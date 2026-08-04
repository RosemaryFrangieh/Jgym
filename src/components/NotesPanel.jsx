import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { StickyNote, Send, Trash2, Pencil, Check, X, User, Loader2, FilterX } from 'lucide-react'

// ─── Local date helpers (mirrors the pattern used in Dashboard.jsx) ────────────
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x }
const toDateInputValue = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
// Parses a 'YYYY-MM-DD' value as a LOCAL date (avoids the UTC-midnight drift
// you'd get from `new Date('YYYY-MM-DD')`).
const parseDateInputValue = (value) => {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const FILTERS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'custom', label: 'Custom' },
]

export default function NotesPanel() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Admin-only filtering — defaults to "today". Custom picks one specific day.
  const [filter, setFilter] = useState('today')
  const today = new Date()
  const [customDate, setCustomDate] = useState(toDateInputValue(today))

  // Admin-only: filter by a specific user — combines with the date filter
  // below (both apply together, e.g. "this user's notes from yesterday").
  const [users, setUsers] = useState([])
  const [userFilter, setUserFilter] = useState('')

  // Inline editing (available to the note's author, or any admin)
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Delete confirmation — a styled in-app popup instead of the browser's window.confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Load the account list once, for the admin's "filter by user" dropdown
  useEffect(() => {
    if (!isAdmin) return
    supabase.from('accounts').select('id, username').order('username', { ascending: true })
      .then(({ data, error: err }) => { if (!err) setUsers(data || []) })
  }, [isAdmin])

  const getRange = useCallback(() => {
    if (filter === 'today') return [startOfDay(today), endOfDay(today)]
    if (filter === 'yesterday') {
      const y = new Date(today); y.setDate(y.getDate() - 1)
      return [startOfDay(y), endOfDay(y)]
    }
    // custom — a single specific day
    if (!customDate) return null
    const d = parseDateInputValue(customDate)
    return [startOfDay(d), endOfDay(d)]
  }, [filter, customDate]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchNotes = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    let query = supabase.from('notes').select('*').order('created_at', { ascending: false })

    if (isAdmin) {
      // Date filter and "filter by user" always apply together.
      const range = getRange()
      if (range) {
        query = query.gte('created_at', range[0].toISOString()).lte('created_at', range[1].toISOString())
      }
      if (userFilter) {
        query = query.eq('author_id', userFilter)
      }
    } else {
      // Regular users only see their own notes — no filters, just everything they've added.
      query = query.eq('author_id', user.id)
    }

    const { data, error: err } = await query
    if (err) {
      setError('Could not load notes. Please try again.')
    } else {
      setNotes(data || [])
    }
    setLoading(false)
  }, [user, isAdmin, getRange, userFilter])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  const clearFilters = () => {
    setFilter('today')
    setCustomDate(toDateInputValue(today))
    setUserFilter('')
  }

  const addNote = async () => {
    const trimmed = content.trim()
    if (!trimmed || submitting || !user) return
    setSubmitting(true)
    setError(null)
    const { error: err } = await supabase.from('notes').insert({
      author_id: user.id,
      author_name: user.username,
      content: trimmed,
    })
    if (err) {
      setError('Could not save your note. Please try again.')
    } else {
      setContent('')
      fetchNotes()
    }
    setSubmitting(false)
  }

  const canModify = (n) => isAdmin || n.author_id === user?.id

  const startEdit = (n) => { setEditingId(n.id); setEditContent(n.content) }
  const cancelEdit = () => { setEditingId(null); setEditContent('') }

  const saveEdit = async (id) => {
    const trimmed = editContent.trim()
    if (!trimmed || savingEdit) return
    setSavingEdit(true)
    const { error: err } = await supabase
      .from('notes')
      .update({ content: trimmed, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (!err) {
      setNotes(prev => prev.map(n => n.id === id ? { ...n, content: trimmed, updated_at: new Date().toISOString() } : n))
      setEditingId(null)
      setEditContent('')
    } else {
      alert('Could not save your changes. Please try again.')
    }
    setSavingEdit(false)
  }

  const deleteNote = (id) => setConfirmDeleteId(id)

  const confirmDelete = async () => {
    if (!confirmDeleteId || deleting) return
    setDeleting(true)
    const { error: err } = await supabase.from('notes').delete().eq('id', confirmDeleteId)
    if (!err) setNotes(prev => prev.filter(n => n.id !== confirmDeleteId))
    setDeleting(false)
    setConfirmDeleteId(null)
  }

  const formatTimestamp = (iso) => {
    const d = new Date(iso)
    return `${d.toLocaleDateString()} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }

  const hasActiveFilters = isAdmin && (userFilter || filter !== 'today')

  return (
    <div className="space-y-6">
      {/* Add a note — available to every logged-in user */}
      <div className="bg-navy-800 p-6 rounded-xl border border-navy-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <StickyNote size={20} className="text-electric-green" /> Add a Note
        </h3>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={3}
          placeholder="Write a note for the admin to review later..."
          className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-white resize-none placeholder:text-slate-600 focus:outline-none focus:border-electric-blue"
        />
        <div className="flex items-center justify-between mt-3">
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            onClick={addNote}
            disabled={!content.trim() || submitting}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-electric-green text-navy-900 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {submitting ? 'Saving...' : 'Add Note'}
          </button>
        </div>
      </div>

      {/* Notes list — everyone can view; date/user filtration is admin-only */}
      <div className="bg-navy-800 p-6 rounded-xl border border-navy-700">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <StickyNote size={20} className="text-electric-blue" />
            {isAdmin ? 'All Notes' : 'Your Notes'}
          </h3>

          {isAdmin && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Date filters */}
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filter === f.key
                      ? 'bg-electric-blue text-white'
                      : 'bg-navy-900 text-slate-400 hover:text-white border border-navy-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
              {filter === 'custom' && (
                <input
                  type="date"
                  value={customDate}
                  onChange={e => setCustomDate(e.target.value)}
                  className="bg-navy-900 border border-navy-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-electric-blue"
                />
              )}

              {/* Filter by user — combines with the date filter above */}
              <select
                value={userFilter}
                onChange={e => setUserFilter(e.target.value)}
                className="bg-navy-900 border border-navy-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-electric-blue"
              >
                <option value="">All users</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.username}</option>
                ))}
              </select>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white border border-navy-700 hover:border-red-400/40 hover:bg-red-500/10 transition-colors"
                >
                  <FilterX size={14} /> Clear Filters
                </button>
              )}
            </div>
          )}
        </div>

        {isAdmin && hasActiveFilters && (
          <p className="text-slate-500 text-xs mb-3">
            Showing notes
            {userFilter && <> from <span className="text-slate-300 font-medium">{users.find(u => u.id === userFilter)?.username}</span></>}
            {' '}for{' '}
            <span className="text-slate-300 font-medium">
              {filter === 'today' ? 'today' : filter === 'yesterday' ? 'yesterday' : customDate}
            </span>
          </p>
        )}

        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-500">
              <Loader2 size={20} className="animate-spin mr-2" /> Loading notes...
            </div>
          ) : notes.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No notes for this period.</p>
          ) : (
            notes.map(n => {
              const isEditing = editingId === n.id
              return (
                <div key={n.id} className="bg-navy-900 p-4 rounded-lg border border-navy-700">
                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        rows={3}
                        autoFocus
                        className="w-full bg-navy-800 border border-navy-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-electric-blue"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={cancelEdit}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white border border-navy-700 transition-colors"
                        >
                          <X size={13} /> Cancel
                        </button>
                        <button
                          onClick={() => saveEdit(n.id)}
                          disabled={!editContent.trim() || savingEdit}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-electric-green text-navy-900 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          <Check size={13} /> {savingEdit ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-sm whitespace-pre-wrap break-words">{n.content}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                          {isAdmin && (
                            <span className="flex items-center gap-1 text-slate-400">
                              <User size={12} /> {n.author_name}
                            </span>
                          )}
                          <span>{formatTimestamp(n.created_at)}</span>
                          {n.updated_at && n.updated_at !== n.created_at && (
                            <span className="italic">(edited)</span>
                          )}
                        </div>
                      </div>
                      {canModify(n) && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => startEdit(n)}
                            title="Edit note"
                            className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-electric-blue hover:bg-electric-blue/10 transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => deleteNote(n.id)}
                            title="Delete note"
                            className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Delete confirmation popup */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-navy-800 rounded-xl border border-navy-700 w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center shrink-0">
                <Trash2 size={18} />
              </div>
              <h3 className="text-white font-semibold text-lg">Delete note?</h3>
            </div>
            <p className="text-slate-400 text-sm mb-6">This note will be permanently deleted. This cannot be undone.</p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white border border-navy-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:brightness-110 disabled:opacity-50 transition-all"
              >
                {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}