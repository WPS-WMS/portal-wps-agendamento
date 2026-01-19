import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Shield, 
  ArrowLeft,
  Save,
  Loader2,
  UserX,
  Key,
  Copy,
  Check,
  Trash2,
  AlertTriangle
} from 'lucide-react'
import { adminAPI } from '../lib/api'

const UserManagement = ({ user, onBack, onUpdate }) => {
  const [formData, setFormData] = useState({
    email: user?.email || '',
    role: user?.role || '',
    supplier_id: user?.supplier_id || '',
    plant_id: user?.plant_id || '',
    is_active: user?.is_active !== false
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState(null)
  const [copied, setCopied] = useState(false)
  const [suppliers, setSuppliers] = useState([])
  const [plants, setPlants] = useState([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || '',
        role: user.role || '',
        supplier_id: user.supplier_id ? user.supplier_id.toString() : '',
        plant_id: user.plant_id ? user.plant_id.toString() : '',
        is_active: user.is_active !== false
      })
    }
    loadSuppliers()
    loadPlants()
  }, [user])

  const loadSuppliers = async () => {
    try {
      const data = await adminAPI.getSuppliers()
      setSuppliers(Array.isArray(data) ? data.filter(s => s.is_active) : [])
    } catch (err) {
      // Erro silencioso - dados não carregados
    }
  }

  const loadPlants = async () => {
    try {
      const data = await adminAPI.getPlants()
      setPlants(Array.isArray(data) ? data.filter(p => p.is_active) : [])
    } catch (err) {
      // Erro silencioso - dados não carregados
    }
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value }
      
      // Limpar associações quando mudar o role
      if (field === 'role') {
        newData.supplier_id = ''
        newData.plant_id = ''
      }
      
      return newData
    })
    setError('')
    setSuccess('')
  }

  const handleSave = async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    // Validações
    if (formData.role === 'supplier' && !formData.supplier_id) {
      setError('Selecione um fornecedor')
      setLoading(false)
      return
    }

    if (formData.role === 'plant' && !formData.plant_id) {
      setError('Selecione uma planta')
      setLoading(false)
      return
    }

    try {
      const updateData = {
        email: formData.email,
        role: formData.role,
        is_active: formData.is_active
      }

      // Limpar associações antigas e adicionar novas baseadas no role
      if (formData.role === 'supplier') {
        const parsed = parseInt(formData.supplier_id, 10)
        if (!isNaN(parsed)) {
          updateData.supplier_id = parsed
        }
        updateData.plant_id = null // Limpar associação com planta
      } else if (formData.role === 'plant') {
        const parsed = parseInt(formData.plant_id, 10)
        if (!isNaN(parsed)) {
          updateData.plant_id = parsed
        }
        updateData.supplier_id = null // Limpar associação com fornecedor
      } else if (formData.role === 'admin') {
        // Admin não tem associações
        updateData.supplier_id = null
        updateData.plant_id = null
      }

      await adminAPI.updateUser(user.id, updateData)
      setSuccess('Usuário atualizado com sucesso!')
      setTimeout(() => {
        onUpdate()
      }, 1000)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao atualizar usuário')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    setLoading(true)
    setError('')
    setResetPasswordSuccess(null)

    try {
      const password = newPassword || null
      const result = await adminAPI.resetUserPassword(user.id, password)
      setResetPasswordSuccess(result)
      setNewPassword('')
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao redefinir senha')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyPassword = async () => {
    if (resetPasswordSuccess?.temp_password) {
      try {
        await navigator.clipboard.writeText(resetPasswordSuccess.temp_password)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        // Erro silencioso ao copiar senha
      }
    }
  }

  const handleDeleteUser = async () => {
    setDeleting(true)
    setError('')
    setSuccess('')
    
    try {
      await adminAPI.deleteUser(user.id)
      
      // Fechar modal de confirmação
      setShowDeleteConfirm(false)
      
      // Pequeno delay para garantir que o backend processou
      // e então recarregar a lista e voltar
      setTimeout(() => {
        onUpdate() // Isso vai chamar loadUsers() e fechar o modal
      }, 300)
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Erro ao excluir usuário'
      setError(errorMessage)
      setShowDeleteConfirm(false)
    } finally {
      setDeleting(false)
    }
  }

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Administrador',
      supplier: 'Fornecedor',
      plant: 'Planta'
    }
    return labels[role] || role
  }

  if (showResetPassword) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Redefinir Senha</h1>
          <Button onClick={() => setShowResetPassword(false)} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Redefinir Senha do Usuário
            </CardTitle>
            <CardDescription>
              {user?.email}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {resetPasswordSuccess ? (
              <Alert className="bg-green-50 border-green-200">
                <AlertDescription className="space-y-2">
                  <p className="font-semibold text-green-800">Senha redefinida com sucesso!</p>
                  {resetPasswordSuccess.temp_password && (
                    <>
                      <div className="flex items-center gap-2">
                        <Input
                          value={resetPasswordSuccess.temp_password}
                          readOnly
                          className="font-mono bg-white"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleCopyPassword}
                        >
                          {copied ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-sm text-green-700">
                        ⚠️ Anote esta senha! Ela não será exibida novamente.
                      </p>
                    </>
                  )}
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nova Senha (Opcional)</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Deixe em branco para gerar senha automática"
                  />
                  <p className="text-xs text-gray-500">
                    Se não informada, uma senha temporária será gerada automaticamente
                  </p>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowResetPassword(false)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleResetPassword}
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Redefinindo...
                      </>
                    ) : (
                      <>
                        <Key className="w-4 h-4 mr-2" />
                        Redefinir Senha
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Gerenciar Usuário</h1>
        <Button onClick={onBack} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Dados do Usuário
          </CardTitle>
          <CardDescription>
            {user?.email}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-green-50 border-green-200">
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Perfil</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => handleInputChange('role', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="supplier">Fornecedor</SelectItem>
                <SelectItem value="plant">Planta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Campo de seleção de Fornecedor - aparece quando o perfil é supplier */}
          {formData.role === 'supplier' && (
            <div className="space-y-2">
              <Label htmlFor="supplier_id">Fornecedor *</Label>
              {suppliers.length > 0 ? (
                <Select
                  value={formData.supplier_id}
                  onValueChange={(value) => handleInputChange('supplier_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id.toString()}>
                        {supplier.description} - {supplier.cnpj}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Alert>
                  <AlertDescription>
                    Nenhum fornecedor ativo disponível. Por favor, cadastre um fornecedor antes de criar um usuário com perfil de fornecedor.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Campo de seleção de Planta - aparece quando o perfil é plant */}
          {formData.role === 'plant' && (
            <div className="space-y-2">
              <Label htmlFor="plant_id">Planta *</Label>
              {plants.length > 0 ? (
                <Select
                  value={formData.plant_id}
                  onValueChange={(value) => handleInputChange('plant_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a planta" />
                  </SelectTrigger>
                  <SelectContent>
                    {plants.map((plant) => (
                      <SelectItem key={plant.id} value={plant.id.toString()}>
                        {plant.name} - {plant.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Alert>
                  <AlertDescription>
                    Nenhuma planta ativa disponível. Por favor, cadastre uma planta antes de criar um usuário com perfil de planta.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Mostrar associação atual apenas se o perfil não foi alterado */}
          {formData.role === user?.role && user?.supplier && (
            <div className="p-3 bg-blue-50 rounded border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Fornecedor associado:</strong> {user.supplier.description} - {user.supplier.cnpj}
              </p>
            </div>
          )}

          {formData.role === user?.role && user?.plant && (
            <div className="p-3 bg-green-50 rounded border border-green-200">
              <p className="text-sm text-green-800">
                <strong>Planta associada:</strong> {user.plant.name} - {user.plant.code}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="is_active">Status</Label>
              <p className="text-sm text-gray-500">
                {formData.is_active ? 'Usuário ativo no sistema' : 'Usuário inativo'}
              </p>
            </div>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => handleInputChange('is_active', checked)}
            />
          </div>

          <div className="space-y-4 pt-4">
            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowResetPassword(true)}
                className="flex-1"
              >
                <Key className="w-4 h-4 mr-2" />
                Redefinir Senha
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </div>
            
            {/* Separador visual para ação destrutiva */}
            <div className="border-t pt-4">
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading || deleting}
                className="w-full"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir Usuário Permanentemente
              </Button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Esta ação excluirá o usuário permanentemente do sistema. Use o toggle acima para apenas desativar.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Confirmação de Exclusão */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Confirmar Exclusão Permanente
            </DialogTitle>
            <DialogDescription className="pt-2">
              Esta ação irá excluir permanentemente o usuário <strong>{user?.email}</strong>.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <Alert className="bg-red-50 border-red-200">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>ATENÇÃO: Esta ação é IRREVERSÍVEL!</strong>
              </AlertDescription>
            </Alert>

            <div className="space-y-2 text-sm text-gray-600">
              <p><strong>Consequências da exclusão permanente:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>O usuário será removido permanentemente do banco de dados</li>
                <li>Não será mais possível fazer login com este usuário</li>
                <li>O usuário desaparecerá completamente da lista</li>
                <li>Esta ação <strong>NÃO pode ser desfeita</strong></li>
              </ul>
            </div>

            <div className="p-3 bg-blue-50 rounded border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>💡 Dica:</strong> Se você apenas quer impedir o acesso temporariamente, 
                use o toggle "Status" acima para desativar o usuário ao invés de excluí-lo.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Confirmar Exclusão
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default UserManagement

