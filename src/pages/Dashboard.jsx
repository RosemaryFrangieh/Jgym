import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import MemberModal from '../components/MemberModal'
import { useAuth } from '../context/AuthContext'
import { Users, UserPlus, AlertTriangle, Calendar, RefreshCw, ShoppingBag, ShoppingCart, Plus, Minus, MessageCircle, Check, Trash2, X } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
​
const TABLE_COLORS = ['#3b82f6', '#00ff88', '#f97316', '#a855f7', '#ec4899', '#eab308']
const UNIT_LABEL = { piece: 'units', kg: 'kg', liter: 'L', session: 'sessions', month: 'months' }
​
// ─── WhatsApp reminder settings — edit these to match your gym ──────────────────
const WHATSAPP_COUNTRY_CODE = '961' // Lebanon; used only when a saved number has no country code
const GYM_NAME = 'J-Gym'
​
// Turn a saved phone number into a wa.me-friendly international number (digits only, no +)
const toWhatsAppNumber = (raw) => {
  let digits = (raw || '').replace(/\D/g, '')
  if (!digits) return ''
  digits = digits.replace(/^0+/, '')
  if (WHATSAPP_COUNTRY_CODE && !digits.startsWith(WHATSAPP_COUNTRY_CODE) && digits.length <= 8) {
    digits = WHATSAPP_COUNTRY_CODE + digits
  }
  return digits
}
​
// The pre-filled reminder message — edit the wording however you like
const buildReminderMessage = (m, daysLabel) => {
  const name = `${m.first_name || ''} ${m.last_name || ''}`.trim() || 'there'
  const endDate = new Date(m.end_date).toLocaleDateString()
  return `Hello ${name}, this is a friendly reminder from ${GYM_NAME}. Your ${m.subscription_type} membership expires on ${endDate} (${daysLabel.toLowerCase()}). Please renew to keep your access with no interruption. See you at the gym! 💪`
}
​
const localDateKey = (d) => {
  const dt = d instanceof Date ? d : new Date(d)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const todayKey = () => localDateKey(new Date())
​
export default function Dashboard() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [stats, setStats] = useState({ total: 0, active: 0, newThisMonth: 0, expiring: [] })
  const [chartData, setChartData] = useState([
    { name: 'Daily', count: 0 }, { name: 'Weekly', count: 0 }, { name: 'Monthly', count: 0 }, { name: 'Custom', count: 0 }
  ])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [renewMember, setRenewMember] = useState(null)
  const [items, setItems] = useState([])
  const [todaySales, setTodaySales] = useState({}) // { itemId: qty } for today only
  const [shopLoading, setShopLoading] = useState(true)
  const [cart, setCart] = useState({}) // { itemId: qty } for the sale being rung up
  const [saving, setSaving] = useState(false)
  const [lastSale, setLastSale] = useState(null)
​
  // Tracks which expiring members have been sent a WhatsApp reminder, keyed by
  // member id + their current end date, so it resets automatically on renewal.
  const [sentReminders, setSentReminders] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gym_expiry_reminders') || '{}') } catch { return {} }
  })
​
  useEffect(() => { fetchDashboardData(); fetchShopData() }, [])
​
  // Keep shop data fresh if the Financials page (or another tab) added/edited items
  useEffect(() => {
    const onFocus = () => fetchShopData()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])
​
  const fetchShopData = async () => {
    setShopLoading(true)
    const tk = todayKey()
    const [itemsRes, salesRes] = await Promise.all([
      supabase.from('shop_items').select('*').order('created_at', { ascending: true }),
      supabase.from('shop_sales').select('item_id, quantity').eq('sale_date', tk),
    ])
    setItems(itemsRes.data || [])
    const salesMap = {}
    for (const row of salesRes.data || []) salesMap[row.item_id] = row.quantity
    setTodaySales(salesMap)
    setShopLoading(false)
  }
