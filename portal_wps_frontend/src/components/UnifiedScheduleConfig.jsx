import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Calendar, 
  Clock, 
  ArrowLeft, 
  Save, 
  Loader2,
  CheckCircle,
  XCircle,
  Settings,
  Trash2,
  Plus,
  Repeat,
  Lock,
  Unlock,
  Building2,
  AlertCircle,
  Edit
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import DateInput from '@/components/ui/date-input'
import TimeInput from '@/components/ui/time-input'
import { adminAPI } from '../lib/api'
import { dateUtils } from '../lib/utils'
import usePermissions from '../hooks/usePermissions'

const UnifiedScheduleConfig = ({ onBack, plantId = null, plantName = null, user }) => {
  const { hasViewPermission, getPermissionType, loading: permissionsLoading } = usePermissions(user)
  
  // Verificar permissões específicas para cada seção
  // Se user não estiver disponível ou ainda carregando, assumir permissões padrão (editor)
  const defaultHoursPermission = (user && !permissionsLoading) ? getPermissionType('configure_default_hours') : 'editor'
  const weeklyBlockPermission = (user && !permissionsLoading) ? getPermissionType('configure_weekly_block') : 'editor'
  const dateBlockPermission = (user && !permissionsLoading) ? getPermissionType('configure_date_block') : 'editor'
  
  // Determinar se cada seção está em modo somente leitura ou oculta
  const isDefaultHoursViewOnly = defaultHoursPermission === 'viewer'
  const isWeeklyBlockViewOnly = weeklyBlockPermission === 'viewer'
  const isDateBlockViewOnly = dateBlockPermission === 'viewer'
  
  const canViewDefaultHours = (user && !permissionsLoading) ? hasViewPermission('configure_default_hours') : true
  const canViewWeeklyBlock = (user && !permissionsLoading) ? hasViewPermission('configure_weekly_block') : true
  const canViewDateBlock = (user && !permissionsLoading) ? hasViewPermission('configure_date_block') : true
  // Estados para Bloqueio Semanal (Recorrente)
  const [weeklyConfigs, setWeeklyConfigs] = useState([])
  const [loadingWeekly, setLoadingWeekly] = useState(true)
  const [savingWeekly, setSavingWeekly] = useState(false)
  const [newWeeklyConfig, setNewWeeklyConfig] = useState({
    day_of_week: null,
    time_start: '',
    time_end: '',
    reason: ''
  })

  // Estados para Bloqueio por Data Específica
  const [selectedDate, setSelectedDate] = useState(dateUtils.toISODate(new Date()))
  const [availableTimes, setAvailableTimes] = useState([])
  const [loadingSpecific, setLoadingSpecific] = useState(false)
  const [savingBatch, setSavingBatch] = useState(false)
  const [localChanges, setLocalChanges] = useState({})
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [editingConfig, setEditingConfig] = useState(null) // Para editar bloqueios específicos

  // Estados gerais
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Estados para Horário Padrão
  const [defaultSchedule, setDefaultSchedule] = useState({
    weekdays: {
      enabled: true, // Habilitado por padrão
      operating_start: null, // Horário de funcionamento inicial (opcional)
      operating_end: null,  // Horário de funcionamento final (opcional)
      start: null,           // Horário inicial para bloqueio (legado)
      end: null             // Horário final para bloqueio (legado)
    },
    weekend: {
      enabled: false,
      days: [], // ["SATURDAY", "SUNDAY"]
      operating_start: null, // Horário de funcionamento inicial
      operating_end: null,    // Horário de funcionamento final
      start: null,            // Horário inicial para bloqueio (legado)
      end: null              // Horário final para bloqueio (legado)
    },
    holiday: {
      enabled: false,
      operating_start: null, // Horário de funcionamento inicial
      operating_end: null,   // Horário de funcionamento final
      start: null,           // Horário inicial para bloqueio (legado)
      end: null             // Horário final para bloqueio (legado)
    }
  })

  // Erros de validação para Horário Padrão
  const [scheduleErrors, setScheduleErrors] = useState({
    weekdays: null,
    weekend: null,
    holiday: null
  })

  const daysOfWeek = [
    { value: null, label: 'Todos os dias' },
    { value: 1, label: 'Segunda-feira' },
    { value: 2, label: 'Terça-feira' },
    { value: 3, label: 'Quarta-feira' },
    { value: 4, label: 'Quinta-feira' },
    { value: 5, label: 'Sexta-feira' },
    { value: 6, label: 'Sábado' },
    { value: 0, label: 'Domingo' }
  ]

  // Gerar horários de 00:00 até 23:00 (intervalos de 1 hora)
  const generateTimeSlots = () => {
    const slots = []
    for (let hour = 0; hour < 24; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`)
    }
    return slots
  }

  const timeSlots = generateTimeSlots()

  // Gerar horários entre time_start e time_end (intervalos de 1 hora)
  const generateTimeRange = (start, end) => {
    if (!start || !end) return []
    const slots = []
    const [startHour] = start.split(':').map(Number)
    const [endHour] = end.split(':').map(Number)
    
    let currentHour = startHour
    
    while (currentHour < endHour) {
      slots.push(`${currentHour.toString().padStart(2, '0')}:00`)
      currentHour++
    }
    
    // Incluir o horário final se for exatamente :00
    if (end.split(':')[1] === '00' && currentHour === endHour) {
      slots.push(`${currentHour.toString().padStart(2, '0')}:00`)
    }
    
    return slots
  }

  // Funções utilitárias para Horário Padrão (precisam estar antes de loadAvailableTimes)
  const isTimeInOperatingRange = (timeStr, operatingStart, operatingEnd) => {
    if (!operatingStart || !operatingEnd) return false
    
    const [timeHour, timeMin] = timeStr.split(':').map(Number)
    const timeTotal = timeHour * 60 + timeMin
    
    const [startHour, startMin] = operatingStart.split(':').map(Number)
    const startTotal = startHour * 60 + startMin
    
    const [endHour, endMin] = operatingEnd.split(':').map(Number)
    const endTotal = endHour * 60 + endMin
    
    return startTotal <= timeTotal < endTotal
  }

  const getDayType = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00')
    const dayOfWeek = date.getDay() // 0=Domingo, 6=Sábado
    
    // Por enquanto, consideramos apenas weekday e weekend
    // Feriados precisariam de uma lista de feriados
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return 'weekend'
    }
    return 'weekday'
  }

  const isTimeAvailableByOperatingHours = (timeStr, dateStr) => {
    const dayType = getDayType(dateStr)
    
    if (dayType === 'weekday') {
      if (!defaultSchedule.weekdays.enabled) return true // Se toggle desabilitado, permite todos
      // Se toggle habilitado mas sem horários preenchidos = 24 horas de funcionamento
      if (!defaultSchedule.weekdays.operating_start || !defaultSchedule.weekdays.operating_end) {
        return true
      }
      return isTimeInOperatingRange(
        timeStr,
        defaultSchedule.weekdays.operating_start,
        defaultSchedule.weekdays.operating_end
      )
    } else if (dayType === 'weekend') {
      if (!defaultSchedule.weekend.enabled) return true // Se não configurado, permite todos
      
      const date = new Date(dateStr + 'T00:00:00')
      const dayOfWeek = date.getDay()
      
      // Verificar se o dia está selecionado
      if (dayOfWeek === 6 && !defaultSchedule.weekend.days.includes('SATURDAY')) return false
      if (dayOfWeek === 0 && !defaultSchedule.weekend.days.includes('SUNDAY')) return false
      
      return isTimeInOperatingRange(
        timeStr,
        defaultSchedule.weekend.operating_start,
        defaultSchedule.weekend.operating_end
      )
    }
    
    // Para feriados, por enquanto retorna true (precisa de lista de feriados)
    return true
  }

  // Carregar configurações semanais
  const loadWeeklyConfigs = async () => {
    if (!plantId) {
      setError('Planta não selecionada')
      return
    }
    try {
      setLoadingWeekly(true)
      const data = await adminAPI.getDefaultSchedule(plantId)
      // Agrupar por dia da semana e motivo para mostrar intervalos
      const grouped = {}
      data.forEach(config => {
        if (!config.is_available) {
          const key = `${config.day_of_week || 'all'}_${config.reason || 'sem_motivo'}`
          if (!grouped[key]) {
            grouped[key] = {
              day_of_week: config.day_of_week,
              day_name: config.day_name,
              reason: config.reason,
              times: [],
              ids: []
            }
          }
          grouped[key].times.push(config.time)
          grouped[key].ids.push(config.id)
        }
      })
      setWeeklyConfigs(Object.values(grouped))
      setError('')
    } catch (err) {
      setError('Erro ao carregar configurações semanais: ' + err.message)
    } finally {
      setLoadingWeekly(false)
    }
  }

  // Carregar horários disponíveis para data específica
  const loadAvailableTimes = async (date) => {
    if (!plantId) {
      setError('Planta não selecionada')
      return
    }
    setLoadingSpecific(true)
    setError('')

    try {
      const times = await adminAPI.getAvailableTimes(date, plantId)
      // Garantir que todos os horários de 00:00 até 23:00 sejam exibidos (intervalos de 1 hora)
      // Se o backend não retornar todos, criar a lista completa
      const allTimeSlots = []
      for (let hour = 0; hour < 24; hour++) {
        allTimeSlots.push(`${hour.toString().padStart(2, '0')}:00`)
      }
      
      // Criar um mapa dos horários recebidos do backend
      const timesMap = new Map(times.map(t => [t.time, t]))
      
      // O backend já filtra baseado nos horários de funcionamento salvos
      // Então apenas usar os dados do backend diretamente
      const completeTimes = allTimeSlots.map(timeStr => {
        const backendTime = timesMap.get(timeStr)
        if (backendTime) {
          return backendTime
        }
        // Se não existe no backend, criar um horário padrão disponível
        return {
          time: timeStr,
          is_available: true,
          reason: null,
          has_appointment: false,
          config_type: 'automática'
        }
      })
      
      setAvailableTimes(completeTimes)
    } catch (err) {
      setError('Erro ao carregar horários: ' + err.message)
    } finally {
      setLoadingSpecific(false)
    }
  }

  // Estados para salvar horários de funcionamento
  const [savingOperatingHours, setSavingOperatingHours] = useState(false)

  // Carregar horários de funcionamento do backend
  const loadOperatingHours = async () => {
    try {
      const data = await adminAPI.getOperatingHours(plantId)
      if (data) {
        setDefaultSchedule(prev => ({
          ...prev,
          weekdays: {
            ...prev.weekdays,
            enabled: data.weekdays?.enabled || true, // Padrão habilitado
            operating_start: data.weekdays?.operating_start || null,
            operating_end: data.weekdays?.operating_end || null
          },
          weekend: {
            ...prev.weekend,
            enabled: data.weekend?.enabled || false,
            days: data.weekend?.days || [],
            operating_start: data.weekend?.operating_start || null,
            operating_end: data.weekend?.operating_end || null
          },
          holiday: {
            ...prev.holiday,
            enabled: data.holiday?.enabled || false,
            operating_start: data.holiday?.operating_start || null,
            operating_end: data.holiday?.operating_end || null
          }
        }))
      }
    } catch (err) {
      // Erro ao carregar horários de funcionamento
      // Não mostrar erro, apenas usar valores padrão
    }
  }

  // Salvar horários de funcionamento
  const handleSaveOperatingHours = async () => {
    // Validar se há erros
    if (scheduleErrors.weekdays || scheduleErrors.weekend) {
      setError('Corrija os erros antes de salvar')
      return
    }

    setSavingOperatingHours(true)
    setError('')

    try {
      await adminAPI.saveOperatingHours(defaultSchedule, plantId)
      setSuccess('Horários de funcionamento salvos com sucesso!')
      setTimeout(() => setSuccess(''), 3000)
      
      // Recarregar horários disponíveis para aplicar as mudanças
      if (selectedDate) {
        await loadAvailableTimes(selectedDate)
      }
    } catch (err) {
      setError('Erro ao salvar horários de funcionamento: ' + err.message)
    } finally {
      setSavingOperatingHours(false)
    }
  }

  useEffect(() => {
    loadWeeklyConfigs()
    loadOperatingHours()
  }, [])

  useEffect(() => {
    loadAvailableTimes(selectedDate)
  }, [selectedDate])

  // Recarregar horários quando os horários de funcionamento mudarem
  useEffect(() => {
    if (selectedDate) {
      loadAvailableTimes(selectedDate)
    }
  }, [
    defaultSchedule.weekdays.enabled,
    defaultSchedule.weekdays.operating_start,
    defaultSchedule.weekdays.operating_end,
    defaultSchedule.weekend.enabled,
    defaultSchedule.weekend.days,
    defaultSchedule.weekend.operating_start,
    defaultSchedule.weekend.operating_end,
    defaultSchedule.holiday.enabled,
    defaultSchedule.holiday.operating_start,
    defaultSchedule.holiday.operating_end
  ])

  // Handlers para Bloqueio Semanal
  const handleSaveWeeklyConfig = async () => {
    if (!newWeeklyConfig.time_start || !newWeeklyConfig.time_end) {
      setError('Selecione o horário inicial e final')
      return
    }

    if (!newWeeklyConfig.reason.trim()) {
      setError('Informe o motivo do bloqueio')
      return
    }

    // Validar que time_end > time_start
    const [startHour, startMin] = newWeeklyConfig.time_start.split(':').map(Number)
    const [endHour, endMin] = newWeeklyConfig.time_end.split(':').map(Number)
    const startTotal = startHour * 60 + startMin
    const endTotal = endHour * 60 + endMin

    if (endTotal <= startTotal) {
      setError('O horário final deve ser maior que o horário inicial')
      return
    }

    try {
      setSavingWeekly(true)
      setError('')
      
      // Gerar horários do intervalo e criar bloqueios para cada um
      const timeRange = generateTimeRange(newWeeklyConfig.time_start, newWeeklyConfig.time_end)
      const savePromises = timeRange.map(time =>
        adminAPI.createDefaultSchedule({
          plant_id: plantId,
          day_of_week: newWeeklyConfig.day_of_week,
          time: time,
          is_available: false,
          reason: newWeeklyConfig.reason
        })
      )

      await Promise.all(savePromises)
      
      setSuccess(`Bloqueio semanal configurado com sucesso! ${timeRange.length} horário(s) bloqueado(s).`)
      setNewWeeklyConfig({
        day_of_week: null,
        time_start: '',
        time_end: '',
        reason: ''
      })
      
      await loadWeeklyConfigs()
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Erro ao salvar configuração semanal: ' + err.message)
    } finally {
      setSavingWeekly(false)
    }
  }

  const handleDeleteWeeklyConfig = async (ids) => {
    if (!confirm('Tem certeza que deseja remover este bloqueio semanal?')) return

    try {
      await Promise.all(ids.map(id => adminAPI.deleteDefaultSchedule(id)))
      setSuccess('Bloqueio semanal removido com sucesso!')
      await loadWeeklyConfigs()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Erro ao remover bloqueio semanal: ' + err.message)
    }
  }

  // Handlers para Bloqueio por Data Específica
  const handleToggleAvailability = (time, currentStatus) => {
    const timeSlot = availableTimes.find(ts => ts.time === time)
    if (timeSlot?.has_appointment) {
      return
    }

    const newStatus = !currentStatus
    setLocalChanges(prev => ({
      ...prev,
      [time]: newStatus
    }))
    setHasUnsavedChanges(true)

    setAvailableTimes(prev => prev.map(ts => 
      ts.time === time ? { ...ts, is_available: newStatus } : ts
    ))
  }

  const handleSaveChanges = async () => {
    if (!hasUnsavedChanges) return

    setSavingBatch(true)
    setError('')

    try {
      const savePromises = Object.entries(localChanges).map(([time, isAvailable]) =>
        adminAPI.createScheduleConfig({
          plant_id: plantId,
          date: selectedDate,
          time: time,
          is_available: isAvailable,
          reason: !isAvailable ? 'Bloqueio manual' : ''
        })
      )

      await Promise.all(savePromises)
      setLocalChanges({})
      setHasUnsavedChanges(false)
      setSuccess('Alterações salvas com sucesso!')
      
      await loadAvailableTimes(selectedDate)
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Erro ao salvar alterações: ' + err.message)
    } finally {
      setSavingBatch(false)
    }
  }


  const handleBlockAll = () => {
    const changes = {}
    availableTimes.forEach(ts => {
      if (!ts.has_appointment) {
        const currentStatus = localChanges.hasOwnProperty(ts.time) 
          ? localChanges[ts.time] 
          : ts.is_available
        if (currentStatus) {
          changes[ts.time] = false
        }
      }
    })
    
    if (Object.keys(changes).length === 0) {
      setError('Todos os horários disponíveis já estão bloqueados')
      setTimeout(() => setError(''), 3000)
      return
    }

    setLocalChanges(prev => ({ ...prev, ...changes }))
    setHasUnsavedChanges(true)
    setAvailableTimes(prev => prev.map(ts => 
      changes.hasOwnProperty(ts.time) ? { ...ts, is_available: false } : ts
    ))
    setSuccess(`${Object.keys(changes).length} horário(s) bloqueado(s). Clique em "Salvar Alterações" para confirmar.`)
    setTimeout(() => setSuccess(''), 3000)
  }

  const handleUnblockAll = () => {
    const changes = {}
    availableTimes.forEach(ts => {
      if (!ts.has_appointment) {
        const currentStatus = localChanges.hasOwnProperty(ts.time) 
          ? localChanges[ts.time] 
          : ts.is_available
        if (!currentStatus) {
          changes[ts.time] = true
        }
      }
    })
    
    if (Object.keys(changes).length === 0) {
      setError('Todos os horários disponíveis já estão desbloqueados')
      setTimeout(() => setError(''), 3000)
      return
    }

    setLocalChanges(prev => ({ ...prev, ...changes }))
    setHasUnsavedChanges(true)
    setAvailableTimes(prev => prev.map(ts => 
      changes.hasOwnProperty(ts.time) ? { ...ts, is_available: true } : ts
    ))
    setSuccess(`${Object.keys(changes).length} horário(s) desbloqueado(s). Clique em "Salvar Alterações" para confirmar.`)
    setTimeout(() => setSuccess(''), 3000)
  }

  const handleBlockBusinessHours = () => {
    const businessHours = []
    for (let hour = 8; hour < 18; hour++) {
      businessHours.push(`${hour.toString().padStart(2, '0')}:00`)
    }

    const changes = {}
    availableTimes.forEach(ts => {
      if (!ts.has_appointment && businessHours.includes(ts.time)) {
        const currentStatus = localChanges.hasOwnProperty(ts.time) 
          ? localChanges[ts.time] 
          : ts.is_available
        if (currentStatus) {
          changes[ts.time] = false
        }
      }
    })
    
    if (Object.keys(changes).length === 0) {
      setError('Todos os horários comerciais já estão bloqueados')
      setTimeout(() => setError(''), 3000)
      return
    }

    setLocalChanges(prev => ({ ...prev, ...changes }))
    setHasUnsavedChanges(true)
    setAvailableTimes(prev => prev.map(ts => 
      changes.hasOwnProperty(ts.time) ? { ...ts, is_available: false } : ts
    ))
    setSuccess(`${Object.keys(changes).length} horário(s) comercial(is) bloqueado(s). Clique em "Salvar Alterações" para confirmar.`)
    setTimeout(() => setSuccess(''), 3000)
  }

  // Limpa mudanças locais ao trocar de data
  useEffect(() => {
    setLocalChanges({})
    setHasUnsavedChanges(false)
  }, [selectedDate])

  // Funções para Horário Padrão
  const validateTimeRange = (start, end) => {
    if (!start || !end) return null
    const [startHour, startMin] = start.split(':').map(Number)
    const [endHour, endMin] = end.split(':').map(Number)
    const startTotal = startHour * 60 + startMin
    const endTotal = endHour * 60 + endMin
    
    if (endTotal <= startTotal) {
      return 'O horário final deve ser maior que o horário inicial'
    }
    return null
  }

  const handleWeekdaysToggle = (enabled) => {
    setDefaultSchedule(prev => ({
      ...prev,
      weekdays: {
        ...prev.weekdays,
        enabled,
        ...(enabled ? {} : { operating_start: null, operating_end: null, start: null, end: null })
      }
    }))
    setScheduleErrors(prev => ({
      ...prev,
      weekdays: null
    }))
  }

  const handleWeekdaysOperatingTimeChange = (field, value) => {
    const newSchedule = {
      ...defaultSchedule.weekdays,
      [field]: value || null // Garantir que string vazia vira null
    }
    setDefaultSchedule(prev => ({
      ...prev,
      weekdays: newSchedule
    }))
    
    // Validar apenas se ambos os campos estiverem preenchidos
    // Se apenas um estiver preenchido, não validar (permite preencher parcialmente)
    if (newSchedule.operating_start && newSchedule.operating_end) {
      const error = validateTimeRange(newSchedule.operating_start, newSchedule.operating_end)
      setScheduleErrors(prev => ({
        ...prev,
        weekdays: error
      }))
    } else {
      // Limpar erro se não houver ambos os campos preenchidos
      setScheduleErrors(prev => ({
        ...prev,
        weekdays: null
      }))
    }
  }

  const handleWeekdaysTimeChange = (field, value) => {
    const newSchedule = {
      ...defaultSchedule.weekdays,
      [field]: value
    }
    setDefaultSchedule(prev => ({
      ...prev,
      weekdays: newSchedule
    }))
    
    // Validar apenas se ambos os campos estiverem preenchidos
    if (newSchedule.start && newSchedule.end) {
      const error = validateTimeRange(newSchedule.start, newSchedule.end)
      setScheduleErrors(prev => ({
        ...prev,
        weekdays: error
      }))
    } else {
      setScheduleErrors(prev => ({
        ...prev,
        weekdays: null
      }))
    }
  }

  const handleWeekendToggle = (enabled) => {
    setDefaultSchedule(prev => ({
      ...prev,
      weekend: {
        ...prev.weekend,
        enabled,
        ...(enabled ? {} : { days: [], operating_start: null, operating_end: null, start: null, end: null })
      }
    }))
    setScheduleErrors(prev => ({
      ...prev,
      weekend: null
    }))
  }

  const handleWeekendOperatingTimeChange = (field, value) => {
    const newSchedule = {
      ...defaultSchedule.weekend,
      [field]: value
    }
    setDefaultSchedule(prev => ({
      ...prev,
      weekend: newSchedule
    }))
    
    // Validar apenas se ambos os campos estiverem preenchidos
    if (newSchedule.operating_start && newSchedule.operating_end) {
      const error = validateTimeRange(newSchedule.operating_start, newSchedule.operating_end)
      setScheduleErrors(prev => ({
        ...prev,
        weekend: error
      }))
    } else {
      setScheduleErrors(prev => ({
        ...prev,
        weekend: null
      }))
    }
  }

  const handleWeekendDayToggle = (day) => {
    const currentDays = defaultSchedule.weekend.days
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day]
    
    setDefaultSchedule(prev => ({
      ...prev,
      weekend: {
        ...prev.weekend,
        days: newDays
      }
    }))
  }

  const handleWeekendTimeChange = (field, value) => {
    const newSchedule = {
      ...defaultSchedule.weekend,
      [field]: value
    }
    setDefaultSchedule(prev => ({
      ...prev,
      weekend: newSchedule
    }))
    
    // Validar apenas se ambos os campos estiverem preenchidos
    if (newSchedule.start && newSchedule.end) {
      const error = validateTimeRange(newSchedule.start, newSchedule.end)
      setScheduleErrors(prev => ({
        ...prev,
        weekend: error
      }))
    } else {
      setScheduleErrors(prev => ({
        ...prev,
        weekend: null
      }))
    }
  }

  const handleHolidayToggle = (enabled) => {
    setDefaultSchedule(prev => ({
      ...prev,
      holiday: {
        ...prev.holiday,
        enabled,
        ...(enabled ? {} : { operating_start: null, operating_end: null, start: null, end: null })
      }
    }))
    setScheduleErrors(prev => ({
      ...prev,
      holiday: null
    }))
  }

  const handleHolidayOperatingTimeChange = (field, value) => {
    const newSchedule = {
      ...defaultSchedule.holiday,
      [field]: value
    }
    setDefaultSchedule(prev => ({
      ...prev,
      holiday: newSchedule
    }))
    
    // Validar apenas se ambos os campos estiverem preenchidos
    if (newSchedule.operating_start && newSchedule.operating_end) {
      const error = validateTimeRange(newSchedule.operating_start, newSchedule.operating_end)
      setScheduleErrors(prev => ({
        ...prev,
        holiday: error
      }))
    } else {
      setScheduleErrors(prev => ({
        ...prev,
        holiday: null
      }))
    }
  }

  const handleHolidayTimeChange = (field, value) => {
    const newSchedule = {
      ...defaultSchedule.holiday,
      [field]: value
    }
    setDefaultSchedule(prev => ({
      ...prev,
      holiday: newSchedule
    }))
    
    // Validar apenas se ambos os campos estiverem preenchidos
    if (newSchedule.start && newSchedule.end) {
      const error = validateTimeRange(newSchedule.start, newSchedule.end)
      setScheduleErrors(prev => ({
        ...prev,
        holiday: error
      }))
    } else {
      setScheduleErrors(prev => ({
        ...prev,
        holiday: null
      }))
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {plantName ? `Configurar Horários - ${plantName}` : 'Configurar Horários'}
          </h1>
          <p className="text-gray-600">
            {plantName 
              ? `Configure horários padrão e bloqueios da planta ${plantName}`
              : 'Configure horários padrão e bloqueios das plantas'}
          </p>
        </div>
      </div>

      {(() => {
        const viewOnlySections = []
        if (isDefaultHoursViewOnly) viewOnlySections.push('Horário Padrão')
        if (isWeeklyBlockViewOnly) viewOnlySections.push('Bloqueio Semanal')
        if (isDateBlockViewOnly) viewOnlySections.push('Bloqueio por Data Específica')
        
        if (viewOnlySections.length === 0) return null
        
        let message = ''
        if (viewOnlySections.length === 1) {
          message = `Você está visualizando a seção "${viewOnlySections[0]}" em modo somente leitura. Para editar as configurações, é necessário ter permissão de Editor.`
        } else {
          const sectionsList = viewOnlySections.map((section, index) => {
            if (index === viewOnlySections.length - 1) {
              return ` e "${section}"`
            } else if (index === 0) {
              return `"${section}"`
            } else {
              return `, "${section}"`
            }
          }).join('')
          message = `Você está visualizando as seções ${sectionsList} em modo somente leitura. Para editar as configurações, é necessário ter permissão de Editor.`
        }
        
        return (
          <Alert>
            <AlertDescription>
              {message}
            </AlertDescription>
          </Alert>
        )
      })()}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {(canViewDefaultHours || canViewWeeklyBlock || canViewDateBlock) ? (
      <Tabs defaultValue={canViewDateBlock ? "blocking" : (canViewDefaultHours ? "operating-hours" : "blocking")} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          {canViewDefaultHours && (
            <TabsTrigger value="operating-hours">
              <Clock className="w-4 h-4 mr-2" />
              Horário Padrão
            </TabsTrigger>
          )}
          {(canViewWeeklyBlock || canViewDateBlock) && (
            <TabsTrigger value="blocking">
              <Lock className="w-4 h-4 mr-2" />
              Bloqueio de Horários
            </TabsTrigger>
          )}
        </TabsList>

        {/* Aba: Horário Padrão */}
        {canViewDefaultHours && (
        <TabsContent value="operating-hours" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Horário Padrão
              </CardTitle>
              <CardDescription>
                Configure aqui o horário padrão de recebimento das plantas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Seção 1: Dias Úteis */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Dias Úteis</h3>
                      <p className="text-sm text-gray-600">Segunda a Sexta-feira</p>
                    </div>
                  </div>
                  <Switch
                    checked={defaultSchedule.weekdays.enabled}
                    onCheckedChange={handleWeekdaysToggle}
                    disabled={isDefaultHoursViewOnly}
                  />
                </div>

                {defaultSchedule.weekdays.enabled && (
                  <div className="pl-14 space-y-4 border-l-2 border-blue-200 ml-2">
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-gray-700">Horários de Funcionamento</Label>
                      <p className="text-xs text-gray-500">Deixe em branco para funcionamento 24 horas</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="weekdays-operating-start" className="text-sm">De</Label>
                          <TimeInput
                            id="weekdays-operating-start"
                            value={defaultSchedule.weekdays.operating_start || ''}
                            onChange={(value) => handleWeekdaysOperatingTimeChange('operating_start', value)}
                            placeholder="HH:mm"
                            intervalMinutes={30}
                            minHour={0}
                            maxHour={23}
                            disabled={isDefaultHoursViewOnly}
                            className={scheduleErrors.weekdays ? 'border-red-500' : ''}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="weekdays-operating-end" className="text-sm">Até</Label>
                          <TimeInput
                            id="weekdays-operating-end"
                            value={defaultSchedule.weekdays.operating_end || ''}
                            onChange={(value) => handleWeekdaysOperatingTimeChange('operating_end', value)}
                            placeholder="HH:mm"
                            intervalMinutes={30}
                            minHour={0}
                            maxHour={23}
                            className={scheduleErrors.weekdays ? 'border-red-500' : ''}
                            disabled={isDefaultHoursViewOnly}
                          />
                        </div>
                      </div>
                      {scheduleErrors.weekdays && (
                        <p className="text-sm text-red-600">{scheduleErrors.weekdays}</p>
                      )}
                      {(!defaultSchedule.weekdays.operating_start || !defaultSchedule.weekdays.operating_end) && (
                        <p className="text-xs text-blue-600 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Funcionamento 24 horas configurado
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Divisor */}
              <div className="border-t"></div>

              {/* Seção 2: Finais de Semana */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Calendar className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Finais de Semana</h3>
                      <p className="text-sm text-gray-600">Sábado e Domingo</p>
                    </div>
                  </div>
                  <Switch
                    checked={defaultSchedule.weekend.enabled}
                    onCheckedChange={handleWeekendToggle}
                    disabled={isDefaultHoursViewOnly}
                  />
                </div>

                {defaultSchedule.weekend.enabled && (
                  <div className="pl-14 space-y-4 border-l-2 border-green-200 ml-2">
                    <div className="space-y-3">
                      <Label>Selecione os dias *</Label>
                      <div className="flex gap-6">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="saturday"
                            checked={defaultSchedule.weekend.days.includes('SATURDAY')}
                            onCheckedChange={() => handleWeekendDayToggle('SATURDAY')}
                            disabled={isDefaultHoursViewOnly}
                          />
                          <Label htmlFor="saturday" className="cursor-pointer font-normal">
                            Sábado
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="sunday"
                            checked={defaultSchedule.weekend.days.includes('SUNDAY')}
                            onCheckedChange={() => handleWeekendDayToggle('SUNDAY')}
                            disabled={isDefaultHoursViewOnly}
                          />
                          <Label htmlFor="sunday" className="cursor-pointer font-normal">
                            Domingo
                          </Label>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-gray-700">Horários de Funcionamento</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="weekend-operating-start" className="text-sm">De *</Label>
                          <TimeInput
                            id="weekend-operating-start"
                            value={defaultSchedule.weekend.operating_start || ''}
                            onChange={(value) => handleWeekendOperatingTimeChange('operating_start', value)}
                            placeholder="HH:mm"
                            intervalMinutes={30}
                            minHour={0}
                            maxHour={23}
                            className={scheduleErrors.weekend ? 'border-red-500' : ''}
                            disabled={isDefaultHoursViewOnly}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="weekend-operating-end" className="text-sm">Até *</Label>
                          <TimeInput
                            id="weekend-operating-end"
                            value={defaultSchedule.weekend.operating_end || ''}
                            onChange={(value) => handleWeekendOperatingTimeChange('operating_end', value)}
                            placeholder="HH:mm"
                            intervalMinutes={30}
                            minHour={0}
                            maxHour={23}
                            className={scheduleErrors.weekend ? 'border-red-500' : ''}
                            disabled={isDefaultHoursViewOnly}
                          />
                        </div>
                      </div>
                      {scheduleErrors.weekend && (
                        <p className="text-sm text-red-600">{scheduleErrors.weekend}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Mensagem Informativa */}
              <Alert className="bg-blue-50 border-blue-200">
                <AlertCircle className="w-4 h-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  Esses horários serão utilizados como padrão para os agendamentos de recebimento.
                </AlertDescription>
              </Alert>

              {/* Botão de Salvar */}
              {!isDefaultHoursViewOnly && (
              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSaveOperatingHours}
                  disabled={savingOperatingHours || scheduleErrors.weekdays || scheduleErrors.weekend}
                  className="min-w-[150px]"
                >
                  {savingOperatingHours ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Salvar Horários
                    </>
                  )}
                </Button>
              </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {/* Aba: Bloqueio de Horários */}
        {(canViewWeeklyBlock || canViewDateBlock) && (
        <TabsContent value="blocking" className="space-y-8 mt-6">
          <div className="space-y-8">
            {/* Seção 1: Bloqueio Semanal (Recorrente) */}
            {canViewWeeklyBlock && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-2 border-b">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Repeat className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Bloqueio Semanal</h2>
                  <p className="text-sm text-gray-600">Configure bloqueios que se repetem toda semana</p>
                </div>
              </div>

              {/* Formulário Novo Bloqueio Semanal */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    Novo Bloqueio Semanal
                  </CardTitle>
                  <CardDescription>
                    Exemplo: Terças-feiras das 12:00 às 13:00 (horário de almoço)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="day_of_week">Dia da Semana *</Label>
                  <Select 
                    value={newWeeklyConfig.day_of_week?.toString() || 'null'} 
                    onValueChange={(value) => setNewWeeklyConfig({
                      ...newWeeklyConfig, 
                      day_of_week: value === 'null' ? null : parseInt(value)
                    })}
                    disabled={isWeeklyBlockViewOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o dia" />
                    </SelectTrigger>
                    <SelectContent>
                      {daysOfWeek.map((day) => (
                        <SelectItem key={day.value?.toString() || 'null'} value={day.value?.toString() || 'null'}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time_start">Horário Inicial *</Label>
                  <Select 
                    value={newWeeklyConfig.time_start} 
                    onValueChange={(value) => setNewWeeklyConfig({...newWeeklyConfig, time_start: value})}
                    disabled={isWeeklyBlockViewOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ex: 12:00" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {timeSlots.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time_end">Horário Final *</Label>
                  <Select 
                    value={newWeeklyConfig.time_end} 
                    onValueChange={(value) => setNewWeeklyConfig({...newWeeklyConfig, time_end: value})}
                    disabled={isWeeklyBlockViewOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ex: 13:00" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {timeSlots
                        .filter(time => {
                          if (!newWeeklyConfig.time_start) return true
                          const [startHour, startMin] = newWeeklyConfig.time_start.split(':').map(Number)
                          const [timeHour, timeMin] = time.split(':').map(Number)
                          return timeHour * 60 + timeMin > startHour * 60 + startMin
                        })
                        .map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Motivo do Bloqueio *</Label>
                <Textarea
                  id="reason"
                  placeholder="Ex: Horário de almoço da equipe"
                  value={newWeeklyConfig.reason}
                  onChange={(e) => setNewWeeklyConfig({...newWeeklyConfig, reason: e.target.value})}
                  rows={2}
                  disabled={isWeeklyBlockViewOnly}
                />
              </div>

              {newWeeklyConfig.time_start && newWeeklyConfig.time_end && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>Intervalo configurado:</strong> {newWeeklyConfig.time_start} até {newWeeklyConfig.time_end}
                    {' '}({generateTimeRange(newWeeklyConfig.time_start, newWeeklyConfig.time_end).length} horário(s) serão bloqueados)
                  </p>
                </div>
              )}

              {!isWeeklyBlockViewOnly && (
                <Button
                onClick={handleSaveWeeklyConfig} 
                disabled={savingWeekly || isWeeklyBlockViewOnly || !newWeeklyConfig.day_of_week || !newWeeklyConfig.time_start || !newWeeklyConfig.time_end || !newWeeklyConfig.reason.trim()} 
                className="w-full"
              >
                {savingWeekly ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Bloqueio Semanal
                  </>
                )}
                </Button>
                )}
                </CardContent>
              </Card>

              {/* Lista de Bloqueios Semanais Ativos */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Repeat className="w-5 h-5" />
                    Bloqueios Semanais Ativos
                  </CardTitle>
                  <CardDescription>
                    Bloqueios que se aplicam automaticamente toda semana
                  </CardDescription>
                </CardHeader>
                <CardContent>
              {loadingWeekly ? (
                <div className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  <p className="text-gray-600">Carregando bloqueios...</p>
                </div>
              ) : weeklyConfigs.length === 0 ? (
                <div className="text-center py-8">
                  <Repeat className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Nenhum bloqueio semanal configurado</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Configure bloqueios que se repetem toda semana
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {weeklyConfigs.map((config, index) => {
                    const sortedTimes = config.times.sort()
                    const timeStart = sortedTimes[0]?.slice(0, 5) || ''
                    const timeEnd = sortedTimes[sortedTimes.length - 1]?.slice(0, 5) || ''
                    
                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              <Lock className="w-3 h-3 mr-1" />
                              Bloqueado
                            </Badge>
                            <div>
                              <p className="font-medium text-sm">
                                <strong>{config.day_name}</strong> - {timeStart} até {timeEnd}
                              </p>
                              {config.reason && (
                                <p className="text-xs text-gray-600 mt-1">
                                  {config.reason}
                                </p>
                              )}
                              <p className="text-xs text-gray-500 mt-1">
                                {config.times.length} horário(s) bloqueado(s)
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {!isWeeklyBlockViewOnly && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteWeeklyConfig(config.ids)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
                </CardContent>
              </Card>
            </div>
            )}

            {/* Seção 2: Bloqueio por Data Específica */}
            {canViewDateBlock && (
            <div className="space-y-4 pt-6 border-t">
              <div className="flex items-center gap-3 pb-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Bloqueio por Data Específica</h2>
                  <p className="text-sm text-gray-600">Bloqueie horários de uma data específica</p>
                </div>
              </div>

              {/* Seletor de Data e Ações Rápidas */}
              <Card>
            <CardHeader>
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2 mb-2">
                    <Calendar className="w-5 h-5" />
                    Selecionar Data
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    <DateInput
                      value={selectedDate}
                      onChange={(value) => setSelectedDate(value)}
                      minDate={dateUtils.toISODate(new Date())}
                      className="w-auto min-w-[200px]"
                      disabled={isDateBlockViewOnly}
                      placeholder="DD/MM/AAAA"
                    />
                  </div>
                </div>
                
                {/* Ações Rápidas */}
                {!isDateBlockViewOnly && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBlockAll}
                    disabled={loadingSpecific || savingBatch}
                    className="flex items-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    Bloquear Todos
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUnblockAll}
                    disabled={loadingSpecific || savingBatch}
                    className="flex items-center gap-2"
                  >
                    <Unlock className="w-4 h-4" />
                    Desbloquear Todos
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBlockBusinessHours}
                    disabled={loadingSpecific || savingBatch}
                    className="flex items-center gap-2"
                  >
                    <Building2 className="w-4 h-4" />
                    Bloquear Comercial
                  </Button>
                  {hasUnsavedChanges && (
                    <Button
                      onClick={handleSaveChanges}
                      disabled={savingBatch}
                      className="flex items-center gap-2"
                    >
                      {savingBatch ? (
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
                  )}
                </div>
                )}
              </div>
            </CardHeader>
            </Card>

            {/* Grade de Horários */}
            <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Horários do Dia
                    <span className="text-lg font-normal text-gray-600 ml-2">
                      {dateUtils.formatDate(new Date(selectedDate + 'T00:00:00'))}
                    </span>
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Clique nos horários para alternar entre disponível e bloqueado
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingSpecific ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  <span className="text-gray-600">Carregando horários...</span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
                    <TooltipProvider>
                      {availableTimes.map((timeSlot) => {
                        const isAvailable = localChanges.hasOwnProperty(timeSlot.time) 
                          ? localChanges[timeSlot.time] 
                          : timeSlot.is_available
                        const isBlocked = !isAvailable
                        const isScheduled = timeSlot.has_appointment
                        const isClickable = !isScheduled

                        return (
                          <Tooltip key={timeSlot.time}>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className={`
                                  relative rounded-lg border-2 p-2.5 text-center transition-all
                                  ${isScheduled 
                                    ? 'border-gray-300 bg-gray-100 cursor-not-allowed opacity-60' 
                                    : isAvailable
                                    ? 'border-green-400 bg-green-100 hover:bg-green-200 hover:border-green-500 cursor-pointer'
                                    : 'border-red-400 bg-red-100 hover:bg-red-200 hover:border-red-500 cursor-pointer'
                                  }
                                  ${localChanges.hasOwnProperty(timeSlot.time) ? 'ring-2 ring-blue-400 ring-offset-1' : ''}
                                `}
                                onClick={() => isClickable && !isDateBlockViewOnly && handleToggleAvailability(timeSlot.time, isAvailable)}
                                disabled={!isClickable || isDateBlockViewOnly}
                              >
                                <div className={`text-sm font-semibold ${isScheduled ? 'text-gray-500' : ''}`}>
                                  {timeSlot.time}
                                </div>
                                {isScheduled && (
                                  <div className="absolute top-1 right-1">
                                    <AlertCircle className="w-3 h-3 text-blue-600" />
                                  </div>
                                )}
                                {localChanges.hasOwnProperty(timeSlot.time) && (
                                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></div>
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-xs">
                                {isScheduled ? (
                                  <div>
                                    <p className="font-semibold">Horário Agendado</p>
                                    <p className="text-gray-400">Não pode ser alterado</p>
                                  </div>
                                ) : isAvailable ? (
                                  <p>Clique para bloquear</p>
                                ) : (
                                  <div>
                                    <p className="font-semibold">Bloqueado</p>
                                    {timeSlot.reason && (
                                      <p className="text-gray-400 mt-1">{timeSlot.reason}</p>
                                    )}
                                    <p className="text-gray-400 mt-1">Clique para desbloquear</p>
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )
                      })}
                    </TooltipProvider>
                  </div>
                  
                  {/* Legenda e Status */}
                  <div className="mt-6 pt-4 border-t">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      {/* Legenda */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded border-2 border-green-400 bg-green-100"></div>
                          <span>Disponível</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded border-2 border-red-400 bg-red-100"></div>
                          <span>Bloqueado</span>
                        </div>
                        {hasUnsavedChanges && (
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span className="text-blue-600 font-medium">Alterações não salvas</span>
                          </div>
                        )}
                      </div>

                      {/* Estatísticas */}
                      {!loadingSpecific && (
                        <div className="text-xs text-gray-500">
                          <span className="font-medium">
                            {availableTimes.filter(ts => !ts.has_appointment && (localChanges.hasOwnProperty(ts.time) ? localChanges[ts.time] : ts.is_available)).length} disponíveis
                          </span>
                          {' • '}
                          <span className="font-medium">
                            {availableTimes.filter(ts => !ts.has_appointment && !(localChanges.hasOwnProperty(ts.time) ? localChanges[ts.time] : ts.is_available)).length} bloqueados
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
              </Card>
            </div>
            )}
          </div>
        </TabsContent>
        )}
      </Tabs>
      ) : (
        <Alert>
          <AlertDescription>
            Você não tem permissão para acessar nenhuma seção de configuração de horários.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

export default UnifiedScheduleConfig
