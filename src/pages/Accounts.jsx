import { useState, useEffect } from 'react'
import { useAuth, ALL_PAGES, loadAccounts, saveAccount, createAccount, deleteAccount } from '../context/AuthContext'
import { Plus, Pencil, Trash2, X, ShieldCheck, Check, AlertTriangle, Loader } from 'lucide-react'

// ─── Delete Confirmation Modal ────────────────────────────────────────────────

function DeleteModal({ account, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-navy-800 rounded-2xl border border-navy-700 p-6 w-full max-w-sm shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-500/10 rounded-lg">
            <AlertTriangle size={20} className="text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">Delete Account</h3>
        </div>
        <p className="text-slate-400 mb-6">
          Are you sure you want to delete <span className="text-white font-medium">{account.username}</span>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 px-4 py-2 bg-navy-700 hover:bg-navy-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50">
            {loading && <Loader size={14} className="animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Account Form Modal ───────────────────────────────────────────────────────

function AccountModal({ account, onClose, onSave, saving }) {
  const isEdit = Boolean(account)
  const [form, setForm] = useState({
    username: account?.username || '',
    password: '',
    role: account?.role || 'user',
    status: account?.status || 'active',
    allowedPages: account?.allowedPages || [ALL_PAGES[0]?.path],
  })
  const [error, setError] = useState('')

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const togglePage = (path) => {
    setForm(prev => {
      const has = prev.allowedPages.includes(path)
      const next = has ? prev.allowedPages.filter(p => p !== path) : [...prev.allowedPages, path]
      return { ...prev, allowedPages: next }
    })
  }

  const handleSave = () => {
    setError('')
    if (!form.username.trim()) return setError('Username is required.')
    if (!isEdit && !form.password) return setError('Password is required.')
    if (form.role === 'user' && form.allowedPages.length === 0)
      return setError('Select at least one page for this user.')

    const payload = {
      ...(account || {}),
      ...form,
      username: form.username.trim(),
      allowedPages: form.role === 'admin' ? ALL_PAGES.map(p => p.path) : form.allowedPages,
    }
    // On edit, only include password if changed
    if (isEdit && !form.password) delete payload.password

    onSave(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-navy-800 rounded-2xl border border-navy-700 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-navy-700">
          <h3 className="text-lg font-semibold text-white">{isEdit ? 'Edit Account' : 'New Account'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Username <span className="text-red-400">*</span></label>
            <input value={form.username} onChange={e => setField('username', e.target.value)}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-electric-blue transition-colors"
              placeholder="e.g. jdoe" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Password {isEdit && <span className="text-slate-500 font-normal">(leave blank to keep current)</span>}
              {!isEdit && <span className="text-red-400"> *</span>}
            </label>
            <input type="password" value={form.password} onChange={e => setField('password', e.target.value)}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-electric-blue transition-colors"
              placeholder={isEdit ? '••••••••' : 'Enter password'} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Role</label>
            <select value={form.role} onChange={e => setField('role', e.target.value)}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-electric-blue transition-colors">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-300">Status</p>
              <p className="text-xs text-slate-500">Inactive users cannot log in</p>
            </div>
            <button type="button" onClick={() => setField('status', form.status === 'active' ? 'inactive' : 'active')}
              className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${form.status === 'active' ? 'bg-electric-blue' : 'bg-navy-700'}`}>
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform mt-0.5 ${form.status === 'active' ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {form.role === 'user' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Page Permissions <span className="text-red-400">*</span>
              </label>
              <div className="space-y-2 bg-navy-900 rounded-lg border border-navy-700 p-3">
                {ALL_PAGES.map(page => {
                  const checked = form.allowedPages.includes(page.path)
                  return (
                    <label key={page.path} className="flex items-center gap-3 cursor-pointer group">
                      <div onClick={() => togglePage(page.path)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0 ${checked ? 'bg-electric-blue border-electric-blue' : 'border-navy-700 group-hover:border-slate-500'}`}>
                        {checked && <Check size={12} className="text-white" />}
                      </div>
                      <span className="text-sm text-slate-300">{page.label}</span>
                      <span className="text-xs text-slate-500 ml-auto">{page.path}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {form.role === 'admin' && (
            <div className="flex items-center gap-2 text-sm text-slate-400 bg-navy-900 border border-navy-700 rounded-lg p-3">
              <ShieldCheck size={16} className="text-electric-green flex-shrink-0" />
              Admins have access to all pages by default.
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-navy-700">
          <button onClick={onClose} disabled={saving}
            className="flex-1 px-4 py-2 bg-navy-700 hover:bg-navy-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2 bg-electric-blue hover:bg-blue-500 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader size={14} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Accounts Page ───────────────────────────────────────────────────────

export default function Accounts() {
  const { user: currentUser, refreshUser } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [pageLoading, setPageLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalAccount, setModalAccount] = useState(undefined) // undefined=closed, null=new
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [toast, setToast] = useState(null)

  // --- DEFINITIONS MOVED ABOVE USEFFECT ---
  
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchAccounts = async () => {
    setPageLoading(true)
    try {
      const data = await loadAccounts()
      setAccounts(data)
    } catch (e) {
      showToast('Failed to load accounts.', 'error')
    }
    setPageLoading(false)
  }

  useEffect(() => { fetchAccounts() }, [])

  // --- END MOVED DEFINITIONS ---

  const handleSave = async (formData) => {
    setSaving(true)
    try {
      if (formData.id) {
        // Edit existing
        await saveAccount(formData)
        showToast('Account updated successfully.')
      } else {
        // Check duplicate username client-side first
        if (accounts.find(a => a.username === formData.username)) {
          showToast('Username already exists.', 'error')
          setSaving(false)
          return
        }
        await createAccount(formData)
        showToast('Account created successfully.')
      }
      await fetchAccounts()
      await refreshUser()
      setModalAccount(undefined)
    } catch (e) {
      showToast(e.message || 'Something went wrong.', 'error')
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const admins = accounts.filter(a => a.role === 'admin')
    if (deleteTarget.role === 'admin' && admins.length === 1) {
      showToast('Cannot delete the last admin account.', 'error')
      setDeleteTarget(null)
      return
    }
    setSaving(true)
    try {
      await deleteAccount(deleteTarget.id)
      showToast('Account deleted.')
      await fetchAccounts()
      await refreshUser()
    } catch (e) {
      showToast(e.message || 'Failed to delete account.', 'error')
    }
    setSaving(false)
    setDeleteTarget(null)
  }

  const getRoleBadge = (role) => role === 'admin'
    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
    : 'bg-electric-blue/10 text-electric-blue border border-electric-blue/20'

  const getStatusBadge = (status) => status === 'active'
    ? 'bg-electric-green/10 text-electric-green border border-electric-green/20'
    : 'bg-slate-700/50 text-slate-400 border border-slate-600/20'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Accounts</h1>
          <p className="text-slate-400 text-sm mt-1">Manage user accounts and page permissions</p>
        </div>
        <button onClick={() => setModalAccount(null)}
          className="flex items-center gap-2 bg-electric-blue hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg font-medium transition-colors">
          <Plus size={18} /> New Account
        </button>
      </div>

      <div className="bg-navy-800 rounded-xl border border-navy-700 overflow-hidden">
        {pageLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader size={24} className="animate-spin text-electric-blue" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-700 text-slate-400 text-left">
                  <th className="px-6 py-4 font-medium">Username</th>
                  <th className="px-6 py-4 font-medium">Role</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Allowed Pages</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(account => (
                  <tr key={account.id} className="border-b border-navy-700/50 hover:bg-navy-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${account.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-electric-blue/20 text-electric-blue'}`}>
                          {account.username[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white font-medium">{account.username}</p>
                          {account.id === currentUser?.id && <p className="text-xs text-electric-green">You</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getRoleBadge(account.role)}`}>{account.role}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadge(account.status)}`}>{account.status}</span>
                    </td>
                    <td className="px-6 py-4">
                      {account.role === 'admin' ? (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <ShieldCheck size={13} className="text-electric-green" /> All pages
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(account.allowedPages || []).map(path => {
                            const page = ALL_PAGES.find(p => p.path === path)
                            return page ? (
                              <span key={path} className="px-2 py-0.5 bg-navy-900 border border-navy-700 rounded text-xs text-slate-300">
                                {page.label}
                              </span>
                            ) : null
                          })}
                          {!account.allowedPages?.length && <span className="text-xs text-slate-500">None</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setModalAccount(account)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-navy-700 rounded-lg transition-colors" title="Edit">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => setDeleteTarget(account)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {accounts.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">No accounts found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalAccount !== undefined && (
        <AccountModal account={modalAccount} onClose={() => setModalAccount(undefined)} onSave={handleSave} saving={saving} />
      )}

      {deleteTarget && (
        <DeleteModal account={deleteTarget} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={saving} />
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-xl text-sm font-medium ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-electric-green text-navy-900'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}