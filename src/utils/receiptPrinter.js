// receiptPrinter.js
import { supabase } from '../supabaseClient' // Added to fetch family members

const RECEIPT_WIDTH = 32 // characters per line, standard for 58mm thermal paper

// The QR code on every receipt links to this Instagram profile.
// Hard-code your gym's Instagram URL here.
const INSTAGRAM_URL = 'https://www.instagram.com/your_gym_handle'

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

/**
 * Builds the plain-text receipt body for any membership-like record.
 * Now accepts an optional `familyMembers` array to print all names/phones
 * if the subscription_type is 'family'.
 */
function buildReceiptText(member, familyMembers = []) {
  const lines = []

  lines.push(centerLine('J-GYM'))
  lines.push(centerLine('Membership Receipt'))
  lines.push(ruleLine('='))
  lines.push(`Name:  ${classMemberDisplayName(member)}`)
  if (member.phone_number) lines.push(`Phone: ${member.phone_number}`)
  if (member.class_type) lines.push(`Class: ${capitalize(member.class_type)}`)
  lines.push(`Plan:  ${capitalize(member.subscription_type)}`)
  lines.push(ruleLine('-'))
  lines.push(labelValueLine('Start:', formatDate(member.start_date)))
  lines.push(labelValueLine('End:', formatDate(member.end_date)))
  
  // ─── Family Members List ───────────────────────────────────
  if (member.subscription_type === 'family' && familyMembers.length > 1) {
    lines.push(centerLine('Family Members'))
    
    // Remove duplicates just in case the primary member is also in the fetch result
    const uniqueMembers = familyMembers.filter((m, index, self) =>
      index === self.findIndex((t) => (
        (t.first_name === m.first_name && t.last_name === m.last_name) && t.phone_number === m.phone_number
      ))
    )
    
    uniqueMembers.forEach((fm, index) => {
      const fmName = classMemberDisplayName(fm)
      lines.push(`${index + 1}. ${fmName}`)
      if (fm.phone_number) lines.push(`   Ph: ${fm.phone_number}`)
    })
    
    lines.push(ruleLine('-'))
  }
  // ───────────────────────────────────────────────────────────

  lines.push(labelValueLine('Base Price:', formatMoney(member.base_price)))
  if (member.discount_type && member.discount_type !== 'none') {
    const discountLabel =
      member.discount_type === 'percentage'
        ? `${member.discount_value}%`
        : formatMoney(member.discount_value)
    lines.push(labelValueLine('Discount:', discountLabel))
  }
  lines.push(ruleLine('-'))
  lines.push(labelValueLine('TOTAL PAID:', formatMoney(member.amount_paid)))
  lines.push(ruleLine('='))
  lines.push('')
  lines.push(centerLine('Thank you!'))
  lines.push('') // spacing before the QR code

  return lines.join('\n')
}

/**
 * The data encoded inside the QR code. 
 */
function buildQRData() {
  return INSTAGRAM_URL
}

// ─── Byte helpers ─────────────────────────────────────────────────────────────

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

/**
 * Builds the ESC/POS command bytes that make the printer render a QR code.
 */
function escposQRCode(dataStr, { size = 6, errorCorrection = 0x31 } = {}) {
  const enc = new TextEncoder()
  const data = enc.encode(dataStr)

  const storeLen = data.length + 3
  const pL = storeLen & 0xff
  const pH = (storeLen >> 8) & 0xff

  const header = Uint8Array.from([
    0x1b, 0x61, 0x01, // ESC a 1  -> center align
    0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00, // select QR model 2
    0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size, // module size
    0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, errorCorrection, // error correction level
    0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30, // store the data (data follows)
  ])
  const footer = Uint8Array.from([
    0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30, // print the stored QR code
    0x1b, 0x61, 0x00, // ESC a 0  -> back to left align
  ])

  return concatBytes([header, data, footer])
}

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

/**
 * Sends a receipt (with a QR code linking to Instagram) to the RawBT app.
 * Now async to allow fetching family members if the plan is 'family'.
 */
export async function printReceiptViaRawBT(member) {
  let familyMembers = []

  // If it's a family plan, fetch all members sharing the same start date and UID
  if (member.subscription_type === 'family') {
    try {
      let query = supabase.from('members').select('first_name, last_name, phone_number')
      
      // Group by member_uid (best method), fallback to phone_number
      if (member.member_uid) {
        query = query.eq('member_uid', member.member_uid)
      } else if (member.phone_number) {
        query = query.eq('phone_number', member.phone_number)
      } else {
        query = query.eq('first_name', member.first_name).eq('last_name', member.last_name)
      }

      // Crucial: only fetch members who started on the EXACT SAME DATE
      // This prevents old family renewals from printing on the current receipt.
      if (member.start_date) {
        query = query.eq('start_date', member.start_date)
      }

      const { data, error } = await query
      if (!error && data) {
        familyMembers = data
      }
    } catch (err) {
      console.error('Error fetching family members for receipt:', err)
    }
  }

  const text = buildReceiptText(member, familyMembers)

  try {
    const enc = new TextEncoder()
    const payload = concatBytes([
      enc.encode(text + '\n'),
      enc.encode(centerLine('Follow us on Instagram') + '\n'),
      escposQRCode(buildQRData()),
      enc.encode('\n\n\n'), // feed paper before cut
    ])
    const encoded = bytesToBase64(payload)
    const url = `rawbt:base64,${encoded}`
    window.location.href = url
  } catch (err) {
    console.error('RawBT print failed, falling back to browser print dialog:', err)
    fallbackBrowserPrint(text)
  }
}