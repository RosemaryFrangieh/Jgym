import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/layout'
import Dashboard from './pages/Dashboard'
import Memberships from './pages/Memberships'
import Financials from './pages/Financials'
import Login from './pages/Login'
import AccessDenied from './pages/AccessDenied'
import Accounts from './pages/Accounts'

// Generic page-level guard
function PageGuard({ path, children }) {
  const { user, loading, canAccess } = useAuth()
  const location = useLocation()

  if (loading) return null

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />

  // Admin-only pages check
  if (path === '/accounts' && user.role !== 'admin') {
    return <Navigate to="/access-denied" replace />
  }

  if (!canAccess(path)) {
    return <Navigate to="/access-denied" replace />
  }

  return children
}

// Redirect to first allowed page if authed
function AuthRedirect() {
  const { user, loading } = useAuth()

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />

  // Already authed, go to login → redirect to app
  return <Navigate to="/" replace />
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-900">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-electric-blue" />
      </div>
    )
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route path="/access-denied" element={<AccessDenied />} />

      {/* Protected layout routes */}
      <Route
        path="/"
        element={
          user ? <Layout /> : <Navigate to="/login" replace />
        }
      >
        <Route
          index
          element={
            <PageGuard path="/">
              <Dashboard />
            </PageGuard>
          }
        />
        <Route
          path="memberships"
          element={
            <PageGuard path="/memberships">
              <Memberships />
            </PageGuard>
          }
        />
        <Route
          path="financials"
          element={
            <PageGuard path="/financials">
              <Financials />
            </PageGuard>
          }
        />
        <Route
          path="accounts"
          element={
            <PageGuard path="/accounts">
              <Accounts />
            </PageGuard>
          }
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App