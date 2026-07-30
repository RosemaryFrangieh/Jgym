// ─── receiptCore.js ──────────────────────────────────────────────────────────
// Pure, dependency-free receipt text engine.
// Works in the browser AND in Node. No supabase / no window in here.
// Import this from receiptPrinter.js (printing) and from the settings preview.
​
// ─── Paper presets ───────────────────────────────────────────────────────────
// Thermal printers are addressed in "columns" of a monospace font.
// 58mm paper  ~= 32 cols, 80mm paper ~= 48 cols.
export const PAPER_WIDTHS = { '58mm': 32, '80mm': 48 }
​
// ─── Default template (superset of the old one, backward compatible) ─────────
export const DEFAULT_RECEIPT_TEMPLATE = {
  // Paper / currency
  paperWidth: '58mm',        // '58mm' | '80mm'
  currencySymbol: '$',
​
  // Header
  headerTitle: '{gymName}',
  headerSubtitle: 'Membership Receipt',
​
  // Receipt meta (NEW)
  showReceiptMeta: true,     // print receipt # + date/time line
  receiptLabel: 'receipt #',
  dateLabel: 'date',
​
  // Family plan section
  familySectionTitle: 'Family Plan Members',
  familyNameFormat: 'name {n}',
  familyPhoneFormat: 'phone {n}',
  showFamilyPhones: true,
  familySeparator: 'dash',   // 'none' | 'blank' | 'dash'
​
  // Single member labels
  singleNameLabel: 'name 1',
  singlePhoneLabel: 'phone 1',
  showSinglePhone: true,
​
  // Field labels
  classLabel: 'class:',
  planLabel: 'plan:',
  startLabel: 'start:',
  endLabel: 'end:',
  notesLabel: 'notes:',
  basePriceLabel: 'base price:',
  discountLabel: 'discount:',
  subtotalLabel: 'subtotal:',   // NEW (base - discount)
  totalPaidLabel: 'total paid:',
  balanceLabel: 'balance due:', // NEW
  changeLabel: 'change:',       // NEW
​
  // Behaviour toggles (NEW)
  showPricing: true,
  showBalance: true,            // show balance due / change when paid != due
  wordWrapNotes: true,
​
  // Footer
  footerMessage: 'Thank you!',
  instagramCaption: 'Follow us on Instagram',
  instagramUrl: 'https://www.instagram.com/j_gym_ehden',
  showInstagramQR: true,
}
​
// ─── Small helpers ───────────────────────────────────────────────────────────
function fillTemplate(str, vars) {
  if (!str) return ''
  let result = str
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value ?? '')
  }
  return result
}
​
function titleCase(str) {
  if (!str) return ''
  return String(str)
    .split(/\s+/)
    .map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ')
}
​
function formatDate(date) {
  if (!date) return '\u2014'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '\u2014'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
​
function formatDateTime(date) {
  const d = date ? new Date(date) : new Date()
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}
​
function money(value, symbol = '$') {
  return `${symbol}${Number(value ?? 0).toFixed(2)}`
}
​
// ─── Line builders (width-aware) ─────────────────────────────────────────────
function centerLine(text, width) {
  const t = String(text ?? '')
  if (t.length >= width) return t.slice(0, width)
  const pad = Math.floor((width - t.length) / 2)
  return ' '.repeat(pad) + t
}
​
function ruleLine(char, width) {
  return char.repeat(width)
}
​
// Word-wrap a long string to `width` columns. Long single words are hard-split.
function wrapText(text, width) {
  const out = []
  for (const rawLine of String(text ?? '').split('\n')) {
    const words = rawLine.split(/\s+/).filter(Boolean)
    if (words.length === 0) { out.push(''); continue }
    let cur = ''
    for (let w of words) {
      while (w.length > width) {              // word longer than the paper
        if (cur) { out.push(cur); cur = '' }
        out.push(w.slice(0, width))
        w = w.slice(width)
      }
      if (!cur) cur = w
      else if ((cur + ' ' + w).length <= width) cur += ' ' + w
      else { out.push(cur); cur = w }
    }
    if (cur) out.push(cur)
  }
  return out
}
​
// "label            value" right-aligned. Falls back to two lines if too long.
function labelValueLine(label, value, width) {
  const l = String(label ?? '')
  const v = String(value ?? '')
  const gap = width - l.length - v.length
  if (gap >= 1) return l + ' '.repeat(gap) + v
  // Not enough room: put the value right-aligned on its own line.
  return l + '\n' + ' '.repeat(Math.max(0, width - v.length)) + v
}
​
// "label: value" that wraps the value under the label if it overflows.
function inlineLine(label, value, width) {
  const prefix = `${label} `
  const text = `${prefix}${value ?? ''}`
  if (text.length <= width) return text
  const wrapped = wrapText(String(value ?? ''), width - 2)
  return [prefix.trimEnd(), ...wrapped.map(w => '  ' + w)].join('\n')
}
​
// ─── Pricing math (NEW — single source of truth) ─────────────────────────────
export function computeTotals(member) {
  const base = Number(member.base_price ?? 0)
  let discountAmount = 0
  if (member.discount_type === 'percentage') {
    discountAmount = base * (Number(member.discount_value ?? 0) / 100)
  } else if (member.discount_type === 'fixed' || member.discount_type === 'amount') {
    discountAmount = Number(member.discount_value ?? 0)
  }
  discountAmount = Math.min(discountAmount, base)         // never negative total
  const subtotal = Math.max(0, base - discountAmount)
  // If amount_paid wasn't recorded, assume they paid the subtotal.
  const paid = member.amount_paid == null ? subtotal : Number(member.amount_paid)
  const diff = subtotal - paid                            // >0 balance due, <0 change
  return { base, discountAmount, subtotal, paid, diff }
}
​
function memberDisplayName(member) {
  const name = `${member.first_name || ''} ${member.last_name || ''}`.trim()
  return name || 'Walk-in Customer'
}
​
// ─── Main builder ─────────────────────────────────────────────────────────────
// @param member         member record
// @param familyMembers  array of { first_name, last_name, phone_number }
// @param settings       { gymName, receiptTemplate }
// @param meta           optional { receiptNo, dateTime } for deterministic output
export function buildReceiptText(member, familyMembers = [], settings = {}, meta = {}) {
  const gymName = settings.gymName || 'J-GYM'
  const tpl = { ...DEFAULT_RECEIPT_TEMPLATE, ...(settings.receiptTemplate || {}) }
  const W = PAPER_WIDTHS[tpl.paperWidth] || PAPER_WIDTHS['58mm']
  const sym = tpl.currencySymbol || '$'
  const lines = []
  const push = (x) => { if (x != null) String(x).split('\n').forEach(l => lines.push(l)) }
​
  // ── Header ──
  const headerTitle = fillTemplate(tpl.headerTitle, { gymName })
  if (headerTitle) push(centerLine(headerTitle, W))
  if (tpl.headerSubtitle) push(centerLine(tpl.headerSubtitle, W))
  push(ruleLine('=', W))
​
  // ── Receipt meta (NEW) ──
  if (tpl.showReceiptMeta) {
    if (meta.receiptNo) push(labelValueLine(`${tpl.receiptLabel}`, String(meta.receiptNo), W))
    push(labelValueLine(`${tpl.dateLabel}`, formatDateTime(meta.dateTime), W))
    push(ruleLine('-', W))
  }
​
  // ── Members ──
  const isFamily = member.subscription_type === 'family' && familyMembers.length > 0
  if (isFamily) {
    if (tpl.familySectionTitle) {
      push(centerLine(tpl.familySectionTitle, W))
      push(ruleLine('-', W))
    }
    familyMembers.forEach((fm, i) => {
      const n = i + 1
      const fmName = `${fm.first_name || ''} ${fm.last_name || ''}`.trim() || 'Unknown'
      push(inlineLine(`${fillTemplate(tpl.familyNameFormat, { n })}:`, fmName, W))
      if (tpl.showFamilyPhones && fm.phone_number) {
        push(inlineLine(`${fillTemplate(tpl.familyPhoneFormat, { n })}:`, fm.phone_number, W))
      }
      if (i < familyMembers.length - 1) {
        if (tpl.familySeparator === 'dash') push(ruleLine('-', W))
        else if (tpl.familySeparator === 'blank') push('')
      }
    })
    push(ruleLine('-', W))
  } else {
    push(inlineLine(`${tpl.singleNameLabel}:`, memberDisplayName(member), W))
    if (tpl.showSinglePhone && member.phone_number) {
      push(inlineLine(`${tpl.singlePhoneLabel}:`, member.phone_number, W))
    }
    push(ruleLine('-', W))
  }
​
  // ── Class & plan ──
  if (member.class_type) push(inlineLine(tpl.classLabel, titleCase(member.class_type), W))
  if (member.subscription_type) push(inlineLine(tpl.planLabel, titleCase(member.subscription_type), W))
  push(ruleLine('-', W))
​
  // ── Dates ──
  push(labelValueLine(tpl.startLabel, formatDate(member.start_date), W))
  push(labelValueLine(tpl.endLabel, formatDate(member.end_date), W))
​
  // ── Notes (word-wrapped) ──
  if (member.description) {
    push(ruleLine('-', W))
    push(tpl.notesLabel)
    const noteLines = tpl.wordWrapNotes
      ? wrapText(member.description, W)
      : String(member.description).match(new RegExp(`.{1,${W}}`, 'g')) || []
    noteLines.forEach(push)
  }
​
  // ── Pricing (NEW: subtotal + balance/change) ──
  if (tpl.showPricing) {
    push(ruleLine('-', W))
    const t = computeTotals(member)
    push(labelValueLine(tpl.basePriceLabel, money(t.base, sym), W))
    if (member.discount_type && member.discount_type !== 'none' && t.discountAmount > 0) {
      const label = member.discount_type === 'percentage'
        ? `-${member.discount_value}%`
        : `-${money(member.discount_value, sym)}`
      push(labelValueLine(tpl.discountLabel, label, W))
      push(labelValueLine(tpl.subtotalLabel, money(t.subtotal, sym), W))
    }
    push(ruleLine('-', W))
    push(labelValueLine(tpl.totalPaidLabel, money(t.paid, sym), W))
    if (tpl.showBalance && Math.abs(t.diff) >= 0.01) {
      if (t.diff > 0) push(labelValueLine(tpl.balanceLabel, money(t.diff, sym), W))
      else push(labelValueLine(tpl.changeLabel, money(-t.diff, sym), W))
    }
    push(ruleLine('=', W))
  }
​
  // ── Footer ──
  push('')
  if (tpl.footerMessage) push(centerLine(tpl.footerMessage, W))
​
  return lines.join('\n')
}
​
export const _internal = { wrapText, labelValueLine, centerLine, inlineLine, titleCase }
​
// ─── Demo / preview helpers ─────────────────────────────────────────────────
// Used by the Settings page to render a live preview of EVERY receipt case at
// once. Each case merges your current template with a small per-case override.
​
const _DEMO_START = '2026-07-30T10:00:00Z'
const _DEMO_END = '2026-08-29T10:00:00Z'
const _DEMO_META = { receiptNo: '0147', dateTime: '2026-07-30T18:55:00' }
const _DEMO_FAMILY = [
  { first_name: 'John', last_name: 'Doe', phone_number: '+9613111222' },
  { first_name: 'Jane', last_name: 'Doe', phone_number: '+9613111333' },
  { first_name: 'Jim', last_name: 'Doe', phone_number: '' },
]
const _base = { start_date: _DEMO_START, end_date: _DEMO_END }
​
export const DEMO_CASES = [
  { id: 'single-pct', group: 'Single member', badge: ['blue', 'Percentage off'],
    title: 'Monthly + class, 10% off',
    description: 'Class shown, percentage discount, subtotal + exact cash — no balance line.',
    member: { ..._base, first_name: 'Sarah', last_name: 'Khoury', phone_number: '+9613445566', class_type: 'aerobics', subscription_type: 'monthly', base_price: 40, discount_type: 'percentage', discount_value: 10, amount_paid: 36, description: 'Paid in cash' } },
  { id: 'single-fixed', group: 'Single member', badge: ['blue', 'Fixed amount off'],
    title: 'Monthly, $5 fixed off',
    description: 'Fixed-amount discount renders as a currency value, not a percentage.',
    member: { ..._base, first_name: 'Rami', last_name: 'Aoun', phone_number: '+9613778899', subscription_type: 'monthly', base_price: 40, discount_type: 'fixed', discount_value: 5, amount_paid: 35 } },
  { id: 'single-none', group: 'Single member', badge: ['green', 'No discount'],
    title: 'Daily drop-in, no discount',
    description: 'No class, no discount — discount + subtotal lines are omitted entirely.',
    member: { ..._base, first_name: 'Nour', last_name: 'Haddad', phone_number: '+9613222444', subscription_type: 'daily', base_price: 7, discount_type: 'none', amount_paid: 7 } },
  { id: 'single-balance', group: 'Single member', badge: ['orange', 'Balance due'],
    title: 'Underpaid → balance due',
    description: 'Paid less than the subtotal: a "balance due" line appears automatically.',
    member: { ..._base, first_name: 'Karim', last_name: 'Saad', phone_number: '+9613909090', subscription_type: 'monthly', base_price: 40, discount_type: 'none', amount_paid: 25 } },
  { id: 'single-change', group: 'Single member', badge: ['orange', 'Change'],
    title: 'Overpaid → change',
    description: 'Paid more than due: a "change" line is computed and shown.',
    member: { ..._base, first_name: 'Lea', last_name: 'Rizk', phone_number: '+9613010101', subscription_type: 'weekly', base_price: 17, discount_type: 'none', amount_paid: 20 } },
​
  { id: 'edge-walkin', group: 'Edge & empty data', badge: ['blue', 'No name'],
    title: 'Walk-in customer',
    description: 'No first/last name falls back to "Walk-in Customer"; phone hidden when absent.',
    member: { ..._base, subscription_type: 'daily', base_price: 7, discount_type: 'none', amount_paid: 7 } },
  { id: 'edge-nophone', group: 'Edge & empty data', badge: ['blue', 'Phone hidden'],
    title: 'Single phone toggle off',
    description: 'showSinglePhone=false suppresses the phone line even when one exists.',
    tplOverride: { showSinglePhone: false },
    member: { ..._base, first_name: 'Maya', last_name: 'Fares', phone_number: '+9613555000', subscription_type: 'monthly', base_price: 40, discount_type: 'none', amount_paid: 40 } },
  { id: 'edge-wrap', group: 'Edge & empty data', badge: ['orange', 'Long text wrap'],
    title: 'Long name + long notes',
    description: 'Long names and notes word-wrap cleanly instead of being cut off mid-word.',
    member: { ..._base, first_name: 'Abdul-Rahman', last_name: 'Constantinopoulos', phone_number: '+9613667788', class_type: 'zumba', subscription_type: 'monthly', base_price: 40, discount_type: 'percentage', discount_value: 15, amount_paid: 34, description: 'Member requested a reminder call two days before expiry and prefers evening classes after 7pm.' } },
​
  { id: 'family-dash', group: 'Family plans', badge: ['blue', 'Dash separator'],
    title: 'Family · dash between members',
    description: '3 members (3rd has no phone). Dash rule separates each member block.',
    family: _DEMO_FAMILY,
    member: { ..._base, first_name: 'John', last_name: 'Doe', subscription_type: 'family', base_price: 100, discount_type: 'percentage', discount_value: 10, amount_paid: 90, description: 'Paid in cash' } },
  { id: 'family-blank', group: 'Family plans', badge: ['blue', 'Blank separator'],
    title: 'Family · blank line separator',
    description: 'Same data, familySeparator = blank for a lighter look.',
    family: _DEMO_FAMILY, tplOverride: { familySeparator: 'blank' },
    member: { ..._base, first_name: 'John', last_name: 'Doe', subscription_type: 'family', base_price: 100, discount_type: 'none', amount_paid: 100 } },
  { id: 'family-compact', group: 'Family plans', badge: ['green', 'No separator + phones off'],
    title: 'Family · compact',
    description: 'familySeparator = none and family phones hidden for a tight member list.',
    family: _DEMO_FAMILY, tplOverride: { familySeparator: 'none', showFamilyPhones: false },
    member: { ..._base, first_name: 'John', last_name: 'Doe', subscription_type: 'family', base_price: 100, discount_type: 'fixed', discount_value: 20, amount_paid: 80 } },
​
  { id: 'wide-single', group: '80mm paper', badge: ['orange', '80mm · single'], wide: true,
    title: 'Wide roll · single member',
    description: 'paperWidth = 80mm widens every rule, centered title and aligned totals.',
    tplOverride: { paperWidth: '80mm' },
    member: { ..._base, first_name: 'Sarah', last_name: 'Khoury', phone_number: '+9613445566', class_type: 'aerobics', subscription_type: 'monthly', base_price: 40, discount_type: 'percentage', discount_value: 10, amount_paid: 36, description: 'Paid in cash' } },
  { id: 'wide-family', group: '80mm paper', badge: ['orange', '80mm · family'], wide: true,
    title: 'Wide roll · family plan',
    description: 'Family layout on 80mm paper — more breathing room per line.',
    family: _DEMO_FAMILY, tplOverride: { paperWidth: '80mm' },
    member: { ..._base, first_name: 'John', last_name: 'Doe', subscription_type: 'family', base_price: 100, discount_type: 'percentage', discount_value: 10, amount_paid: 90 } },
]
​
// By default we only preview the two cases the Settings page cares about:
// one single membership and one family plan. Pass { all: true } for the full
// 13-case library.
export const PREVIEW_CASE_IDS = ['single-pct', 'family-dash']
​
// Build one rendered receipt per case, using the caller's live settings merged
// with each case's override. Returns an array ready to .map() in the UI.
export function buildAllDemoReceipts(settings = {}, { all = false } = {}) {
  const gymName = settings.gymName || 'J-GYM'
  const baseTpl = settings.receiptTemplate || {}
  const cases = all ? DEMO_CASES : DEMO_CASES.filter((c) => PREVIEW_CASE_IDS.includes(c.id))
  return cases.map((c) => {
    const receiptTemplate = { ...baseTpl, ...(c.tplOverride || {}) }
    const merged = { ...DEFAULT_RECEIPT_TEMPLATE, ...receiptTemplate }
    return {
      id: c.id,
      group: c.group,
      title: c.title,
      description: c.description,
      badge: c.badge,
      wide: !!c.wide,
      showQR: merged.showInstagramQR,
      instagramCaption: merged.instagramCaption,
      text: buildReceiptText(c.member, c.family || [], { gymName, receiptTemplate }, _DEMO_META),
    }
  })
}
​