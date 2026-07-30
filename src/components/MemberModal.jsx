// membermodal.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { X, Printer, Check, Plus } from 'lucide-react'
import { printReceiptViaRawBT } from '../utils/receiptPrinter'
import { useSettings } from '../context/SettingsContext'

// Family plans store their 3 member names + phone numbers inside the description
// field, structured so we can parse them back when editing.
const FAMILY_MARKER = 'Family plan'
function buildFamilyDescription(names, phones, notes) {
  const lines = [FAMILY_MARKER]
  if (names.length) lines.push(`Members: ${names.join(', ')}`)
  if (phones.length) lines.push(`Phones: ${phones.join(', ')}`)
  const extra = (notes || '').trim()
  if (extra && !extra.startsWith(FAMILY_MARKER)) lines.push('', extra)
  return lines.join('\n')
}
function parseFamilyDescription(description) {
  const result = { names: [], phones: [] }
  if (!description) return result
  for (const line of description.split('\n')) {
    const m = line.match(/^Members:\s*(.*)$/i)
    const p = line.match(/^Phones:\s*(.*)$/i)
    if (m) result.names = m[1].split(',').map(s => s.trim()).filter(Boolean)
    if (p) result.phones = p[1].split(',').map(s => s.trim()).filter(Boolean)
  }
  return result
}

