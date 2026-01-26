import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './components/LandingPage'
import Login from './components/Login'
import Header from './components/Header'
import Loading from './components/Loading'
import SupplierDashboard from './components/SupplierDashboard'
import AdminDashboard from './components/AdminDashboard'
import PlantDashboard from './components/PlantDashboard'
import ResetPassword from './components/ResetPassword'
import useAuth from './hooks/useAuth'
import { Toaster } from './components/ui/sonner'
import './App.css'

// Componente para rotas públicas (LandingPage, Login)
function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  
  if (loading) {
    return <Loading message="Inicializando sistema..." />
  }
  
  // Se estiver autenticado, redirecionar para o dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }
  
  return children
}

// Componente para rota de login
function LoginRoute({ onLogin }) {
  return <Login onLogin={onLogin} />
}

// Componente para rotas protegidas (Dashboards)
function ProtectedRoute() {
  const { user, token, logout, loading, isAuthenticated } = useAuth()
  
  if (loading) {
    return <Loading message="Inicializando sistema..." />
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} onLogout={logout} />
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {user.role === 'admin' ? (
          <AdminDashboard user={user} token={token} />
        ) : user.role === 'plant' ? (
          <PlantDashboard user={user} token={token} />
        ) : (
          <SupplierDashboard user={user} token={token} />
        )}
      </main>
    </div>
  )
}

function App() {
  const { login } = useAuth()
  
  return (
    <BrowserRouter>
      <Routes>
        {/* Rota pública: Landing Page */}
        <Route 
          path="/" 
          element={
            <PublicRoute>
              <LandingPage />
            </PublicRoute>
          } 
        />
        
        {/* Rota pública: Login */}
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <LoginRoute onLogin={login} />
            </PublicRoute>
          } 
        />
        
        {/* Rota pública: Reset Password */}
        <Route path="/reset-password" element={<ResetPassword />} />
        
        {/* Rota protegida: Dashboard */}
        <Route path="/dashboard" element={<ProtectedRoute />} />
        
        {/* Redirecionar rotas antigas para dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}

export default App
