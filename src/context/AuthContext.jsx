import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext(null)

export const ALL_PAGES = [
  { path: '/', label: 'Dashboard' },
  { path: '/memberships', label: 'Memberships' },
  { path: '/financials', label: 'Financials' },
]

export const ADMIN_ONLY_PAGES = ['/accounts']

const SESSION_KEY = 'gym_session'
const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000 // 8 hours

// ─── Supabase account helpers ─────────────────────────────────────────────────

export async function loadAccounts() {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data.map(normalizeAccount)
}

export async function saveAccount(account) {
  const row = denormalizeAccount(account)
  const { data, error } = await supabase
    .from('accounts')
    .update(row)
    .eq('id', account.id)
    .select()
    .single()
  if (error) throw error
  return normalizeAccount(data)
}

export async function createAccount(account) {
  const row = denormalizeAccount(account)
  const { data, error } = await supabase
    .from('accounts')
    .insert(row)
    .select()
    .single()
  if (error) throw error
  return normalizeAccount(data)
}

export async function deleteAccount(id) {
  const { error } = await supabase.from('accounts').delete().eq('id', id)
  if (error) throw error
}

// Supabase uses snake_case + text[] for allowed_pages
function normalizeAccount(row) {
  return {
    id: row.id,
    username: row.username,
    password: row.password,
    role: row.role,
    status: row.status,
    allowedPages: row.allowed_pages ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function denormalizeAccount(account) {
  const row = {
    username: account.username,
    password: account.password,
    role: account.role,
    status: account.status,
    allowed_pages: account.allowedPages ?? [],
    updated_at: new Date().toISOString(),
  }
  if (account.id) row.id = account.id
  return row
}

// ─── AuthProvider ─────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore session on mount — re-fetch account from Supabase to get latest permissions
  useEffect(() => {
    async function restoreSession() {
      try {
        const raw = sessionStorage.getItem(SESSION_KEY)
        if (raw) {
          const session = JSON.parse(raw)
          if (Date.now() < session.expiresAt) {
            const { data, error } = await supabase
              .from('accounts')
              .select('*')
              .eq('id', session.userId)
              .eq('status', 'active')
              .single()
            if (!error && data) {
              setUser(normalizeAccount(data))
            } else {
              sessionStorage.removeItem(SESSION_KEY)
            }
          } else {
            sessionStorage.removeItem(SESSION_KEY)
          }
        }
      } catch {}
      setLoading(false)
    }
    restoreSession()
  }, [])

  const login = useCallback(async (username, password) => {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .eq('status', 'active')
      .single()

    if (error || !data) {
      return { success: false, error: 'Invalid username or password.' }
    }

    const account = normalizeAccount(data)
    const session = {
      userId: account.id,
      expiresAt: Date.now() + SESSION_TIMEOUT_MS,
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    setUser(account)
    return { success: true, account }
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY)
    setUser(null)
  }, [])

  // Re-fetch current user from Supabase (call after admin edits an account)
  const refreshUser = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', user.id)
      .single()
    if (!error && data) setUser(normalizeAccount(data))
  }, [user])

  const canAccess = useCallback((path) => {
    if (!user) return false
    if (user.role === 'admin') return true
    return user.allowedPages?.includes(path) ?? false
  }, [user])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, canAccess }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}