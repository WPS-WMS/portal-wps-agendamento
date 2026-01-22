import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
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

function AppContent() {
  const { user, token, loading, login, logout, isAuthenticated } = useAuth()
  const location = useLocation()

  if (loading) {
    return <Loading message="Inicializando sistema..." />
  }

  // Se estiver na rota de reset-password, mostrar componente de reset
  if (location.pathname === '/reset-password') {
    return (
      <>
        <ResetPassword />
        <Toaster />
      </>
    )
  }

  return (
    <>
      {!isAuthenticated ? (
        <Login onLogin={login} />
      ) : (
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
      )}
      <Toaster />
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/reset-password" element={<AppContent />} />
        <Route path="*" element={<AppContent />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
