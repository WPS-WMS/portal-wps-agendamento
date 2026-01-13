import { useState, useEffect } from 'react'
import Login from './components/Login'
import Header from './components/Header'
import Loading from './components/Loading'
import SupplierDashboard from './components/SupplierDashboard'
import AdminDashboard from './components/AdminDashboard'
import PlantDashboard from './components/PlantDashboard'
import useAuth from './hooks/useAuth'
import './App.css'

function App() {
  const { user, token, loading, login, logout, isAuthenticated } = useAuth()

  if (loading) {
    return <Loading message="Inicializando sistema..." />
  }

  if (!isAuthenticated) {
    return <Login onLogin={login} />
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

export default App
