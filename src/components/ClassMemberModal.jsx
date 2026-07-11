// ClassMemberModal.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { X } from 'lucide-react'

const FIXED_PRICES = { daily: 5, monthly: 40 }
const DURATION_DAYS = { daily: 1, monthly: 30 }

export default function ClassMemberModal({ member, onClose }) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
    description: '',
    class_type: 'aerobics',
    subscription_type: 'monthly',
    base_price: FIXED_PRICES.monthly,
    discount_type: 'none',
    discount_value: 0,
    start_date: new Date().toISOString().split('T')[0],
  })
  const [amountPaid, setAmountPaid] = useState(0)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (member) {
      setFormData({
        first_name: member.first_name || '',
        last_name: member.last_name || '',
        phone_number: member.phone_number || '',
        description: member.description || '',
        class_type: member.class_type || 'aerobics',
        subscription_type: member.subscription_type || 'monthly',
        base_price: member.base_price ?? FIXED_PRICES.monthly,
        discount_type: member.discount_type || 'none',
        discount_value: member.discount_value ?? 0,
        start_date: member.start_date ? member.start_date.split('T')[0] : new Date().toISOString().split('T')[0],
      })
    }
  }, [member])

  useEffect(() => {
    calculateAmount()
  }, [formData.base_price, formData.discount_type, formData.discount_value])

  const calculateAmount = () => {
    const base = parseFloat(formData.base_price) || 0
    const discVal = parseFloat(formData.discount_value) || 0
    let finalAmount = base

    if (formData.discount_type === 'percentage') {
      finalAmount = base - base * (discVal / 100)
    } else if (formData.discount_type === 'fixed') {
      finalAmount = base - discVal
    }
    setAmountPaid(finalAmount < 0 ? 0 : finalAmount)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    const updated = { ...formData, [name]: value }

    if (name === 'subscription_type') {
      updated.base_price = FIXED_PRICES[value]
    }

    setFormData(updated)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const startDateObj = new Date(formData.start_date)
    const endDateObj = new Date(startDateObj)
    endDateObj.setDate(endDateObj.getDate() + DURATION_DAYS[formData.subscription_type])

    const payload = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      phone_number: formData.phone_number,
      description: formData.description,
      class_type: formData.class_type,
      subscription_type: formData.subscription_type,
      base_price: parseFloat(formData.base_price),
      discount_type: formData.discount_type,
      discount_value: parseFloat(formData.discount_value) || 0,
      amount_paid: amountPaid,
      start_date: formData.start_date,
      end_date: endDateObj.toISOString().split('T')[0],
    }

    let result
    if (member) {
      result = await supabase.from('class_members').update(payload).eq('id', member.id)
    } else {
      result = await supabase.from('class_members').insert([
        { ...payload, membership_status: 'new', renewal_count: 0 },
      ])
    }

    setLoading(false)

    if (result.error) {
      setError(result.error.message)
      return
    }

    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-navy-800 rounded-xl w-full max-w-lg p-6 border border-navy-700 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">{member ? 'Edit Class Member' : 'Add Class Member'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={24} /></button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">First Name</label>
              <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} required className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Last Name</label>
              <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Phone Number</label>
            <input type="text" name="phone_number" value={formData.phone_number} onChange={handleChange} className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Class</label>
              <select name="class_type" value={formData.class_type} onChange={handleChange} className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white">
                <option value="aerobics">Aerobics</option>
                <option value="zumba">Zumba</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Plan</label>
              <select name="subscription_type" value={formData.subscription_type} onChange={handleChange} className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white">
                <option value="daily">Daily - ${FIXED_PRICES.daily}</option>
                <option value="monthly">Monthly - ${FIXED_PRICES.monthly}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Start Date</label>
            <input type="date" name="start_date" value={formData.start_date} onChange={handleChange} required className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Base Price ($)</label>
              <input type="number" name="base_price" value={formData.base_price} disabled className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white disabled:opacity-50" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Discount Type</label>
              <select name="discount_type" value={formData.discount_type} onChange={handleChange} className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white">
                <option value="none">None</option>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed ($)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Discount Value</label>
              <input type="number" name="discount_value" value={formData.discount_value} onChange={handleChange} disabled={formData.discount_type === 'none'} min="0" step="0.01" className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white disabled:opacity-50" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Description <span className="text-slate-600">(optional)</span></label>
            <textarea name="description" value={formData.description} onChange={handleChange} rows={3} placeholder="Any notes about this membership..." className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white resize-none placeholder:text-slate-600" />
          </div>

          <div className="bg-navy-900 p-4 rounded-lg flex justify-between items-center">
            <span className="text-slate-400">Final Amount Paid:</span>
            <span className="text-2xl font-bold text-electric-green">${amountPaid.toFixed(2)}</span>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
            <button type="submit" disabled={loading} className="px-6 py-2 bg-electric-blue text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}