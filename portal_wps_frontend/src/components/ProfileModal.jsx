import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, User, Mail, Lock } from 'lucide-react'
import { apiClient } from '../lib/api'

const ProfileModal = ({ isOpen, onClose, user, onUpdateSuccess }) => {
  const [formData, setFormData] = useState({
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (isOpen && user) {
      setFormData({
        email: user.email || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
      setError('')
      setSuccess('')
    }
  }, [isOpen, user])

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Administrador',
      supplier: 'Fornecedor',
      plant: 'Planta'
    }
    return labels[role] || role
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    setError('')
    setSuccess('')

    // Validações no frontend antes de enviar
    // 1. Se há nova senha, senha atual é obrigatória
    if (formData.newPassword && !formData.currentPassword) {
      setError('Digite a senha atual para alterar a senha')
      setLoading(false)
      return
    }

    // 2. Validar se nova senha e confirmação são iguais
    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      setError('As senhas não coincidem')
      setLoading(false)
      return
    }

    // 3. Validar tamanho mínimo da nova senha
    if (formData.newPassword && formData.newPassword.length < 6) {
      setError('A nova senha deve ter no mínimo 6 caracteres')
      setLoading(false)
      return
    }

    // 4. Se não há nova senha, não há nada para atualizar
    if (!formData.newPassword) {
      setError('Preencha os campos de senha para realizar a alteração')
      setLoading(false)
      return
    }

    try {
      // Preparar dados para envio
      const updateData = {}
      
      // Apenas incluir senha se foi fornecida
      if (formData.newPassword) {
        updateData.current_password = formData.currentPassword
        updateData.new_password = formData.newPassword
      }

      // Se não houver nada para atualizar
      if (Object.keys(updateData).length === 0) {
        setError('Nenhuma alteração foi feita')
        setLoading(false)
        return
      }

      // Usar apiClient em vez de fetch direto para funcionar em produção
      const response = await apiClient.put('/user/profile', updateData)
      const data = response.data

      setSuccess('Perfil atualizado com sucesso!')
      // Limpar campos de senha
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }))
      
      // Chamar callback de sucesso
      if (onUpdateSuccess) {
        onUpdateSuccess(data.user)
      }

      // Fechar modal após 1.5 segundos
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (err) {
      // Tratar erros da API
      if (err.response) {
        const status = err.response.status
        const errorMessage = err.response.data?.error || 'Erro ao atualizar perfil'
        
        if (status === 401) {
          setError('Senha atual incorreta')
        } else if (status === 400) {
          setError(errorMessage)
        } else {
          setError(errorMessage || 'Erro ao atualizar perfil')
        }
      } else if (err.request) {
        setError('Servidor não está respondendo. Verifique se o backend está rodando.')
      } else {
        setError('Erro de conexão. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Editar Perfil
          </DialogTitle>
          <DialogDescription>
            Atualize suas informações pessoais. Os campos marcados são editáveis.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-green-50 text-green-900 border-green-200">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Informações não editáveis */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Email</Label>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <p className="text-sm font-medium">{user?.email}</p>
              </div>
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Perfil</Label>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                <p className="text-sm font-medium">{getRoleLabel(user?.role)}</p>
              </div>
            </div>
          </div>

          {/* Seção de alteração de senha */}
          <div className="space-y-4 pt-4 border-t">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Alterar Senha
            </h4>

            <div className="space-y-2">
              <Label htmlFor="currentPassword">Senha Atual</Label>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                placeholder="Digite sua senha atual"
                value={formData.currentPassword}
                onChange={handleChange}
                disabled={loading}
                autoComplete="current-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                placeholder="Digite a nova senha"
                value={formData.newPassword}
                onChange={handleChange}
                disabled={loading}
                autoComplete="new-password"
              />
              <p className="text-xs text-gray-500">Mínimo de 6 caracteres</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirme a nova senha"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={loading}
                autoComplete="new-password"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default ProfileModal

