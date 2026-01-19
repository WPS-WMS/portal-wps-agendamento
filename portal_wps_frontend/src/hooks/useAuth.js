import { useState, useEffect, useCallback } from 'react'

const useAuth = () => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)

  // Função para limpar autenticação
  const clearAuth = useCallback(() => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    // Limpar qualquer outro dado de sessão
    sessionStorage.clear()
  }, [])

  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('token')
      const storedUser = localStorage.getItem('user')

      if (storedToken && storedUser) {
        try {
          // Verificar se o token ainda é válido
          const response = await fetch('/api/verify', {
            headers: {
              'Authorization': `Bearer ${storedToken}`
            }
          })

          if (response.ok) {
            const data = await response.json()
            setUser(data.user)
            setToken(storedToken)
          } else {
            // Token inválido, limpar storage
            clearAuth()
          }
        } catch (error) {
          clearAuth()
        }
      }
      
      setLoading(false)
    }

    checkAuth()
  }, [clearAuth])

  // Verificar autenticação periodicamente (a cada 5 minutos)
  useEffect(() => {
    if (!user || !token) return

    const intervalId = setInterval(async () => {
      try {
        const response = await fetch('/api/verify', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (!response.ok) {
          // Token expirou ou é inválido
          clearAuth()
        }
      } catch (error) {
        console.error('Erro ao verificar token:', error)
      }
    }, 5 * 60 * 1000) // 5 minutos

    return () => clearInterval(intervalId)
  }, [user, token, clearAuth])

  const login = (userData, userToken) => {
    setUser(userData)
    setToken(userToken)
    localStorage.setItem('token', userToken)
    localStorage.setItem('user', JSON.stringify(userData))
  }

  const logout = useCallback(() => {
    clearAuth()
    // Forçar reload da página para garantir que não há estado residual
    window.location.href = '/'
  }, [clearAuth])

  const updateUser = useCallback((updatedData) => {
    const newUser = { ...user, ...updatedData }
    setUser(newUser)
    localStorage.setItem('user', JSON.stringify(newUser))
  }, [user])

  return {
    user,
    token,
    loading,
    login,
    logout,
    updateUser,
    isAuthenticated: !!user && !!token
  }
}

export default useAuth
