import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import TimeInput from '@/components/ui/time-input'
import DateInput from '@/components/ui/date-input'
import { ArrowLeft, Save, Loader2, Plus, AlertCircle } from 'lucide-react'
import { adminAPI, plantAPI, supplierAPI } from '../lib/api'
import { dateUtils, statusUtils } from '../lib/utils'
import usePermissions from '../hooks/usePermissions'
import { toast } from 'sonner'

const AppointmentEditForm = ({ appointment, suppliers = [], plants = [], onSubmit, onCancel, user = null }) => {
  const { hasPermission } = usePermissions(user)
  
  // Verificar se o usuário tem permissão para reagendar
  const canReschedule = hasPermission('reschedule', 'editor')
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    time_end: '',
    purchase_order: '',
    truck_plate: '',
    driver_name: '',
    supplier_id: '',
    plant_id: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [rescheduleReason, setRescheduleReason] = useState('')
  const [pendingSubmit, setPendingSubmit] = useState(null)
  const [isRescheduling, setIsRescheduling] = useState(false) // Flag para indicar que é um reagendamento
  const [plantScheduleConfig, setPlantScheduleConfig] = useState(null) // Configurações de horário da planta selecionada
  const [loadingScheduleConfig, setLoadingScheduleConfig] = useState(false)

  // Determinar se é criação ou edição
  const isCreating = !appointment?.id
  // Não bloquear campos ao criar - permitir edição mesmo quando vem pré-preenchido
  const isDateTimeLocked = false

  // Função auxiliar para normalizar formato de horário (HH:MM:SS -> HH:MM)
  const normalizeTime = (timeStr) => {
    if (!timeStr) return ''
    // Se já está no formato HH:MM, retornar como está
    if (typeof timeStr === 'string' && timeStr.length === 5) return timeStr
    // Se tem segundos (HH:MM:SS), remover
    if (typeof timeStr === 'string' && timeStr.length >= 8) return timeStr.slice(0, 5)
    // Se é objeto time do backend, converter
    if (typeof timeStr === 'string') return timeStr.slice(0, 5)
    return timeStr
  }

  // Armazenar valores originais para detectar mudanças
  const [originalValues, setOriginalValues] = useState({
    date: '',
    time: '',
    time_end: ''
  })

  useEffect(() => {
    if (appointment) {
      const normalizedDate = appointment.date || ''
      const normalizedTime = normalizeTime(appointment.time)
      const normalizedTimeEnd = normalizeTime(appointment.time_end)
      
      setFormData({
        date: normalizedDate,
        time: normalizedTime,
        time_end: normalizedTimeEnd,
        purchase_order: appointment.purchase_order || '',
        truck_plate: appointment.truck_plate || '',
        driver_name: appointment.driver_name || '',
        supplier_id: appointment.supplier_id || '',
        plant_id: appointment.plant_id || ''
      })
      
      // Armazenar valores originais
      setOriginalValues({
        date: normalizedDate,
        time: normalizedTime,
        time_end: normalizedTimeEnd
      })
    } else if (isCreating) {
      // Preencher automaticamente baseado no perfil do usuário
      if (user?.role === 'supplier' && user?.supplier_id) {
        // Fornecedor: preencher supplier_id automaticamente
        setFormData(prev => ({
          ...prev,
          supplier_id: user.supplier_id.toString()
        }))
      } else if (user?.role === 'plant' && user?.plant_id) {
        // Planta: preencher plant_id automaticamente
        setFormData(prev => ({
          ...prev,
          plant_id: user.plant_id.toString()
        }))
      }
    }
  }, [appointment, isCreating, user])

  // Carregar configurações da planta quando planta ou data mudarem
  useEffect(() => {
    const loadPlantScheduleConfig = async () => {
      // Apenas para fornecedores criando novo agendamento
      if (user?.role === 'supplier' && isCreating && formData.plant_id) {
        setLoadingScheduleConfig(true)
        try {
          const plantId = parseInt(formData.plant_id, 10)
          if (isNaN(plantId)) {
            setLoadingScheduleConfig(false)
            return
          }
          const date = formData.date || null
          
          const config = await supplierAPI.getPlantScheduleConfig(plantId, date)
          setPlantScheduleConfig(config)
          
          // Se há data e horários configurados, validar horários existentes
          if (date && config.operating_hours && config.operating_hours.length > 0) {
            const operatingHours = config.operating_hours[0]
            const startTime = operatingHours.operating_start
            const endTime = operatingHours.operating_end
            
            if (startTime && endTime) {
              // Verificar se o horário inicial está fora do horário de funcionamento
              setFormData(prev => {
                let updated = { ...prev }
                if (prev.time && (prev.time < startTime || prev.time >= endTime)) {
                  updated.time = ''
                  updated.time_end = ''
                  setError(`Horário de funcionamento da planta: ${startTime} às ${endTime}`)
                }
                // Verificar se o horário final está fora do horário de funcionamento
                if (prev.time_end && (prev.time_end <= startTime || prev.time_end > endTime)) {
                  updated.time_end = ''
                  if (!error) {
                    setError(`Horário de funcionamento da planta: ${startTime} às ${endTime}`)
                  }
                }
                return updated
              })
            }
          }
        } catch (err) {
          // Erro silencioso ao carregar configurações
          // Não mostrar erro ao usuário, apenas logar
        } finally {
          setLoadingScheduleConfig(false)
        }
      } else if (!formData.plant_id) {
        // Limpar configurações se planta não estiver selecionada
        setPlantScheduleConfig(null)
      }
    }
    
    loadPlantScheduleConfig()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.plant_id, formData.date, user?.role, isCreating])

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Limpar erro do campo quando o usuário começa a digitar
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: false }))
    }
    setError('')
    
    // Se a planta foi selecionada, carregar configurações imediatamente (mesmo sem data)
    if (field === 'plant_id' && value && user?.role === 'supplier' && isCreating) {
      const loadConfig = async () => {
        setLoadingScheduleConfig(true)
        try {
          const config = await supplierAPI.getPlantScheduleConfig(parseInt(value, 10))
          setPlantScheduleConfig(config)
        } catch (err) {
          // Erro silencioso ao carregar configurações
        } finally {
          setLoadingScheduleConfig(false)
        }
      }
      loadConfig()
    }
  }

  const validateForm = () => {
    const errors = {}
    let isValid = true

    if (!formData.date) {
      errors.date = true
      isValid = false
    }
    if (!formData.time) {
      errors.time = true
      isValid = false
    }
    if (!formData.time_end || !formData.time_end.trim()) {
      errors.time_end = true
      isValid = false
    } else if (formData.time_end <= formData.time) {
      errors.time_end = true
      setError('O horário final deve ser maior que o horário inicial')
      isValid = false
    }
    if (!formData.purchase_order.trim()) {
      errors.purchase_order = true
      isValid = false
    }
    if (!formData.truck_plate.trim()) {
      errors.truck_plate = true
      isValid = false
    }
    if (!formData.driver_name.trim()) {
      errors.driver_name = true
      isValid = false
    }
    
    // Validação condicional baseada no perfil
    if (isCreating) {
      // Fornecedor precisa de plant_id
      if (user?.role === 'supplier' && !formData.plant_id) {
        errors.plant_id = true
        isValid = false
      }
      // Planta precisa de supplier_id
      if (user?.role === 'plant' && !formData.supplier_id) {
        errors.supplier_id = true
        isValid = false
      }
      // Admin precisa de ambos
      if (user?.role === 'admin') {
        if (!formData.supplier_id) {
          errors.supplier_id = true
          isValid = false
        }
        if (!formData.plant_id) {
          errors.plant_id = true
          isValid = false
        }
      }
    }

    setFieldErrors(errors)
    return isValid
  }

  // Verificar se houve mudança de data ou horário
  const hasDateTimeChanged = () => {
    if (isCreating) return false
    
    return formData.date !== originalValues.date ||
           formData.time !== originalValues.time ||
           formData.time_end !== originalValues.time_end
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      setError('Por favor, preencha todos os campos obrigatórios.')
      return
    }

    // Se houve mudança de data/horário e não é criação, verificar permissão de reagendamento
    if (!isCreating && hasDateTimeChanged()) {
      // Verificar se o usuário tem permissão para reagendar
      if (!canReschedule) {
        // Restaurar valores originais
        setFormData(prev => ({
          ...prev,
          date: originalValues.date,
          time: originalValues.time,
          time_end: originalValues.time_end
        }))
        return
      }
      
      setIsRescheduling(true) // Marcar que é um reagendamento
      setShowRescheduleModal(true)
      return
    }

    // Se não houve mudança ou é criação, salvar diretamente
    setIsRescheduling(false)
    await performSubmit()
  }

  // Função auxiliar para submit com motivo (usada quando vem da modal)
  const performSubmitWithReason = async (formDataToUse, reason) => {
    setLoading(true)
    setError('')

    try {
      const submitData = { ...formDataToUse }
      
      // Garantir que supplier_id seja inteiro
      if (submitData.supplier_id) {
        const parsed = parseInt(submitData.supplier_id, 10)
        if (!isNaN(parsed)) {
          submitData.supplier_id = parsed
        }
      }
      
      // Garantir que plant_id seja inteiro
      if (submitData.plant_id) {
        const parsed = parseInt(submitData.plant_id, 10)
        if (!isNaN(parsed)) {
          submitData.plant_id = parsed
        }
      }
      
      // Sempre incluir o motivo se foi fornecido
      if (reason && reason.trim()) {
        submitData.motivo_reagendamento = reason.trim()
      }

      // Determinar qual API usar baseado no role do usuário
      const api = user?.role === 'plant' ? plantAPI : (user?.role === 'supplier' ? supplierAPI : adminAPI)
      
      let response
      if (isCreating) {
        response = await api.createAppointment(submitData)
        // Mostrar mensagem de sucesso
        const dateStr = dateUtils.formatDate(submitData.date)
        const timeStr = dateUtils.formatTime(submitData.time)
        toast.success('Agendamento criado com sucesso!', {
          description: `Agendamento para ${dateStr} às ${timeStr} foi criado.`,
          duration: 5000
        })
      } else {
        response = await api.updateAppointment(appointment.id, submitData)
        // Mostrar mensagem de sucesso
        const dateStr = dateUtils.formatDate(submitData.date)
        const timeStr = dateUtils.formatTime(submitData.time)
        toast.success('Agendamento atualizado com sucesso!', {
          description: `Agendamento para ${dateStr} às ${timeStr} foi atualizado.`,
          duration: 5000
        })
      }
      
      // Limpar estado da modal
      setShowRescheduleModal(false)
      setRescheduleReason('')
      setPendingSubmit(null)
      setIsRescheduling(false)
      
      // Aguardar um pouco antes de fechar o formulário para garantir que o toast apareça
      setTimeout(() => {
        onSubmit()
      }, 100)
    } catch (err) {
      // Fechar modal de reagendamento em caso de erro
      setShowRescheduleModal(false)
      setPendingSubmit(null)
      
      // Tratar erro de conflito de horário ou capacidade máxima
      if (err.response?.status === 409) {
        const errorMessage = err.response?.data?.error || 'Horário já ocupado. Por favor, escolha outro horário.'
        setError(errorMessage)
        setFieldErrors({ date: true, time: true })
      } else if (err.response?.status === 400 && err.response?.data?.requires_reschedule_reason) {
        // Se o backend exigir motivo mas não foi fornecido, mostrar modal novamente
        setPendingSubmit(() => async () => {
          await performSubmitWithReason(formDataToUse, reason)
        })
        setShowRescheduleModal(true)
      } else {
        // Exibir erro de validação (ex: horário de funcionamento)
        const errorMessage = err.response?.data?.error || err.message || 'Erro ao salvar agendamento'
        setError(errorMessage)
        // Se for erro de validação de horário, destacar campos de data/hora
        if (err.response?.status === 400 && errorMessage.includes('horário')) {
          setFieldErrors({ date: true, time: true })
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const performSubmit = async () => {
    setLoading(true)
    setError('')

    try {
      const submitData = { ...formData }
      
      // Garantir que supplier_id seja inteiro
      if (submitData.supplier_id) {
        const parsed = parseInt(submitData.supplier_id, 10)
        if (!isNaN(parsed)) {
          submitData.supplier_id = parsed
        }
      }
      
      // Garantir que plant_id seja inteiro
      if (submitData.plant_id) {
        const parsed = parseInt(submitData.plant_id, 10)
        if (!isNaN(parsed)) {
          submitData.plant_id = parsed
        }
      }
      
      // Se é reagendamento, incluir o motivo
      if (!isCreating && isRescheduling && rescheduleReason.trim()) {
        submitData.motivo_reagendamento = rescheduleReason.trim()
      }

      // Determinar qual API usar baseado no role do usuário
      const api = user?.role === 'plant' ? plantAPI : (user?.role === 'supplier' ? supplierAPI : adminAPI)
      
      let response
      if (isCreating) {
        response = await api.createAppointment(submitData)
        // Mostrar mensagem de sucesso
        const dateStr = dateUtils.formatDate(submitData.date)
        const timeStr = dateUtils.formatTime(submitData.time)
        toast.success('Agendamento criado com sucesso!', {
          description: `Agendamento para ${dateStr} às ${timeStr} foi criado.`,
          duration: 5000
        })
      } else {
        response = await api.updateAppointment(appointment.id, submitData)
        // Mostrar mensagem de sucesso
        const dateStr = dateUtils.formatDate(submitData.date)
        const timeStr = dateUtils.formatTime(submitData.time)
        toast.success('Agendamento atualizado com sucesso!', {
          description: `Agendamento para ${dateStr} às ${timeStr} foi atualizado.`,
          duration: 5000
        })
      }
      
      // Limpar estado da modal
      setShowRescheduleModal(false)
      setRescheduleReason('')
      setPendingSubmit(null)
      setIsRescheduling(false)
      
      // Aguardar um pouco antes de fechar o formulário para garantir que o toast apareça
      setTimeout(() => {
        onSubmit()
      }, 100)
    } catch (err) {
      // Tratar erro de conflito de horário ou capacidade máxima
      if (err.response?.status === 409) {
        const errorMessage = err.response?.data?.error || 'Horário já ocupado. Por favor, escolha outro horário.'
        setError(errorMessage)
        setFieldErrors({ date: true, time: true })
      } else if (err.response?.status === 400 && err.response?.data?.requires_reschedule_reason) {
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
    
    
    // Chamar diretamente com o motivo capturado
    await performSubmitWithReason(formData, rescheduleReason.trim())
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
      time: originalValues.time,
      time_end: originalValues.time_end
    }))
  }

  const isFormValid = () => {
    const timeEndValid = formData.time_end && formData.time_end.trim() && formData.time_end > formData.time
    const baseValid = formData.date && 
           formData.time && 
           timeEndValid &&
           formData.purchase_order.trim() && 
           formData.truck_plate.trim() && 
           formData.driver_name.trim()
    
    if (!isCreating) return baseValid
    
    // Validação condicional baseada no perfil
    if (user?.role === 'supplier') {
      return baseValid && formData.plant_id
    } else if (user?.role === 'plant') {
      return baseValid && formData.supplier_id
    } else if (user?.role === 'admin') {
      return baseValid && formData.supplier_id && formData.plant_id
    }
    
    return baseValid
  }

  // Permitir renderização mesmo quando appointment é um objeto vazio (criação de novo agendamento)
  // O componente já trata isso com isCreating = !appointment?.id
  if (appointment === null || appointment === undefined) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={onCancel}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isCreating ? 'Novo Agendamento' : 'Editar Agendamento'}
          </h1>
          <p className="text-gray-600">
            {isCreating ? 'Preencha os dados para criar um agendamento' : 'Modifique os dados do agendamento'}
          </p>
        </div>
      </div>

      {/* Informações do Status (apenas para edição) */}
      {!isCreating && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-blue-800">Status Atual</CardTitle>
              <Badge className={statusUtils.getStatusColor(appointment.status)}>
                {statusUtils.getStatusLabel(appointment.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {appointment.check_in_time && (
              <p className="text-sm text-blue-700">
                <strong>Check-in:</strong> {dateUtils.formatDateTime(appointment.check_in_time)}
              </p>
            )}
            {appointment.check_out_time && (
              <p className="text-sm text-blue-700">
                <strong>Check-out:</strong> {dateUtils.formatDateTime(appointment.check_out_time)}
              </p>
            )}
            {appointment.status !== 'scheduled' && (
              <Alert>
                <AlertDescription>
                  <strong>Atenção:</strong> Este agendamento já passou pelo processo de check-in/check-out. 
                  Alterações devem ser feitas com cuidado.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Dados do Agendamento</CardTitle>
          <CardDescription>
            Todos os campos são obrigatórios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isCreating && !canReschedule && (
              <Alert className="bg-orange-50 border-orange-200">
                <AlertCircle className="w-4 h-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  Você não tem permissão para reagendar agendamentos. Apenas usuários com perfil Editor podem alterar data e horários.
                </AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Fornecedor: mostrar para admin e planta */}
            {isCreating && suppliers && (user?.role === 'admin' || user?.role === 'plant') && (
              <div className="space-y-2">
                <Label htmlFor="supplier_id">
                  Fornecedor <span className="text-red-500">*</span>
                </Label>
                <select
                  id="supplier_id"
                  value={formData.supplier_id}
                  onChange={(e) => handleInputChange('supplier_id', e.target.value)}
                  required
                  disabled={loading}
                  className={`flex h-10 w-full rounded-md border ${
                    fieldErrors.supplier_id ? 'border-red-500' : 'border-input'
                  } bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <option value="">Selecione um fornecedor</option>
                  {suppliers
                    .filter(s => s.is_active)
                    .map(supplier => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.description} - {supplier.cnpj}
                      </option>
                    ))}
                </select>
                {fieldErrors.supplier_id && (
                  <p className="text-xs text-red-500">Campo obrigatório</p>
                )}
              </div>
            )}

            {/* Planta: mostrar para admin e fornecedor */}
            {isCreating && plants && plants.length > 0 && (user?.role === 'admin' || user?.role === 'supplier') && (
              <div className="space-y-2">
                <Label htmlFor="plant_id">
                  Planta de Entrega <span className="text-red-500">*</span>
                </Label>
                <select
                  id="plant_id"
                  value={formData.plant_id}
                  onChange={(e) => handleInputChange('plant_id', e.target.value)}
                  required
                  disabled={loading || loadingScheduleConfig}
                  className={`flex h-10 w-full rounded-md border ${
                    fieldErrors.plant_id ? 'border-red-500' : 'border-input'
                  } bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <option value="">Selecione uma planta</option>
                  {plants
                    .filter(p => p.is_active)
                    .map(plant => (
                      <option key={plant.id} value={plant.id}>
                        {plant.name} - {plant.cnpj}
                      </option>
                    ))}
                </select>
                {fieldErrors.plant_id && (
                  <p className="text-xs text-red-500">Campo obrigatório</p>
                )}
                {/* Mostrar informações de horário de funcionamento quando planta for selecionada */}
                {plantScheduleConfig && plantScheduleConfig.operating_hours && plantScheduleConfig.operating_hours.length > 0 && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm font-medium text-blue-900">Horário de Funcionamento:</p>
                    {plantScheduleConfig.operating_hours.map((oh, idx) => (
                      <p key={idx} className="text-sm text-blue-700">
                        {oh.operating_start && oh.operating_end 
                          ? `${oh.operating_start} às ${oh.operating_end}`
                          : 'Não configurado'}
                      </p>
                    ))}
                  </div>
                )}
                {loadingScheduleConfig && (
                  <p className="text-xs text-gray-500">Carregando configurações da planta...</p>
                )}
              </div>
            )}

            {/* Data */}
            <div className="space-y-2">
              <Label htmlFor="date">
                Data <span className="text-red-500">*</span>
              </Label>
              <DateInput
                id="date"
                value={formData.date}
                onChange={(value) => {
                  // Se não é criação e não tem permissão para reagendar, não permitir alteração
                  if (!isCreating && !canReschedule && value !== originalValues.date) {
                    return
                  }
                  handleInputChange('date', value)
                }}
                disabled={loading || isDateTimeLocked || (!isCreating && !canReschedule)}
                className={fieldErrors.date ? 'border-red-500' : ''}
                required
              />
              {fieldErrors.date && (
                <p className="text-xs text-red-500">Campo obrigatório</p>
              )}
            </div>

            {/* Horário Inicial */}
            <div className="space-y-2">
              <Label htmlFor="time">
                Horário Inicial <span className="text-red-500">*</span>
                <span className="text-gray-500 text-xs font-normal ml-2">(intervalos de 30 minutos)</span>
              </Label>
              <TimeInput
                id="time"
                value={formData.time}
                onChange={(value) => {
                  // Se não é criação e não tem permissão para reagendar, não permitir alteração
                  if (!isCreating && !canReschedule && value !== originalValues.time) {
                    return
                  }
                  handleInputChange('time', value)
                  // Se o horário final for menor ou igual ao inicial, limpar
                  if (formData.time_end && value && value >= formData.time_end) {
                    handleInputChange('time_end', '')
                  }
                }}
                disabled={loading || isDateTimeLocked || (!isCreating && !canReschedule)}
                placeholder="--:--"
                intervalMinutes={30}
                className={fieldErrors.time ? 'border-red-500' : ''}
              />
              {fieldErrors.time && (
                <p className="text-xs text-red-500">Campo obrigatório</p>
              )}
              <p className="text-xs text-gray-500">
                Digite o horário no formato HH:mm (ex: 09:00, 14:30). Apenas intervalos de 30 minutos são permitidos.
              </p>
            </div>

            {/* Horário Final */}
            <div className="space-y-2">
              <Label htmlFor="time_end">
                Horário Final <span className="text-red-500">*</span>
                <span className="text-gray-500 text-xs font-normal ml-2">(intervalos de 30 minutos)</span>
              </Label>
              <TimeInput
                id="time_end"
                value={formData.time_end}
                onChange={(value) => {
                  // Se não é criação e não tem permissão para reagendar, não permitir alteração
                  if (!isCreating && !canReschedule && value !== originalValues.time_end) {
                    return
                  }
                  
                  if (value && formData.time && value <= formData.time) {
                    setError('O horário final deve ser maior que o horário inicial')
                    setFieldErrors(prev => ({ ...prev, time_end: true }))
                  } else {
                    setError('')
                    setFieldErrors(prev => ({ ...prev, time_end: false }))
                    handleInputChange('time_end', value)
                  }
                }}
                disabled={loading || isDateTimeLocked || !formData.time || (!isCreating && !canReschedule)}
                placeholder="--:--"
                intervalMinutes={30}
                className={fieldErrors.time_end ? 'border-red-500' : ''}
              />
              {fieldErrors.time_end && (
                <p className="text-xs text-red-500">
                  {!formData.time_end || !formData.time_end.trim() 
                    ? 'Campo obrigatório' 
                    : 'O horário final deve ser maior que o horário inicial'}
                </p>
              )}
              <p className="text-xs text-gray-500">
                O horário final define o término do intervalo de agendamento. Digite no formato HH:mm (ex: 10:00, 15:30).
              </p>
            </div>

            {/* Pedido de Compra */}
            <div className="space-y-2">
              <Label htmlFor="purchase_order">
                Pedido de Compra <span className="text-red-500">*</span>
              </Label>
              <Input
                id="purchase_order"
                type="text"
                placeholder="Ex: PO-2025-001"
                value={formData.purchase_order}
                onChange={(e) => handleInputChange('purchase_order', e.target.value)}
                required
                disabled={loading}
                className={fieldErrors.purchase_order ? 'border-red-500' : ''}
              />
              {fieldErrors.purchase_order && (
                <p className="text-xs text-red-500">Campo obrigatório</p>
              )}
            </div>

            {/* Placa do Caminhão */}
            <div className="space-y-2">
              <Label htmlFor="truck_plate">
                Placa do Caminhão <span className="text-red-500">*</span>
              </Label>
              <Input
                id="truck_plate"
                type="text"
                placeholder="Ex: ABC-1234"
                value={formData.truck_plate}
                onChange={(e) => handleInputChange('truck_plate', e.target.value.toUpperCase())}
                required
                disabled={loading}
                className={fieldErrors.truck_plate ? 'border-red-500' : ''}
                maxLength={8}
              />
              {fieldErrors.truck_plate && (
                <p className="text-xs text-red-500">Campo obrigatório</p>
              )}
            </div>

            {/* Nome do Motorista */}
            <div className="space-y-2">
              <Label htmlFor="driver_name">
                Nome do Motorista <span className="text-red-500">*</span>
              </Label>
              <Input
                id="driver_name"
                type="text"
                placeholder="Ex: João Silva"
                value={formData.driver_name}
                onChange={(e) => handleInputChange('driver_name', e.target.value)}
                required
                disabled={loading}
                className={fieldErrors.driver_name ? 'border-red-500' : ''}
              />
              {fieldErrors.driver_name && (
                <p className="text-xs text-red-500">Campo obrigatório</p>
              )}
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
                ) : isCreating ? (
                  <>
                    <Plus className="w-4 h-4" />
                    Criar Agendamento
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Salvar Alterações
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
    </div>
  )
}

export default AppointmentEditForm
