import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Save, Loader2, Shield, Copy, Check } from 'lucide-react'
import { adminAPI } from '../lib/api'
import { validation } from '../lib/utils'

const UserForm = ({ onBack, onSuccess }) => {
  const [formData, setFormData] = useState({
    email: '',
    role: '',
    password: '',
    supplier_id: '',
    plant_id: '',
    is_active: true
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const [copied, setCopied] = useState(false)
  const [suppliers, setSuppliers] = useState([])
  const [plants, setPlants] = useState([])

  useEffect(() => {
    loadSuppliers()
    loadPlants()
  }, [])

  const loadSuppliers = async () => {
    try {
      const data = await adminAPI.getSuppliers()
      setSuppliers(Array.isArray(data) ? data.filter(s => s.is_active) : [])
    } catch (err) {
      console.error('Erro ao carregar fornecedores:', err)
    }
  }

  const loadPlants = async () => {
    try {
      const data = await adminAPI.getPlants()
      setPlants(Array.isArray(data) ? data.filter(p => p.is_active) : [])
    } catch (err) {
      console.error('Erro ao carregar plantas:', err)
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
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(null)

    // Validações
    if (!formData.email.trim()) {
      setError('Email é obrigatório')
      setLoading(false)
      return
    }

    if (!validation.isValidEmail(formData.email)) {
      setError('Email inválido')
      setLoading(false)
      return
    }

    if (!formData.role) {
      setError('Perfil é obrigatório')
      setLoading(false)
      return
    }

    // Validar associações baseadas no role
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
      const submitData = {
        email: formData.email,
        role: formData.role,
        is_active: formData.is_active
      }

      if (formData.password) {
        submitData.password = formData.password
      }

      if (formData.role === 'supplier') {
        submitData.supplier_id = parseInt(formData.supplier_id)
      }

      if (formData.role === 'plant') {
        submitData.plant_id = parseInt(formData.plant_id)
      }

      const result = await adminAPI.createUser(submitData)
      setSuccess(result)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao criar usuário')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyPassword = async () => {
    if (success?.temp_password) {
      try {
        await navigator.clipboard.writeText(success.temp_password)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        // Erro silencioso ao copiar senha
      }
    }
  }

  const handleFinish = () => {
    onSuccess()
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 p-6">
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Shield className="w-5 h-5" />
              Usuário Criado com Sucesso!
            </CardTitle>
            <CardDescription>
              O usuário foi cadastrado no sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {success.temp_password && (
              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertDescription className="space-y-2">
                  <p className="font-semibold text-yellow-800">Senha Temporária Gerada:</p>
                  <div className="flex items-center gap-2">
                    <Input
                      value={success.temp_password}
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
                  <p className="text-sm text-yellow-700">
                    ⚠️ Anote esta senha! Ela não será exibida novamente.
                  </p>
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <p><strong>Email:</strong> {success.user?.email}</p>
              <p><strong>Perfil:</strong> {
                success.user?.role === 'admin' ? 'Administrador' :
                success.user?.role === 'supplier' ? 'Fornecedor' :
                success.user?.role === 'plant' ? 'Planta' : success.user?.role
              }</p>
            </div>
            <Button onClick={handleFinish} className="w-full">
              Concluir
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Novo Usuário</h1>
        <Button onClick={onBack} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do Usuário</CardTitle>
          <CardDescription>
            Preencha os dados para criar um novo usuário no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="usuario@exemplo.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Perfil *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => handleInputChange('role', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o perfil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="supplier">Fornecedor</SelectItem>
                  <SelectItem value="plant">Planta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dropdown de Planta/Fornecedor - aparece sempre abaixo do perfil */}
            {formData.role && formData.role !== 'admin' && (
              <div className="space-y-2">
                <Label htmlFor={formData.role === 'supplier' ? 'supplier_id' : 'plant_id'}>
                  {formData.role === 'supplier' ? 'Fornecedor' : 'Planta'} *
                </Label>
                {formData.role === 'supplier' ? (
                  <Select
                    value={formData.supplier_id}
                    onValueChange={(value) => handleInputChange('supplier_id', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o fornecedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.length > 0 ? (
                        suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id.toString()}>
                            {supplier.description} - {supplier.cnpj}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="" disabled>
                          Nenhum fornecedor disponível
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select
                    value={formData.plant_id}
                    onValueChange={(value) => handleInputChange('plant_id', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a planta" />
                    </SelectTrigger>
                    <SelectContent>
                      {plants.length > 0 ? (
                        plants.map((plant) => (
                          <SelectItem key={plant.id} value={plant.id.toString()}>
                            {plant.name} - {plant.code}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="" disabled>
                          Nenhuma planta disponível
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Senha (Opcional)</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
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
                onClick={onBack}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Criar Usuário
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default UserForm

