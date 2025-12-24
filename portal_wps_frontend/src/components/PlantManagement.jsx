import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  Building2, 
  Trash2, 
  Ban, 
  CheckCircle, 
  Save,
  Loader2
} from 'lucide-react'
import { adminAPI } from '../lib/api'

const PlantManagement = ({ plant, onBack, onUpdate }) => {
  const [formData, setFormData] = useState({
    name: plant?.name || '',
    code: plant?.code || '',
    is_active: plant?.is_active !== false
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
      await adminAPI.updatePlant(plant.id, formData)
      onUpdate()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao salvar planta')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setLoading(true)
    setError('')

    try {
      await adminAPI.deletePlant(plant.id)
      onUpdate()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao bloquear planta')
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
      await adminAPI.updatePlant(plant.id, { is_active: newStatus })
      setFormData(prev => ({ ...prev, is_active: newStatus }))
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao alterar status')
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
              Confirmar Bloqueio
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
                  Bloquear Planta
                </CardTitle>
                <CardDescription className="text-red-700">
                  Tem certeza que deseja bloquear a planta "{plant.name}"?
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
                    <strong>Código:</strong> {plant.code}
                  </p>
                  <p className="text-sm text-gray-600 mb-2">
                    <strong>Nome:</strong> {plant.name}
                  </p>
                  {plant.email && (
                    <p className="text-sm text-gray-600">
                      <strong>E-mail:</strong> {plant.email}
                    </p>
                  )}
                </div>

                <Alert>
                  <AlertDescription>
                    <strong>Atenção:</strong> Esta ação irá:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Desativar a planta no sistema</li>
                      <li>Bloquear o acesso dos usuários desta planta</li>
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
                  Bloqueando...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Confirmar Bloqueio
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
            Gerenciar Planta
          </DialogTitle>
          <DialogDescription>
            Edite, bloqueie ou desative a planta
          </DialogDescription>
        </DialogHeader>

      {/* Status da Planta */}
      <Card className={`${formData.is_active ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className={`${formData.is_active ? 'text-green-800' : 'text-red-800'} flex items-center gap-2`}>
              <Building2 className="w-5 h-5" />
              {plant.name}
            </CardTitle>
            <Badge className={formData.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
              {formData.is_active ? 'Ativo' : 'Bloqueado'}
            </Badge>
          </div>
          <CardDescription className={formData.is_active ? 'text-green-700' : 'text-red-700'}>
            Código: {plant.code}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
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
                  Bloquear
                </>
              ) : (
                <>
                  <CheckCircle className="w-3 h-3" />
                  Ativar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Formulário de Edição */}
      <Card>
        <CardHeader>
          <CardTitle>Dados da Planta</CardTitle>
          <CardDescription>
            Edite as informações da planta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Planta</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Código */}
          <div className="space-y-2">
            <Label htmlFor="code">Código</Label>
            <Input
              id="code"
              value={formData.code}
              onChange={(e) => handleInputChange('code', e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Botões de Ação */}
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Bloquear Planta
            </Button>
            <Button
              variant="outline"
              onClick={onBack}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading || !formData.name.trim() || !formData.code.trim()}
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

export default PlantManagement

