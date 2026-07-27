// receiptPrinter.js
import { supabase } from '../supabaseClient'

const RECEIPT_WIDTH = 32

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

function buildReceiptText(member, familyMembers = []) {
  const lines = []

  lines.push(centerLine('J-GYM'))
  lines.push(centerLine('Membership Receipt'))
  lines.push(ruleLine('='))
  
  // ─── Family Plan Multiple Names & Phones ───────────────────
  if (member.subscription_type === 'family' && familyMembers.length > 0) {
    lines.push(centerLine('Family Plan Members'))
    lines.push(ruleLine('-'))
    
    familyMembers.forEach((fm, index) => {
      const fmName = `${fm.first_name || ''} ${fm.last_name || ''}`.trim() || 'Unknown'
      lines.push(`Name ${index + 1}: ${fmName}`)
      if (fm.phone_number) {
        lines.push(`Phone ${index + 1}: ${fm.phone_number}`)
      }
    })
    
    lines.push(ruleLine('-'))
  } else {
    // Standard single member info
    lines.push(`Name:  ${classMemberDisplayName(member)}`)
    if (member.phone_number) lines.push(`Phone: ${member.phone_number}`)
  }
  
  if (member.class_type) lines.push(`Class: ${capitalize(member.class_type)}`)
  lines.push(`Plan:  ${capitalize(member.subscription_type)}`)
  lines.push(ruleLine('-'))
  lines.push(labelValueLine('Start:', formatDate(member.start_date)))
  lines.push(labelValueLine('End:', formatDate(member.end_date)))
  
  // Print description/notes if they exist (helps if they type names here instead)
  if (member.description) {
    lines.push('Notes:')
    const desc = member.description
    for (let i = 0; i < desc.length; i += RECEIPT_WIDTH) {
      lines.push(desc.substring(i, i + RECEIPT_WIDTH))
    }
    lines.push(ruleLine('-'))
  }

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

export async function printReceiptViaRawBT(member) {
  let familyMembers = []

  // If it's a family plan, fetch all members sharing the EXACT same start_date and end_date
  // This links family members together reliably without needing a member_uid
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

  const text = buildReceiptText(member, familyMembers)

  try {
    const enc = new TextEncoder()
    const payload = concatBytes([
      enc.encode(text + '\n'),
      enc.encode(centerLine('Follow us on Instagram') + '\n'),
      escposQRCode(buildQRData()),
      enc.encode('\n\n\n'),
    ])
    const encoded = bytesToBase64(payload)
    const url = `rawbt:base64,${encoded}`
    window.location.href = url
  } catch (err) {
    console.error('RawBT print failed, falling back to browser print dialog:', err)
    fallbackBrowserPrint(text)
  }
}