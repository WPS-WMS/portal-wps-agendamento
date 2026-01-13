import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Building2, 
  Ban, 
  CheckCircle, 
  Save,
  Loader2,
  Clock
} from 'lucide-react'
import { adminAPI } from '../lib/api'
import { formatPhone, formatCEP } from '../lib/formatters'

const PlantManagement = ({ plant, onBack, onUpdate }) => {
  const [formData, setFormData] = useState({
    name: plant?.name || '',
    code: plant?.code || '',
    cnpj: plant?.cnpj || '',
    phone: plant?.phone || '',
    cep: plant?.cep || '',
    street: plant?.street || '',
    number: plant?.number || '',
    neighborhood: plant?.neighborhood || '',
    reference: plant?.reference || '',
    is_active: plant?.is_active !== false
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('dados')
  const [maxCapacity, setMaxCapacity] = useState(1)
  const [maxCapacityLoading, setMaxCapacityLoading] = useState(false)
  const [maxCapacityError, setMaxCapacityError] = useState('')
  const [maxCapacitySuccess, setMaxCapacitySuccess] = useState('')

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError('')
  }

  const handlePhoneChange = (e) => {
    const value = formatPhone(e.target.value)
    handleInputChange('phone', value)
  }

  const handleCEPChange = (e) => {
    const value = formatCEP(e.target.value)
    handleInputChange('cep', value)
  }

  // Atualizar formData quando o objeto plant mudar
  useEffect(() => {
    if (plant) {
      console.log('PlantManagement - Objeto plant recebido:', plant)
      console.log('PlantManagement - CNPJ:', plant.cnpj)
      setFormData({
        name: plant.name || '',
        code: plant.code || '',
        cnpj: plant.cnpj || '',
        phone: plant.phone || '',
        cep: plant.cep || '',
        street: plant.street || '',
        number: plant.number || '',
        neighborhood: plant.neighborhood || '',
        reference: plant.reference || '',
        is_active: plant.is_active !== false
      })
      
      // Carregar capacidade máxima da planta
      loadMaxCapacity()
    }
  }, [plant])
  
  const loadMaxCapacity = async () => {
    if (!plant?.id) return
    
    setMaxCapacityLoading(true)
    setMaxCapacityError('')
    
    try {
      const data = await adminAPI.getPlantMaxCapacity(plant.id)
      setMaxCapacity(data.max_capacity || 1)
    } catch (err) {
      setMaxCapacityError(err.response?.data?.error || 'Erro ao carregar capacidade máxima')
      setMaxCapacity(1) // Valor padrão
    } finally {
      setMaxCapacityLoading(false)
    }
  }
  
  const handleSaveMaxCapacity = async () => {
    if (!plant?.id) return
    
    setMaxCapacityLoading(true)
    setMaxCapacityError('')
    setMaxCapacitySuccess('')
    
    try {
      const result = await adminAPI.setPlantMaxCapacity(plant.id, maxCapacity)
      console.log(`[PlantManagement] Capacidade salva com sucesso:`, result)
      setMaxCapacitySuccess('Capacidade máxima atualizada com sucesso!')
      setTimeout(() => setMaxCapacitySuccess(''), 3000)
      
      // Recarregar capacidade para garantir sincronização
      const updatedData = await adminAPI.getPlantMaxCapacity(plant.id)
      setMaxCapacity(updatedData.max_capacity || 1)
      console.log(`[PlantManagement] Capacidade recarregada: ${updatedData.max_capacity}`)
      
      onUpdate() // Recarregar dados da planta
    } catch (err) {
      console.error(`[PlantManagement] Erro ao salvar capacidade:`, err)
      setMaxCapacityError(err.response?.data?.error || 'Erro ao salvar capacidade máxima')
    } finally {
      setMaxCapacityLoading(false)
    }
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


  const handleToggleStatus = async () => {
    const newStatus = !formData.is_active
    setLoading(true)
    setError('')

    try {
      await adminAPI.updatePlant(plant.id, { is_active: newStatus })
      setFormData(prev => ({ ...prev, is_active: newStatus }))
      // Recarregar a lista de plantas para garantir que apareça na tela
      onUpdate()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao alterar status')
    } finally {
      setLoading(false)
    }
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
            Edite ou inative a planta
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
              {formData.is_active ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
          <CardDescription className={formData.is_active ? 'text-green-700' : 'text-red-700'}>
            Código: {plant.code}
            {plant.cnpj && ` • CNPJ: ${plant.cnpj}`}
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
                  Inativar
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="dados">Dados da Planta</TabsTrigger>
          <TabsTrigger value="capacidade">Recebimentos por Horário</TabsTrigger>
        </TabsList>
        
        {/* Aba: Dados da Planta */}
        <TabsContent value="dados" className="space-y-4">
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

          {/* CNPJ (somente leitura) */}
          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input
              id="cnpj"
              value={formData.cnpj || plant?.cnpj || ''}
              disabled
              readOnly
              className="bg-gray-100 cursor-not-allowed"
            />
          </div>

          {/* Telefone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              type="text"
              placeholder="(00) 00000-0000"
              value={formData.phone}
              onChange={handlePhoneChange}
              maxLength={15}
              disabled={loading}
            />
          </div>

          {/* Separador - Endereço */}
          <div className="border-t pt-6 mt-6">
            <h3 className="text-sm font-semibold mb-6">Endereço</h3>

            {/* CEP */}
            <div className="space-y-2 mb-4">
              <Label htmlFor="cep">CEP</Label>
              <Input
                id="cep"
                type="text"
                placeholder="00000-000"
                value={formData.cep}
                onChange={handleCEPChange}
                maxLength={9}
                disabled={loading}
              />
            </div>

            {/* Rua */}
            <div className="space-y-2 mb-4">
              <Label htmlFor="street">Rua</Label>
              <Input
                id="street"
                type="text"
                placeholder="Nome da rua"
                value={formData.street}
                onChange={(e) => handleInputChange('street', e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Número e Bairro */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="number">Número</Label>
                <Input
                  id="number"
                  type="text"
                  placeholder="123"
                  value={formData.number}
                  onChange={(e) => handleInputChange('number', e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="neighborhood">Bairro</Label>
                <Input
                  id="neighborhood"
                  type="text"
                  placeholder="Nome do bairro"
                  value={formData.neighborhood}
                  onChange={(e) => handleInputChange('neighborhood', e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Referência */}
            <div className="space-y-2">
              <Label htmlFor="reference">Referência</Label>
              <Input
                id="reference"
                type="text"
                placeholder="Ponto de referência próximo"
                value={formData.reference}
                onChange={(e) => handleInputChange('reference', e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

              {/* Botões de Ação */}
              <DialogFooter>
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
        </TabsContent>
        
        {/* Aba: Recebimentos por Horário */}
        <TabsContent value="capacidade" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Capacidade Máxima de Recebimentos por Horário
              </CardTitle>
              <CardDescription>
                Configure quantos agendamentos podem ser realizados no mesmo horário para esta planta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {maxCapacityError && (
                <Alert variant="destructive">
                  <AlertDescription>{maxCapacityError}</AlertDescription>
                </Alert>
              )}
              
              {maxCapacitySuccess && (
                <Alert className="border-green-200 bg-green-50">
                  <AlertDescription className="text-green-800">{maxCapacitySuccess}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="max_capacity">Capacidade Máxima por Horário</Label>
                <Input
                  id="max_capacity"
                  type="number"
                  min="1"
                  value={maxCapacity}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 1
                    setMaxCapacity(value)
                    setMaxCapacityError('')
                    setMaxCapacitySuccess('')
                  }}
                  disabled={maxCapacityLoading}
                  className="w-32"
                />
                <p className="text-sm text-gray-500">
                  Número máximo de agendamentos que podem ser realizados no mesmo horário para esta planta.
                </p>
              </div>
              
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={onBack}
                  disabled={maxCapacityLoading}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveMaxCapacity}
                  disabled={maxCapacityLoading || maxCapacity < 1}
                  className="flex items-center gap-2"
                >
                  {maxCapacityLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Salvar Capacidade
                    </>
                  )}
                </Button>
              </DialogFooter>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </DialogContent>
    </Dialog>
  )
}

export default PlantManagement

