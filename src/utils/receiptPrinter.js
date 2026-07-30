import { supabase } from '../supabaseClient'

const RECEIPT_WIDTH = 32 // 58mm thermal printer (32 chars/line)

// ─── Default receipt template ────────────────────────────────────────────────
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
  showFamilyClassAndPlan: false,

  // Single member labels
  singleNameLabel: 'name 1',
  singlePhoneLabel: 'phone 1',
  showSinglePhone: true,

  // Field labels
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
  instagramUrl: 'https://www.instagram.com/j_gym_ehden',
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
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatMoney(value) {
  return `$${Number(value ?? 0).toFixed(2)}`
}

function centerLine(text, width = RECEIPT_WIDTH) {
  if (!text) return ''
  if (text.length >= width) return text
  const padLeft = Math.floor((width - text.length) / 2)
  return ' '.repeat(padLeft) + text
}

function ruleLine(char = '-', width = RECEIPT_WIDTH) {
  return char.repeat(width)
}

// Wrap a long string into multiple lines no longer than `width`.
function wrapText(text, width = RECEIPT_WIDTH) {
  if (!text) return []
  const words = String(text).split(/\s+/)
  const lines = []
  let current = ''
  for (const w of words) {
    if (!current) {
      current = w
    } else if ((current + ' ' + w).length <= width) {
      current += ' ' + w
    } else {
      lines.push(current)
      current = w
    }
  }
  if (current) lines.push(current)
  // Hard-break any word still longer than width
  return lines.flatMap(line => {
    if (line.length <= width) return [line]
    const out = []
    for (let i = 0; i < line.length; i += width) out.push(line.slice(i, i + width))
    return out
  })
}

// Label : value with right-aligned value. If value doesn't fit on the same line,
// it drops onto the next line(s) properly wrapped.
function labelValueLine(label, value, width = RECEIPT_WIDTH) {
  const v = String(value ?? '')
  const l = String(label ?? '')
  if (!l) return wrapText(v, width)
  if (l.length + 1 + v.length <= width) {
    const gap = Math.max(1, width - l.length - v.length)
    return [`${l}${' '.repeat(gap)}${v}`]
  }
  return [l, ...wrapText(v, width)]
}

// ─── Build receipt text from template ────────────────────────────────────────

/**
 * @param {object} member        - The member record
 * @param {array}  familyMembers - Family plan members (empty for non-family)
 * @param {object} settings      - { gymName, receiptTemplate }
 * @returns {string}
 */
