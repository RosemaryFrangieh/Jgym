import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import ClassMemberModal from '../components/ClassMemberModal'
import { printReceiptViaRawBT } from '../utils/receiptPrinter'
import { useAuth } from '../context/AuthContext'
import {
  Search, Plus, Pencil, Trash2, X, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Eye, RefreshCw, Calendar, Printer,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function isClassExpired(endDate) {
  if (!endDate) return false
  const todayStr = new Date().toISOString().split('T')[0]
  const endStr = new Date(endDate).toISOString().split('T')[0]
  return todayStr > endStr
}

export function computeClassEndDate(member) {
  if (!member.start_date) return member.end_date || null
  const durationMap = { daily: 0, monthly: 30 }
  const days = durationMap[member.subscription_type] ?? 0
  if (days === 0 && member.subscription_type !== 'daily') return member.end_date || null
  const start = new Date(member.start_date)
  start.setDate(start.getDate() + days)
  return start.toISOString().split('T')[0]
}

export function classMemberDisplayName(m) {
  const name = `${m.first_name || ''} ${m.last_name || ''}`.trim()
  return name || 'Walk-in Customer'
}

function toYearMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
function formatYearMonth(ym) {
  const [y, m] = ym.split('-')
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}
function monthBounds(ym) {
  const [y, m] = ym.split('-').map(Number)
  return {
    from: new Date(y, m - 1, 1).toISOString().split('T')[0],
    to:   new Date(y, m, 0).toISOString().split('T')[0],
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 10
const CLASS_TYPES = ['all', 'aerobics', 'zumba']
const PLAN_TYPES = ['all', 'daily', 'monthly']
const DEFAULT_FILTERS = { classType: 'all', planType: 'all', statusFilter: 'all', membershipStatus: 'all' }
const FIXED_PRICES = { daily: 5, monthly: 40 }

// ─── Badges ──────────────────────────────────────────────────────────────────
function StatusBadge({ expired }) {
  return expired ? (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border bg-red-500/20 text-red-400 border-red-500/30">
      <XCircle size={12} /> Expired
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border bg-green-500/20 text-green-400 border-green-500/30">
      <CheckCircle size={12} /> Active
    </span>
  )
}

function PlanBadge({ type }) {
  const colors = {
    daily:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    monthly: 'bg-green-500/20 text-green-400 border-green-500/30',
  }
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium border capitalize ${colors[type] ?? 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
      {type}
    </span>
  )
}

function ClassTypeBadge({ type }) {
  const colors = {
    aerobics: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    zumba:    'bg-pink-500/20 text-pink-400 border-pink-500/30',
  }
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium border capitalize ${colors[type] ?? 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
      {type}
    </span>
  )
}

function MembershipStatusBadge({ status }) {
  const isNew = status !== 'renewed'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${
      isNew ? 'bg-electric-blue/20 text-electric-blue border-electric-blue/30' : 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    }`}>
      {isNew ? 'New' : 'Renewed'}
    </span>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({ member, onClose, onRenew }) {
  const endDate = computeClassEndDate(member)
  const expired = isClassExpired(endDate)
  const fmt = (d) => d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-navy-800 rounded-xl w-full max-w-md p-6 border border-navy-700">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-xl font-bold text-white">{classMemberDisplayName(member)}</h3>
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
            <span className="text-slate-400 text-sm">Class</span>
            <ClassTypeBadge type={member.class_type} />
          </div>
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
            <PlanBadge type={member.subscription_type} />
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
          {expired && (
            <button onClick={() => { onClose(); onRenew(member) }} className="flex items-center gap-2 px-5 py-2 bg-electric-blue text-white rounded-lg font-semibold hover:opacity-90 text-sm">
              <RefreshCw size={15} /> Renew
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Renew Modal ──────────────────────────────────────────────────────────────
function RenewModal({ member, onClose, onSuccess }) {
  const [classType, setClassType]       = useState(member.class_type || 'aerobics')
  const [subscriptionType, setSubscriptionType] = useState(member.subscription_type === 'daily' ? 'monthly' : member.subscription_type)
  const [startDate, setStartDate]       = useState(new Date().toISOString().split('T')[0])
  const [discountType, setDiscountType] = useState('none')
  const [discountValue, setDiscountValue] = useState(0)
  const [fullName, setFullName]         = useState(`${member.first_name || ''} ${member.last_name || ''}`.trim())
  const [phoneNumber, setPhoneNumber]   = useState(member.phone_number || '')
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState(null)

  const wasDaily   = member.subscription_type === 'daily'
  const switchingFromDaily = wasDaily && subscriptionType !== 'daily'
  const DAILY_UPGRADE_DISCOUNT = 5

  const rawBasePrice = FIXED_PRICES[subscriptionType] || 0
  const basePrice    = switchingFromDaily ? Math.max(0, rawBasePrice - DAILY_UPGRADE_DISCOUNT) : rawBasePrice
  const discVal      = parseFloat(discountValue) || 0
  const amountPaid   = discountType === 'percentage'
    ? Math.max(0, basePrice - basePrice * (discVal / 100))
    : discountType === 'fixed' ? Math.max(0, basePrice - discVal) : basePrice

  const infoMissing = switchingFromDaily && (!fullName.trim() || !phoneNumber.trim())

  const handleRenew = async () => {
    setError(null)
    if (infoMissing) { setError('Please enter a name and phone number for this membership.'); return }
    setLoading(true)
    const durationMap = { daily: 0, monthly: 30 }
    const start = new Date(startDate)
    start.setDate(start.getDate() + durationMap[subscriptionType])
    const endDateStr = start.toISOString().split('T')[0]

    const updatePayload = {
      class_type: classType,
      subscription_type: subscriptionType,
      base_price: basePrice,
      discount_type: discountType,
      discount_value: discVal,
      amount_paid: amountPaid,
      start_date: startDate,
      end_date: endDateStr,
      renewal_count: (member.renewal_count || 0) + 1,
    }
    if (switchingFromDaily) {
      const parts = fullName.trim().split(/\s+/).filter(Boolean)
      updatePayload.first_name = parts[0] || ''
      updatePayload.last_name = parts.slice(1).join(' ')
      updatePayload.phone_number = phoneNumber.trim()
    }

    const { error: err } = await supabase.from('class_members').update(updatePayload).eq('id', member.id)
    setLoading(false)
    if (err) { setError(err.message); return }
    onSuccess()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-navy-800 rounded-xl w-full max-w-md p-6 border border-navy-700">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h3 className="text-xl font-bold text-white">Renew Class Membership</h3>
            <p className="text-slate-400 text-sm mt-0.5">{classMemberDisplayName(member)}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={24} /></button>
        </div>
        {error && <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>}
        {switchingFromDaily && (
          <div className="mb-4 p-3 bg-electric-blue/10 border border-electric-blue/30 rounded-lg text-electric-blue text-sm">
            Switching from Daily — $5 discount applied automatically, and this membership now needs a name and phone number.
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Class</label>
            <select value={classType} onChange={e => setClassType(e.target.value)} className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white">
              <option value="aerobics">Aerobics</option>
              <option value="zumba">Zumba</option>
            </select>
          </div>
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
            <label className="block text-sm text-slate-400 mb-1">Plan</label>
            <select value={subscriptionType} onChange={e => setSubscriptionType(e.target.value)} className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white">
              <option value="daily">Daily — ${FIXED_PRICES.daily}</option>
              <option value="monthly">Monthly — ${FIXED_PRICES.monthly}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">New Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white" />
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
          <button onClick={handleRenew} disabled={loading || infoMissing} className="flex items-center gap-2 px-5 py-2 bg-electric-blue text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 text-sm">
            <RefreshCw size={15} /> {loading ? 'Renewing…' : 'Confirm Renewal'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Month Navigator ──────────────────────────────────────────────────────────
function MonthNavigator({ value, onChange }) {
  const now = toYearMonth(new Date())
  const prev = () => {
    const [y, m] = value.split('-').map(Number)
    onChange(toYearMonth(new Date(y, m - 2, 1)))
  }
  const next = () => {
    const [y, m] = value.split('-').map(Number)
    onChange(toYearMonth(new Date(y, m, 1)))
  }
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

// ─── Main component ──────────────────────────────────────────────────────────
export default function Classes() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [members, setMembers]               = useState([])
  const [loading, setLoading]               = useState(true)
  const [search, setSearch]                 = useState('')
  const [filters, setFilters]               = useState(DEFAULT_FILTERS)
  const [selectedMonth, setSelectedMonth]   = useState(toYearMonth(new Date()))
  const [page, setPage]                     = useState(1)
  const [isModalOpen, setIsModalOpen]       = useState(false)
  const [currentMember, setCurrentMember]   = useState(null)
  const [detailMember, setDetailMember]     = useState(null)
  const [renewMember, setRenewMember]       = useState(null)

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    const { from, to } = monthBounds(selectedMonth)
    let query = supabase
      .from('class_members')
      .select('*')
      .gte('created_at', `${from}T00:00:00.000Z`)
      .lte('created_at', `${to}T23:59:59.999Z`)
      .order('created_at', { ascending: false })

    if (filters.classType !== 'all') query = query.eq('class_type', filters.classType)
    if (filters.planType !== 'all')  query = query.eq('subscription_type', filters.planType)

    const { data, error } = await query
    if (!error) setMembers(data || [])
    setLoading(false)
  }, [filters, selectedMonth])

  useEffect(() => { fetchMembers(); setPage(1) }, [fetchMembers])
  useEffect(() => { setSelectedMonth(toYearMonth(new Date())) }, [])

  const enriched = members.map(m => ({
    ...m,
    _computedEndDate: computeClassEndDate(m),
    get _expired() { return isClassExpired(this._computedEndDate) },
  }))

  const filtered = enriched.filter(m => {
    const q = search.toLowerCase()
    if (q) {
      const name = classMemberDisplayName(m).toLowerCase()
      if (!name.includes(q) && !(m.phone_number || '').includes(q)) return false
    }
    if (filters.statusFilter === 'active'  &&  m._expired) return false
    if (filters.statusFilter === 'expired' && !m._expired) return false
    if (filters.membershipStatus !== 'all' && (m.membership_status ?? 'new') !== filters.membershipStatus) return false
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const handleFilterChange = (key, value) => setFilters(prev => ({ ...prev, [key]: value }))
  const clearFilters = () => { setFilters(DEFAULT_FILTERS); setSearch(''); setPage(1) }
  const hasActiveFilters = search !== '' || filters.classType !== 'all' || filters.planType !== 'all' || filters.statusFilter !== 'all' || filters.membershipStatus !== 'all'

  const handleEdit = (m) => { setCurrentMember(m); setIsModalOpen(true) }
  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this class member?')) {
      await supabase.from('class_members').delete().eq('id', id)
      fetchMembers()
    }
  }

  const activeCount  = filtered.filter(m => !m._expired).length
  const expiredCount = filtered.filter(m =>  m._expired).length

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Classes — Aerobics & Zumba</h2>
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

      {/* Summary — admin only */}
      {isAdmin && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-navy-800 border border-navy-700 rounded-xl p-4">
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Members This Month</p>
            <p className="text-2xl font-bold text-white">{loading ? '—' : filtered.length}</p>
          </div>
          <div className="bg-navy-800 border border-navy-700 rounded-xl p-4">
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Active</p>
            <p className="text-2xl font-bold text-green-400">{loading ? '—' : activeCount}</p>
          </div>
          <div className="bg-navy-800 border border-navy-700 rounded-xl p-4">
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Expired</p>
            <p className="text-2xl font-bold text-red-400">{loading ? '—' : expiredCount}</p>
          </div>
          <div className="bg-navy-800 border border-navy-700 rounded-xl p-4">
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Daily / Monthly</p>
            <p className="text-2xl font-bold text-white">
              {loading ? '—' : `${filtered.filter(m=>m.subscription_type==='daily').length} / ${filtered.filter(m=>m.subscription_type==='monthly').length}`}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
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
            {['all','active','expired'].map(s => (
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
            {['all','new','renewed'].map(s => (
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

        <div className="flex flex-wrap gap-2">
          {CLASS_TYPES.map(t => (
            <button key={t} onClick={() => handleFilterChange('classType', t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                filters.classType === t ? 'bg-electric-blue text-white' : 'bg-navy-900 text-slate-400 border border-navy-700 hover:border-slate-500'
              }`}
            >{t}</button>
          ))}
          <span className="text-slate-700">|</span>
          {PLAN_TYPES.map(t => (
            <button key={t} onClick={() => handleFilterChange('planType', t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                filters.planType === t ? 'bg-electric-blue text-white' : 'bg-navy-900 text-slate-400 border border-navy-700 hover:border-slate-500'
              }`}
            >{t}</button>
          ))}
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-navy-700">
         
          {hasActiveFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
              <X size={14} /> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-navy-800 rounded-xl border border-navy-700 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-navy-900 border-b border-navy-700 text-slate-400 text-sm">
            <tr>
              <th className="p-4">Member</th>
              <th className="p-4 hidden md:table-cell">Contact</th>
              <th className="p-4">Class</th>
              <th className="p-4">Plan</th>
              <th className="p-4 hidden sm:table-cell">Start</th>
              <th className="p-4 hidden lg:table-cell">End</th>
              <th className="p-4">Status</th>
              <th className="p-4">Amount</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="p-8 text-center text-slate-500">Loading…</td></tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center">
                  <p className="text-slate-500">No class memberships found for {formatYearMonth(selectedMonth)}.</p>
                  <p className="text-slate-600 text-sm mt-1">Try navigating to a different month.</p>
                </td>
              </tr>
            ) : (
              paginated.map(m => (
                <tr key={m.id} className={`border-b border-navy-700 transition-colors ${m._expired ? 'bg-red-950/20 hover:bg-red-950/30' : 'hover:bg-navy-900/50'}`}>
                  <td className="p-4">
                    <p className="text-white font-medium">{classMemberDisplayName(m)}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{new Date(m.created_at).toLocaleDateString()}</p>
                  </td>
                  <td className="p-4 hidden md:table-cell text-slate-400 text-sm">{m.phone_number || '—'}</td>
                  <td className="p-4"><ClassTypeBadge type={m.class_type} /></td>
                  <td className="p-4"><PlanBadge type={m.subscription_type} /></td>
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
                  <td className="p-4">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setDetailMember(m)} className="p-2 text-slate-400 hover:text-white transition-colors" title="View details">
                        <Eye size={17} />
                      </button>
                      {m._expired && (
                        <button onClick={() => setRenewMember(m)} className="p-2 text-slate-400 hover:text-electric-blue transition-colors" title="Renew">
                          <RefreshCw size={17} />
                        </button>
                      )}
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

      {/* Pagination */}
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

      {/* Modals */}
      {isModalOpen && (
        <ClassMemberModal member={currentMember} onClose={() => { setIsModalOpen(false); fetchMembers() }} />
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