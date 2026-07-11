export const GYM_NAME = 'J-GYM'
export const INSTAGRAM_URL = 'https://www.instagram.com/j_gym_ehden?igsh=ZmkxbG84MjVnMXI0' 

const LINE_WIDTH = 32

const esc = (...codes) => String.fromCharCode(...codes)

const ESC_INIT = esc(0x1b, 0x40)
const ALIGN_LEFT = esc(0x1b, 0x61, 0)
const ALIGN_CENTER = esc(0x1b, 0x61, 1)
const BOLD_ON = esc(0x1b, 0x45, 1)
const BOLD_OFF = esc(0x1b, 0x45, 0)
const SIZE_NORMAL = esc(0x1d, 0x21, 0x00)
const SIZE_DOUBLE = esc(0x1d, 0x21, 0x11)
const FEED_CUT = '\n\n\n\n'

const divider = () => '-'.repeat(LINE_WIDTH) + '\n'

const row = (label, value) => {
  const line = `${label}${value}`
  return line.length > LINE_WIDTH ? line + '\n' : line + '\n'
}

const formatDate = (isoDate) => {
  if (!isoDate) return '-'
  const d = new Date(isoDate)
  return isNaN(d) ? isoDate : d.toLocaleDateString()
}

const SUBSCRIPTION_LABELS = {
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: '2 Weeks',
  triweekly: '3 Weeks',
  monthly: 'Monthly',
  custom: 'Custom',
}

// ---- ESC/POS QR code helpers ----
// GS ( k command family — supported by nearly all ESC/POS thermal printers,
// including the ones RawBT talks to.

const qrCommand = (fn, pL, pH, cn, data = '') => {
  return esc(0x1d, 0x28, 0x6b, pL, pH, cn, fn) + data
}

const buildQRCode = (text, moduleSize = 6) => {
  let out = ''

  // 1) Select model (model 2, most common)
  out += esc(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00)

  // 2) Set module size (1-16 px per module)
  out += esc(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, moduleSize)

  // 3) Set error correction level (48=L, 49=M, 50=Q, 51=H)
  out += esc(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31)

  // 4) Store data in the symbol storage area
  const dataBytes = new TextEncoder().encode(text)
  const storeLen = dataBytes.length + 3 // cn + fn + m + data
  const pL = storeLen & 0xff
  const pH = (storeLen >> 8) & 0xff
  out += esc(0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30) + text

  // 5) Print the symbol
  out += esc(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30)

  return out
}

export function buildReceiptText(member) {
  const discountLine =
    member.discount_type && member.discount_type !== 'none' && Number(member.discount_value) > 0
      ? `Discount: ${
          member.discount_type === 'percentage'
            ? `${member.discount_value}%`
            : `$${Number(member.discount_value).toFixed(2)}`
        }\n`
      : ''

  let r = ''
  r += ESC_INIT
  r += ALIGN_CENTER
  r += SIZE_DOUBLE
  r += `${GYM_NAME}\n`
  r += SIZE_NORMAL
  r += 'Membership Receipt\n'
  r += divider()
  r += ALIGN_LEFT
  r += row('Member: ', `${member.first_name || ''} ${member.last_name || ''}`.trim() || 'Walk-in Customer')
  r += row('Phone: ', member.phone_number || '-')
  r += row('Plan: ', SUBSCRIPTION_LABELS[member.subscription_type] || member.subscription_type)
  r += row('Start: ', formatDate(member.start_date))
  r += row('End: ', formatDate(member.end_date))
  r += divider()
  r += row('Base Price: ', `$${Number(member.base_price).toFixed(2)}`)
  if (discountLine) r += discountLine
  r += divider()
  r += BOLD_ON
  r += SIZE_DOUBLE
  r += `TOTAL: $${Number(member.amount_paid).toFixed(2)}\n`
  r += SIZE_NORMAL
  r += BOLD_OFF
  r += divider()
  r += ALIGN_CENTER
  r += `${new Date().toLocaleString()}\n`
  r += 'Thank you!\n'

  // --- Instagram QR code ---
  r += '\nFollow us on Instagram\n'
  r += buildQRCode(INSTAGRAM_URL)
  r += '\n'

  r += FEED_CUT

  return r
}

export function printReceiptViaRawBT(member) {
  const receiptText = buildReceiptText(member)
  const encoded = encodeURIComponent(receiptText)
  const intentUrl = `intent:${encoded}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`
  window.location.href = intentUrl
}