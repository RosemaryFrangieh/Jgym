// membership.jsx
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import MemberModal from '../components/MemberModal'
import { Search, Plus, Pencil, Trash2, X, ChevronLeft, ChevronRight, CheckCircle, XCircle, Eye, RefreshCw, Calendar, Printer } from 'lucide-react'
import { printReceiptViaRawBT } from '../utils/receiptPrinter'
​
// ─── Helpers ──────────────────────────────────────────────────────────────────
​
export function isMembershipExpired(endDate) {
  if (!endDate) return false
  const todayStr = new Date().toISOString().split('T')[0]
  const endStr = new Date(endDate).toISOString().split('T')[0]
  return todayStr > endStr
}
​
export function computeEndDate(member) {
  if (!member.start_date) return member.end_date || null
  if (member.subscription_type === 'custom') return member.end_date || null
  const durationMap = { daily: 1, weekly: 7, biweekly: 14, triweekly: 21, monthly: 30 }
  const days = durationMap[member.subscription_type] ?? 0
  if (days === 0) return member.end_date || null
  const start = new Date(member.start_date)
  start.setDate(start.getDate() + days)
  return start.toISOString().split('T')[0]
}
​
export function memberDisplayName(m) {
  const name = `${m.first_name || ''} ${m.last_name || ''}`.trim()
  return name || 'Walk-in Customer'
}
function toYearMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
​
// Returns a display label like "June 2026"
function formatYearMonth(ym) {
  const [y, m] = ym.split('-')
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}
​
// Returns first and last ISO date strings of a given 'YYYY-MM'
function monthBounds(ym) {
  const [y, m] = ym.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const last  = new Date(y, m, 0)
  return {
    from: first.toISOString().split('T')[0],
    to:   last.toISOString().split('T')[0],
  }
}
​
// ─── Constants ────────────────────────────────────────────────────────────────
​
const PAGE_SIZE = 10
const SUBSCRIPTION_TYPES = ['all', 'daily', 'weekly', 'biweekly', 'triweekly', 'monthly', 'custom']
const DEFAULT_FILTERS = { subscriptionType: 'all', statusFilter: 'all', membershipStatus: 'all' }
const FIXED_PRICES = { daily: 7, weekly: 17, biweekly: 25, triweekly: 32, monthly: 40 }
​
// ─── Badges ──────────────────────────────────────────────────────────────────
​
function StatusBadge({ expired }) {
  if (expired) return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border bg-red-500/20 text-red-400 border-red-500/30">
      <XCircle size={12} /> Expired
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border bg-green-500/20 text-green-400 border-green-500/30">
      <CheckCircle size={12} /> Active
    </span>
  )
}
​
function SubscriptionBadge({ type }) {
  const colors = {
    daily:     'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    weekly:    'bg-blue-500/20 text-blue-400 border-blue-500/30',
    biweekly:  'bg-purple-500/20 text-purple-400 border-purple-500/30',
    triweekly: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    monthly:   'bg-green-500/20 text-green-400 border-green-500/30',
    custom:    'bg-pink-500/20 text-pink-400 border-pink-500/30',
  }
  const labels = { biweekly: '2 Weeks', triweekly: '3 Weeks' }
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium border capitalize ${colors[type] ?? 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
      {labels[type] ?? type}
    </span>
  )
}
​
function MembershipStatusBadge({ status }) {
  const isNew = status !== 'renewed'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${
      isNew
        ? 'bg-electric-blue/20 text-electric-blue border-electric-blue/30'
        : 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    }`}>
      {isNew ? 'New' : 'Renewed'}
    </span>
  )
}
​
// ─── Detail Modal ─────────────────────────────────────────────────────────────
​
function DetailModal({ member, onClose, onRenew }) {
  const endDate = computeEndDate(member)
  const expired = isMembershipExpired(endDate)
  const fmt = (d) => d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—'
​
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-navy-800 rounded-xl w-full max-w-md p-6 border border-navy-700">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-xl font-bold text-white">{memberDisplayName(member)}</h3>
            <p className="text-slate-400 text-sm mt-0.5">{member.phone_number || 'No phone on file'}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={24} /></button>
        </div>
        <div className={`rounded-lg p-3 mb-5 flex items-center gap-2 ${expired ? 'bg-red-900/30 border border-red-700/50' : 'bg-green-900/30 border border-green-700/50'}`}>
          {expired ? <XCircle size={16} className="text-red-400" /> : <CheckCircle size={16} className="text-green-400" />}
          <span className={`text-sm font-semibold ${expired ? 'text-red-400' : 'text-green-400'}`}>
            {expired ? 'Membership Expired' : 'Membership Active'}
          </span>
        </div>
        <div className="space-y-3 mb-5">
          <div className="flex justify-between items-center py-2 border-b border-navy-700">
            <span className="text-slate-400 text-sm">Membership</span>
            <div className="flex items-center gap-2">
              <MembershipStatusBadge status={member.membership_status} />
              {(member.renewal_count || 0) > 0 && (
                <span className="flex items-center gap-1 text-slate-400 text-xs">
                  <RefreshCw size={12} /> Renewed {member.renewal_count}x
                </span>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-navy-700">
            <span className="text-slate-400 text-sm">Plan</span>
            <SubscriptionBadge type={member.subscription_type} />
          </div>
          <div className="flex justify-between items-center py-2 border-b border-navy-700">
            <span className="text-slate-400 text-sm">Start Date</span>
            <span className="text-white text-sm">{fmt(member.start_date)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-navy-700">
            <span className="text-slate-400 text-sm">End Date</span>
            <span className={`text-sm font-medium ${expired ? 'text-red-400' : 'text-white'}`}>{fmt(endDate)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-navy-700">
            <span className="text-slate-400 text-sm">Base Price</span>
            <span className="text-white text-sm">${member.base_price}</span>
          </div>
          {member.discount_type !== 'none' && (
            <div className="flex justify-between items-center py-2 border-b border-navy-700">
              <span className="text-slate-400 text-sm">Discount</span>
              <span className="text-yellow-400 text-sm">
                {member.discount_type === 'percentage' ? `${member.discount_value}%` : `$${member.discount_value}`} off
              </span>
            </div>
          )}
          <div className="flex justify-between items-center py-2 border-b border-navy-700">
            <span className="text-slate-400 text-sm">Amount Paid</span>
            <span className="text-electric-green font-bold">${member.amount_paid}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-navy-700">
            <span className="text-slate-400 text-sm">Created</span>
            <span className="text-white text-sm">{fmt(member.created_at)}</span>
          </div>
          {member.description && (
            <div className="py-2">
              <span className="text-slate-400 text-sm block mb-1">Notes</span>
              <p className="text-white text-sm bg-navy-900 rounded-lg p-3 leading-relaxed">{member.description}</p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Close</button>
          <button onClick={() => printReceiptViaRawBT(member)} className="flex items-center gap-2 px-4 py-2 border border-navy-700 text-slate-300 hover:text-white hover:border-slate-500 rounded-lg font-medium text-sm transition-colors">
            <Printer size={15} /> Print Receipt
          </button>
          <button onClick={() => { onClose(); onRenew(member) }} className="flex items-center gap-2 px-5 py-2 bg-electric-blue text-white rounded-lg font-semibold hover:opacity-90 text-sm">
            <RefreshCw size={15} /> {expired ? 'Renew Membership' : 'Renew Early'}
          </button>
        </div>
      </div>
    </div>
  )
}
​
// ─── Renew Modal ──────────────────────────────────────────────────────────────
​
function RenewModal({ member, onClose, onSuccess }) {
  const [subscriptionType, setSubscriptionType] = useState(member.subscription_type === 'custom' ? 'monthly' : member.subscription_type)
  const _currentEndForRenewal = computeEndDate(member)
  const _alreadyExpired = isMembershipExpired(_currentEndForRenewal)
  // Early renewal: if the member is NOT expired yet, start the new period the day
  // AFTER their current expiration date so no days are lost and there's no overlap.
  // If they're already expired, start today (default behavior).
  const _defaultStartDate = (!_alreadyExpired && _currentEndForRenewal)
    ? (() => { const d = new Date(_currentEndForRenewal); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0] })()
    : new Date().toISOString().split('T')[0]
  const [startDate, setStartDate]   = useState(_defaultStartDate)
  const [customEndDate, setCustomEndDate] = useState('')
  const [customPrice, setCustomPrice]    = useState(member.base_price)
  const [discountType, setDiscountType]  = useState('none')
  const [discountValue, setDiscountValue] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [fullName, setFullName]       = useState(`${member.first_name || ''} ${member.last_name || ''}`.trim())
  const [phoneNumber, setPhoneNumber] = useState(member.phone_number || '')
​
  const DAILY_UPGRADE_DISCOUNT = 7
  const isCustom   = subscriptionType === 'custom'
  const wasDaily   = member.subscription_type === 'daily'
  // Daily member switching to a non-daily plan: needs real contact info, gets $7 off
  const switchingFromDaily = wasDaily && subscriptionType !== 'daily'
​
  const rawBasePrice = isCustom ? parseFloat(customPrice) || 0 : FIXED_PRICES[subscriptionType] || 0
  const basePrice  = switchingFromDaily ? Math.max(0, rawBasePrice - DAILY_UPGRADE_DISCOUNT) : rawBasePrice
  const discVal    = parseFloat(discountValue) || 0
  const amountPaid = discountType === 'percentage'
    ? Math.max(0, basePrice - basePrice * (discVal / 100))
    : discountType === 'fixed' ? Math.max(0, basePrice - discVal) : basePrice
​
  const infoMissing = switchingFromDaily && (!fullName.trim() || !phoneNumber.trim())
​
  const handleRenew = async () => {
    setError(null)
    if (infoMissing) { setError('Please enter a name and phone number for this membership.'); return }
    setLoading(true)
    let endDateStr
    if (isCustom) {
      endDateStr = customEndDate
    } else {
      const durationMap = { daily: 1, weekly: 7, biweekly: 14, triweekly: 21, monthly: 30 }
      const start = new Date(startDate)
      start.setDate(start.getDate() + durationMap[subscriptionType])
      endDateStr = start.toISOString().split('T')[0]
    }
    const updatePayload = {
      subscription_type: subscriptionType, base_price: basePrice,
      discount_type: discountType, discount_value: discVal,
      amount_paid: amountPaid, start_date: startDate, end_date: endDateStr,
      renewal_count: (member.renewal_count || 0) + 1,
    }
    if (switchingFromDaily) {
      const parts = fullName.trim().split(/\s+/).filter(Boolean)
      updatePayload.first_name = parts[0] || ''
      updatePayload.last_name = parts.slice(1).join(' ')
      updatePayload.phone_number = phoneNumber.trim()
    }
    const { error: err } = await supabase.from('members').update(updatePayload).eq('id', member.id)
    setLoading(false)
    if (err) { setError(err.message); return }
    onSuccess()
  }
​
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-navy-800 rounded-xl w-full max-w-md p-6 border border-navy-700">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h3 className="text-xl font-bold text-white">Renew Membership</h3>
            <p className="text-slate-400 text-sm mt-0.5">{memberDisplayName(member)}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={24} /></button>
        </div>
        {error && <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>}
        {switchingFromDaily && (
          <div className="mb-4 p-3 bg-electric-blue/10 border border-electric-blue/30 rounded-lg text-electric-blue text-sm">
            Switching from Daily — $7 discount applied automatically, and this membership now needs a name and phone number.
          </div>
        )}
        {!_alreadyExpired && _currentEndForRenewal && (
          <div className="mb-4 p-3 bg-electric-green/10 border border-electric-green/30 rounded-lg text-electric-green text-sm">
            Early renewal — current plan is still active until {new Date(_currentEndForRenewal).toLocaleDateString()}. The new period starts the day after ({new Date(startDate).toLocaleDateString()}), so no days are lost.
          </div>
        )}
        <div className="space-y-4">
          {switchingFromDaily && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Full Name</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="e.g. John Smith" className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white placeholder:text-slate-600" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Phone Number</label>
                <input type="text" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} required className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white" />
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Subscription Type</label>
            <select value={subscriptionType} onChange={e => setSubscriptionType(e.target.value)} className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white">
              <option value="daily">Daily — ${FIXED_PRICES.daily}</option>
              <option value="weekly">Weekly — ${FIXED_PRICES.weekly}</option>
              <option value="biweekly">2 Weeks — ${FIXED_PRICES.biweekly}</option>
              <option value="triweekly">3 Weeks — ${FIXED_PRICES.triweekly}</option>
              <option value="monthly">Monthly — ${FIXED_PRICES.monthly}</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div className={`grid gap-4 ${isCustom ? 'grid-cols-3' : 'grid-cols-1'}`}>
            <div>
              <label className="block text-sm text-slate-400 mb-1">New Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white" />
            </div>
            {isCustom && (<>
              <div>
                <label className="block text-sm text-slate-400 mb-1">End Date</label>
                <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Price ($)</label>
                <input type="number" value={customPrice} onChange={e => setCustomPrice(e.target.value)} min="0" step="0.01" className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white" />
              </div>
            </>)}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Discount Type</label>
              <select value={discountType} onChange={e => setDiscountType(e.target.value)} className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white">
                <option value="none">None</option>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed ($)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Discount Value</label>
              <input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)} disabled={discountType === 'none'} min="0" step="0.01" className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white disabled:opacity-50" />
            </div>
          </div>
          <div className="bg-navy-900 p-4 rounded-lg flex justify-between items-center">
            <span className="text-slate-400 text-sm">Amount to Collect</span>
            <span className="text-2xl font-bold text-electric-green">${amountPaid.toFixed(2)}</span>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancel</button>
          <button onClick={handleRenew} disabled={loading || (isCustom && !customEndDate) || infoMissing} className="flex items-center gap-2 px-5 py-2 bg-electric-blue text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 text-sm">
            <RefreshCw size={15} /> {loading ? 'Renewing…' : 'Confirm Renewal'}
          </button>
        </div>
      </div>
    </div>
  )
}
​
// ─── Month Navigator ──────────────────────────────────────────────────────────
​
function MonthNavigator({ value, onChange }) {
  const now = toYearMonth(new Date())
​
  const prev = () => {
    const [y, m] = value.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    onChange(toYearMonth(d))
  }
  const next = () => {
    const [y, m] = value.split('-').map(Number)
    const d = new Date(y, m, 1)
    onChange(toYearMonth(d))
  }
​
  return (
    <div className="flex items-center gap-2">
      <button onClick={prev} className="p-1.5 rounded-lg bg-navy-900 border border-navy-700 hover:border-slate-500 text-slate-400 hover:text-white transition-colors">
        <ChevronLeft size={16} />
      </button>
      <div className="flex items-center gap-2 px-4 py-1.5 bg-navy-900 border border-navy-700 rounded-lg min-w-[160px] justify-center">
        <Calendar size={15} className="text-electric-blue" />
        <span className="text-white text-sm font-medium">{formatYearMonth(value)}</span>
        {value === now && <span className="text-xs text-electric-blue font-semibold">Current</span>}
      </div>
      <button onClick={next} disabled={value >= now} className="p-1.5 rounded-lg bg-navy-900 border border-navy-700 hover:border-slate-500 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
​
// ─── Main component ──────────────────────────────────────────────────────────
​
export default function Memberships() {
  const [members, setMembers]             = useState([])
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [filters, setFilters]             = useState(DEFAULT_FILTERS)
  const [selectedMonth, setSelectedMonth] = useState(toYearMonth(new Date()))
  const [page, setPage]                   = useState(1)
  const [isModalOpen, setIsModalOpen]     = useState(false)
  const [currentMember, setCurrentMember] = useState(null)
  const [detailMember, setDetailMember]   = useState(null)
  const [renewMember, setRenewMember]     = useState(null)
​
  const fetchMembers = useCallback(async () => {
    setLoading(true)
    const { from, to } = monthBounds(selectedMonth)
​
    let query = supabase
      .from('members')
      .select('*')
      .gte('created_at', `${from}T00:00:00.000Z`)
      .lte('created_at', `${to}T23:59:59.999Z`)
      .order('created_at', { ascending: false })
​
    if (filters.subscriptionType !== 'all') {
      query = query.eq('subscription_type', filters.subscriptionType)
    }
​
    const { data, error } = await query
    if (!error) setMembers(data || [])
    setLoading(false)
  }, [filters, selectedMonth])
​
  useEffect(() => { fetchMembers(); setPage(1) }, [fetchMembers])
​
  // Reset to current month when component mounts (auto monthly reset)
  useEffect(() => {
    const now = toYearMonth(new Date())
    setSelectedMonth(now)
  }, [])
​
  const enrichedMembers = members.map(m => ({
    ...m,
    _computedEndDate: computeEndDate(m),
    get _expired() { return isMembershipExpired(this._computedEndDate) },
  }))
​
  const filteredMembers = enrichedMembers.filter(m => {
    const q = search.toLowerCase()
    if (q) {
      const fullName = memberDisplayName(m).toLowerCase()
      if (!fullName.includes(q) && !(m.phone_number || '').includes(q)) return false
    }
    if (filters.statusFilter === 'active'  &&  m._expired) return false
    if (filters.statusFilter === 'expired' && !m._expired) return false
    if (filters.membershipStatus !== 'all' && (m.membership_status ?? 'new') !== filters.membershipStatus) return false
    return true
  })
​
  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const paginated  = filteredMembers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
​
  const handleFilterChange = (key, value) => setFilters(prev => ({ ...prev, [key]: value }))
​
  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS)
    setSearch('')
    setPage(1)
  }
​
  const hasActiveFilters = search !== '' || filters.subscriptionType !== 'all' || filters.statusFilter !== 'all' || filters.membershipStatus !== 'all'
​
  const handleEdit   = (member) => { setCurrentMember(member); setIsModalOpen(true) }
  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this member?')) {
      await supabase.from('members').delete().eq('id', id)
      fetchMembers()
    }
  }
​
  // Monthly totals summary
  const activeCount     = filteredMembers.filter(m => !m._expired).length
  const expiredCount    = filteredMembers.filter(m =>  m._expired).length
​
  return (
    <div>
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Memberships</h2>
          <p className="text-slate-400 text-sm mt-0.5">Showing records created in {formatYearMonth(selectedMonth)}</p>
        </div>
        <div className="flex items-center gap-3">
          <MonthNavigator value={selectedMonth} onChange={(ym) => { setSelectedMonth(ym); setPage(1) }} />
          <button
            onClick={() => { setCurrentMember(null); setIsModalOpen(true) }}
            className="flex items-center gap-2 bg-electric-blue text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            <Plus size={20} /> Add Member
          </button>
        </div>
      </div>
​
      {/* ── Monthly summary cards ── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-4">
          <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Members This Month</p>
          <p className="text-2xl font-bold text-white">{loading ? '—' : filteredMembers.length}</p>
        </div>
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-4">
          <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Active</p>
          <p className="text-2xl font-bold text-green-400">{loading ? '—' : activeCount}</p>
        </div>
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-4">
          <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Expired</p>
          <p className="text-2xl font-bold text-red-400">{loading ? '—' : expiredCount}</p>
        </div>
       
      </div>
​
      {/* ── Filters ── */}
      <div className="bg-navy-800 rounded-xl border border-navy-700 p-4 mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Search by name or phone…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg pl-9 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-electric-blue"
            />
          </div>
          <div className="flex items-center gap-2">
            {['all', 'active', 'expired'].map(s => (
              <button key={s} onClick={() => handleFilterChange('statusFilter', s)}
                className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                  filters.statusFilter === s
                    ? s === 'expired' ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                      : s === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                      : 'bg-electric-blue text-white'
                    : 'bg-navy-900 text-slate-400 border border-navy-700 hover:border-slate-500'
                }`}
              >{s}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {['all', 'new', 'renewed'].map(s => (
              <button key={s} onClick={() => handleFilterChange('membershipStatus', s)}
                className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                  filters.membershipStatus === s
                    ? s === 'renewed' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                      : s === 'new' ? 'bg-electric-blue/20 text-electric-blue border border-electric-blue/40'
                      : 'bg-electric-blue text-white'
                    : 'bg-navy-900 text-slate-400 border border-navy-700 hover:border-slate-500'
                }`}
              >{s}</button>
            ))}
          </div>
        </div>
​
        <div className="flex flex-wrap gap-2">
          {SUBSCRIPTION_TYPES.map(type => (
            <button key={type} onClick={() => handleFilterChange('subscriptionType', type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                filters.subscriptionType === type ? 'bg-electric-blue text-white' : 'bg-navy-900 text-slate-400 border border-navy-700 hover:border-slate-500'
              }`}
            >{type}</button>
          ))}
        </div>
