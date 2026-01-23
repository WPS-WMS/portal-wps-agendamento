import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import TimeInput from '@/components/ui/time-input'
import DateInput from '@/components/ui/date-input'
import { ArrowLeft, Save, Loader2, AlertCircle } from 'lucide-react'
import { supplierAPI } from '../lib/api'
import { dateUtils } from '../lib/utils'

const AppointmentForm = ({ appointment, preSelectedDate, preSelectedTime, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    date: preSelectedDate || '',
    time: preSelectedTime || '',
    purchase_order: '',
    truck_plate: '',
    driver_name: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [rescheduleReason, setRescheduleReason] = useState('')
  const [pendingSubmit, setPendingSubmit] = useState(null)
  const [isRescheduling, setIsRescheduling] = useState(false) // Flag para indicar que é um reagendamento
  const [originalValues, setOriginalValues] = useState({
    date: '',
    time: ''
  })

  useEffect(() => {
    if (appointment) {
      const normalizedDate = appointment.date || preSelectedDate || ''
      const normalizedTime = appointment.time ? appointment.time.slice(0, 5) : (preSelectedTime || '')
      const normalizedTimeEnd = appointment.time_end ? appointment.time_end.slice(0, 5) : ''
      
      setFormData({
        date: normalizedDate,
        time: normalizedTime,
        time_end: normalizedTimeEnd,
        purchase_order: appointment.purchase_order || '',
        truck_plate: appointment.truck_plate || '',
        driver_name: appointment.driver_name || ''
      })
      
      // Armazenar valores originais
      setOriginalValues({
        date: normalizedDate,
        time: normalizedTime
      })
    } else if (preSelectedDate || preSelectedTime) {
      // Se não há appointment mas há dados pré-selecionados (ex: clique em slot)
      const normalizedTimeEnd = preSelectedTime ? (() => {
        const [hour, min] = preSelectedTime.split(':').map(Number)
        const endHour = min === 30 ? (hour + 1) % 24 : hour
        const endMin = min === 30 ? 0 : 30
        return `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`
      })() : ''
      
      setFormData(prev => ({
        ...prev,
        date: preSelectedDate || prev.date,
        time: preSelectedTime || prev.time,
        time_end: normalizedTimeEnd || prev.time_end
      }))
    }
  }, [appointment, preSelectedDate, preSelectedTime])

  const handleDateChange = (e) => {
    const newDate = e.target.value
    setFormData(prev => ({ ...prev, date: newDate }))
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Verificar se houve mudança de data ou horário
  const hasDateTimeChanged = () => {
    if (!appointment) return false
    
    return formData.date !== originalValues.date ||
           formData.time !== originalValues.time
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Se houve mudança de data/horário, exibir modal de motivo
    if (appointment && hasDateTimeChanged()) {
      setIsRescheduling(true) // Marcar que é um reagendamento
      setPendingSubmit(() => async () => {
        await performSubmit()
      })
      setShowRescheduleModal(true)
      return
    }

    // Se não houve mudança ou é criação, salvar diretamente
    setIsRescheduling(false)
    await performSubmit()
  }

  const performSubmit = async () => {
    setLoading(true)
    setError('')

    try {
      const submitData = { ...formData }
      
      // Se é reagendamento, incluir o motivo
      if (appointment && isRescheduling && rescheduleReason.trim()) {
        submitData.motivo_reagendamento = rescheduleReason.trim()
      }

      if (appointment) {
        // Editar agendamento existente
        await supplierAPI.updateAppointment(appointment.id, submitData)
      } else {
        // Criar novo agendamento
        await supplierAPI.createAppointment(submitData)
      }
      
      // Limpar estado da modal
      setShowRescheduleModal(false)
      setRescheduleReason('')
      setPendingSubmit(null)
      setIsRescheduling(false)
      
      onSubmit()
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.requires_reschedule_reason) {
        // Se o backend exigir motivo mas não foi fornecido, mostrar modal
        setPendingSubmit(() => async () => {
          await performSubmit()
        })
        setShowRescheduleModal(true)
      } else {
        setError(err.response?.data?.error || err.message || 'Erro ao salvar agendamento')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmReschedule = async () => {
    if (!rescheduleReason.trim()) {
      return
    }
    
    if (pendingSubmit) {
      await pendingSubmit()
    }
  }

  const handleCancelReschedule = () => {
    setShowRescheduleModal(false)
    setRescheduleReason('')
    setPendingSubmit(null)
    setIsRescheduling(false)
    // Restaurar valores originais
    setFormData(prev => ({
      ...prev,
      date: originalValues.date,
      time: originalValues.time
    }))
  }

  const isFormValid = () => {
    return formData.date && 
           formData.time && 
           formData.purchase_order.trim() && 
           formData.truck_plate.trim() && 
           formData.driver_name.trim()
  }

  // Data mínima é hoje
  const minDate = dateUtils.toISODate(new Date())

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={onCancel}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {appointment ? 'Editar Agendamento' : 'Novo Agendamento'}
          </h1>
          <p className="text-gray-600">
            {appointment ? 'Modifique os dados do agendamento' : 'Preencha os dados para criar um novo agendamento'}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do Agendamento</CardTitle>
          <CardDescription>
            Todos os campos são obrigatórios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Data */}
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                min={minDate}
                value={formData.date}
                onChange={handleDateChange}
                required
                disabled={loading}
              />
            </div>

            {/* Horário */}
            <div className="space-y-2">
              <Label htmlFor="time">Horário</Label>
              {loadingSlots ? (
                <div className="flex items-center gap-2 p-3 border rounded-md">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-gray-600">Carregando horários...</span>
                </div>
              ) : (
                <Select
                  value={formData.time}
                  onValueChange={(value) => handleInputChange('time', value)}
                  disabled={!formData.date || loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um horário" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSlots.length === 0 ? (
                      <SelectItem value="" disabled>
                        {formData.date ? 'Nenhum horário disponível' : 'Selecione uma data primeiro'}
                      </SelectItem>
                    ) : (
                      availableSlots.map((slot) => (
                        <SelectItem key={slot} value={slot}>
                          {slot}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Pedido de Compra */}
            <div className="space-y-2">
              <Label htmlFor="purchase_order">Pedido de Compra</Label>
              <Input
                id="purchase_order"
                type="text"
                placeholder="Ex: PO-2025-001"
                value={formData.purchase_order}
                onChange={(e) => handleInputChange('purchase_order', e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {/* Placa do Caminhão */}
            <div className="space-y-2">
              <Label htmlFor="truck_plate">Placa do Caminhão</Label>
              <Input
                id="truck_plate"
                type="text"
                placeholder="Ex: ABC-1234"
                value={formData.truck_plate}
                onChange={(e) => handleInputChange('truck_plate', e.target.value.toUpperCase())}
                required
                disabled={loading}
              />
            </div>

            {/* Nome do Motorista */}
            <div className="space-y-2">
              <Label htmlFor="driver_name">Nome do Motorista</Label>
              <Input
                id="driver_name"
                type="text"
                placeholder="Ex: João Silva"
                value={formData.driver_name}
                onChange={(e) => handleInputChange('driver_name', e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {/* Botões */}
            <div className="flex gap-3 pt-4">
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
                    {appointment ? 'Atualizar' : 'Criar'} Agendamento
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Modal de Motivo de Reagendamento */}
      <Dialog open={showRescheduleModal} onOpenChange={setShowRescheduleModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-purple-600" />
              Motivo do Reagendamento
            </DialogTitle>
            <DialogDescription>
              Você alterou a data ou horário do agendamento. Por favor, informe o motivo do reagendamento.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reschedule_reason">
                Motivo do Reagendamento <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="reschedule_reason"
                placeholder="Ex: Cliente solicitou alteração de horário devido a imprevisto no transporte..."
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-gray-500">
                Este motivo será registrado junto ao agendamento e o status será alterado para "Reagendado".
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelReschedule}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmReschedule}
              disabled={loading || !rescheduleReason.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                'Confirmar Reagendamento'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AppointmentForm
