// receiptPrinter.js

import { supabase } from '../supabaseClient'

const RECEIPT_WIDTH = 32

// ─── Default receipt template (exported so SettingsContext can reuse) ────────

export const DEFAULT_RECEIPT_TEMPLATE = {
  // Header
  headerTitle: '{gymName}',
  headerSubtitle: 'Membership Receipt',

  // Family plan section
  familySectionTitle: 'Family Plan Members',
  familyNameFormat: 'name {n}',
  familyPhoneFormat: 'phone {n}',
  showFamilyPhones: true,
  familySeparator: 'dash', // 'none' | 'blank' | 'dash'

  // Single member labels
  singleNameLabel: 'name 1',
  singlePhoneLabel: 'phone 1',
  showSinglePhone: true,

  // Field labels (inline = "label: value", aligned = right-aligned value)
  classLabel: 'class:',
  planLabel: 'plan:',
  startLabel: 'start:',
  endLabel: 'end:',
  notesLabel: 'notes:',
  basePriceLabel: 'base price:',
  discountLabel: 'discount:',
  totalPaidLabel: 'total paid:',

  // Footer
  footerMessage: 'Thank you!',
  instagramCaption: 'Follow us on Instagram',
  instagramUrl: 'https://www.instagram.com/your_gym_handle',
  showInstagramQR: true,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fillTemplate(str, vars) {
  if (!str) return ''
  let result = str
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value ?? '')
  }
  return result
}

function classMemberDisplayName(member) {
  const name = `${member.first_name || ''} ${member.last_name || ''}`.trim()
  return name || 'Walk-in Customer'
}

function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function formatDate(date) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatMoney(value) {
  return `$${Number(value ?? 0).toFixed(2)}`
}

function centerLine(text, width = RECEIPT_WIDTH) {
  if (text.length >= width) return text
  const padLeft = Math.floor((width - text.length) / 2)
  return ' '.repeat(padLeft) + text
}

function ruleLine(char = '-', width = RECEIPT_WIDTH) {
  return char.repeat(width)
}

function labelValueLine(label, value, width = RECEIPT_WIDTH) {
  const gap = Math.max(1, width - label.length - value.length)
  return `${label}${' '.repeat(gap)}${value}`
}

// ─── Build receipt text from template ────────────────────────────────────────

/**
 * @param {object} member - The member record
 * @param {array}  familyMembers - Family plan members (empty for non-family)
 * @param {object} settings - { gymName, receiptTemplate }
 */
export function buildReceiptText(member, familyMembers = [], settings = {}) {
  const gymName = settings.gymName || 'J-GYM'
  const tpl = { ...DEFAULT_RECEIPT_TEMPLATE, ...(settings.receiptTemplate || {}) }

  const lines = []

  // ─── Header ──────────────────────────────────────────────
  const headerTitle = fillTemplate(tpl.headerTitle, { gymName })
  if (headerTitle) lines.push(centerLine(headerTitle))
  if (tpl.headerSubtitle) lines.push(centerLine(tpl.headerSubtitle))
  lines.push(ruleLine('='))

  // ─── Family Plan Members OR Single Member ────────────────
  if (member.subscription_type === 'family' && familyMembers.length > 0) {
    if (tpl.familySectionTitle) {
      lines.push(centerLine(tpl.familySectionTitle))
      lines.push(ruleLine('-'))
    }

    familyMembers.forEach((fm, index) => {
      const n = index + 1
      const fmName = `${fm.first_name || ''} ${fm.last_name || ''}`.trim() || 'Unknown'
      lines.push(`${fillTemplate(tpl.familyNameFormat, { n, name: fmName })}: ${fmName}`)

      if (tpl.showFamilyPhones && fm.phone_number) {
        lines.push(`${fillTemplate(tpl.familyPhoneFormat, { n, phone: fm.phone_number })}: ${fm.phone_number}`)
      }

      // Separator between members (not after the last one)
      if (index < familyMembers.length - 1) {
        if (tpl.familySeparator === 'dash') {
          lines.push(ruleLine('-'))
        } else if (tpl.familySeparator === 'blank') {
          lines.push('')
        }
      }
    })

    lines.push(ruleLine('-'))
  } else {
    // Single member
    const displayName = classMemberDisplayName(member)
    const nameLabel = fillTemplate(tpl.singleNameLabel, { gymName })
    lines.push(`${nameLabel}: ${displayName}`)

    if (tpl.showSinglePhone && member.phone_number) {
      lines.push(`${tpl.singlePhoneLabel}: ${member.phone_number}`)
    }
  }

  // ─── Class & Plan ────────────────────────────────────────
  if (member.class_type) {
    lines.push(`${tpl.classLabel} ${capitalize(member.class_type)}`)
  }
  lines.push(`${tpl.planLabel} ${capitalize(member.subscription_type)}`)
  lines.push(ruleLine('-'))

  // ─── Dates ───────────────────────────────────────────────
  lines.push(labelValueLine(tpl.startLabel, formatDate(member.start_date)))
  lines.push(labelValueLine(tpl.endLabel, formatDate(member.end_date)))

  // ─── Notes ───────────────────────────────────────────────
  if (member.description) {
    lines.push(tpl.notesLabel)
    const desc = member.description
    for (let i = 0; i < desc.length; i += RECEIPT_WIDTH) {
      lines.push(desc.substring(i, i + RECEIPT_WIDTH))
    }
    lines.push(ruleLine('-'))
  }

  // ─── Pricing ─────────────────────────────────────────────
  lines.push(labelValueLine(tpl.basePriceLabel, formatMoney(member.base_price)))
  if (member.discount_type && member.discount_type !== 'none') {
    const discountLabel =
      member.discount_type === 'percentage'
        ? `${member.discount_value}%`
        : formatMoney(member.discount_value)
    lines.push(labelValueLine(tpl.discountLabel, discountLabel))
  }
  lines.push(ruleLine('-'))
  lines.push(labelValueLine(tpl.totalPaidLabel, formatMoney(member.amount_paid)))
  lines.push(ruleLine('='))

  // ─── Footer ──────────────────────────────────────────────
  lines.push('')
  if (tpl.footerMessage) {
    lines.push(centerLine(tpl.footerMessage))
  }

  return lines.join('\n')
}