​
        <div className="flex items-center justify-between pt-1 border-t border-navy-700">
          <span className="text-slate-400 text-sm">
            {loading ? 'Loading…' : <><span className="text-white font-semibold">{filteredMembers.length}</span> member{filteredMembers.length !== 1 ? 's' : ''} found</>}
          </span>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
              <X size={14} /> Clear filters
            </button>
          )}
        </div>
      </div>
​
      {/* ── Table ── */}
      <div className="bg-navy-800 rounded-xl border border-navy-700 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-navy-900 border-b border-navy-700 text-slate-400 text-sm">
            <tr>
              <th className="p-4">Member</th>
              <th className="p-4 hidden md:table-cell">Contact</th>
              <th className="p-4">Plan</th>
              <th className="p-4 hidden sm:table-cell">Start</th>
              <th className="p-4 hidden lg:table-cell">End</th>
              <th className="p-4">Status</th>
              <th className="p-4">Amount</th>
              <th className="p-4 hidden xl:table-cell">Description</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="p-8 text-center text-slate-500">Loading…</td></tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center">
                  <p className="text-slate-500">No memberships found for {formatYearMonth(selectedMonth)}.</p>
                  <p className="text-slate-600 text-sm mt-1">Try navigating to a different month.</p>
                </td>
              </tr>
            ) : (
              paginated.map(m => (
                <tr key={m.id} className={`border-b border-navy-700 transition-colors ${m._expired ? 'bg-red-950/20 hover:bg-red-950/30' : 'hover:bg-navy-900/50'}`}>
                  <td className="p-4">
                    <p className="text-white font-medium">{memberDisplayName(m)}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{new Date(m.created_at).toLocaleDateString()}</p>
                  </td>
                  <td className="p-4 hidden md:table-cell text-slate-400 text-sm">{m.phone_number || '—'}</td>
                  <td className="p-4"><SubscriptionBadge type={m.subscription_type} /></td>
                  <td className="p-4 hidden sm:table-cell text-slate-400 text-sm">
                    {m.start_date ? new Date(m.start_date).toLocaleDateString() : '—'}
                  </td>
                  <td className="p-4 hidden lg:table-cell text-slate-400 text-sm">
                    {m._computedEndDate ? new Date(m._computedEndDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1 items-start">
                      <StatusBadge expired={m._expired} />
                      <div className="flex items-center gap-1">
                        <MembershipStatusBadge status={m.membership_status} />
                        {(m.renewal_count || 0) > 0 && (
                          <span className="text-slate-500 text-xs">×{m.renewal_count}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-electric-green font-semibold">${m.amount_paid}</td>
                  <td className="p-4 hidden xl:table-cell text-slate-400 text-sm max-w-[180px]">
                    {m.description
                      ? <span className="block truncate" title={m.description}>{m.description}</span>
                      : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setDetailMember(m)} className="p-2 text-slate-400 hover:text-white transition-colors" title="View details">
                        <Eye size={17} />
                      </button>
                      <button onClick={() => setRenewMember(m)} className="p-2 text-slate-400 hover:text-electric-blue transition-colors" title={m._expired ? 'Renew' : 'Renew early'}>
                        <RefreshCw size={17} />
                      </button>
                      <button onClick={() => handleEdit(m)} className="p-2 text-slate-400 hover:text-electric-blue transition-colors" title="Edit">
                        <Pencil size={17} />
                      </button>
                      <button onClick={() => handleDelete(m.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="Delete">
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
​
      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-400">
          <span>Page <span className="text-white font-medium">{safePage}</span> of <span className="text-white font-medium">{totalPages}</span></span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-navy-800 border border-navy-700 hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft size={16} /> Prev
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-navy-800 border border-navy-700 hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
​
      {/* ── Modals ── */}
      {isModalOpen && (
        <MemberModal member={currentMember} onClose={() => { setIsModalOpen(false); fetchMembers() }} />
      )}
      {detailMember && (
        <DetailModal member={detailMember} onClose={() => setDetailMember(null)} onRenew={(m) => setRenewMember(m)} />
      )}
      {renewMember && (
        <RenewModal member={renewMember} onClose={() => setRenewMember(null)} onSuccess={() => { setRenewMember(null); fetchMembers() }} />
      )}
    </div>
  )
}