export function buildReceiptText(member, familyMembers = [], settings = {}) {
  const gymName = settings.gymName || 'J-GYM'
  const tpl = { ...DEFAULT_RECEIPT_TEMPLATE, ...(settings.receiptTemplate || {}) }

  const member0 = member || {}
  const family = Array.isArray(familyMembers) ? familyMembers : []
  const lines = []

  // ─── Header ──────────────────────────────────────────────
  const headerTitle = fillTemplate(tpl.headerTitle, { gymName })
  if (headerTitle) lines.push(centerLine(headerTitle))
  if (tpl.headerSubtitle) lines.push(centerLine(tpl.headerSubtitle))
  lines.push(ruleLine('='))

  // ─── Family Plan Members OR Single Member ────────────────
  const isFamily = member0.subscription_type === 'family' && family.length > 0

  if (isFamily) {
    if (tpl.familySectionTitle) {
      lines.push(centerLine(tpl.familySectionTitle))
      lines.push(ruleLine('-'))
    }

    family.forEach((fm, index) => {
      const n = index + 1
      const fmName = classMemberDisplayName(fm)

      // If the user's format contains {name}, render it as a single line.
      // Otherwise, render "format: name" (legacy behavior).
      if (tpl.familyNameFormat && tpl.familyNameFormat.includes('{name}')) {
        lines.push(...wrapText(fillTemplate(tpl.familyNameFormat, { n, name: fmName }), RECEIPT_WIDTH))
      } else {
        const lbl = fillTemplate(tpl.familyNameFormat, { n }) || `name ${n}`
        lines.push(...labelValueLine(lbl, fmName))
      }

      if (tpl.showFamilyPhones && fm.phone_number) {
        const phoneLbl = fillTemplate(tpl.familyPhoneFormat, { n, phone: fm.phone_number }) || `phone ${n}`
        if (tpl.familyPhoneFormat && tpl.familyPhoneFormat.includes('{phone}')) {
          lines.push(...wrapText(phoneLbl, RECEIPT_WIDTH))
        } else {
          lines.push(...labelValueLine(phoneLbl, fm.phone_number))
        }
      }

      if (tpl.showFamilyClassAndPlan) {
        if (fm.class_type) lines.push(...labelValueLine(tpl.classLabel, capitalize(fm.class_type)))
        if (fm.subscription_type) lines.push(...labelValueLine(tpl.planLabel, capitalize(fm.subscription_type)))
      }

      if (index < family.length - 1) {
        if (tpl.familySeparator === 'dash') lines.push(ruleLine('-'))
        else if (tpl.familySeparator === 'blank') lines.push('')
      }
    })

    lines.push(ruleLine('-'))
  } else {
    const displayName = classMemberDisplayName(member0)
    const nameLabel = fillTemplate(tpl.singleNameLabel, { gymName }) || 'name 1'
    if (tpl.singleNameLabel && tpl.singleNameLabel.includes('{name}')) {
      lines.push(...wrapText(fillTemplate(tpl.singleNameLabel, { name: displayName }), RECEIPT_WIDTH))
    } else {
      lines.push(...labelValueLine(nameLabel, displayName))
    }
    if (tpl.showSinglePhone && member0.phone_number) {
      if (tpl.singlePhoneLabel && tpl.singlePhoneLabel.includes('{phone}')) {
        lines.push(...wrapText(fillTemplate(tpl.singlePhoneLabel, { phone: member0.phone_number }), RECEIPT_WIDTH))
      } else {
        lines.push(...labelValueLine(tpl.singlePhoneLabel, member0.phone_number))
      }
    }
  }

  // ─── Class & Plan ────────────────────────────────────────
  if (member0.class_type) {
    lines.push(...labelValueLine(tpl.classLabel, capitalize(member0.class_type)))
  }
  if (member0.subscription_type) {
    lines.push(...labelValueLine(tpl.planLabel, capitalize(member0.subscription_type)))
  }
  lines.push(ruleLine('-'))

  // ─── Dates ───────────────────────────────────────────────
  lines.push(...labelValueLine(tpl.startLabel, formatDate(member0.start_date)))
  lines.push(...labelValueLine(tpl.endLabel, formatDate(member0.end_date)))

  // ─── Notes ───────────────────────────────────────────────
  if (member0.description) {
    if (tpl.notesLabel) lines.push(tpl.notesLabel)
    lines.push(...wrapText(member0.description, RECEIPT_WIDTH))
    lines.push(ruleLine('-'))
  }

  // ─── Pricing ─────────────────────────────────────────────
  lines.push(...labelValueLine(tpl.basePriceLabel, formatMoney(member0.base_price)))

  if (member0.discount_type && member0.discount_type !== 'none' && Number(member0.discount_value) > 0) {
    const discountLabel =
      member0.discount_type === 'percentage'
        ? `${member0.discount_value}%`
        : formatMoney(member0.discount_value)
    lines.push(...labelValueLine(tpl.discountLabel, discountLabel))
  }

  lines.push(ruleLine('-'))
  lines.push(...labelValueLine(tpl.totalPaidLabel, formatMoney(member0.amount_paid)))
  lines.push(ruleLine('='))

  // ─── Footer ──────────────────────────────────────────────
  lines.push('')
  if (tpl.footerMessage) {
    wrapText(tpl.footerMessage, RECEIPT_WIDTH).forEach(l => lines.push(centerLine(l)))
  }

  return lines.join('\n')
}

// ─── Demo receipts (all cases) ───────────────────────────────────────────────

