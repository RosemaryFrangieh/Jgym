import { useState, useEffect, useMemo } from 'react'
import { useSettings, DEFAULT_SETTINGS } from '../context/SettingsContext'
import {
  Save, Loader, Plus, Trash2, Settings as SettingsIcon,
  DollarSign, Dumbbell, RotateCcw, AlertTriangle, Printer, Eye, Building, Layers
} from 'lucide-react'
import { buildReceiptText, buildAllDemoReceipts, DEFAULT_RECEIPT_TEMPLATE } from '../utils/receiptPrinter'

const MEMBERSHIP_FIELDS = [
  { key: 'daily',     label: 'Daily' },
  { key: 'weekly',    label: 'Weekly' },
  { key: 'biweekly',  label: '2 Weeks' },
  { key: 'triweekly', label: '3 Weeks' },
  { key: 'monthly',   label: 'Monthly' },
  { key: 'family',    label: 'Family Monthly' },
]

// Sample data for the default preview
const SAMPLE_MEMBER = {
  first_name: 'John', last_name: 'Doe',
  phone_number: '+1234567890',
  class_type: 'aerobics', subscription_type: 'family',
  start_date: new Date().toISOString(),
  end_date: new Date(Date.now() + 30 * 86400000).toISOString(),
  description: 'Paid in cash',
  base_price: 100, discount_type: 'percentage', discount_value: 10, amount_paid: 90,
}
const SAMPLE_FAMILY = [
  { first_name: 'John', last_name: 'Doe', phone_number: '+1234567890' },
  { first_name: 'Jane', last_name: 'Doe', phone_number: '+1234567891' },
  { first_name: 'Jim',  last_name: 'Doe', phone_number: '' },
]