​
  const fetchDashboardData = async () => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const twoDaysFromNow = new Date(today); twoDaysFromNow.setDate(today.getDate() + 2); twoDaysFromNow.setHours(23, 59, 59, 999)
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const { data: members } = await supabase.from('members').select('*')
    if (members) {
      const active = members.filter(m => new Date(m.end_date) >= today)
      const newThisMonth = members.filter(m => new Date(m.start_date) >= startOfMonth)
      const expiring = members.filter(m => {
        const e = new Date(m.end_date)
        return e >= today && e <= twoDaysFromNow && m.subscription_type !== 'daily'
      })
      setStats({ total: members.length, active: active.length, newThisMonth: newThisMonth.length, expiring })
      setChartData([
        { name: 'Daily', count: active.filter(m => m.subscription_type === 'daily').length },
        { name: 'Weekly', count: active.filter(m => m.subscription_type === 'weekly').length },
        { name: 'Biweekly', count: active.filter(m => m.subscription_type === 'biweekly').length },
        { name: 'Triweekly', count: active.filter(m => m.subscription_type === 'triweekly').length },
        { name: 'Monthly', count: active.filter(m => m.subscription_type === 'monthly').length },
        { name: 'Custom', count: active.filter(m => m.subscription_type === 'custom').length },
      ])
    }
  }
​
  const handleRenew = (member) => { setRenewMember(member); setIsModalOpen(true) }
​
  const getDaysRemaining = (endDate) => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const end = new Date(endDate); end.setHours(0, 0, 0, 0)
    return Math.ceil((end - today) / (1000 * 60 * 60 * 24))
  }
  const getDaysColor = (d) => d === 0 ? 'text-red-500' : d === 1 ? 'text-red-400' : d === 2 ? 'text-orange-400' : 'text-yellow-400'
  const getDaysLabel = (d) => d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `${d} days`
​
  // ─── WhatsApp reminder helpers ───────────────────────────────────────────────
  const reminderKey = (m) => `${m.id}:${localDateKey(m.end_date)}`
  const isReminderSent = (m) => Boolean(sentReminders[reminderKey(m)])
​
  const sendWhatsApp = (m) => {
    const number = toWhatsAppNumber(m.phone_number)
    if (!number) { alert('This member has no valid phone number saved.'); return }
    const daysLabel = getDaysLabel(getDaysRemaining(m.end_date))
    const text = encodeURIComponent(buildReminderMessage(m, daysLabel))
    window.open(`https://wa.me/${number}?text=${text}`, '_blank')
    // Mark this membership cycle as reminded and persist it
    setSentReminders(prev => {
      const next = { ...prev, [reminderKey(m)]: new Date().toISOString() }
      try { localStorage.setItem('gym_expiry_reminders', JSON.stringify(next)) } catch {}
      return next
    })
  }
​
  // Today-only sales — automatically resets to 0 each new day (no row for today yet)
  const getSales = (id) => todaySales[id] ?? 0
  const getItemRevenue = (item) => getSales(item.id) * parseFloat(item.price)
  const totalItemRevenue = items.reduce((sum, item) => sum + getItemRevenue(item), 0)
  const totalItemsSoldToday = items.reduce((sum, item) => sum + getSales(item.id), 0)
​
  // Cart-based register: ring up a sale instead of editing per-item counters.
  const addToCart = (item) => setCart(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }))
  const setCartQty = (id, qty) => {
    const n = Math.max(0, parseInt(qty, 10) || 0)
    setCart(prev => {
      const next = { ...prev }
      if (n === 0) delete next[id]
      else next[id] = n
      return next
    })
  }
  const removeFromCart = (id) => setCart(prev => { const next = { ...prev }; delete next[id]; return next })
  const clearCart = () => setCart({})
​
  const cartLines = items.filter(it => (cart[it.id] || 0) > 0)
  const cartCount = cartLines.reduce((s, it) => s + cart[it.id], 0)
  const cartTotal = cartLines.reduce((s, it) => s + cart[it.id] * parseFloat(it.price), 0)
​
  // Commit the whole cart at once: add cart quantities on top of today's totals.
  const completeSale = async () => {
    if (cartLines.length === 0 || saving) return
    setSaving(true)
    const stamp = new Date().toISOString()
    const tk = todayKey()
    const rows = cartLines.map(it => ({
      item_id: it.id,
      sale_date: tk,
      quantity: (todaySales[it.id] ?? 0) + cart[it.id],
      updated_at: stamp,
    }))
    const { error } = await supabase
      .from('shop_sales')
      .upsert(rows, { onConflict: 'item_id,sale_date' })
    if (error) {
      alert('Could not record the sale. Please try again.')
    } else {
      setTodaySales(prev => {
        const next = { ...prev }
        for (const it of cartLines) next[it.id] = (next[it.id] ?? 0) + cart[it.id]
        return next
      })
      setLastSale({ count: cartCount, total: cartTotal })
      setCart({})
    }
    setSaving(false)
  }
