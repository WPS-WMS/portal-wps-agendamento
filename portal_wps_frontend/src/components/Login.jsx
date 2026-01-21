import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Truck, Eye, EyeOff } from 'lucide-react'
import { authAPI } from '../lib/api'

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({ email: false, password: false })
  const [showPassword, setShowPassword] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMessage, setResetMessage] = useState('')
  const [resetError, setResetError] = useState('')

  // Memoizar o ícone de senha para evitar renderizações duplicadas
  const passwordIcon = useMemo(() => {
    return showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />
  }, [showPassword])

  // Validação de formato de email
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // RN02 - Validação de campos vazios e formato
  const validateFields = () => {
    const errors = {
      email: false,
      password: false
    }
    
    // Validar se campos estão vazios
    if (email.trim() === '') {
      errors.email = true
      setFieldErrors(errors)
      setError('O campo deve ser preenchido')
      return false
    }
    
    if (password.trim() === '') {
      errors.password = true
      setFieldErrors(errors)
      setError('O campo deve ser preenchido')
      return false
    }
    
    // Validar formato de email
    if (!isValidEmail(email.trim())) {
      errors.email = true
      errors.password = true // Marcar ambos para não expor qual campo está incorreto
      setFieldErrors(errors)
      setError('Dados inválidos')
      return false
    }
    
    setFieldErrors({ email: false, password: false })
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    e.stopPropagation() // Prevenir propagação do evento
    
    setError('')
    setFieldErrors({ email: false, password: false })
    
    // RN02 - Validar antes de enviar
    if (!validateFields()) {
      return // Retornar early se validação falhar
    }

    setLoading(true)

    try {
      const data = await authAPI.login({ email, password })
      
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      onLogin(data.user, data.token)
    } catch (err) {
      // RN01 - Mensagem genérica, não expor qual campo está incorreto
      let errorMessage = 'Dados inválidos'
      
      if (err.response) {
        const status = err.response.status
        
        if (status === 401 || status === 403) {
          errorMessage = 'Dados inválidos'
          setFieldErrors({ email: true, password: true })
        } else if (status === 500) {
          errorMessage = 'Erro no servidor. Tente novamente mais tarde.'
          setFieldErrors({ email: false, password: false })
        } else {
          errorMessage = 'Erro ao fazer login. Tente novamente.'
          setFieldErrors({ email: false, password: false })
        }
      } else if (err.request) {
        // Requisição foi feita mas não houve resposta
        errorMessage = 'Servidor não está respondendo. Verifique se o backend está rodando.'
        setFieldErrors({ email: false, password: false })
      } else {
        // Erro ao configurar a requisição
        errorMessage = 'Erro de conexão. Tente novamente.'
        setFieldErrors({ email: false, password: false })
      }
      
      // Definir erro e fazer scroll para a mensagem
      setError(errorMessage)
      
      // Fazer scroll suave para a mensagem de erro após um pequeno delay
      // Usar requestAnimationFrame para garantir que o DOM foi atualizado
      requestAnimationFrame(() => {
        setTimeout(() => {
          const errorElement = document.querySelector('[role="alert"]')
          if (errorElement) {
            errorElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            // Adicionar foco visual temporário
            errorElement.style.outline = '2px solid rgb(239 68 68)'
            errorElement.style.outlineOffset = '2px'
            setTimeout(() => {
              errorElement.style.outline = ''
              errorElement.style.outlineOffset = ''
            }, 2000)
          }
        }, 100)
      })
    } finally {
      setLoading(false)
    }
  }

  // RN03 - Recuperação de senha
  const handleForgotPassword = async () => {
    setResetError('')
    setResetMessage('')
    
    if (resetEmail.trim() === '') {
      setResetError('O campo deve ser preenchido')
      return
    }

    setResetLoading(true)

    try {
      await authAPI.forgotPassword(resetEmail)
      
      // RN03 - Sempre exibir mensagem genérica, não informar se email existe
      setResetMessage('Se o e-mail estiver cadastrado, você receberá instruções para redefinir sua senha.')
      setResetEmail('')
      
      // Fechar modal após 3 segundos
      setTimeout(() => {
        setShowForgotPassword(false)
        setResetMessage('')
      }, 3000)
    } catch (err) {
      // RN03 - Mesmo em caso de erro, exibir mensagem genérica
      setResetMessage('Se o e-mail estiver cadastrado, você receberá instruções para redefinir sua senha.')
      setResetEmail('')
      setTimeout(() => {
        setShowForgotPassword(false)
        setResetMessage('')
      }, 3000)
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
            <Truck className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">Cargo Flow</CardTitle>
          <CardDescription className="text-gray-600">
            Sistema de Agendamento de Carga
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <Alert 
                variant="destructive" 
                className="animate-in fade-in slide-in-from-top-2 duration-300"
                role="alert"
                aria-live="assertive"
              >
                <AlertDescription className="font-medium">{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="text"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  // Limpar erro apenas quando o usuário começar a digitar
                  if (error) {
                    setFieldErrors(prev => ({ ...prev, email: false }))
                    setError('')
                  }
                }}
                onInvalid={(e) => {
                  e.preventDefault()
                }}
                disabled={loading}
                className={fieldErrors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    // Limpar erro apenas quando o usuário começar a digitar
                    if (error) {
                      setFieldErrors(prev => ({ ...prev, password: false }))
                      setError('')
                    }
                  }}
                  disabled={loading}
                  className={`pr-10 ${fieldErrors.password ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowPassword(!showPassword)
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none z-10"
                  disabled={loading}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  tabIndex={-1}
                >
                  {passwordIcon}
                </button>
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                disabled={loading}
              >
                Esqueci minha senha
              </button>
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Modal de Recuperação de Senha - RN03 */}
      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recuperar Senha</DialogTitle>
            <DialogDescription>
              Digite seu e-mail para receber instruções de recuperação de senha.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {resetMessage && (
              <Alert className="bg-green-50 text-green-900 border-green-200">
                <AlertDescription>{resetMessage}</AlertDescription>
              </Alert>
            )}
            
            {resetError && (
              <Alert variant="destructive">
                <AlertDescription>{resetError}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="seu@email.com"
                value={resetEmail}
                onChange={(e) => {
                  setResetEmail(e.target.value)
                  setResetError('')
                }}
                disabled={resetLoading}
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowForgotPassword(false)
                setResetEmail('')
                setResetError('')
                setResetMessage('')
              }}
              disabled={resetLoading}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleForgotPassword}
              disabled={resetLoading}
            >
              {resetLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Login
