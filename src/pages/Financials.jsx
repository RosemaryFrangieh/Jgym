import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { DollarSign, TrendingUp, Wallet, ShoppingBag, Package, BarChart2, Plus, Pencil, Trash2, X, Check, Calendar } from 'lucide-react'
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

const UNIT_LABEL = { piece: 'units', kg: 'kg', liter: 'L', session: 'sessions', month: 'months' }

// Local date key (YYYY-MM-DD) in user's timezone
const localDateKey = (d) => {
  const dt = d instanceof Date ? d : new Date(d)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const todayKey = () => localDateKey(new Date())

// Migrate old { itemId: count } format to new { 'YYYY-MM-DD': { itemId: count } }
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

const FILTER_OPTIONS = [
  { id: 'day', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'custom', label: 'Custom' },
]

export default function Financials() {
  const [stats, setStats] = useState({ total: 0, daily: 0, weekly: 0, monthly: 0 })
  const [recent, setRecent] = useState([])
  const [filterType, setFilterType] = useState('day')
  const [customRange, setCustomRange] = useState({ start: todayKey(), end: todayKey() })

  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gym_shop_items') || '[]') } catch { return [] }
  })
  const [itemSales, setItemSales] = useState(() => migrateItemSales(localStorage.getItem('gym_item_sales')))
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  // Re-read sales from localStorage when page is focused (in case Dashboard changed it)
  useEffect(() => {
    const onFocus = () => setItemSales(migrateItemSales(localStorage.getItem('gym_item_sales')))
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  // Compute the active date range based on filter
  const getRange = () => {
    const today = new Date()
    const todayStr = todayKey()
    if (filterType === 'day') return { start: todayStr, end: todayStr }
    if (filterType === 'week') {
      const start = new Date(today)
      start.setDate(today.getDate() - 6)
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
    const { data } = await supabase.from('members').select('*').order('created_at', { ascending: false })
    if (data) {
      const filtered = data.filter(m => inRange(m.created_at))
      const total = filtered.reduce((sum, m) => sum + parseFloat(m.amount_paid || 0), 0)
      const daily = filtered.filter(m => m.subscription_type === 'daily').reduce((sum, m) => sum + parseFloat(m.amount_paid || 0), 0)
      const weekly = filtered.filter(m => m.subscription_type === 'weekly').reduce((sum, m) => sum + parseFloat(m.amount_paid || 0), 0)
      const monthly = filtered.filter(m => m.subscription_type === 'monthly').reduce((sum, m) => sum + parseFloat(m.amount_paid || 0), 0)
      setStats({ total, daily, weekly, monthly })
      setRecent(filtered.slice(0, 8))
    }
  }

  useEffect(() => { fetchFinancials() }, [filterType, customRange.start, customRange.end])

  useEffect(() => {
    localStorage.setItem('gym_shop_items', JSON.stringify(items))
  }, [items])

  // Get sales for an item within the active range (aggregates all dates in range)
  const getSales = (id) => {
    return Object.entries(itemSales).reduce((sum, [dateKey, dayData]) => {
      if (dateKey >= range.start && dateKey <= range.end) {
        return sum + (dayData[id] ?? 0)
      }
      return sum
    }, 0)
  }

  const getItemRevenue = (item) => getSales(item.id) * parseFloat(item.price)
  const totalItemRevenue = items.reduce((sum, item) => sum + getItemRevenue(item), 0)
  const totalItemsSold = items.reduce((sum, item) => sum + getSales(item.id), 0)
  const grandTotal = stats.total + totalItemRevenue

  const handleSaveItem = (data) => {
    if (editingItem !== null) {
      setItems(prev => prev.map((it, i) => i === editingItem ? { ...it, ...data } : it))
    } else {
      setItems(prev => [...prev, { id: Date.now(), ...data }])
    }
    setShowItemModal(false)
    setEditingItem(null)
  }

  const handleDeleteItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx))
    setDeleteConfirm(null)
  }

  const pieData = [
    { name: 'Daily Subs', value: stats.daily },
    { name: 'Weekly Subs', value: stats.weekly },
    { name: 'Monthly Subs', value: stats.monthly },
  ].filter(d => d.value > 0)

  const itemBarData = items.map(it => ({
    name: it.name.length > 12 ? it.name.slice(0, 11) + '…' : it.name,
    revenue: parseFloat(getItemRevenue(it).toFixed(2)),
    sales: getSales(it.id),
  }))

  const dateInputClass = "bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-electric-blue transition-colors [color-scheme:dark]"

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-2xl font-bold text-white">Financial Overview</h2>
        <div className="text-slate-400 text-sm flex items-center gap-2">
          <Calendar size={14} />
          <span>Range: <span className="text-white font-medium">{range.start}</span> → <span className="text-white font-medium">{range.end}</span></span>
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
            <input
              type="date"
              value={customRange.start}
              onChange={e => setCustomRange(r => ({ ...r, start: e.target.value }))}
              className={dateInputClass}
            />
            <span className="text-slate-500">→</span>
            <input
              type="date"
              value={customRange.end}
              onChange={e => setCustomRange(r => ({ ...r, end: e.target.value }))}
              className={dateInputClass}
            />
          </div>
        )}
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5">
        <div className="bg-gradient-to-br from-electric-blue to-blue-700 p-6 rounded-xl shadow-lg flex items-center justify-between col-span-1 sm:col-span-2 xl:col-span-1">
          <div>
            <p className="text-blue-100 text-sm">Grand Total Revenue</p>
            <h3 className="text-3xl font-bold text-white">${grandTotal.toFixed(2)}</h3>
            <p className="text-blue-200 text-xs mt-1">Memberships + Shop (in range)</p>
          </div>
          <Wallet size={40} className="text-white/80" />
        </div>
        <div className="bg-navy-800 p-6 rounded-xl border border-navy-700 flex items-center gap-4">
          <div className="p-3 bg-electric-green/10 rounded-lg text-electric-green"><TrendingUp size={28} /></div>
          <div>
            <p className="text-slate-400 text-sm">Membership Revenue</p>
            <h3 className="text-2xl font-bold text-white">${stats.total.toFixed(2)}</h3>
          </div>
        </div>
        <div className="bg-navy-800 p-6 rounded-xl border border-navy-700 flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 rounded-lg text-purple-400"><ShoppingBag size={28} /></div>
          <div>
            <p className="text-slate-400 text-sm">Shop Revenue</p>
            <h3 className="text-2xl font-bold text-white">${totalItemRevenue.toFixed(2)}</h3>
          </div>
        </div>
        <div className="bg-navy-800 p-6 rounded-xl border border-navy-700 flex items-center gap-4">
          <div className="p-3 bg-pink-500/10 rounded-lg text-pink-400"><Package size={28} /></div>
          <div>
            <p className="text-slate-400 text-sm">Items Sold</p>
            <h3 className="text-2xl font-bold text-white">{totalItemsSold}</h3>
            <p className="text-slate-500 text-xs mt-0.5">in selected range</p>
          </div>
        </div>
        <div className="bg-navy-800 p-6 rounded-xl border border-navy-700 flex items-center gap-4">
          <div className="p-3 bg-orange-500/10 rounded-lg text-orange-500"><DollarSign size={28} /></div>
          <div>
            <p className="text-slate-400 text-sm">Monthly Subs</p>
            <h3 className="text-2xl font-bold text-white">${stats.monthly.toFixed(2)}</h3>
          </div>
        </div>
      </div>

      {/* Items Sold — per-item breakdown */}
      {items.length > 0 && (
        <div className="bg-navy-800 p-6 rounded-xl border border-navy-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Package size={20} className="text-pink-400" /> Items Sold — Breakdown
            <span className="ml-1 text-slate-500 text-sm font-normal">({totalItemsSold} total in range)</span>
          </h3>
          {totalItemsSold === 0 ? (
            <p className="text-slate-500 text-sm py-4">No items sold in this range.</p>
          ) : (
            <div className="space-y-3">
              {items
                .map((item, idx) => ({ item, idx, qty: getSales(item.id) }))
                .sort((a, b) => b.qty - a.qty)
                .map(({ item, idx, qty }) => {
                  const colorClass = ITEM_COLORS[idx % ITEM_COLORS.length]
                  const maxQty = Math.max(...items.map(i => getSales(i.id)), 1)
                  return (
                    <div key={item.id} className="flex items-center gap-3">
                      <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colorClass}`}>
                        {item.name}
                      </span>
                      <div className="flex-1">
                        <div className="h-1.5 bg-navy-700 rounded-full overflow-hidden">
                          <div className="h-full bg-electric-blue rounded-full" style={{ width: `${(qty / maxQty) * 100}%` }} />
                        </div>
                      </div>
                      <span className="shrink-0 text-white font-semibold text-sm w-16 text-right">{qty} {UNIT_LABEL[item.unit] || 'units'}</span>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-navy-800 p-6 rounded-xl border border-navy-700">
          <h3 className="text-lg font-semibold text-white mb-4">Revenue Breakdown</h3>
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
                <Tooltip
                  formatter={(v, name) => name === 'revenue' ? `$${v.toFixed(2)}` : `${v} sold`}
                  contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px' }}
                />
                <Bar dataKey="revenue" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Membership Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-navy-800 p-6 rounded-xl border border-navy-700">
          <h3 className="text-lg font-semibold text-white mb-4">Membership Breakdown</h3>
          <div className="space-y-3">
            {[
              { label: 'Daily Subscriptions', value: stats.daily, color: 'bg-electric-blue' },
              { label: 'Weekly Subscriptions', value: stats.weekly, color: 'bg-electric-green' },
              { label: 'Monthly Subscriptions', value: stats.monthly, color: 'bg-orange-500' },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${row.color} shrink-0`} />
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">{row.label}</span>
                    <span className="text-white font-semibold">${row.value.toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 bg-navy-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${row.color} rounded-full`}
                      style={{ width: stats.total > 0 ? `${(row.value / stats.total) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-navy-800 p-6 rounded-xl border border-navy-700">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Transactions</h3>
          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {recent.map(m => (
              <div key={m.id} className="flex justify-between items-center border-b border-navy-700 pb-3">
                <div>
                  <p className="text-white font-medium">{`${m.first_name || ''} ${m.last_name || ''}`.trim() || 'Walk-in Customer'}</p>
                  <p className="text-slate-400 text-sm capitalize">{m.subscription_type} subscription</p>
                </div>
                <span className="text-electric-green font-semibold">+${m.amount_paid}</span>
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
          <button
            onClick={() => { setEditingItem(null); setShowItemModal(true) }}
            className="flex items-center gap-2 px-4 py-2.5 bg-electric-green text-navy-900 font-semibold rounded-lg text-sm hover:brightness-110 transition-all"
          >
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
                      <button
                        onClick={() => { setEditingItem(idx); setShowItemModal(true) }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-electric-blue hover:bg-electric-blue/10 transition-colors"
                      ><Pencil size={14} /></button>
                      <button
                        onClick={() => setDeleteConfirm(idx)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      ><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <h4 className="text-white font-semibold text-base mb-1 truncate">{item.name}</h4>
                  <p className="text-2xl font-bold text-electric-green">${parseFloat(item.price).toFixed(2)}</p>

                  {/* Sold in range stats */}
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
    </div>
  )
}