// ─── Reusable UI ─────────────────────────────────────────────────────────────
function Card({ icon: Icon, title, description, children }) {
  return (
    <div className="bg-navy-900 border border-navy-700/50 rounded-2xl p-6 shadow-lg">
      <div className="flex items-start gap-4 mb-6">
        <div className="p-2.5 bg-electric-blue/10 rounded-xl text-electric-blue border border-electric-blue/20">
          <Icon size={20} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white tracking-tight">{title}</h2>
          {description && <p className="text-slate-400 text-sm mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

function NumberField({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
        <input
          type="number" min="0" step="0.01" value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-navy-800 border border-navy-700 hover:border-navy-600 rounded-lg pl-7 pr-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-electric-blue/40 focus:border-electric-blue transition-all"
        />
      </div>
    </div>
  )
}

function TextField({ label, hint, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      <input
        value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-navy-800 border border-navy-700 hover:border-navy-600 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-electric-blue/40 focus:border-electric-blue transition-all"
      />
      {hint && <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{hint}</p>}
    </div>
  )
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      <select
        value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-navy-800 border border-navy-700 hover:border-navy-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-electric-blue/40 focus:border-electric-blue transition-all"
      >
        {options.map(o => (
          <option key={o.value} value={o.value} className="bg-navy-900 text-white">{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between cursor-pointer py-2 group">
      <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-electric-blue' : 'bg-navy-700'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </label>
  )
}

function SectionLabel({ children }) {
  return <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-navy-700/50 pb-3 mb-4">{children}</h3>
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function Settings() {
  const { settings, loading, error, updateSettings } = useSettings()

  const [form, setForm] = useState(settings)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [newClassType, setNewClassType] = useState('')
  const [demoMode, setDemoMode] = useState(false)
  const [demoIndex, setDemoIndex] = useState(0)

  useEffect(() => { if (!loading) setForm(settings) }, [loading, settings])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const setMembershipPrice = (key, value) =>
    setForm(prev => ({ ...prev, membershipPrices: { ...prev.membershipPrices, [key]: value } }))
  const setClassPrice = (type, key, value) =>
    setForm(prev => ({ ...prev, classPrices: { ...prev.classPrices, [type]: { ...prev.classPrices[type], [key]: value } } }))
  const setReceiptField = (key, value) =>
    setForm(prev => ({ ...prev, receiptTemplate: { ...prev.receiptTemplate, [key]: value } }))

  const addClassType = () => {
    const name = newClassType.trim().toLowerCase()
    if (!name) return
    if (form.classTypes.includes(name)) return showToast('That class already exists.', 'error')
    setForm(prev => ({
      ...prev,
      classTypes: [...prev.classTypes, name],
      classPrices: { ...prev.classPrices, [name]: { daily: 0, monthly: 0 } },
    }))
    setNewClassType('')
  }

  const removeClassType = (type) => {
    if (form.classTypes.length <= 1) return showToast('You need at least one class type.', 'error')
    setForm(prev => {
      const restPrices = { ...prev.classPrices }
      delete restPrices[type]
      return {
        ...prev,
        classTypes: prev.classTypes.filter(t => t !== type),
        classPrices: restPrices,
      }
    })
  }

  // All demo receipts based on current form state
  const demoReceipts = useMemo(() => buildAllDemoReceipts({
    gymName: form.gymName,
    receiptTemplate: form.receiptTemplate,
  }), [form.gymName, form.receiptTemplate])

  // Single live preview (family sample) — used when demo mode is off
  const previewReceipt = useMemo(() => buildReceiptText(SAMPLE_MEMBER, SAMPLE_FAMILY, {
    gymName: form.gymName,
    receiptTemplate: form.receiptTemplate,
  }), [form.gymName, form.receiptTemplate])

  const handleSave = async () => {
    setSaving(true)
    try {
      const membershipPrices = Object.fromEntries(
        Object.entries(form.membershipPrices).map(([k, v]) => [k, parseFloat(v) || 0])
      )
      const classPrices = Object.fromEntries(
        Object.entries(form.classPrices).map(([type, prices]) => [
          type,
          Object.fromEntries(Object.entries(prices).map(([k, v]) => [k, parseFloat(v) || 0])),
        ])
      )
      await updateSettings({
        gymName: form.gymName.trim() || DEFAULT_SETTINGS.gymName,
        whatsappCountryCode: form.whatsappCountryCode.trim() || DEFAULT_SETTINGS.whatsappCountryCode,
        membershipPrices,
        classTypes: form.classTypes,
        classPrices,
        receiptTemplate: { ...DEFAULT_RECEIPT_TEMPLATE, ...form.receiptTemplate },
      })
      showToast('Settings saved successfully.')
    } catch (e) {
      showToast(e.message || 'Failed to save settings.', 'error')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader size={24} className="animate-spin text-electric-blue" />
      </div>
    )
  }

  const currentDemo = demoReceipts[demoIndex]

  return (
    <div className="min-h-screen bg-navy-950 text-slate-200">

      {/* Sticky Header */}
      <div className="sticky top-0 z-20 backdrop-blur-md bg-navy-950/90 border-b border-navy-800">
        <div className="max-w-[1400px] mx-auto px-6 md:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">System Settings</h1>
            <p className="text-slate-400 text-xs md:text-sm mt-0.5 hidden sm:block">Configure gym operations, pricing, and receipt layouts.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setForm(settings)}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-slate-300 hover:text-white hover:bg-navy-800 rounded-lg font-medium transition-colors text-sm"
            >
              <RotateCcw size={15} /> Discard
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-electric-blue hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg font-medium transition-all shadow-lg shadow-electric-blue/20 disabled:opacity-50 text-sm"
            >
              {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {/* Top Sections */}
      <div className="max-w-3xl mx-auto px-6 md:px-8 py-8 space-y-8">
        {error && (
          <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-xl px-4 py-3 text-sm">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Couldn't load settings from Supabase — showing defaults.</p>
              <p className="text-yellow-400/80 mt-1 text-xs">{error}</p>
            </div>
          </div>
        )}

        <Card icon={Building} title="Gym Info" description="Basic information about your facility.">
          <div className="grid sm:grid-cols-2 gap-6">
            <TextField label="Gym Name" value={form.gymName} onChange={v => setField('gymName', v)} placeholder="e.g. J-GYM" />
            <TextField
              label="WhatsApp Country Code"
              value={form.whatsappCountryCode}
              onChange={v => setField('whatsappCountryCode', v.replace(/\D/g, ''))}
              placeholder="e.g. 961"
              hint="Used when a saved phone number has no country code."
            />
          </div>
        </Card>

        <Card icon={DollarSign} title="Membership Pricing" description="Base prices for standard gym memberships.">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {MEMBERSHIP_FIELDS.map(f => (
              <NumberField key={f.key} label={f.label} value={form.membershipPrices[f.key] ?? 0} onChange={v => setMembershipPrice(f.key, v)} />
            ))}
          </div>
        </Card>

        <Card icon={Dumbbell} title="Classes & Pricing" description="Manage available class types and their specific rates.">
          <div className="space-y-4">
            {form.classTypes.map(type => (
              <div key={type} className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-white font-medium capitalize text-sm">{type}</span>
                  <button onClick={() => removeClassType(type)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors" title="Remove class">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <NumberField label="Daily"   value={form.classPrices[type]?.daily   ?? 0} onChange={v => setClassPrice(type, 'daily', v)} />
                  <NumberField label="Monthly" value={form.classPrices[type]?.monthly ?? 0} onChange={v => setClassPrice(type, 'monthly', v)} />
                </div>
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <input
                value={newClassType}
                onChange={e => setNewClassType(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addClassType())}
                placeholder="New class name, e.g. yoga"
                className="flex-1 bg-navy-800 border border-navy-700 hover:border-navy-600 rounded-lg px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-electric-blue/40 focus:border-electric-blue transition-all"
              />
              <button onClick={addClassType} className="flex items-center gap-2 px-4 py-2.5 bg-navy-700 hover:bg-navy-600 text-white rounded-lg text-sm font-medium transition-colors">
                <Plus size={15} /> Add
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Receipt Customization (split layout) */}
      <div className="max-w-[1400px] mx-auto px-6 md:px-8 py-8 border-t border-navy-800 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

          {/* Form side */}
          <div className="lg:col-span-3">
            <Card icon={Printer} title="Receipt Customization" description="Tailor the thermal printer output. Special formatting applies to family plans.">

              <div className="space-y-8">

                <div className="space-y-4">
                  <SectionLabel>Header Configuration</SectionLabel>
                  <div className="grid sm:grid-cols-2 gap-5">
                    <TextField label="Header Title"    value={form.receiptTemplate?.headerTitle}    onChange={v => setReceiptField('headerTitle', v)}    placeholder="{gymName}" hint="Use {gymName} to insert the gym name automatically." />
                    <TextField label="Header Subtitle" value={form.receiptTemplate?.headerSubtitle} onChange={v => setReceiptField('headerSubtitle', v)} placeholder="Membership Receipt" />
                  </div>
                </div>

                <div className="space-y-4">
                  <SectionLabel>Family Plan Layout</SectionLabel>
                  <p className="text-xs text-slate-500 -mt-2 mb-3">
                    Only applies to family memberships. Use <code className="bg-navy-800 px-1.5 py-0.5 rounded text-electric-blue text-[10px]">{'{n}'}</code> for member number, <code className="bg-navy-800 px-1.5 py-0.5 rounded text-electric-blue text-[10px]">{'{name}'}</code> for name, <code className="bg-navy-800 px-1.5 py-0.5 rounded text-electric-blue text-[10px]">{'{phone}'}</code> for phone.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-5">
                    <TextField label="Family Section Title" value={form.receiptTemplate?.familySectionTitle} onChange={v => setReceiptField('familySectionTitle', v)} placeholder="Family Plan Members" />
                    <SelectField
                      label="Separator Between Members"
                      value={form.receiptTemplate?.familySeparator}
                      onChange={v => setReceiptField('familySeparator', v)}
                      options={[
                        { value: 'none',  label: 'No separator' },
                        { value: 'blank', label: 'Blank line' },
                        { value: 'dash',  label: 'Dash line (---)' },
                      ]}
                    />
                    <TextField label="Name Label Format"  value={form.receiptTemplate?.familyNameFormat}  onChange={v => setReceiptField('familyNameFormat', v)}  placeholder="name {n}" hint="e.g. 'name {n}' → 'name 1: John Doe'. Or 'Member {n}: {name}'." />
                    <TextField label="Phone Label Format" value={form.receiptTemplate?.familyPhoneFormat} onChange={v => setReceiptField('familyPhoneFormat', v)} placeholder="phone {n}" hint="If hidden via toggle, phones won't print at all." />
                  </div>
                  <div className="bg-navy-800/50 rounded-xl px-4 py-2 border border-navy-700/50 space-y-1">
                    <Toggle label="Show phone numbers for family members"     checked={form.receiptTemplate?.showFamilyPhones     ?? true} onChange={v => setReceiptField('showFamilyPhones', v)} />
                    <Toggle label="Show class & plan per family member"        checked={form.receiptTemplate?.showFamilyClassAndPlan ?? false} onChange={v => setReceiptField('showFamilyClassAndPlan', v)} />
                  </div>
                </div>

                <div className="space-y-4">
                  <SectionLabel>Single Member Layout</SectionLabel>
                  <div className="grid sm:grid-cols-2 gap-5">
                    <TextField label="Name Label"  value={form.receiptTemplate?.singleNameLabel}  onChange={v => setReceiptField('singleNameLabel', v)}  placeholder="name 1" />
                    <TextField label="Phone Label" value={form.receiptTemplate?.singlePhoneLabel} onChange={v => setReceiptField('singlePhoneLabel', v)} placeholder="phone 1" />
                  </div>
                  <div className="bg-navy-800/50 rounded-xl px-4 py-2 border border-navy-700/50">
                    <Toggle label="Show phone number for single members" checked={form.receiptTemplate?.showSinglePhone ?? true} onChange={v => setReceiptField('showSinglePhone', v)} />
                  </div>
                </div>

                <div className="space-y-4">
                  <SectionLabel>Field Labels</SectionLabel>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                    <TextField label="Class"        value={form.receiptTemplate?.classLabel}      onChange={v => setReceiptField('classLabel', v)}      placeholder="class:" />
                    <TextField label="Plan"         value={form.receiptTemplate?.planLabel}       onChange={v => setReceiptField('planLabel', v)}       placeholder="plan:" />
                    <TextField label="Start Date"   value={form.receiptTemplate?.startLabel}      onChange={v => setReceiptField('startLabel', v)}      placeholder="start:" />
                    <TextField label="End Date"     value={form.receiptTemplate?.endLabel}        onChange={v => setReceiptField('endLabel', v)}        placeholder="end:" />
                    <TextField label="Notes"        value={form.receiptTemplate?.notesLabel}      onChange={v => setReceiptField('notesLabel', v)}      placeholder="notes:" />
                    <TextField label="Base Price"   value={form.receiptTemplate?.basePriceLabel}  onChange={v => setReceiptField('basePriceLabel', v)}  placeholder="base price:" />
                    <TextField label="Discount"     value={form.receiptTemplate?.discountLabel}   onChange={v => setReceiptField('discountLabel', v)}   placeholder="discount:" />
                    <TextField label="Total Paid"   value={form.receiptTemplate?.totalPaidLabel}  onChange={v => setReceiptField('totalPaidLabel', v)}  placeholder="total paid:" />
                  </div>
                </div>

                <div className="space-y-4">
                  <SectionLabel>Footer & Socials</SectionLabel>
                  <div className="grid sm:grid-cols-2 gap-5">
                    <TextField label="Footer Message"     value={form.receiptTemplate?.footerMessage}     onChange={v => setReceiptField('footerMessage', v)}     placeholder="Thank you!" />
                    <TextField label="Instagram Caption"  value={form.receiptTemplate?.instagramCaption}  onChange={v => setReceiptField('instagramCaption', v)}  placeholder="Follow us on Instagram" />
                  </div>
                  <TextField label="Instagram URL" value={form.receiptTemplate?.instagramUrl} onChange={v => setReceiptField('instagramUrl', v)} placeholder="https://www.instagram.com/j_gym_ehden" hint="Query strings (?igsh=…) are stripped automatically — they cause blank pages on some scanners." />
                  <div className="bg-navy-800/50 rounded-xl px-4 py-2 border border-navy-700/50">
                    <Toggle label="Print Instagram QR code at the bottom" checked={form.receiptTemplate?.showInstagramQR ?? true} onChange={v => setReceiptField('showInstagramQR', v)} />
                  </div>
                </div>

                <button
                  onClick={() => setForm(prev => ({ ...prev, receiptTemplate: { ...DEFAULT_RECEIPT_TEMPLATE } }))}
                  className="text-xs text-slate-500 hover:text-electric-blue transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw size={12} /> Reset receipt template to defaults
                </button>

              </div>
            </Card>
          </div>

          {/* Sticky Preview Side */}
          <div className="hidden lg:block lg:col-span-2">
            <div className="sticky top-24 space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 text-slate-400">
                  <Eye size={16} />
                  <span className="text-sm font-medium uppercase tracking-wider">Live Receipt Preview</span>
                </div>
                <button
                  onClick={() => setDemoMode(d => !d)}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition-colors ${demoMode ? 'bg-electric-blue/20 border-electric-blue/40 text-electric-blue' : 'border-navy-700 text-slate-400 hover:text-white hover:border-navy-600'}`}
                  title="Toggle demo of all receipt cases"
                >
                  <Layers size={12} /> {demoMode ? 'Demo ON' : 'Demo all cases'}
                </button>
              </div>

              {demoMode && (
                <div className="flex flex-wrap gap-1.5">
                  {demoReceipts.map((d, i) => (
                    <button
                      key={i}
                      onClick={() => setDemoIndex(i)}
                      className={`text-[10px] px-2 py-1 rounded border transition-colors ${i === demoIndex ? 'bg-electric-blue text-white border-electric-blue' : 'border-navy-700 text-slate-400 hover:text-white hover:border-navy-600'}`}
                    >
                      {i + 1}. {d.title}
                    </button>
                  ))}
                </div>
              )}

              {/* Receipt Paper */}
              <div className="bg-slate-800 p-4 rounded-lg shadow-2xl border border-navy-700">
                <div className="bg-white text-gray-900 p-5 rounded-sm shadow-inner relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 border-t-2 border-dashed border-gray-300"></div>
                  <pre className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all pt-2">
{demoMode ? (currentDemo?.text || '') : previewReceipt}
                  </pre>
                  {form.receiptTemplate?.showInstagramQR && (
                    <div className="mt-4 flex flex-col items-center">
                      <div className="w-16 h-16 bg-gray-900 mb-1" style={{ backgroundImage: 'linear-gradient(45deg, #fff 25%, transparent 25%, transparent 75%, #fff 75%, #fff), linear-gradient(45deg, #fff 25%, transparent 25%, transparent 75%, #fff 75%, #fff)', backgroundSize: '8px 8px', backgroundPosition: '0 0, 4px 4px' }}></div>
                      <span className="text-[9px] font-mono text-gray-600">{form.receiptTemplate?.instagramCaption || 'Follow us'}</span>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 border-b-2 border-dashed border-gray-300"></div>
                </div>
              </div>

              <p className="text-xs text-slate-500 text-center px-4">
                {demoMode
                  ? `Case ${demoIndex + 1}/${demoReceipts.length}: ${currentDemo?.title}. All cases use the current template.`
                  : 'Preview uses sample family data. Actual prints use real member data + a thermal printer.'}
              </p>
            </div>
          </div>

        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-500 text-navy-950'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}