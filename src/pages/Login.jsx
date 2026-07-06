import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth, ALL_PAGES } from '../context/AuthContext'
import { Dumbbell, LogIn, Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!username.trim()) return setError('Username is required.')
    if (!password) return setError('Password is required.')

    setLoading(true)

    const result = await login(username.trim(), password)
    setLoading(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    // Redirect to the page they tried to visit, or their first allowed page
    const from = location.state?.from?.pathname
    const account = result.account

    let destination = '/'
    if (account.role === 'admin') {
      destination = from && from !== '/login' ? from : '/'
    } else {
      const allowed = account.allowedPages || []
      if (from && allowed.includes(from)) {
        destination = from
      } else {
        // go to first allowed page
        const first = ALL_PAGES.find(p => allowed.includes(p.path))
        destination = first ? first.path : '/access-denied'
      }
    }

    navigate(destination, { replace: true })
  }

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <Dumbbell size={36} className="text-electric-green" />
            <h1 className="text-3xl font-bold text-white">J-gym</h1>
          </div>
          <p className="text-slate-400">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-navy-800 rounded-2xl border border-navy-700 p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">
                {error}
              </div>
            )}

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your username"
                autoComplete="username"
                autoFocus
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-electric-blue transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full bg-navy-900 border border-navy-700 rounded-lg px-4 py-2.5 pr-12 text-white placeholder-slate-500 focus:outline-none focus:border-electric-blue transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-electric-blue hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors mt-2"
            >
              {loading ? (
                <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-white" />
              ) : (
                <>
                  <LogIn size={18} />
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          J-gym Management System
        </p>
      </div>
    </div>
  )
}