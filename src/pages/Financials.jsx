import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { DollarSign, TrendingUp, Wallet, ShoppingBag, Package, BarChart2, Plus, Pencil, Trash2, X, Check, Calendar, Dumbbell, Activity, UserCheck } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

const COLORS = ['#3b82f6', '#00ff88', '#f97316', '#a855f7', '#ec4899', '#eab308']

const ITEM_COLORS = [
  'bg-electric-blue/10 text-electric-blue border-electric-blue/20',
  'bg-electric-green/10 text-electric-green border-electric-green/20',
  'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'bg-pink-500/10 text-pink-400 border-pink-500/20',
  'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
]

const localDateKey = (d) => {
  const dt = d instanceof Date ? d : new Date(d)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const todayKey = () => localDateKey(new Date())

function migrateItemSales(raw) {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const keys = Object.keys(parsed)
    if (keys.length === 0) return {}
    if (/^\d{4}-\d{2}-\d{2}$/.test(keys[0])) return parsed
    return { [todayKey()]: parsed }
  } catch {
    return {}
  }
}

const FILTER_OPTIONS = [
  { id: 'day', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'custom', label: 'Custom' },
]

const dateInputClass = "bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-electric-blue transition-colors [color-scheme:dark]"

function ItemModal({ item, onClose, onSave }) {
  const [form, setForm] = useState(item || { name: '', price: '', unit: 'piece', stock: '' })
  const [error, setError] = useState('')

  const handleSubmit = () => {
    if (!form.name.trim()) return setError('Item name is required.')
    if (!form.price || isNaN(parseFloat(form.price)) || parseFloat(form.price) < 0)
      return setError('Enter a valid price.')
    setError('')
    onSave({ ...form, price: parseFloat(parseFloat(form.price).toFixed(2)), stock: form.stock === '' ? null : parseInt(form.stock) })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-navy-800 border border-navy-700 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-navy-700">
          <h3 className="text-lg font-semibold text-white">{item ? 'Edit Item' : 'New Item for Sale'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && <p className="text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className="block text-slate-400 text-sm mb-1">Item Name</label>
            <input
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-electric-blue transition-colors"
              placeholder="e.g. Protein Shake"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 text-sm mb-1">Price ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-electric-blue transition-colors"
                placeholder="0.00"
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Unit</label>
              <select
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-electric-blue transition-colors"
                value={form.unit}
                onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
              >
                <option value="piece">Per Piece</option>
                <option value="kg">Per KG</option>
                <option value="liter">Per Liter</option>
                <option value="session">Per Session</option>
                <option value="month">Per Month</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-slate-400 text-sm mb-1">Stock Qty <span className="text-slate-500">(optional)</span></label>
            <input
              type="number"
              min="0"
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-electric-blue transition-colors"
              placeholder="Leave blank if unlimited"
              value={form.stock ?? ''}
              onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-navy-700">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-navy-600 text-slate-400 hover:text-white hover:border-navy-500 transition-colors text-sm font-medium">Cancel</button>
          <button onClick={handleSubmit} className="flex-1 py-2.5 rounded-lg bg-electric-blue text-white font-medium text-sm hover:bg-blue-600 transition-colors flex items-center justify-center gap-2">
            <Check size={16} /> {item ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
      </div>
    </div>
  )
}

function UpgradedMembersModal({ onClose }) {
  const [filterType, setFilterType] = useState('day')
  const [customRange, setCustomRange] = useState({ start: todayKey(), end: todayKey() })
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)

  const getRange = () => {
    const today = new Date()
    const todayStr = todayKey()
    if (filterType === 'day') return { start: todayStr, end: todayStr }
    if (filterType === 'yesterday') {
      const y = new Date(today); y.setDate(today.getDate() - 1)
      return { start: localDateKey(y), end: localDateKey(y) }
    }
    if (filterType === 'week') {
      const start = new Date(today); start.setDate(today.getDate() - 6)
      return { start: localDateKey(start), end: todayStr }
    }
    if (filterType === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      return { start: localDateKey(start), end: todayStr }
    }
    return { start: customRange.start || todayStr, end: customRange.end || todayStr }
  }

  const range = getRange()

  useEffect(() => {
    const fetchUpgraded = async () => {
      setLoading(true)
      const [membersRes, classesRes] = await Promise.all([
        supabase.from('members').select('*').eq('was_daily', true),
        supabase.from('class_members').select('*').eq('was_daily', true)
      ])
      
      const membersData = (membersRes.data || []).map(m => ({
        ...m, category: 'Gym', name: `${m.first_name || ''} ${m.last_name || ''}`.trim() || 'Walk-in', sub_type: m.subscription_type
      }))
      const classesData = (classesRes.data || []).map(c => ({
        ...c, category: 'Class', name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Walk-in', sub_type: `${c.class_type} (${c.subscription_type})`
      }))
      
      const allRecords = [...membersData, ...classesData]
        .filter(r => {
          if (!r.start_date) return false
          const d = localDateKey(new Date(r.start_date))
          return d >= range.start && d <= range.end
        })
        .sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
        
      setRecords(allRecords)
      setLoading(false)
    }
    fetchUpgraded()
  }, [filterType, customRange.start, customRange.end])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-navy-800 border border-navy-700 rounded-2xl w-full max-w-5xl mx-4 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-navy-700">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <UserCheck size={20} className="text-purple-400" /> Daily Upgraded Members
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
        </div>
        
        <div className="px-6 py-4 border-b border-navy-700 flex flex-wrap items-center gap-3">
          <div className="flex gap-1 bg-navy-900 rounded-lg p-1">
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setFilterType(opt.id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filterType === opt.id ? 'bg-electric-blue text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {filterType === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={customRange.start} onChange={e => setCustomRange(r => ({ ...r, start: e.target.value }))} className={dateInputClass} />
              <span className="text-slate-500">→</span>
              <input type="date" value={customRange.end} onChange={e => setCustomRange(r => ({ ...r, end: e.target.value }))} className={dateInputClass} />
            </div>
          )}
        </div>

        <div className="overflow-auto">
          <table className="w-full text-left">
            <thead className="bg-navy-900 border-b border-navy-700 text-slate-400 text-sm sticky top-0">
              <tr>
                <th className="p-4">Name</th>
                <th className="p-4">Category</th>
                <th className="p-4">Phone</th>
                <th className="p-4">New Plan</th>
                <th className="p-4">Renewal Date</th>
                <th className="p-4">Amount Paid</th>
                <th className="p-4">Renewals</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-500">Loading...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-500">No upgraded members in this range.</td></tr>
              ) : (
                records.map(r => (
                  <tr key={`${r.category}-${r.id}`} className="border-b border-navy-700 hover:bg-navy-900/50">
                    <td className="p-4 text-white font-medium">{r.name}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${r.category === 'Gym' ? 'bg-electric-blue/20 text-electric-blue border-electric-blue/30' : 'bg-pink-500/20 text-pink-400 border-pink-500/30'}`}>
                        {r.category}
                      </span>
                    </td>
                    <td className="p-4 text-slate-400 text-sm">{r.phone_number || '—'}</td>
                    <td className="p-4 text-slate-300 capitalize text-sm">{r.sub_type}</td>
                    <td className="p-4 text-slate-400 text-sm">{r.start_date ? new Date(r.start_date).toLocaleDateString() : '—'}</td>
                    <td className="p-4 text-electric-green font-semibold">${r.amount_paid}</td>
                    <td className="p-4 text-slate-400 text-sm">{r.renewal_count || 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function Financials() {
  const [stats, setStats] = useState({
    gymTotal: 0, gymDaily: 0, gymWeekly: 0, gymBiweekly: 0, gymTriweekly: 0, gymMonthly: 0,
    classesTotal: 0, classDaily: 0, classMonthly: 0
  })
  const [recent, setRecent] = useState([])
  const [filterType, setFilterType] = useState('day')
  const [customRange, setCustomRange] = useState({ start: todayKey(), end: todayKey() })
  const [showUpgradedModal, setShowUpgradedModal] = useState(false)

  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gym_shop_items') || '[]') } catch { return [] }
  })
  const [itemSales, setItemSales] = useState(() => migrateItemSales(localStorage.getItem('gym_item_sales')))
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  useEffect(() => {
    const onFocus = () => setItemSales(migrateItemSales(localStorage.getItem('gym_item_sales')))
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const getRange = () => {
    const today = new Date()
    const todayStr = todayKey()
    if (filterType === 'day') return { start: todayStr, end: todayStr }
    if (filterType === 'yesterday') {
      const y = new Date(today); y.setDate(today.getDate() - 1)
      return { start: localDateKey(y), end: localDateKey(y) }
    }
    if (filterType === 'week') {
      const start = new Date(today); start.setDate(today.getDate() - 6)
      return { start: localDateKey(start), end: todayStr }
    }
    if (filterType === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      return { start: localDateKey(start), end: todayStr }
    }
    return { start: customRange.start || todayStr, end: customRange.end || todayStr }
  }

  const range = getRange()

  const inRange = (isoStr) => {
    if (!isoStr) return false
    const d = localDateKey(new Date(isoStr))
    return d >= range.start && d <= range.end
  }

  const fetchFinancials = async () => {
    const [membersRes, classesRes] = await Promise.all([
      supabase.from('members').select('*').order('created_at', { ascending: false }),
      supabase.from('class_members').select('*').order('created_at', { ascending: false })
    ])

    const membersData = membersRes.data || []
    const classesData = classesRes.data || []

    const filteredMembers = membersData.filter(m => inRange(m.created_at))
    const filteredClasses = classesData.filter(c => inRange(c.created_at))

    const gymTotal = filteredMembers.reduce((sum, m) => sum + parseFloat(m.amount_paid || 0), 0)
    const gymDaily = filteredMembers.filter(m => m.subscription_type === 'daily').reduce((sum, m) => sum + parseFloat(m.amount_paid || 0), 0)
    const gymWeekly = filteredMembers.filter(m => m.subscription_type === 'weekly').reduce((sum, m) => sum + parseFloat(m.amount_paid || 0), 0)
    const gymBiweekly = filteredMembers.filter(m => m.subscription_type === 'biweekly').reduce((sum, m) => sum + parseFloat(m.amount_paid || 0), 0)
    const gymTriweekly = filteredMembers.filter(m => m.subscription_type === 'triweekly').reduce((sum, m) => sum + parseFloat(m.amount_paid || 0), 0)
    const gymMonthly = filteredMembers.filter(m => m.subscription_type === 'monthly').reduce((sum, m) => sum + parseFloat(m.amount_paid || 0), 0)

    const classesTotal = filteredClasses.reduce((sum, c) => sum + parseFloat(c.amount_paid || 0), 0)
    const classDaily = filteredClasses.filter(c => c.subscription_type === 'daily').reduce((sum, c) => sum + parseFloat(c.amount_paid || 0), 0)
    const classMonthly = filteredClasses.filter(c => c.subscription_type === 'monthly').reduce((sum, c) => sum + parseFloat(c.amount_paid || 0), 0)

    setStats({ 
      gymTotal, gymDaily, gymWeekly, gymBiweekly, gymTriweekly, gymMonthly, 
      classesTotal, classDaily, classMonthly 
    })

    const mappedMembers = filteredMembers.map(m => ({
      id: `gym-${m.id}`, type: 'Gym', name: `${m.first_name || ''} ${m.last_name || ''}`.trim() || 'Walk-in',
      sub_type: m.subscription_type, amount: m.amount_paid, created_at: m.created_at
    }))

    const mappedClasses = filteredClasses.map(c => ({
      id: `cls-${c.id}`, type: 'Class', name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Walk-in',
      sub_type: `${c.class_type} (${c.subscription_type})`, amount: c.amount_paid, created_at: c.created_at
    }))

    const mergedRecent = [...mappedMembers, ...mappedClasses]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 8)

    setRecent(mergedRecent)
  }

  useEffect(() => { fetchFinancials() }, [filterType, customRange.start, customRange.end])
  useEffect(() => { localStorage.setItem('gym_shop_items', JSON.stringify(items)) }, [items])

  const getSales = (id) => {
    return Object.entries(itemSales).reduce((sum, [dateKey, dayData]) => {
      if (dateKey >= range.start && dateKey <= range.end) return sum + (dayData[id] ?? 0)
      return sum
    }, 0)
  }

  const getItemRevenue = (item) => getSales(item.id) * parseFloat(item.price)
  const totalItemRevenue = items.reduce((sum, item) => sum + getItemRevenue(item), 0)
  const totalItemsSold = items.reduce((sum, item) => sum + getSales(item.id), 0)
  
  const totalSubscriptionsRevenue = stats.gymTotal + stats.classesTotal
  const grandTotal = totalSubscriptionsRevenue + totalItemRevenue

  const handleSaveItem = (data) => {
    if (editingItem !== null) {
      setItems(prev => prev.map((it, i) => i === editingItem ? { ...it, ...data } : it))
    } else {
      setItems(prev => [...prev, { id: Date.now(), ...data }])
    }
    setShowItemModal(false); setEditingItem(null)
  }

  const handleDeleteItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx)); setDeleteConfirm(null)
  }

  const pieData = [
    { name: 'Gym Subscriptions', value: stats.gymTotal },
    { name: 'Classes', value: stats.classesTotal },
    { name: 'Shop Items', value: totalItemRevenue },
  ].filter(d => d.value > 0)

  const itemBarData = items.map(it => ({
    name: it.name.length > 12 ? it.name.slice(0, 11) + '…' : it.name,
    revenue: parseFloat(getItemRevenue(it).toFixed(2)), sales: getSales(it.id),
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-2xl font-bold text-white">Financial Overview</h2>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowUpgradedModal(true)} 
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg font-semibold text-sm hover:bg-purple-600 transition-colors"
          >
            <UserCheck size={16} /> Review Daily Upgraded
          </button>
          <div className="text-slate-400 text-sm flex items-center gap-2">
            <Calendar size={14} />
            <span>Range: <span className="text-white font-medium">{range.start}</span> → <span className="text-white font-medium">{range.end}</span></span>
          </div>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="bg-navy-800 p-4 rounded-xl border border-navy-700 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-slate-400" />
          <span className="text-slate-300 text-sm font-medium">Filter:</span>
        </div>
        <div className="flex gap-1 bg-navy-900 rounded-lg p-1">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setFilterType(opt.id)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filterType === opt.id ? 'bg-electric-blue text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {filterType === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={customRange.start} onChange={e => setCustomRange(r => ({ ...r, start: e.target.value }))} className={dateInputClass} />
            <span className="text-slate-500">→</span>
            <input type="date" value={customRange.end} onChange={e => setCustomRange(r => ({ ...r, end: e.target.value }))} className={dateInputClass} />
          </div>
        )}
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="bg-gradient-to-br from-electric-blue to-blue-700 p-6 rounded-xl shadow-lg flex items-center justify-between col-span-1 sm:col-span-2 xl:col-span-1">
          <div>
            <p className="text-blue-100 text-sm">Grand Total Revenue</p>
            <h3 className="text-3xl font-bold text-white">${grandTotal.toFixed(2)}</h3>
            <p className="text-blue-200 text-xs mt-1">Gym + Classes + Shop (in range)</p>
          </div>
          <Wallet size={40} className="text-white/80" />
        </div>
        <div className="bg-navy-800 p-6 rounded-xl border border-navy-700 flex items-center gap-4">
          <div className="p-3 bg-electric-green/10 rounded-lg text-electric-green"><Dumbbell size={28} /></div>
          <div>
            <p className="text-slate-400 text-sm">Gym Subscriptions</p>
            <h3 className="text-2xl font-bold text-white">${stats.gymTotal.toFixed(2)}</h3>
          </div>
        </div>
        <div className="bg-navy-800 p-6 rounded-xl border border-navy-700 flex items-center gap-4">
          <div className="p-3 bg-pink-500/10 rounded-lg text-pink-400"><Activity size={28} /></div>
          <div>
            <p className="text-slate-400 text-sm">Classes Revenue</p>
            <h3 className="text-2xl font-bold text-white">${stats.classesTotal.toFixed(2)}</h3>
            <p className="text-slate-500 text-xs mt-0.5">Aerobics & Zumba</p>
          </div>
        </div>
        <div className="bg-navy-800 p-6 rounded-xl border border-navy-700 flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 rounded-lg text-purple-400"><ShoppingBag size={28} /></div>
          <div>
            <p className="text-slate-400 text-sm">Shop Revenue</p>
            <h3 className="text-2xl font-bold text-white">${totalItemRevenue.toFixed(2)}</h3>
            <p className="text-slate-500 text-xs mt-0.5">{totalItemsSold} item{totalItemsSold !== 1 ? 's' : ''} sold</p>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-navy-800 p-6 rounded-xl border border-navy-700">
          <h3 className="text-lg font-semibold text-white mb-4">Revenue Sources Breakdown</h3>
          {pieData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-slate-500 text-sm">No revenue data for this range.</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => `$${v.toFixed(2)}`} contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-navy-800 p-6 rounded-xl border border-navy-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><BarChart2 size={20} /> Shop Items Revenue</h3>
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-slate-500 text-sm gap-2">
              <Package size={32} className="text-slate-700" />
              <p>No shop items yet. Add items below.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={itemBarData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <YAxis stroke="#94a3b8" tickFormatter={v => `$${v}`} />
                <Tooltip formatter={(v, name) => name === 'revenue' ? `$${v.toFixed(2)}` : `${v} sold`} contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px' }} />
                <Bar dataKey="revenue" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Membership & Classes Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-navy-800 p-6 rounded-xl border border-navy-700">
          <h3 className="text-lg font-semibold text-white mb-4">Subscriptions Breakdown</h3>
          <div className="space-y-3">
            {[
              { label: 'Gym - Daily', value: stats.gymDaily, total: totalSubscriptionsRevenue, color: 'bg-electric-blue' },
              { label: 'Gym - Weekly', value: stats.gymWeekly, total: totalSubscriptionsRevenue, color: 'bg-electric-green' },
              { label: 'Gym - 2 Weeks', value: stats.gymBiweekly, total: totalSubscriptionsRevenue, color: 'bg-purple-500' },
              { label: 'Gym - 3 Weeks', value: stats.gymTriweekly, total: totalSubscriptionsRevenue, color: 'bg-indigo-500' },
              { label: 'Gym - Monthly', value: stats.gymMonthly, total: totalSubscriptionsRevenue, color: 'bg-orange-500' },
              { label: 'Classes - Daily', value: stats.classDaily, total: totalSubscriptionsRevenue, color: 'bg-yellow-500' },
              { label: 'Classes - Monthly', value: stats.classMonthly, total: totalSubscriptionsRevenue, color: 'bg-pink-500' },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${row.color} shrink-0`} />
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">{row.label}</span>
                    <span className="text-white font-semibold">${row.value.toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 bg-navy-700 rounded-full overflow-hidden">
                    <div className={`h-full ${row.color} rounded-full`} style={{ width: row.total > 0 ? `${(row.value / row.total) * 100}%` : '0%' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-navy-800 p-6 rounded-xl border border-navy-700">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Transactions</h3>
          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {recent.map(t => (
              <div key={t.id} className="flex justify-between items-center border-b border-navy-700 pb-3">
                <div>
                  <p className="text-white font-medium">{t.name}</p>
                  <p className="text-slate-400 text-sm capitalize">
                    <span className={`inline-block w-2 h-2 rounded-full mr-1 align-middle ${t.type === 'Gym' ? 'bg-electric-green' : 'bg-pink-400'}`}></span>
                    {t.sub_type} {t.type === 'Gym' ? 'subscription' : ''}
                  </p>
                </div>
                <span className="text-electric-green font-semibold">+${t.amount}</span>
              </div>
            ))}
            {recent.length === 0 && <p className="text-slate-500 text-center py-8">No transactions in this range.</p>}
          </div>
        </div>
      </div>

      {/* ── Shop Items Section ── */}
      <div className="bg-navy-800 rounded-xl border border-navy-700 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-navy-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-electric-green/10 rounded-lg text-electric-green"><ShoppingBag size={22} /></div>
            <div>
              <h3 className="text-lg font-semibold text-white">Items for Sale</h3>
              <p className="text-slate-500 text-sm">{items.length} item{items.length !== 1 ? 's' : ''} listed · {totalItemsSold} sold in range</p>
            </div>
          </div>
          <button onClick={() => { setEditingItem(null); setShowItemModal(true) }} className="flex items-center gap-2 px-4 py-2.5 bg-electric-green text-navy-900 font-semibold rounded-lg text-sm hover:brightness-110 transition-all">
            <Plus size={17} /> Add Item
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 bg-navy-900 rounded-full mb-4"><Package size={36} className="text-slate-600" /></div>
            <p className="text-slate-400 font-medium">No items yet</p>
            <p className="text-slate-600 text-sm mt-1">Add products or services you sell at the gym</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 p-6">
            {items.map((item, idx) => {
              const colorClass = ITEM_COLORS[idx % ITEM_COLORS.length]
              const soldInRange = getSales(item.id)
              const revInRange = getItemRevenue(item)
              return (
                <div key={item.id} className="bg-navy-900 rounded-xl p-5 border border-navy-700 hover:border-navy-600 transition-colors group">
                  <div className="flex items-start justify-between mb-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colorClass}`}>
                      <Package size={12} /> {item.unit}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingItem(idx); setShowItemModal(true) }} className="p-1.5 rounded-lg text-slate-500 hover:text-electric-blue hover:bg-electric-blue/10 transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => setDeleteConfirm(idx)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <h4 className="text-white font-semibold text-base mb-1 truncate">{item.name}</h4>
                  <p className="text-2xl font-bold text-electric-green">${parseFloat(item.price).toFixed(2)}</p>
                  <div className="mt-3 pt-3 border-t border-navy-700 grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-slate-500 text-xs">Sold (range)</p>
                      <p className="text-white font-semibold text-sm">{soldInRange}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Revenue (range)</p>
                      <p className="text-electric-green font-semibold text-sm">${revInRange.toFixed(2)}</p>
                    </div>
                  </div>
                  {item.stock !== null && item.stock !== undefined && (
                    <p className={`text-xs mt-2 font-medium ${item.stock === 0 ? 'text-red-400' : item.stock < 5 ? 'text-orange-400' : 'text-slate-500'}`}>
                      {item.stock === 0 ? '⚠ Out of stock' : `${item.stock} in stock`}
                    </p>
                  )}
                  {deleteConfirm === idx && (
                    <div className="mt-3 pt-3 border-t border-navy-700">
                      <p className="text-red-400 text-xs mb-2">Remove this item?</p>
                      <div className="flex gap-2">
                        <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-1.5 rounded-lg text-xs border border-navy-600 text-slate-400 hover:text-white transition-colors">Cancel</button>
                        <button onClick={() => handleDeleteItem(idx)} className="flex-1 py-1.5 rounded-lg text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors font-medium">Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showItemModal && (
        <ItemModal
          item={editingItem !== null ? items[editingItem] : null}
          onClose={() => { setShowItemModal(false); setEditingItem(null) }}
          onSave={handleSaveItem}
        />
      )}

      {showUpgradedModal && <UpgradedMembersModal onClose={() => setShowUpgradedModal(false)} />}
    </div>
  )
}