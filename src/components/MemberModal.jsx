// membermodel.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { X, Printer, Check } from 'lucide-react'
import { printReceiptViaRawBT } from '../utils/receiptPrinter'

const FIXED_PRICES = {
  daily: 7,
  weekly: 17,
  biweekly: 25,
  triweekly: 32,
  monthly: 40
}

export default function MemberModal({ member, onClose }) {
  const [fullName, setFullName] = useState('')
  const [formData, setFormData] = useState({
    first_name: '', last_name: '', phone_number: '', description: '',
    subscription_type: 'monthly', base_price: 40, discount_type: 'none', discount_value: 0,
    start_date: new Date().toISOString().split('T')[0],
    end_date: ''
  })
  const [amountPaid, setAmountPaid] = useState(0)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [savedMember, setSavedMember] = useState(null) // set after a successful save, shows the receipt screen
  const isCustom = formData.subscription_type === 'custom'
  const isDaily  = formData.subscription_type === 'daily'

  useEffect(() => {
    if (member) {
      setFullName(`${member.first_name || ''} ${member.last_name || ''}`.trim())
      setFormData({
        ...member,
        start_date: member.start_date.split('T')[0],
        end_date: member.end_date ? member.end_date.split('T')[0] : ''
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
      finalAmount = base - (base * (discVal / 100))
    } else if (formData.discount_type === 'fixed') {
      finalAmount = base - discVal
    }
    setAmountPaid(finalAmount < 0 ? 0 : finalAmount)
  }

  const handleFullNameChange = (e) => {
    const value = e.target.value
    setFullName(value)
    const parts = value.trim().split(/\s+/).filter(Boolean)
    const first_name = parts[0] || ''
    const last_name = parts.slice(1).join(' ')
    setFormData(f => ({ ...f, first_name, last_name }))
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    const updated = { ...formData, [name]: value }

    if (name === 'subscription_type' && value !== 'custom') {
      updated.base_price = FIXED_PRICES[value]
    }

    setFormData(updated)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    let endDateObj

    if (isCustom) {
      endDateObj = new Date(formData.end_date)
    } else {
      const duration = formData.subscription_type === 'daily' ? 1 : formData.subscription_type === 'weekly' ? 7 : formData.subscription_type === 'biweekly' ? 14 : formData.subscription_type === 'triweekly' ? 21 : 30
      const startDateObj = new Date(formData.start_date)
      endDateObj = new Date(startDateObj)
      endDateObj.setDate(endDateObj.getDate() + duration)
    }

    const payload = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      phone_number: formData.phone_number,
      subscription_type: formData.subscription_type,
      description: formData.description,
      base_price: parseFloat(formData.base_price),
      discount_type: formData.discount_type,
      discount_value: parseFloat(formData.discount_value),
      amount_paid: amountPaid,
      start_date: formData.start_date,
      end_date: endDateObj.toISOString().split('T')[0]
    }

    let result
    if (member) {
      result = await supabase.from('members').update(payload).eq('id', member.id)
    } else {
      result = await supabase.from('members').insert([payload])
    }

    setLoading(false)

    if (result.error) {
      setError(result.error.message)
      return
    }

    setSavedMember(payload)
  }

  if (savedMember) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
        <div className="bg-navy-800 rounded-xl w-full max-w-md p-6 border border-navy-700">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-12 h-12 rounded-full bg-electric-green/20 flex items-center justify-center mb-3">
              <Check size={28} className="text-electric-green" />
            </div>
            <h3 className="text-xl font-bold text-white">Member Saved</h3>
            <p className="text-slate-400 text-sm mt-1">
              {savedMember.first_name} {savedMember.last_name} — ${Number(savedMember.amount_paid).toFixed(2)} paid
            </p>
          </div>

          <button
            onClick={() => printReceiptViaRawBT(savedMember)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-electric-blue text-white rounded-lg font-semibold hover:opacity-90 mb-3"
          >
            <Printer size={20} /> Print Receipt (Bluetooth)
          </button>
          <p className="text-xs text-slate-500 text-center mb-4">
            Sends the receipt to RawBT, which relays it to your paired Bluetooth printer.
          </p>

          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-slate-400 hover:text-white border border-navy-700 rounded-lg"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-navy-800 rounded-xl w-full max-w-lg p-6 border border-navy-700 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">{member ? 'Edit Member' : 'Add New Member'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={24} /></button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Full Name {isDaily && <span className="text-slate-600">(optional for daily)</span>}
            </label>
            <input
              type="text"
              name="full_name"
              value={fullName}
              onChange={handleFullNameChange}
              required={!isDaily}
              placeholder="e.g. John Smith"
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white placeholder:text-slate-600"
            />
          </div>

          <div>
              <label className="block text-sm text-slate-400 mb-1">
                Phone Number {isDaily && <span className="text-slate-600">(optional for daily)</span>}
              </label>
              <input type="text" name="phone_number" value={formData.phone_number} onChange={handleChange} required={!isDaily} className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white" />
            </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Subscription Type</label>
            <select name="subscription_type" value={formData.subscription_type} onChange={handleChange} className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white">
              <option value="daily">Daily - ${FIXED_PRICES.daily}</option>
              <option value="weekly">Weekly - ${FIXED_PRICES.weekly}</option>
              <option value="biweekly">2 Weeks - ${FIXED_PRICES.biweekly}</option>
              <option value="triweekly">3 Weeks - ${FIXED_PRICES.triweekly}</option>
              <option value="monthly">Monthly - ${FIXED_PRICES.monthly}</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {isCustom ? (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Start Date</label>
                <input type="date" name="start_date" value={formData.start_date} onChange={handleChange} required className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">End Date</label>
                <input type="date" name="end_date" value={formData.end_date} onChange={handleChange} required className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Custom Price ($)</label>
                <input type="number" name="base_price" value={formData.base_price} onChange={handleChange} required min="0" step="0.01" className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white" />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm text-slate-400 mb-1">Start Date</label>
              <input type="date" name="start_date" value={formData.start_date} onChange={handleChange} required className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white" />
            </div>
          )}

          {!isCustom && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Base Price ($)</label>
                <input type="number" name="base_price" value={formData.base_price} onChange={handleChange} required disabled className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white disabled:opacity-50" />
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
                <input type="number" name="discount_value" value={formData.discount_value} onChange={handleChange} disabled={formData.discount_type === 'none'} className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white disabled:opacity-50" />
              </div>
            </div>
          )}

          {isCustom && (
            <div className="grid grid-cols-2 gap-4">
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
                <input type="number" name="discount_value" value={formData.discount_value} onChange={handleChange} disabled={formData.discount_type === 'none'} className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white disabled:opacity-50" />
              </div>
            </div>
          )}

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