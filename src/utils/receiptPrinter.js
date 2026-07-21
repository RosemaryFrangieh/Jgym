// receiptPrinter.js
// Prints a receipt to a Bluetooth thermal printer via the RawBT
// Android app (https://www.rawbt.ru/). RawBT registers a "rawbt:" URL scheme —
// navigating to rawbt:base64,<data> hands the print job straight to the app.
// The payload is raw bytes (base64-encoded), so we can mix the plain-text
// receipt with ESC/POS QR-code commands (GS ( k) that the printer renders
// natively. Falls back to the browser print dialog if RawBT isn't available
// (e.g. testing on desktop).
​
const RECEIPT_WIDTH = 32 // characters per line, standard for 58mm thermal paper
​
function classMemberDisplayName(member) {
  const name = `${member.first_name || ''} ${member.last_name || ''}`.trim()
  return name || 'Walk-in Customer'
}
​
function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}
​
function formatDate(date) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
​
function formatMoney(value) {
  return `$${Number(value ?? 0).toFixed(2)}`
}
​
function centerLine(text, width = RECEIPT_WIDTH) {
  if (text.length >= width) return text
  const padLeft = Math.floor((width - text.length) / 2)
  return ' '.repeat(padLeft) + text
}
​
function ruleLine(char = '-', width = RECEIPT_WIDTH) {
  return char.repeat(width)
}
​
function labelValueLine(label, value, width = RECEIPT_WIDTH) {
  const gap = Math.max(1, width - label.length - value.length)
  return `${label}${' '.repeat(gap)}${value}`
}
​
/**
 * Builds the plain-text receipt body for any membership-like record
 * (works for both regular members and class members since it only
 * touches fields common to both tables).
 */
function buildReceiptText(member) {
  const lines = []
​
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
  lines.push(ruleLine('-'))
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
​
  return lines.join('\n')
}
​
/**
 * The text encoded inside the QR code. Scanning it shows the membership
 * details. Change the returned string if you'd rather encode something else
 * (e.g. a check-in URL like `https://your-gym.app/verify/${member.id}`).
 */
function buildQRData(member) {
  const parts = ['J-GYM Membership', `Name: ${classMemberDisplayName(member)}`]
  if (member.phone_number) parts.push(`Phone: ${member.phone_number}`)
  parts.push(`Plan: ${capitalize(member.subscription_type)}`)
  parts.push(`Valid: ${formatDate(member.start_date)} - ${formatDate(member.end_date)}`)
  parts.push(`Paid: ${formatMoney(member.amount_paid)}`)
  return parts.join('\n')
}
​
// ─── Byte helpers ─────────────────────────────────────────────────────────────
​
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
​
function bytesToBase64(bytes) {
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}
​
/**
 * Builds the ESC/POS command bytes that make the printer render a QR code.
 * Uses the standard GS ( k QR functions (model 2), supported by virtually all
 * 58mm/80mm thermal printers. `size` is the module (dot) size 1–16.
 */
function escposQRCode(dataStr, { size = 6, errorCorrection = 0x31 } = {}) {
  const enc = new TextEncoder()
  const data = enc.encode(dataStr)
​
  // Store-data length includes the 3 following bytes (cn, fn, m).
  const storeLen = data.length + 3
  const pL = storeLen & 0xff
  const pH = (storeLen >> 8) & 0xff
​
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
​
  return concatBytes([header, data, footer])
}
​
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
​
/**
 * Sends a receipt (with a QR code) to the RawBT app for printing on a paired
 * Bluetooth thermal printer. Accepts a member/class_member record.
 */
export function printReceiptViaRawBT(member) {
  const text = buildReceiptText(member)
​
  try {
    // Assemble the job as raw bytes: plain-text receipt, a caption, the ESC/POS
    // QR-code commands, then a paper feed. RawBT base64-decodes this and streams
    // the bytes to the printer.
    const enc = new TextEncoder()
    const payload = concatBytes([
      enc.encode(text + '\n'),
      enc.encode(centerLine('Scan to verify membership') + '\n'),
      escposQRCode(buildQRData(member)),
      enc.encode('\n\n\n'), // feed paper before cut
    ])
    const encoded = bytesToBase64(payload)
    const url = `rawbt:base64,${encoded}`
    window.location.href = url
  } catch (err) {
    console.error('RawBT Print failed, falling back to browser print dialog:', err)
    fallbackBrowserPrint(text)
  }
}