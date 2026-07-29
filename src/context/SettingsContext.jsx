// settingscontext.jsx

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { DEFAULT_RECEIPT_TEMPLATE } from '../utils/receiptPrinter'

const SettingsContext = createContext(null)

const SETTINGS_ROW_ID = 'app'

export const DEFAULT_SETTINGS = {
  gymName: 'J-GYM',
  whatsappCountryCode: '961',
  membershipPrices: { daily: 7, weekly: 17, biweekly: 25, triweekly: 32, monthly: 40, family: 100 },
  classTypes: ['aerobics', 'zumba'],
  classPrices: {
    aerobics: { daily: 5, monthly: 60 },
    zumba: { daily: 5, monthly: 40 },
  },
  receiptTemplate: { ...DEFAULT_RECEIPT_TEMPLATE },
}

function normalizeSettings(row) {
  if (!row) return DEFAULT_SETTINGS
  return {
    gymName: row.gym_name ?? DEFAULT_SETTINGS.gymName,
    whatsappCountryCode: row.whatsapp_country_code ?? DEFAULT_SETTINGS.whatsappCountryCode,
    membershipPrices: { ...DEFAULT_SETTINGS.membershipPrices, ...(row.membership_prices ?? {}) },
    classTypes: row.class_types?.length ? row.class_types : DEFAULT_SETTINGS.classTypes,
    classPrices: { ...DEFAULT_SETTINGS.classPrices, ...(row.class_prices ?? {}) },
    receiptTemplate: { ...DEFAULT_RECEIPT_TEMPLATE, ...(row.receipt_template ?? {}) },
  }
}

function denormalizeSettings(settings) {
  return {
    id: SETTINGS_ROW_ID,
    gym_name: settings.gymName,
    whatsapp_country_code: settings.whatsappCountryCode,
    membership_prices: settings.membershipPrices,
    class_types: settings.classTypes,
    class_prices: settings.classPrices,
    receipt_template: settings.receiptTemplate,
    updated_at: new Date().toISOString(),
  }
}

export async function loadSettingsFromDb() {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('id', SETTINGS_ROW_ID)
    .maybeSingle()
  if (error) throw error
  return normalizeSettings(data)
}

export async function saveSettingsToDb(settings) {
  const row = denormalizeSettings(settings)
  const { data, error } = await supabase
    .from('settings')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return normalizeSettings(data)
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refreshSettings = useCallback(async () => {
    try {
      const next = await loadSettingsFromDb()
      setSettings(next)
      setError(null)
    } catch (e) {
      setError(e.message || 'Failed to load settings.')
    }
  }, [])

  useEffect(() => {
    (async () => {
      setLoading(true)
      await refreshSettings()
      setLoading(false)
    })()
  }, [refreshSettings])

  const updateSettings = useCallback(async (partial) => {
    const next = { ...settings, ...partial }
    const saved = await saveSettingsToDb(next)
    setSettings(saved)
    return saved
  }, [settings])

  return (
    <SettingsContext.Provider value={{ settings, loading, error, refreshSettings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider')
  return ctx
}