export function buildAllDemoReceipts(settings = {}) {
  const now = Date.now()
  const day = 86400000

  const cases = [
    {
      title: 'Daily • Single • no discount',
      member: {
        first_name: 'Sami', last_name: 'Khoury',
        phone_number: '+96170123456',
        class_type: 'gym', subscription_type: 'daily',
        start_date: new Date(now).toISOString(),
        end_date: new Date(now + day).toISOString(),
        description: 'Walk-in',
        base_price: 7, discount_type: 'none', discount_value: 0, amount_paid: 7,
      },
      family: [],
    },
    {
      title: 'Weekly • Single • % discount • no phone',
      member: {
        first_name: 'Lara', last_name: 'Haddad',
        phone_number: '',
        class_type: 'zumba', subscription_type: 'weekly',
        start_date: new Date(now).toISOString(),
        end_date: new Date(now + 7 * day).toISOString(),
        description: 'Paid via WhatsApp',
        base_price: 17, discount_type: 'percentage', discount_value: 10, amount_paid: 15.3,
      },
      family: [],
    },
    {
      title: 'Monthly • Single • fixed discount',
      member: {
        first_name: 'Joseph', last_name: 'Elias',
        phone_number: '+96171234567',
        class_type: 'aerobics', subscription_type: 'monthly',
        start_date: new Date(now).toISOString(),
        end_date: new Date(now + 30 * day).toISOString(),
        description: '',
        base_price: 40, discount_type: 'fixed', discount_value: 5, amount_paid: 35,
      },
      family: [],
    },
    {
      title: 'Family • 3 members • all phones',
      member: {
        first_name: 'John', last_name: 'Doe',
        phone_number: '+1234567890',
        class_type: 'gym', subscription_type: 'family',
        start_date: new Date(now).toISOString(),
        end_date: new Date(now + 30 * day).toISOString(),
        description: 'Paid in cash',
        base_price: 100, discount_type: 'percentage', discount_value: 10, amount_paid: 90,
      },
      family: [
        { first_name: 'John', last_name: 'Doe', phone_number: '+1234567890' },
        { first_name: 'Jane', last_name: 'Doe', phone_number: '+1234567891' },
        { first_name: 'Jim', last_name: 'Doe', phone_number: '+1234567892' },
      ],
    },
    {
      title: 'Family • mixed phones',
      member: {
        first_name: 'Maria', last_name: 'Saade',
        phone_number: '+96170000000',
        class_type: 'gym', subscription_type: 'family',
        start_date: new Date(now).toISOString(),
        end_date: new Date(now + 30 * day).toISOString(),
        description: '',
        base_price: 100, discount_type: 'none', discount_value: 0, amount_paid: 100,
      },
      family: [
        { first_name: 'Maria', last_name: 'Saade', phone_number: '+96170000000' },
        { first_name: 'Charbel', last_name: 'Saade', phone_number: '' },
        { first_name: 'Layla', last_name: 'Saade', phone_number: '+96171111111' },
      ],
    },
    {
      title: 'Triweekly • long notes (wraps)',
      member: {
        first_name: 'Antoine', last_name: 'Abou Khalil',
        phone_number: '+96170998877',
        class_type: 'crossfit', subscription_type: 'triweekly',
        start_date: new Date(now).toISOString(),
        end_date: new Date(now + 21 * day).toISOString(),
        description: 'Customer requested to freeze the subscription for 3 days due to travel. Will resume next Monday.',
        base_price: 32, discount_type: 'none', discount_value: 0, amount_paid: 32,
      },
      family: [],
    },
  ]

  return cases.map(c => ({
    title: c.title,
    text: buildReceiptText(c.member, c.family, settings),
  }))
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
    0x1b, 0x61, 0x01,                                     // center align
    0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00, // model QR
    0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size,       // module size
    0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, errorCorrection,
    0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30,           // store data
  ])
  const footer = Uint8Array.from([
    0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30,       // print QR
    0x1b, 0x61, 0x00,                                     // reset align
  ])

  return concatBytes([header, data, footer])
}

// ─── Fallback browser print ──────────────────────────────────────────────────

function fallbackBrowserPrint(text, showQR, instagramUrl, instagramCaption) {
  const printWindow = window.open('', '_blank', 'width=380,height=600')
  if (!printWindow) {
    alert(
      'Could not open the print window (pop-up blocked), and RawBT was not detected. ' +
      'Please allow pop-ups or install RawBT on this Android device.'
    )
    return
  }
  const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  printWindow.document.write(`
    <html><head><title>Receipt</title>
    <style>
      body { margin:0; padding:16px; font-family: 'Courier New', monospace; font-size:12px; white-space:pre; color:#000; }
      .qr-wrap { text-align:center; margin-top:12px; }
      .qr-wrap img { width:140px; height:140px; }
      .cap { font-size:11px; margin-top:4px; }
    </style></head>
    <body>${safe}
    ${showQR && instagramUrl ? `<div class="qr-wrap">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(instagramUrl)}" alt="QR" />
      ${instagramCaption ? `<div class="cap">${instagramCaption}</div>` : ''}
    </div>` : ''}
    </body></html>
  `)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => printWindow.print(), 250)
}

function sanitizeInstagramUrl(rawUrl) {
  let url = (rawUrl || '').trim()
  if (!url) return ''
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url
  try {
    const u = new URL(url)
    return u.origin + u.pathname // drop ?igsh=... which can blank-screen some scanners
  } catch {
    return url
  }
}

// ─── Main entry point ────────────────────────────────────────────────────────

/**
 * @param {object} member   - The member record
 * @param {object} settings - Full settings object from SettingsContext
 */
export async function printReceiptViaRawBT(member, settings = {}) {
  let familyMembers = []

  if (member?.subscription_type === 'family') {
    try {
      let query = supabase.from('members').select('first_name, last_name, phone_number')
      if (member.start_date) query = query.eq('start_date', member.start_date)
      if (member.end_date)   query = query.eq('end_date', member.end_date)
      query = query.eq('subscription_type', 'family')
      const { data, error } = await query
      if (!error && data) familyMembers = data
    } catch (err) {
      console.error('Error fetching family members for receipt:', err)
    }
  }

  const tpl = { ...DEFAULT_RECEIPT_TEMPLATE, ...(settings.receiptTemplate || {}) }
  const text = buildReceiptText(member, familyMembers, settings)

  try {
    const enc = new TextEncoder()
    const chunks = [enc.encode(text + '\n')]

    if (tpl.showInstagramQR && tpl.instagramUrl) {
      const cleanUrl = sanitizeInstagramUrl(tpl.instagramUrl)
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
    fallbackBrowserPrint(
      text,
      tpl.showInstagramQR,
      sanitizeInstagramUrl(tpl.instagramUrl),
      tpl.instagramCaption,
    )
  }
}