export default function MemberModal({ member, onClose }) {
  const { settings } = useSettings()
  const FIXED_PRICES = settings.membershipPrices
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
  const isFamily = formData.subscription_type === 'family'
  const [familyNames, setFamilyNames]   = useState(['', '', ''])
  const [familyPhones, setFamilyPhones] = useState([''])

  useEffect(() => {
    if (member) {
      setFullName(`${member.first_name || ''} ${member.last_name || ''}`.trim())
      setFormData({
        ...member,
        start_date: member.start_date.split('T')[0],
        end_date: member.end_date ? member.end_date.split('T')[0] : ''
      })
      if (member.subscription_type === 'family') {
        const parsed = parseFamilyDescription(member.description)
        const primary = `${member.first_name || ''} ${member.last_name || ''}`.trim()
        setFamilyNames([parsed.names[0] || primary, parsed.names[1] || '', parsed.names[2] || ''])
        setFamilyPhones(parsed.phones.length ? parsed.phones : [member.phone_number || ''])
      }
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
      // Updated duration map: 8 days for 1 week, 16 days for 2 weeks, 23 days for 3 weeks
      const durationMap = { daily: 1, weekly: 8, biweekly: 16, triweekly: 23, monthly: 32, family: 32 }
      const duration = durationMap[formData.subscription_type] || 32
      const startDateObj = new Date(formData.start_date)
      endDateObj = new Date(startDateObj)
      endDateObj.setDate(endDateObj.getDate() + duration)
    }

    let firstName = formData.first_name
    let lastName = formData.last_name
    let phone = formData.phone_number
    let description = formData.description
    let basePrice = parseFloat(formData.base_price)

    if (isFamily) {
      const names = familyNames.map(n => n.trim()).filter(Boolean)
      const phones = familyPhones.map(p => p.trim()).filter(Boolean)
      const primaryParts = (names[0] || '').split(/\s+/).filter(Boolean)
      firstName = primaryParts[0] || ''
      lastName = primaryParts.slice(1).join(' ')
      phone = phones[0] || ''
      basePrice = FIXED_PRICES.family
      description = buildFamilyDescription(names, phones, formData.description)
    }

    const payload = {
      first_name: firstName,
      last_name: lastName,
      phone_number: phone,
      subscription_type: formData.subscription_type,
      description: description,
      base_price: basePrice,
      discount_type: formData.discount_type,
      discount_value: parseFloat(formData.discount_value),
      amount_paid: amountPaid,
      start_date: formData.start_date,
      end_date: endDateObj.toISOString().split('T')[0]
    }

    let result
    if (member) {
      // Editing an existing member's details isn't a new payment —
      // don't touch last_payment_at here.
      result = await supabase.from('members').update(payload).eq('id', member.id)
    } else {
      // Brand new member = a payment was just collected right now.
      result = await supabase.from('members').insert([{
        ...payload,
        last_payment_at: new Date().toISOString(),
      }])
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
        <div className="bg-white dark:bg-navy-800 rounded-xl w-full max-w-md p-6 border border-slate-200 dark:border-navy-700 transition-colors">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-electric-green/20 flex items-center justify-center mb-3 transition-colors">
              <Check size={28} className="text-emerald-500 dark:text-electric-green" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white transition-colors">Member Saved</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 transition-colors">
              {savedMember.first_name} {savedMember.last_name} — ${Number(savedMember.amount_paid).toFixed(2)} paid
            </p>
          </div>

          <button
            onClick={() => printReceiptViaRawBT(savedMember, settings)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 dark:bg-electric-blue text-white rounded-lg font-semibold hover:opacity-90 mb-3 transition-colors"
          >
            <Printer size={20} /> Print Receipt (Bluetooth)
          </button>
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center mb-4 transition-colors">
            Sends the receipt to RawBT, which relays it to your paired Bluetooth printer.
          </p>

          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-navy-700 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-navy-800 rounded-xl w-full max-w-lg p-6 border border-slate-200 dark:border-navy-700 max-h-[90vh] overflow-y-auto transition-colors">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white transition-colors">{member ? 'Edit Member' : 'Add New Member'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><X size={24} /></button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-lg text-red-600 dark:text-red-300 text-sm transition-colors">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isFamily && (
            <>
              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1 transition-colors">
                  Full Name {isDaily && <span className="text-slate-400 dark:text-slate-600">(optional for daily)</span>}
                </label>
                <input
                  type="text"
                  name="full_name"
                  value={fullName}
                  onChange={handleFullNameChange}
                  required={!isDaily}
                  placeholder="e.g. John Smith"
                  className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-blue-500 dark:focus:border-electric-blue transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1 transition-colors">
                  Phone Number {isDaily && <span className="text-slate-400 dark:text-slate-600">(optional for daily)</span>}
                </label>
                <input 
                  type="text" 
                  name="phone_number" 
                  value={formData.phone_number} 
                  onChange={handleChange} 
                  required={!isDaily} 
                  className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-blue-500 dark:focus:border-electric-blue transition-colors" 
                />
              </div>
            </>
          )}

          {isFamily && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1 transition-colors">Family Members <span className="text-slate-400 dark:text-slate-600">(3 names)</span></label>
                <div className="space-y-2">
                  {[0, 1, 2].map(i => (
                    <input
                      key={i}
                      type="text"
                      value={familyNames[i]}
                      onChange={e => setFamilyNames(n => n.map((v, idx) => (idx === i ? e.target.value : v)))}
                      required={i === 0}
                      placeholder={`Member ${i + 1} full name${i === 0 ? '' : ' (optional)'}`}
                      className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-blue-500 dark:focus:border-electric-blue transition-colors"
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1 transition-colors">Phone Numbers <span className="text-slate-400 dark:text-slate-600">(optional)</span></label>
                <div className="space-y-2">
                  {familyPhones.map((phone, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => setFamilyPhones(p => p.map((v, idx) => (idx === i ? e.target.value : v)))}
                        placeholder="e.g. +961 70 123 456"
                        className="flex-1 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-blue-500 dark:focus:border-electric-blue transition-colors"
                      />
                      {familyPhones.length > 1 && (
                        <button type="button" onClick={() => setFamilyPhones(p => p.filter((_, idx) => idx !== i))} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="Remove">
                          <X size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setFamilyPhones(p => [...p, ''])} className="mt-2 flex items-center gap-1 text-sm text-blue-600 dark:text-electric-blue hover:opacity-80 transition-colors">
                  <Plus size={16} /> Add phone number
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1 transition-colors">Subscription Type</label>
            <select name="subscription_type" value={formData.subscription_type} onChange={handleChange} className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-electric-blue transition-colors">
              <option value="daily">Daily - ${FIXED_PRICES.daily}</option>
              <option value="weekly">Weekly - ${FIXED_PRICES.weekly}</option>
              <option value="biweekly">2 Weeks - ${FIXED_PRICES.biweekly}</option>
              <option value="triweekly">3 Weeks - ${FIXED_PRICES.triweekly}</option>
              <option value="monthly">Monthly - ${FIXED_PRICES.monthly}</option>
              <option value="family">Family Monthly - ${FIXED_PRICES.family}</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {isCustom ? (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1 transition-colors">Start Date</label>
                <input type="date" name="start_date" value={formData.start_date} onChange={handleChange} required className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-electric-blue transition-colors" />
              </div>
              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1 transition-colors">End Date</label>
                <input type="date" name="end_date" value={formData.end_date} onChange={handleChange} required className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-electric-blue transition-colors" />
              </div>
              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1 transition-colors">Custom Price ($)</label>
                <input type="number" name="base_price" value={formData.base_price} onChange={handleChange} required min="0" step="0.01" className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-electric-blue transition-colors" />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1 transition-colors">Start Date</label>
              <input type="date" name="start_date" value={formData.start_date} onChange={handleChange} required className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-electric-blue transition-colors" />
            </div>
          )}

          {!isCustom && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1 transition-colors">Base Price ($)</label>
                <input type="number" name="base_price" value={formData.base_price} onChange={handleChange} required disabled className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white disabled:opacity-50 focus:outline-none focus:border-blue-500 dark:focus:border-electric-blue transition-colors" />
              </div>
              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1 transition-colors">Discount Type</label>
                <select name="discount_type" value={formData.discount_type} onChange={handleChange} className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-electric-blue transition-colors">
                  <option value="none">None</option>
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed ($)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1 transition-colors">Discount Value</label>
                <input type="number" name="discount_value" value={formData.discount_value} onChange={handleChange} disabled={formData.discount_type === 'none'} className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white disabled:opacity-50 focus:outline-none focus:border-blue-500 dark:focus:border-electric-blue transition-colors" />
              </div>
            </div>
          )}

          {isCustom && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1 transition-colors">Discount Type</label>
                <select name="discount_type" value={formData.discount_type} onChange={handleChange} className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-electric-blue transition-colors">
                  <option value="none">None</option>
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed ($)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1 transition-colors">Discount Value</label>
                <input type="number" name="discount_value" value={formData.discount_value} onChange={handleChange} disabled={formData.discount_type === 'none'} className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white disabled:opacity-50 focus:outline-none focus:border-blue-500 dark:focus:border-electric-blue transition-colors" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1 transition-colors">Description <span className="text-slate-400 dark:text-slate-600">(optional)</span></label>
            <textarea name="description" value={formData.description} onChange={handleChange} rows={3} placeholder="Any notes about this membership..." className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white resize-none placeholder-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-blue-500 dark:focus:border-electric-blue transition-colors" />
          </div>

          <div className="bg-slate-50 dark:bg-navy-900 p-4 rounded-lg flex justify-between items-center transition-colors">
            <span className="text-slate-500 dark:text-slate-400 transition-colors">Final Amount Paid:</span>
            <span className="text-2xl font-bold text-emerald-500 dark:text-electric-green transition-colors">${amountPaid.toFixed(2)}</span>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 dark:bg-electric-blue text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition-colors">
              {loading ? 'Saving...' : 'Save Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}