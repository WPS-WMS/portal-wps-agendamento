import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Save, Loader2, Building2, Copy, Check } from 'lucide-react'
import { adminAPI } from '../lib/api'
import { validation } from '../lib/utils'
import { formatPhone, formatCEP } from '../lib/formatters'

const PlantForm = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    email: '',
    phone: '',
    street: '',
    neighborhood: '',
    number: '',
    cep: '',
    reference: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const [copied, setCopied] = useState(false)

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError('')
  }

  const handleCEPChange = (e) => {
    const value = formatCEP(e.target.value)
    handleInputChange('cep', value)
  }

  const handlePhoneChange = (e) => {
    const value = formatPhone(e.target.value)
    handleInputChange('phone', value)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(null)

    // Validações
    if (!formData.name.trim()) {
      setError('Nome é obrigatório')
      setLoading(false)
      return
    }

    if (!formData.code.trim()) {
      setError('Código é obrigatório')
      setLoading(false)
      return
    }

    if (!formData.email.trim()) {
      setError('E-mail é obrigatório')
      setLoading(false)
      return
    }

    if (!validation.isValidEmail(formData.email)) {
      setError('E-mail inválido')
      setLoading(false)
      return
    }

    try {
      const result = await adminAPI.createPlant(formData)
      setSuccess(result)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao salvar planta')
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
    onSubmit()
  }

  const isFormValid = () => {
    return formData.name.trim() && 
           formData.code.trim() && 
           formData.email.trim() &&
           validation.isValidEmail(formData.email)
  }

  if (success) {
    return (
      <Dialog open={true} onOpenChange={onCancel}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-800">
              <Building2 className="w-5 h-5" />
              Planta Criada com Sucesso!
            </DialogTitle>
            <DialogDescription>
              A planta foi cadastrada e o usuário foi criado
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-green-800 flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  {success.plant.name}
                </CardTitle>
                <CardDescription className="text-green-700">
                  Código: {success.plant.code}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-green-800">Email de Acesso:</Label>
                  <p className="font-mono text-sm bg-white p-2 rounded border mt-1">
                    {success.user.email}
                  </p>
                </div>
                
                <div>
                  <Label className="text-green-800">Senha Temporária:</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="font-mono text-sm bg-white p-2 rounded border flex-1">
                      {success.temp_password}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCopyPassword}
                      className="flex items-center gap-1"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          Copiar
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <Alert>
                  <AlertDescription>
                    <strong>Importante:</strong> Anote ou copie a senha temporária, pois ela não será exibida novamente. 
                    O usuário deve usar essas credenciais para fazer o primeiro login no sistema.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button onClick={handleFinish} className="w-full">
              Finalizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Nova Planta
          </DialogTitle>
          <DialogDescription>
            Preencha os dados para criar uma nova planta
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Nome (Obrigatório) */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              type="text"
              placeholder="Ex: Planta São Paulo"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {/* Código (Obrigatório) */}
          <div className="space-y-2">
            <Label htmlFor="code">Código *</Label>
            <Input
              id="code"
              type="text"
              placeholder="Ex: SP-001"
              value={formData.code}
              onChange={(e) => handleInputChange('code', e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {/* E-mail (Obrigatório) */}
          <div className="space-y-2">
            <Label htmlFor="email">E-mail *</Label>
            <Input
              id="email"
              type="email"
              placeholder="contato@planta.com"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {/* Telefone (Opcional) */}
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone (opcional)</Label>
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
            <h3 className="text-sm font-semibold mb-6">Endereço (opcional)</h3>

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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!isFormValid() || loading}
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
                  Salvar
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default PlantForm