// ─── ESC/POS QR Code ─────────────────────────────────────────────────────────

function concatBytes(chunks) {
  let total = 0
  for (const c of chunks) total += c.length
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out
}

function bytesToBase64(bytes) {
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
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

// ─── Fallback browser print ──────────────────────────────────────────────────

function fallbackBrowserPrint(text) {
  const printWindow = window.open('', '_blank', 'width=380,height=600')
  if (!printWindow) {
    alert(
      'Could not open the print window (pop-up blocked), and the RawBT app was not detected. ' +
      'Please allow pop-ups, or install RawBT on this Android device to print directly to the thermal printer.'
    )
    return
  }
  printWindow.document.write(
    `<pre style="font-family: monospace; font-size: 13px; white-space: pre-wrap; padding: 16px;">${text}\n\n[QR code prints on the thermal printer]</pre>`
  )
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

// Helper to clean the Instagram URL
function sanitizeInstagramUrl(rawUrl) {
  let url = (rawUrl || '').trim();
  if (!url) return '';
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  try {
    const urlObj = new URL(url);
    // Keep only the origin and path, dropping query strings like ?igsh=...
    // which can cause blank pages when scanned by mobile cameras.
    return urlObj.origin + urlObj.pathname;
  } catch {
    return url; // If URL parsing fails, fall back to the raw string
  }
}

// ─── Main entry point ────────────────────────────────────────────────────────

/**
 * @param {object} member - The member record
 * @param {object} settings - Full settings object from SettingsContext
 *                            (must contain gymName and receiptTemplate)
 */
export async function printReceiptViaRawBT(member, settings = {}) {
  let familyMembers = []

  if (member.subscription_type === 'family') {
    try {
      let query = supabase.from('members').select('first_name, last_name, phone_number')

      if (member.start_date) {
        query = query.eq('start_date', member.start_date)
      }
      if (member.end_date) {
        query = query.eq('end_date', member.end_date)
      }
      query = query.eq('subscription_type', 'family')

      const { data, error } = await query
      if (!error && data) {
        familyMembers = data
      }
    } catch (err) {
      console.error('Error fetching family members for receipt:', err)
    }
  }

  const text = buildReceiptText(member, familyMembers, settings)
  const tpl = { ...DEFAULT_RECEIPT_TEMPLATE, ...(settings.receiptTemplate || {}) }

  try {
    const enc = new TextEncoder()
    const chunks = [enc.encode(text + '\n')]

    if (tpl.showInstagramQR && tpl.instagramUrl) {
      // Clean the URL to ensure it scans correctly on all phones
      const cleanUrl = sanitizeInstagramUrl(tpl.instagramUrl);

      if (tpl.instagramCaption) {
        chunks.push(enc.encode(centerLine(tpl.instagramCaption) + '\n'))
      }
      chunks.push(escposQRCode(cleanUrl, { size: 6 }))
    }

    chunks.push(enc.encode('\n\n\n'))

    const payload = concatBytes(chunks)
    const encoded = bytesToBase64(payload)
    const url = `rawbt:base64,${encoded}`
    window.location.href = url
  } catch (err) {
    console.error('RawBT print failed, falling back to browser print dialog:', err)
    fallbackBrowserPrint(text)
  }
}