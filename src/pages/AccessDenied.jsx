import { useNavigate } from 'react-router-dom'
import { useAuth, ALL_PAGES } from '../context/AuthContext'
import { ShieldOff, ArrowLeft } from 'lucide-react'

export default function AccessDenied() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const handleBack = () => {
    if (!user) return navigate('/login')
    const allowed = user.role === 'admin' ? ALL_PAGES : ALL_PAGES.filter(p => user.allowedPages?.includes(p.path))
    if (allowed.length > 0) navigate(allowed[0].path)
    else navigate('/login')
  }

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 mb-6">
          <ShieldOff size={36} className="text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-slate-400 mb-8">
          You don't have permission to view this page. Contact your administrator to request access.
        </p>
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 bg-navy-800 hover:bg-navy-700 border border-navy-700 text-white px-6 py-2.5 rounded-lg transition-colors font-medium"
        >
          <ArrowLeft size={18} />
          Go Back
        </button>
      </div>
    </div>
  )
}