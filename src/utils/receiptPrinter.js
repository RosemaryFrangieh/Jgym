// ─── receiptPrinter.js ────────────────────────────────────────────────────────
// Printing layer. All text/layout logic now lives in receiptCore.js so the
// live Settings preview and the physical print can NEVER drift apart.
//
// Drop-in replacement: it still exports DEFAULT_RECEIPT_TEMPLATE and
// buildReceiptText (re-exported from the core), plus printReceiptViaRawBT.

import { supabase } from '../supabaseClient'
import {
  DEFAULT_RECEIPT_TEMPLATE,
  PAPER_WIDTHS,
  buildReceiptText,
  computeTotals,
  buildAllDemoReceipts,
  DEMO_CASES,
} from './receiptCore'

export {
  DEFAULT_RECEIPT_TEMPLATE,
  PAPER_WIDTHS,
  buildReceiptText,
  computeTotals,
  buildAllDemoReceipts,
  DEMO_CASES,
}

// ─── Family fetch (more robust than before) ───────────────────────────────
// Old logic matched on start_date + end_date + subscription_type, which can
// accidentally group two unrelated families that share the same dates.
// Preferred: a `family_id` column. We use it when present and fall back to the
// legacy date match so nothing breaks before you run the migration.
async function fetchFamilyMembers(member) {
  try {
    const cols = 'first_name, last_name, phone_number'
    if (member.family_id) {
      const { data, error } = await supabase
        .from('members').select(cols)
        .eq('family_id', member.family_id)
        .order('created_at', { ascending: true })
      if (!error && data?.length) return data
    }
    // Legacy fallback
    let q = supabase.from('members').select(cols).eq('subscription_type', 'family')
    if (member.start_date) q = q.eq('start_date', member.start_date)
    if (member.end_date) q = q.eq('end_date', member.end_date)
    const { data, error } = await q
    if (!error && data) return data
  } catch (err) {
    console.error('Error fetching family members for receipt:', err)
  }
  return []
}

// ─── ESC/POS QR code ──────────────────────────────────────────────────
function concatBytes(chunks) {
  let total = 0
  for (const c of chunks) total += c.length
  const out = new Uint8Array(total)
  let off = 0
  for (const c of chunks) { out.set(c, off); off += c.length }
  return out
}
function bytesToBase64(bytes) {
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}
function escposQRCode(dataStr, { size = 6, errorCorrection = 0x31 } = {}) {
  const enc = new TextEncoder()
  const data = enc.encode(dataStr)
  const storeLen = data.length + 3
  const pL = storeLen & 0xff
  const pH = (storeLen >> 8) & 0xff
  const header = Uint8Array.from([
    0x1b, 0x61, 0x01,
    0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00,
    0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size,
    0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, errorCorrection,
    0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30,
  ])
  const footer = Uint8Array.from([
    0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30,
    0x1b, 0x61, 0x00,
  ])
  return concatBytes([header, data, footer])
}

function sanitizeInstagramUrl(rawUrl) {
  let url = (rawUrl || '').trim()
  if (!url) return ''
  if (!/^https?:\/\//.test(url)) url = 'https://' + url
  try {
    const u = new URL(url)
    return u.origin + u.pathname   // drop ?igsh=... which breaks some scanners
  } catch (err) {
    console.error('Instagram URL failed to parse, using raw value:', rawUrl, err)
    return url
  }
}

function centerForWidth(text, width) {
  const t = String(text ?? '')
  if (t.length >= width) return t
  return ' '.repeat(Math.floor((width - t.length) / 2)) + t
}

// ─── Fallback browser print ─────────────────────────────────────────
function fallbackBrowserPrint(text) {
  const w = window.open('', '_blank', 'width=380,height=600')
  if (!w) {
    alert(
      'Could not open the print window (pop-up blocked), and RawBT was not detected. ' +
      'Allow pop-ups, or install RawBT on this Android device to print to the thermal printer.'
    )
    return
  }
  w.document.write(
    `<pre style="font-family:monospace;font-size:13px;white-space:pre-wrap;padding:16px;">${text}\n\n[QR code prints on the thermal printer]</pre>`
  )
  w.document.close()
  w.focus()
  w.print()
}

// ─── Optional: generate a short human receipt number ──────────────────────────
function receiptNumberFrom(member) {
  if (member.receipt_no) return member.receipt_no
  if (member.id != null) return String(member.id).slice(-6)
  return String(Date.now()).slice(-6)
}

// ─── Send one payload to RawBT ─────────────────────────────────────────
// Small helper so both the text job and the QR job go through the exact
// same encode/dispatch path.
function sendToRawBT(chunks) {
  const encoded = bytesToBase64(concatBytes(chunks))
  window.location.href = `rawbt:base64,${encoded}`
}

// ─── Main entry point ─────────────────────────────────────────────────
// @param member   member record
// @param settings full settings object from SettingsContext ({ gymName, receiptTemplate })
//
// NOTE: the receipt text and the Instagram QR are now sent to RawBT as TWO
// separate jobs (with a short delay between them) instead of one combined
// payload. Packing everything into a single base64 blob meant that on long
// receipts (family plans, long notes) the QR bytes — appended at the very
// end of the stream — were the part most likely to get silently dropped or
// truncated by RawBT/the printer, while the receipt text above them still
// printed fine. Sending the QR as its own small job avoids that.
export async function printReceiptViaRawBT(member, settings = {}) {
  const tpl = { ...DEFAULT_RECEIPT_TEMPLATE, ...(settings.receiptTemplate || {}) }
  const width = PAPER_WIDTHS[tpl.paperWidth] || PAPER_WIDTHS['58mm']

  const familyMembers = member.subscription_type === 'family'
    ? await fetchFamilyMembers(member)
    : []

  const meta = { receiptNo: receiptNumberFrom(member), dateTime: new Date() }
  const text = buildReceiptText(member, familyMembers, settings, meta)

  try {
    const enc = new TextEncoder()

    // ── Job 1: receipt text ──
    sendToRawBT([enc.encode(text + '\n\n')])

    // ── Job 2: Instagram QR, sent separately after a short delay so RawBT
    // has time to flush job 1 before job 2 arrives. ──
    if (tpl.showInstagramQR && tpl.instagramUrl) {
      const cleanUrl = sanitizeInstagramUrl(tpl.instagramUrl)
      if (cleanUrl) {
        setTimeout(() => {
          try {
            const qrChunks = []
            if (tpl.instagramCaption) {
              qrChunks.push(enc.encode(centerForWidth(tpl.instagramCaption, width) + '\n'))
            }
            // Bigger QR on wide paper.
            qrChunks.push(escposQRCode(cleanUrl, { size: tpl.paperWidth === '80mm' ? 8 : 6 }))
            qrChunks.push(enc.encode('\n\n\n'))
            sendToRawBT(qrChunks)
          } catch (err) {
            console.error('RawBT QR print failed:', err)
          }
        }, 400) // bump this up (e.g. 800) if the QR is still dropped on slower printers
      } else {
        console.warn('showInstagramQR is on but instagramUrl sanitized to empty — skipping QR.')
      }
    }
  } catch (err) {
    console.error('RawBT print failed, falling back to browser print dialog:', err)
    fallbackBrowserPrint(text)
  }
}