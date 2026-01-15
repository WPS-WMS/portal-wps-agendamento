import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  Building2, 
  Edit, 
  Trash2, 
  Ban, 
  CheckCircle, 
  Save,
  Loader2
} from 'lucide-react'
import { adminAPI } from '../lib/api'
import usePermissions from '../hooks/usePermissions'

const SupplierManagement = ({ supplier, onBack, onUpdate, user }) => {
  const { hasPermission, getPermissionType } = usePermissions(user)
  const canInactivate = hasPermission('inactivate_supplier', 'editor')
  const canDelete = hasPermission('delete_supplier', 'editor')
  const deletePermissionType = getPermissionType('delete_supplier')
  const canViewDelete = deletePermissionType !== 'none'
  const [formData, setFormData] = useState({
    description: supplier?.description || '',
    is_active: supplier?.is_active !== false
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError('')
  }

  const handleSave = async () => {
    setLoading(true)
    setError('')

    try {
      await adminAPI.updateSupplier(supplier.id, formData)
      onUpdate()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setLoading(true)
    setError('')

    try {
      await adminAPI.deleteSupplier(supplier.id)
      onUpdate()
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Erro ao excluir fornecedor'
      setError(errorMessage)
      setShowDeleteConfirm(false)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async () => {
    const newStatus = !formData.is_active
    setLoading(true)
    setError('')

    try {
      await adminAPI.updateSupplier(supplier.id, { is_active: newStatus })
      setFormData(prev => ({ ...prev, is_active: newStatus }))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (showDeleteConfirm) {
    return (
      <Dialog open={true} onOpenChange={() => setShowDeleteConfirm(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-red-800 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Confirmar Exclusão
            </DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-red-800 flex items-center gap-2">
                  <Trash2 className="w-5 h-5" />
                  Excluir Fornecedor
                </CardTitle>
                <CardDescription className="text-red-700">
                  Tem certeza que deseja excluir o fornecedor "{supplier.description}"?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="bg-white p-4 rounded border">
                  <p className="text-sm text-gray-600 mb-2">
                    <strong>CNPJ:</strong> {supplier.cnpj}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Descrição:</strong> {supplier.description}
                  </p>
                </div>

                <Alert>
                  <AlertDescription>
                    <strong>Atenção:</strong> Esta ação irá:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Desativar o fornecedor no sistema</li>
                      <li>Inativar o acesso dos usuários deste fornecedor</li>
                      <li>Manter o histórico de agendamentos para auditoria</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Confirmar Exclusão
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={true} onOpenChange={onBack}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Gerenciar Fornecedor
          </DialogTitle>
          <DialogDescription>
            Edite, inative ou exclua o fornecedor
          </DialogDescription>
        </DialogHeader>

      {/* Status do Fornecedor */}
      <Card className={`${formData.is_active ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className={`${formData.is_active ? 'text-green-800' : 'text-red-800'} flex items-center gap-2`}>
              <Building2 className="w-5 h-5" />
              {supplier.description}
            </CardTitle>
            <Badge className={formData.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
              {formData.is_active ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
          <CardDescription className={formData.is_active ? 'text-green-700' : 'text-red-700'}>
            CNPJ: {supplier.cnpj}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!canInactivate && (
            <Alert className="mb-4">
              <AlertDescription>
                Você não tem permissão para inativar/ativar fornecedores. Apenas usuários com perfil Editor podem realizar esta ação.
              </AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            {canInactivate && (
              <Button
                size="sm"
                variant={formData.is_active ? "destructive" : "default"}
                onClick={handleToggleStatus}
                disabled={loading}
                className="flex items-center gap-1"
              >
                {formData.is_active ? (
                  <>
                    <Ban className="w-3 h-3" />
                    Inativar
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3 h-3" />
                    Ativar
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Formulário de Edição */}
      <Card>
        <CardHeader>
          <CardTitle>Dados do Fornecedor</CardTitle>
          <CardDescription>
            Edite as informações do fornecedor
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* CNPJ (somente leitura) */}
          <div className="space-y-2">
            <Label>CNPJ</Label>
            <Input
              value={supplier.cnpj}
              disabled
              className="bg-gray-50"
            />
            <p className="text-xs text-gray-500">
              O CNPJ não pode ser alterado após o cadastro
            </p>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description">Nome/Descrição do Fornecedor</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Botões de Ação */}
          {canViewDelete && !canDelete && (
            <Alert className="mb-4">
              <AlertDescription>
                Você não tem permissão para excluir fornecedores. Apenas usuários com perfil Editor podem realizar esta ação.
              </AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            {canViewDelete && (
              <Button
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading || !canDelete}
                className="flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Excluir Fornecedor
              </Button>
            )}
            <Button
              variant="outline"
              onClick={onBack}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading || !formData.description.trim()}
              className="flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </DialogFooter>
        </CardContent>
      </Card>
      </DialogContent>
    </Dialog>
  )
}

export default SupplierManagement