​
  return (
    <div className="space-y-6">
      {/* Summary Cards — admin only */}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-navy-800 p-6 rounded-xl border border-navy-700 flex items-center gap-4">
            <div className="p-3 bg-electric-blue/10 rounded-lg text-electric-blue"><Users size={28} /></div>
            <div><p className="text-slate-400 text-sm">Total Active Members</p><h3 className="text-2xl font-bold text-white">{stats.active}</h3></div>
          </div>
          <div className="bg-navy-800 p-6 rounded-xl border border-navy-700 flex items-center gap-4">
            <div className="p-3 bg-electric-green/10 rounded-lg text-electric-green"><UserPlus size={28} /></div>
            <div><p className="text-slate-400 text-sm">New This Month</p><h3 className="text-2xl font-bold text-white">{stats.newThisMonth}</h3></div>
          </div>
          <div className="bg-navy-800 p-6 rounded-xl border border-navy-700 flex items-center gap-4">
            <div className="p-3 bg-orange-500/10 rounded-lg text-orange-500"><AlertTriangle size={28} /></div>
            <div><p className="text-slate-400 text-sm">Expiring (≤ 2 days)</p><h3 className="text-2xl font-bold text-white">{stats.expiring.length}</h3></div>
          </div>
        </div>
      )}
​
      <div className={`grid grid-cols-1 ${isAdmin ? 'lg:grid-cols-2' : ''} gap-6`}>
        {isAdmin && (
          <div className="bg-navy-800 p-6 rounded-xl border border-navy-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Calendar size={20} /> Subscription Breakdown</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" allowDecimals={false} />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px' }} />
                <Bar dataKey="count" fill="#00ff88" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
​
        <div className="bg-navy-800 p-6 rounded-xl border border-navy-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><AlertTriangle size={20} className="text-orange-500" /> Expiring Soon</h3>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
            {stats.expiring.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No memberships expiring soon.</p>
            ) : stats.expiring.map(m => {
              const daysLeft = getDaysRemaining(m.end_date)
              const sent = isReminderSent(m)
              return (
                <div key={m.id} className="flex justify-between items-center bg-navy-900 p-3 rounded-lg">
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-medium truncate">{m.first_name} {m.last_name}</p>
                    <p className="text-slate-400 text-sm">{m.phone_number}</p>
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <p className="text-orange-500 font-semibold text-sm capitalize">{m.subscription_type}</p>
                    <p className={`text-xs font-medium ${getDaysColor(daysLeft)}`}>{getDaysLabel(daysLeft)}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <button
                      onClick={() => sendWhatsApp(m)}
                      title={sent ? 'Reminder sent — click to send again' : 'Send WhatsApp reminder'}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${sent ? 'bg-electric-green/15 text-electric-green hover:bg-electric-green/25' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'}`}
                    >
                      {sent ? <Check size={14} /> : <MessageCircle size={14} />}
                      <span className="hidden sm:inline">{sent ? 'Sent' : 'WhatsApp'}</span>
                    </button>
                    <button onClick={() => handleRenew(m)} className="flex items-center gap-1.5 px-3 py-1.5 bg-electric-blue/10 text-electric-blue rounded-lg text-sm font-medium hover:bg-electric-blue/20 transition-colors">
                      <RefreshCw size={14} /><span className="hidden sm:inline">Renew</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
​
      {/* Shop Register - point-of-sale style: tap items into a cart, then check out */}
      {items.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Register: tap an item to add it to the current sale */}
          <div className="lg:col-span-2 bg-navy-800 rounded-xl border border-navy-700 overflow-hidden">
            <div className="px-6 py-5 border-b border-navy-700 flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <ShoppingBag size={20} className="text-purple-400" /> Shop Register
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  {todayKey()} · resets daily
                </span>
              </h3>
              <div className="text-right">
                <p className="text-slate-400 text-xs">Today's Revenue · {totalItemsSoldToday} sold</p>
                <p className="text-electric-green font-bold text-lg">${totalItemRevenue.toFixed(2)}</p>
              </div>
            </div>
            <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {items.map((item, idx) => {
                const color = TABLE_COLORS[idx % TABLE_COLORS.length]
                const inCart = cart[item.id] || 0
                return (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className="relative text-left bg-navy-900 rounded-xl p-4 border border-navy-700 hover:border-electric-green/60 active:scale-[0.98] transition-all"
                  >
                    {inCart > 0 && (
                      <span className="absolute top-2 right-2 min-w-[22px] h-[22px] px-1.5 flex items-center justify-center rounded-full bg-electric-green text-navy-900 text-xs font-bold">
                        {inCart}
                      </span>
                    )}
                    <div className="w-2 h-8 rounded-full mb-3" style={{ backgroundColor: color }} />
                    <p className="text-white font-semibold text-sm truncate">{item.name}</p>
                    <p className="text-slate-500 text-xs mb-2">per {item.unit}</p>
                    <p className="text-electric-green font-bold">${parseFloat(item.price).toFixed(2)}</p>
                    <p className="text-slate-600 text-[11px] mt-1">{getSales(item.id)} sold today</p>
                  </button>
                )
              })}
            </div>
          </div>
​
          {/* Current sale (cart / receipt) */}
          <div className="bg-navy-800 rounded-xl border border-navy-700 flex flex-col">
            <div className="px-5 py-5 border-b border-navy-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <ShoppingCart size={18} className="text-electric-green" /> Current Sale
              </h3>
              {cartLines.length > 0 && (
                <button onClick={clearCart} className="text-slate-500 hover:text-red-400 text-xs flex items-center gap-1 transition-colors">
                  <Trash2 size={13} /> Clear
                </button>
              )}
            </div>
​
            <div className="flex-1 p-5 space-y-2 min-h-[160px]">
              {cartLines.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-8">
                  <ShoppingCart size={30} className="text-slate-700 mb-3" />
                  <p className="text-slate-500 text-sm">Tap items to ring up a sale</p>
                  {lastSale && (
                    <p className="text-slate-600 text-xs mt-3">
                      Last sale: {lastSale.count} item{lastSale.count !== 1 ? 's' : ''} · ${lastSale.total.toFixed(2)}
                    </p>
                  )}
                </div>
              ) : (
                cartLines.map(it => (
                  <div key={it.id} className="flex items-center gap-2 bg-navy-900 rounded-lg px-3 py-2 border border-navy-700">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{it.name}</p>
                      <p className="text-slate-500 text-xs">${parseFloat(it.price).toFixed(2)} × {cart[it.id]} = <span className="text-electric-green">${(parseFloat(it.price) * cart[it.id]).toFixed(2)}</span></p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setCartQty(it.id, cart[it.id] - 1)} className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-navy-700 transition-colors"><Minus size={12} /></button>
                      <input
                        type="number" min="0" inputMode="numeric" value={cart[it.id]}
                        onChange={e => setCartQty(it.id, e.target.value)}
                        className="w-10 text-center bg-navy-800 border border-navy-700 rounded-md py-0.5 text-white text-sm font-semibold focus:outline-none focus:border-electric-blue [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button onClick={() => setCartQty(it.id, cart[it.id] + 1)} className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-electric-green hover:bg-electric-green/10 transition-colors"><Plus size={12} /></button>
                      <button onClick={() => removeFromCart(it.id)} className="w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"><X size={13} /></button>
                    </div>
                  </div>
                ))
              )}
            </div>
​
            <div className="px-5 py-4 border-t border-navy-700">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-400 text-sm">Total ({cartCount} item{cartCount !== 1 ? 's' : ''})</span>
                <span className="text-electric-green font-bold text-xl">${cartTotal.toFixed(2)}</span>
              </div>
              <button
                onClick={completeSale}
                disabled={cartLines.length === 0 || saving}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-sm transition-all bg-electric-green text-navy-900 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Check size={17} /> {saving ? 'Recording...' : 'Complete Sale'}
              </button>
            </div>
          </div>
        </div>
      )}
​
      {isModalOpen && (
        <MemberModal member={renewMember} onClose={() => { setIsModalOpen(false); setRenewMember(null); fetchDashboardData() }} />
      )}
    </div>
  )
}
​