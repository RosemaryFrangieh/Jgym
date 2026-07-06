import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import MemberModal from '../components/MemberModal'
import { Users, UserPlus, AlertTriangle, Calendar, RefreshCw, ShoppingBag, Plus, Minus } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const TABLE_COLORS = ['#3b82f6', '#00ff88', '#f97316', '#a855f7', '#ec4899', '#eab308']
const UNIT_LABEL = { piece: 'units', kg: 'kg', liter: 'L', session: 'sessions', month: 'months' }

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, active: 0, newThisMonth: 0, expiring: [] })
  const [chartData, setChartData] = useState([
    { name: 'Daily', count: 0 }, { name: 'Weekly', count: 0 }, { name: 'Monthly', count: 0 }, { name: 'Custom', count: 0 }
  ])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [renewMember, setRenewMember] = useState(null)

  // Items for sale
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gym_shop_items') || '[]') } catch { return [] }
  })
  const [itemSales, setItemSales] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gym_item_sales') || '{}') } catch { return {} }
  })

  // --- DEFINITIONS MOVED ABOVE USEFFECT ---

  const fetchDashboardData = async () => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const threeDaysFromNow = new Date(today); threeDaysFromNow.setDate(today.getDate() + 3); threeDaysFromNow.setHours(23, 59, 59, 999)
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const { data: members } = await supabase.from('members').select('*')
    if (members) {
      const active = members.filter(m => new Date(m.end_date) >= today)
      const newThisMonth = members.filter(m => new Date(m.start_date) >= startOfMonth)
      const expiring = members.filter(m => { const e = new Date(m.end_date); return e >= today && e <= threeDaysFromNow })
      setStats({ total: members.length, active: active.length, newThisMonth: newThisMonth.length, expiring })
      setChartData([
        { name: 'Daily', count: active.filter(m => m.subscription_type === 'daily').length },
        { name: 'Weekly', count: active.filter(m => m.subscription_type === 'weekly').length },
        { name: 'Monthly', count: active.filter(m => m.subscription_type === 'monthly').length },
        { name: 'Custom', count: active.filter(m => m.subscription_type === 'custom').length },
      ])
    }
  }

  useEffect(() => { fetchDashboardData() }, [])
  useEffect(() => { localStorage.setItem('gym_item_sales', JSON.stringify(itemSales)) }, [itemSales])

  // --- END MOVED DEFINITIONS ---

  const handleRenew = (member) => { setRenewMember(member); setIsModalOpen(true) }

  const getDaysRemaining = (endDate) => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const end = new Date(endDate); end.setHours(0, 0, 0, 0)
    return Math.ceil((end - today) / (1000 * 60 * 60 * 24))
  }
  const getDaysColor = (d) => d === 0 ? 'text-red-500' : d === 1 ? 'text-red-400' : d === 2 ? 'text-orange-400' : 'text-yellow-400'
  const getDaysLabel = (d) => d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `${d} days`

  const getSales = (id) => itemSales[id] ?? 0
  const getItemRevenue = (item) => getSales(item.id) * parseFloat(item.price)
  const totalItemRevenue = items.reduce((sum, item) => sum + getItemRevenue(item), 0)

  const adjustSales = (id, delta) => {
    setItemSales(prev => {
      const current = prev[id] ?? 0
      const next = Math.max(0, current + delta)
      return { ...prev, [id]: next }
    })
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
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
          <div><p className="text-slate-400 text-sm">Expiring (≤ 3 days)</p><h3 className="text-2xl font-bold text-white">{stats.expiring.length}</h3></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart */}
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

        {/* Expiring List */}
        <div className="bg-navy-800 p-6 rounded-xl border border-navy-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><AlertTriangle size={20} className="text-orange-500" /> Expiring Soon</h3>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
            {stats.expiring.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No memberships expiring soon.</p>
            ) : stats.expiring.map(m => {
              const daysLeft = getDaysRemaining(m.end_date)
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
                  <button onClick={() => handleRenew(m)} className="ml-3 shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-electric-blue/10 text-electric-blue rounded-lg text-sm font-medium hover:bg-electric-blue/20 transition-colors">
                    <RefreshCw size={14} /><span className="hidden sm:inline">Renew</span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Item Revenue Table */}
      {items.length > 0 && (
        <div className="bg-navy-800 rounded-xl border border-navy-700 overflow-hidden">
          <div className="px-6 py-5 border-b border-navy-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2"><ShoppingBag size={20} className="text-purple-400" /> Shop Items Revenue</h3>
            <div className="text-right">
              <p className="text-slate-400 text-xs">Total Shop Revenue</p>
              <p className="text-electric-green font-bold text-lg">${totalItemRevenue.toFixed(2)}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-navy-700">
                  <th className="text-left text-slate-400 text-xs font-medium px-6 py-3 uppercase tracking-wider">Item</th>
                  <th className="text-left text-slate-400 text-xs font-medium px-4 py-3 uppercase tracking-wider">Price</th>
                  <th className="text-center text-slate-400 text-xs font-medium px-4 py-3 uppercase tracking-wider">Units Sold</th>
                  <th className="text-right text-slate-400 text-xs font-medium px-6 py-3 uppercase tracking-wider">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const sold = getSales(item.id)
                  const rev = getItemRevenue(item)
                  const color = TABLE_COLORS[idx % TABLE_COLORS.length]
                  return (
                    <tr key={item.id} className="border-b border-navy-700/50 hover:bg-navy-900/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-8 rounded-full" style={{ backgroundColor: color }} />
                          <div>
                            <p className="text-white font-medium">{item.name}</p>
                            <p className="text-slate-500 text-xs">per {item.unit}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-300">${parseFloat(item.price).toFixed(2)}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => adjustSales(item.id, -1)}
                            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-navy-700 transition-colors"
                          ><Minus size={13} /></button>
                          <span className="text-white font-semibold w-8 text-center">{sold}</span>
                          <button
                            onClick={() => adjustSales(item.id, 1)}
                            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-electric-green hover:bg-electric-green/10 transition-colors"
                          ><Plus size={13} /></button>
                        </div>
                        <p className="text-slate-600 text-xs text-center mt-1">{UNIT_LABEL[item.unit] || 'units'}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-bold text-base ${rev > 0 ? 'text-electric-green' : 'text-slate-500'}`}>
                          ${rev.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-navy-900">
                  <td colSpan={3} className="px-6 py-4 text-slate-300 font-semibold">Total Shop Revenue</td>
                  <td className="px-6 py-4 text-right text-electric-green font-bold text-lg">${totalItemRevenue.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <MemberModal member={renewMember} onClose={() => { setIsModalOpen(false); setRenewMember(null); fetchDashboardData() }} />
      )}
    </div>
  )
}