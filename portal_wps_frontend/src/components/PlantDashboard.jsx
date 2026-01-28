import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer'
import { 
  Users, 
  Calendar, 
  ChevronLeft, 
  ChevronRight,
  ChevronUp,
  ChevronDown, 
  Plus, 
  LogIn, 
  LogOut, 
  Edit,
  Building2,
  Clock,
  CheckCircle,
  XCircle,
  Settings,
  Trash2,
  Ban,
  ArrowLeft
} from 'lucide-react'
import { plantAPI, adminAPI } from '../lib/api'
import { dateUtils, statusUtils } from '../lib/utils'
import { toast } from 'sonner'
import { UI_CONFIG } from '../lib/constants'
import SupplierForm from './SupplierForm'
import SupplierManagement from './SupplierManagement'
import PlantManagement from './PlantManagement'
import UnifiedScheduleConfig from './UnifiedScheduleConfig'
import AppointmentEditForm from './AppointmentEditForm'
import PlantForm from './PlantForm'
import UsersScreen from './UsersScreen'
import usePermissions from '../hooks/usePermissions'

// Constante para altura proporcional por hora
const HOUR_HEIGHT = UI_CONFIG.HOUR_HEIGHT

const PlantDashboard = ({ user, token }) => {
  const { hasPermission, hasViewPermission, getPermissionType, loading: permissionsLoading } = usePermissions(user)
  
  // Garantir que se a permissão de configurações for removida, volte para a aba de agendamentos
  useEffect(() => {
    if (activeTab === 'suppliers' && !hasPermission('view_system_config', 'viewer')) {
      setActiveTab('appointments')
    }
  }, [hasPermission, activeTab])
  
  const [suppliers, setSuppliers] = useState([])
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [showSupplierManagement, setShowSupplierManagement] = useState(false)
  const [managingSupplier, setManagingSupplier] = useState(null)
  const [showUnifiedScheduleConfig, setShowUnifiedScheduleConfig] = useState(false)
  const [selectedPlantForSchedule, setSelectedPlantForSchedule] = useState(null)
  const [showSuppliersScreen, setShowSuppliersScreen] = useState(false)
  const [showPlantsScreen, setShowPlantsScreen] = useState(false)
  const [showPlantForm, setShowPlantForm] = useState(false)
  const [showPlantManagement, setShowPlantManagement] = useState(false)
  const [managingPlant, setManagingPlant] = useState(null)
  const [plants, setPlants] = useState([])
  const [showAppointmentForm, setShowAppointmentForm] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState(null)
  const [activeTab, setActiveTab] = useState('appointments')
  const [activeFilter, setActiveFilter] = useState('all')
  // Capacidade máxima da planta do usuário
  const [maxCapacity, setMaxCapacity] = useState(1)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [showUsersScreen, setShowUsersScreen] = useState(false)
  const [plantInfo, setPlantInfo] = useState(null)
  const [timeSlots, setTimeSlots] = useState([])
  const [operatingHours, setOperatingHours] = useState({ start: '08:00', end: '17:00' })
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedPlantId, setSelectedPlantId] = useState(null)
  
  // Estados para controlar expansão de horários fora do padrão
  const [showBeforeHours, setShowBeforeHours] = useState(false)
  const [showAfterHours, setShowAfterHours] = useState(false)
  
  // Ref para o container de scroll do calendário
  const calendarScrollRef = useRef(null)

  const loadSuppliers = async () => {
    if (!hasPermission('view_suppliers', 'viewer')) {
      setSuppliers([])
      return
    }
    try {
      const data = await plantAPI.getSuppliers()
      
      if (Array.isArray(data)) {
        setSuppliers(data)
      } else {
        setSuppliers([])
      }
    } catch (err) {
      setSuppliers([])
      setError('Erro ao carregar fornecedores: ' + (err.response?.data?.error || err.message || 'Erro desconhecido'))
    }
  }

  const loadPlants = async () => {
    if (!hasPermission('view_plants', 'viewer')) {
      setPlants([])
      return
    }
    try {
      const data = await plantAPI.getPlants()
      
      if (Array.isArray(data)) {
        setPlants(data)
      } else {
        setPlants([])
      }
    } catch (err) {
      setPlants([])
      setError('Erro ao carregar plantas: ' + (err.response?.data?.error || err.message || 'Erro desconhecido'))
    }
  }

  const loadAppointments = async (date) => {
    try {
      setLoading(true)
      const dateISO = dateUtils.toISODate(date)
      const data = await plantAPI.getAppointments(dateISO)
      setAppointments(Array.isArray(data) ? data : [])
      setError('')
    } catch (err) {
      setError('Erro ao carregar agendamentos: ' + (err.response?.data?.error || err.message))
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }

  const loadPlantProfile = async () => {
    try {
      const data = await plantAPI.getProfile()
      setPlantInfo(data.plant)
      if (data.plant && data.plant.id) {
        setSelectedPlantId(data.plant.id)
      }
    } catch (err) {
      // Erro silencioso ao carregar perfil
    }
  }

  const loadTimeSlots = async (plantId, date) => {
    if (!plantId || !date) {
      setTimeSlots([])
      setOperatingHours({ start: '08:00', end: '17:00' })
      return
    }

    try {
      setLoadingSlots(true)
      const dateStr = dateUtils.toISODate(date)
      const data = await adminAPI.getPlantTimeSlots(plantId, dateStr)
      
      if (data && data.slots) {
        setTimeSlots(data.slots)
        if (data.operating_hours) {
          setOperatingHours(data.operating_hours)
        }
      } else {
        setTimeSlots([])
      }
    } catch (err) {
      setTimeSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }

  // Carregar capacidade máxima da planta do usuário diretamente do plantInfo
  useEffect(() => {
    if (plantInfo?.max_capacity !== undefined) {
      const capacity = plantInfo.max_capacity || 1
      setMaxCapacity(capacity)
    } else if (plantInfo?.id) {
      // Fallback: se max_capacity não estiver disponível, usar valor padrão
      setMaxCapacity(1)
    }
  }, [plantInfo])

  useEffect(() => {
    loadPlantProfile()
  }, [])

  useEffect(() => {
    if (hasPermission('view_suppliers', 'viewer')) {
      loadSuppliers()
    }
    if (hasPermission('view_plants', 'viewer')) {
      loadPlants()
    }
    loadAppointments(currentDate)
  }, [currentDate, activeTab])

  useEffect(() => {
    if (showPlantsScreen && hasPermission('view_plants', 'viewer')) {
      loadPlants()
    }
  }, [showPlantsScreen])
  
  useEffect(() => {
    if (showPlantsScreen && !showPlantManagement && !showPlantForm && hasPermission('view_plants', 'viewer')) {
      loadPlants()
    }
  }, [showPlantsScreen, showPlantManagement, showPlantForm])

  // Carregar fornecedores quando a tela de fornecedores é aberta
  useEffect(() => {
    if (showSuppliersScreen && hasPermission('view_suppliers', 'viewer')) {
      loadSuppliers()
    }
  }, [showSuppliersScreen])

  // Carregar fornecedores quando o formulário de agendamento é aberto (para criar novo agendamento)
  useEffect(() => {
    if (showAppointmentForm && editingAppointment && !editingAppointment.id) {
      // É um novo agendamento - carregar fornecedores se ainda não foram carregados
      if (suppliers.length === 0 && hasPermission('view_suppliers', 'viewer')) {
        loadSuppliers()
      }
    }
  }, [showAppointmentForm, editingAppointment])

  // Carregar slots de tempo quando planta ou data mudarem
  useEffect(() => {
    if (selectedPlantId && currentDate && !isNaN(currentDate.getTime())) {
      // Verificar se a data não é no passado
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const selectedDate = new Date(currentDate)
      selectedDate.setHours(0, 0, 0, 0)
      
      if (selectedDate >= today) {
        loadTimeSlots(selectedPlantId, currentDate)
      } else {
        setTimeSlots([])
      }
    } else {
      setTimeSlots([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlantId, currentDate?.getTime()])

  const handlePreviousDay = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() - 1)
    setCurrentDate(newDate)
  }

  const handleNextDay = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + 1)
    setCurrentDate(newDate)
  }

  const handleDateChange = (dateString) => {
    if (dateString) {
      // IMPORTANTE: Criar data usando setHours(12,0,0,0) para evitar problemas de fuso horário
      // Quando criamos new Date('YYYY-MM-DD'), o JavaScript interpreta como UTC 00:00:00
      // que pode ser convertido para o dia anterior no fuso horário local
      // Usando setHours(12,0,0,0) garantimos que a data seja interpretada corretamente
      const newDate = new Date(dateString + 'T12:00:00')
      // Validar se a data é válida
      if (!isNaN(newDate.getTime())) {
        // Normalizar para meia-noite local para manter consistência
        newDate.setHours(0, 0, 0, 0)
        setCurrentDate(newDate)
      }
    }
  }

  const handleCheckIn = async (appointmentId) => {
    if (!hasPermission('check_in', 'editor')) {
      toast.error('Permissão negada', {
        description: 'Você não tem permissão para realizar check-in',
        duration: 4000
      })
      return
    }
    try {
      const result = await plantAPI.checkIn(appointmentId)
      const dateToLoad = currentDate instanceof Date ? currentDate : new Date(currentDate)
      await loadAppointments(dateToLoad)
      toast.success('Check-in realizado com sucesso!', {
        description: `Payload ERP gerado com sucesso`,
        duration: 5000
      })
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Erro desconhecido'
      toast.error('Erro ao realizar check-in', {
        description: errorMessage,
        duration: 5000
      })
    }
  }

  const handleCheckOut = async (appointmentId) => {
    if (!hasPermission('check_out', 'editor')) {
      toast.error('Permissão negada', {
        description: 'Você não tem permissão para realizar check-out',
        duration: 4000
      })
      return
    }
    try {
      const result = await plantAPI.checkOut(appointmentId)
      setAppointments(prev => prev.map(apt => 
        apt.id === appointmentId 
          ? { ...apt, status: 'checked_out', check_out_time: result.appointment?.check_out_time }
          : apt
      ))
      await loadAppointments(currentDate)
      toast.success('Check-out realizado com sucesso!', {
        duration: 4000
      })
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Erro desconhecido'
      toast.error('Erro ao realizar check-out', {
        description: errorMessage,
        duration: 5000
      })
    }
  }

  const handleEditAppointment = (appointment) => {
    if (!hasPermission('edit_appointment', 'editor')) {
      setError('Você não tem permissão para editar agendamentos')
      return
    }
    setEditingAppointment(appointment)
    setShowAppointmentForm(true)
  }

  const handleSupplierFormSubmit = async () => {
    setShowSupplierForm(false)
    await loadSuppliers()
  }

  const handleManageSupplier = (supplier) => {
    // Permitir abrir para visualização ou edição
    if (!hasViewPermission('edit_supplier')) {
      setError('Você não tem permissão para visualizar fornecedores')
      return
    }
    setManagingSupplier(supplier)
    setShowSupplierManagement(true)
  }

  const handleSupplierManagementUpdate = async () => {
    setShowSupplierManagement(false)
    setManagingSupplier(null)
    await loadSuppliers()
    await loadAppointments(currentDate)
  }

  const handlePlantFormSubmit = async () => {
    setShowPlantForm(false)
    await loadPlants()
  }

  const handleManagePlant = (plant) => {
    // Verificar permissão apenas se não for admin e se as permissões já foram carregadas
    if (user?.role !== 'admin' && !permissionsLoading) {
      if (!hasViewPermission('edit_plant')) {
        setError('Você não tem permissão para visualizar plantas')
        return
      }
    }
    const updatedPlant = plants.find(p => p.id === plant.id)
    if (updatedPlant) {
      setManagingPlant(updatedPlant)
    } else {
      setManagingPlant(plant)
    }
    setShowPlantManagement(true)
  }

  const handlePlantManagementUpdate = async () => {
    try {
      const data = await plantAPI.getPlants()
      if (Array.isArray(data)) {
        setPlants(data)
        if (managingPlant) {
          const updatedPlant = data.find(p => p.id === managingPlant.id)
          if (updatedPlant) {
            setManagingPlant(updatedPlant)
          }
        }
      }
      // Recarregar perfil da planta para atualizar max_capacity
      await loadPlantProfile()
    } catch (err) {
      await loadPlants()
      // Tentar recarregar perfil mesmo em caso de erro
      await loadPlantProfile()
    }
  }

  const handleDeleteAppointment = async (appointmentId) => {
    if (!hasPermission('delete_appointment', 'editor')) {
      setError('Você não tem permissão para excluir agendamentos')
      return
    }
    if (!confirm('Tem certeza que deseja excluir este agendamento?')) return

    try {
      await plantAPI.deleteAppointment(appointmentId)
      await loadAppointments(currentDate)
    } catch (err) {
      setError('Erro ao excluir agendamento: ' + err.message)
    }
  }

  const handleAppointmentFormSubmit = async () => {
    setShowAppointmentForm(false)
    setEditingAppointment(null)
    await loadAppointments(currentDate)
  }

  // Função para normalizar datas sem problemas de timezone
  const getDateString = (date) => {
    if (!date) return null
    if (typeof date === 'string') {
      // Se já é uma string no formato YYYY-MM-DD, retornar diretamente
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date
      }
      // Se tem timezone, pegar apenas a parte da data
      return date.split('T')[0]
    }
    // Se é um objeto Date, converter para YYYY-MM-DD sem problemas de timezone
    const d = new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  const currentDateISO = getDateString(currentDate)
  
  // Filtrar agendamentos do dia selecionado
  // IMPORTANTE: Todos os agendamentos aparecem na data original do agendamento (date),
  // independente do status (scheduled, checked_in, checked_out, rescheduled)
  // IMPORTANTE: Filtrar apenas agendamentos da própria planta
  const dayAppointments = appointments.filter(apt => {
    if (!apt.date) {
      return false
    }
    
    // VALIDAÇÃO: Garantir que o agendamento pertence à planta do usuário
    if (plantInfo && plantInfo.id && apt.plant_id !== plantInfo.id) {
      return false
    }
    
    const aptDate = getDateString(apt.date)
    const matches = aptDate === currentDateISO
    
    // VALIDAÇÃO RIGOROSA: Se não corresponder, não incluir
    if (!matches) {
      return false
    }
    
    return true
  })
  
  // VALIDAÇÃO ADICIONAL: Garantir que todos os agendamentos filtrados são realmente do dia selecionado
  const filteredAppointments = (activeFilter === 'all' 
    ? dayAppointments 
    : dayAppointments.filter(appointment => appointment.status === activeFilter)
  ).filter(appointment => {
    // VALIDAÇÃO FINAL: Garantir que a data do agendamento corresponde à data selecionada
    if (!appointment.date) return false
    const aptDate = getDateString(appointment.date)
    if (aptDate !== currentDateISO) {
      return false
    }
    return true
  })

  const appointmentsByTime = {}
  filteredAppointments.forEach(apt => {
    const startTime = dateUtils.formatTime(apt.time)
    if (!appointmentsByTime[startTime]) {
      appointmentsByTime[startTime] = []
    }
    if (!appointmentsByTime[startTime].find(a => a.id === apt.id)) {
      appointmentsByTime[startTime].push(apt)
    }
  })
  
  Object.keys(appointmentsByTime).forEach(timeSlot => {
    appointmentsByTime[timeSlot].sort((a, b) => {
      const timeA = dateUtils.formatTime(a.time)
      const timeB = dateUtils.formatTime(b.time)
      return timeA.localeCompare(timeB)
    })
  })

  const uniqueTimes = new Set()
  filteredAppointments.forEach(apt => {
    uniqueTimes.add(dateUtils.formatTime(apt.time))
  })
  
  for (let hour = 0; hour < 24; hour++) {
    uniqueTimes.add(`${hour.toString().padStart(2, '0')}:00`)
    uniqueTimes.add(`${hour.toString().padStart(2, '0')}:30`)
  }
  
  const availableHours = Array.from(uniqueTimes).sort((a, b) => {
    const [h1, m1] = a.split(':').map(Number)
    const [h2, m2] = b.split(':').map(Number)
    return h1 * 60 + m1 - (h2 * 60 + m2)
  })

  const calculateCardHeight = (appointment) => {
    const startTime = dateUtils.formatTime(appointment.time)
    const endTime = appointment.time_end ? dateUtils.formatTime(appointment.time_end) : startTime
    
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin
    
    const durationHours = Math.max((endMinutes - startMinutes) / 60, 0.25)
    const height = durationHours * HOUR_HEIGHT
    
    // Quando há 5 ou mais colunas, manter altura mínima fixa de 100px para melhor visualização
    const minHeight = maxCapacity >= 5 ? 100 : 80
    return Math.max(height, minHeight)
  }

  const calculateCardTop = (timeString) => {
    const [hour, min] = timeString.split(':').map(Number)
    const totalMinutes = hour * 60 + min
    const hoursFromStart = totalMinutes / 60
    return hoursFromStart * HOUR_HEIGHT
  }

  const getStatusBorderColor = (status) => {
    switch (status) {
      case 'rescheduled':
        return 'border-l-purple-500'
      case 'scheduled':
        return 'border-l-blue-500'
      case 'checked_in':
        return 'border-l-orange-500'
      case 'checked_out':
        return 'border-l-green-500'
      default:
        return 'border-l-red-500'
    }
  }

  const getCardContentLevel = (height) => {
    const MIN_HEIGHT_FOR_SUMMARY = UI_CONFIG.MIN_HEIGHT_FOR_SUMMARY
    const MIN_HEIGHT_FOR_FULL = UI_CONFIG.MIN_HEIGHT_FOR_FULL
    
    if (height < MIN_HEIGHT_FOR_SUMMARY) {
      return 'minimal'
    } else if (height < MIN_HEIGHT_FOR_FULL) {
      return 'summary'
    } else {
      return 'full'
    }
  }

  // Função para verificar se um horário está dentro do funcionamento
  const isTimeWithinOperatingHours = (timeString) => {
    if (!operatingHours.start || !operatingHours.end) {
      return true // Se não há horários definidos, permitir
    }
    
    const [timeHour, timeMin] = timeString.split(':').map(Number)
    const [startHour, startMin] = operatingHours.start.split(':').map(Number)
    const [endHour, endMin] = operatingHours.end.split(':').map(Number)
    
    const timeMinutes = timeHour * 60 + timeMin
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin
    
    return timeMinutes >= startMinutes && timeMinutes < endMinutes
  }

  // Função para verificar se há capacidade disponível em um horário e coluna específica
  const hasCapacityAvailable = (timeString, colIndex) => {
    // Verificar se a coluna está dentro da capacidade máxima
    if (colIndex >= maxCapacity) {
      return false
    }
    
    // Se há timeSlots, verificar se o horário existe
    // Não verificar slot.is_available porque isso verifica capacidade geral,
    // não por coluna. A verificação de área vazia (isAreaEmpty) já garante
    // que esta coluna específica está disponível.
    if (timeSlots.length > 0) {
      const slot = timeSlots.find(s => s.time === timeString)
      if (!slot) {
        // Se não encontrou o slot, pode ser que esteja fora do horário de funcionamento
        // Mas isso já é verificado por isTimeWithinOperatingHours
        return true // Permitir, pois outras verificações vão bloquear se necessário
      }
    }
    
    // A verificação de área vazia (isAreaEmpty) já garante que a coluna está disponível
    return true
  }

  // Função para verificar se uma área está vazia (sem agendamentos sobrepostos)
  const isAreaEmpty = (top, height, colIndex) => {
    const columnAppointments = appointmentsByColumn[colIndex] || []
    
    // Verificar se há agendamentos sobrepostos nesta coluna
    for (const appointment of columnAppointments) {
      if (!appointment.date) continue
      const aptDate = getDateString(appointment.date)
      if (aptDate !== currentDateISO) continue
      
      const aptTop = calculateCardTop(dateUtils.formatTime(appointment.time))
      const aptHeight = calculateCardHeight(appointment)
      const aptBottom = aptTop + aptHeight
      const clickedBottom = top + height
      
      // Verificar sobreposição
      if (top < aptBottom && clickedBottom > aptTop) {
        return false // Há sobreposição
      }
    }
    
    return true // Área está vazia
  }

  // Função para lidar com clique em área vazia
  const handleEmptyAreaClick = (timeString, colIndex) => {
    // Verificar permissão
    if (!hasPermission('create_appointment', 'editor')) {
      return
    }
    
    // Verificar se a coluna está dentro da capacidade máxima
    if (colIndex >= maxCapacity) {
      return
    }
    
    // Verificar se está dentro do horário de funcionamento
    if (!isTimeWithinOperatingHours(timeString)) {
      return
    }
    
    // Verificar se há capacidade disponível nesta coluna
    if (!hasCapacityAvailable(timeString, colIndex)) {
      return
    }
    
    // Verificar se a área está vazia (sem agendamentos sobrepostos)
    const slotHeight = HOUR_HEIGHT / 2 // 30 minutos
    const top = calculateCardTop(timeString)
    if (!isAreaEmpty(top, slotHeight, colIndex)) {
      return
    }
    
    // Calcular horário final (30 minutos depois)
    const [hour, min] = timeString.split(':').map(Number)
    const endHour = min === 30 ? (hour + 1) % 24 : hour
    const endMin = min === 30 ? 0 : 30
    const endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`

    // Abrir formulário com dados pré-preenchidos
    setEditingAppointment(null)
    setShowAppointmentForm(true)
    
    setTimeout(() => {
      setEditingAppointment({
        date: currentDateISO,
        time: timeString,
        time_end: endTime,
        plant_id: selectedPlantId || plantInfo?.id
      })
    }, 100)
  }

  const handleCardClick = (appointment) => {
    setSelectedAppointment(appointment)
    setDrawerOpen(true)
  }

  const appointmentsOverlap = (apt1, apt2) => {
    const start1 = dateUtils.formatTime(apt1.time)
    const end1 = apt1.time_end ? dateUtils.formatTime(apt1.time_end) : start1
    const start2 = dateUtils.formatTime(apt2.time)
    const end2 = apt2.time_end ? dateUtils.formatTime(apt2.time_end) : start2
    
    const [h1, m1] = start1.split(':').map(Number)
    const [h2, m2] = end1.split(':').map(Number)
    const [h3, m3] = start2.split(':').map(Number)
    const [h4, m4] = end2.split(':').map(Number)
    
    const start1Min = h1 * 60 + m1
    const end1Min = h2 * 60 + m2
    const start2Min = h3 * 60 + m3
    const end2Min = h4 * 60 + m4
    
    return start1Min < end2Min && start2Min < end1Min
  }

  const appointmentsByColumn = useMemo(() => {
    // Usar a capacidade específica da planta do usuário
    const capacity = Math.max(1, maxCapacity)
    const columns = Array.from({ length: capacity }, () => [])
    
    // Ordenar agendamentos por horário de início, e por ID (ordem de criação) quando o horário for igual
    // Isso garante que a posição dos cards seja fixa baseada na ordem de criação
    const sortedAppointments = [...filteredAppointments].sort((a, b) => {
      const timeA = dateUtils.formatTime(a.time)
      const timeB = dateUtils.formatTime(b.time)
      const [h1, m1] = timeA.split(':').map(Number)
      const [h2, m2] = timeB.split(':').map(Number)
      const timeDiff = (h1 * 60 + m1) - (h2 * 60 + m2)
      // Se o horário for igual, ordenar por ID (ordem de criação) para manter posição fixa
      if (timeDiff === 0) {
        return (a.id || 0) - (b.id || 0)
      }
      return timeDiff
    })
    
    const appointmentColumnMap = new Map()
    
    // Função auxiliar para verificar se dois agendamentos se sobrepõem
    const doAppointmentsOverlap = (apt1, apt2) => {
      const start1 = dateUtils.formatTime(apt1.time)
      const end1 = apt1.time_end ? dateUtils.formatTime(apt1.time_end) : start1
      const start2 = dateUtils.formatTime(apt2.time)
      const end2 = apt2.time_end ? dateUtils.formatTime(apt2.time_end) : start2
      
      const [h1, m1] = start1.split(':').map(Number)
      const [h2, m2] = end1.split(':').map(Number)
      const [h3, m3] = start2.split(':').map(Number)
      const [h4, m4] = end2.split(':').map(Number)
      
      const start1Min = h1 * 60 + m1
      const end1Min = h2 * 60 + m2
      const start2Min = h3 * 60 + m3
      const end2Min = h4 * 60 + m4
      
      // Verificar sobreposição: start1 < end2 && start2 < end1
      return start1Min < end2Min && start2Min < end1Min
    }
    
    // Função auxiliar para encontrar a melhor coluna para um agendamento
    const findBestColumn = (appointment) => {
      // Verificar cada coluna para encontrar uma que não tenha conflitos
      for (let colIndex = 0; colIndex < capacity; colIndex++) {
        const columnAppointments = columns[colIndex]
        let hasConflict = false
        
        // Verificar se há conflito com algum agendamento já nesta coluna
        for (const existingApt of columnAppointments) {
          // Verificar se o agendamento existente está realmente nesta coluna
          if (appointmentColumnMap.get(existingApt.id) === colIndex) {
            // Verificar se há sobreposição de horários
            if (doAppointmentsOverlap(appointment, existingApt)) {
              hasConflict = true
              break
            }
          }
        }
        
        if (!hasConflict) {
          return colIndex
        }
      }
      
      // Se todas as colunas têm conflito, usar a primeira (não deveria acontecer se capacidade está correta)
      return 0
    }
    
    // Processar agendamentos respeitando a capacidade específica desta planta
    sortedAppointments.forEach(appointment => {
      if (appointmentColumnMap.has(appointment.id)) {
        return
      }
      
      // Encontrar a melhor coluna para este agendamento
      const colIndex = findBestColumn(appointment)
      columns[colIndex].push(appointment)
      appointmentColumnMap.set(appointment.id, colIndex)
    })
    
    return columns
  }, [filteredAppointments, maxCapacity])

  const timelineHeight = useMemo(() => {
    let height = 24 * HOUR_HEIGHT
    if (filteredAppointments.length > 0) {
      const lastAppointment = filteredAppointments.reduce((latest, apt) => {
        const aptTime = dateUtils.formatTime(apt.time_end || apt.time)
        const latestTime = dateUtils.formatTime(latest.time_end || latest.time)
        return aptTime > latestTime ? apt : latest
      }, filteredAppointments[0])
      
      const lastTime = dateUtils.formatTime(lastAppointment.time_end || lastAppointment.time)
      height = Math.max(calculateCardTop(lastTime) + calculateCardHeight(lastAppointment) + 100, 24 * HOUR_HEIGHT)
    }
    return height
  }, [filteredAppointments])
  
  // Funções auxiliares para calcular posições do horário padrão
  const getOperatingHoursTop = useMemo(() => {
    if (!operatingHours || !operatingHours.start) return 0
    try {
      const [startHour, startMin] = operatingHours.start.split(':').map(Number)
      if (isNaN(startHour) || isNaN(startMin)) return 0
      return (startHour * 60 + startMin) / 60 * HOUR_HEIGHT
    } catch (error) {
      return 0
    }
  }, [operatingHours?.start])
  
  const getOperatingHoursHeight = useMemo(() => {
    if (!operatingHours || !operatingHours.start || !operatingHours.end) return timelineHeight
    try {
      const [startHour, startMin] = operatingHours.start.split(':').map(Number)
      const [endHour, endMin] = operatingHours.end.split(':').map(Number)
      if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin)) return timelineHeight
      const startTop = (startHour * 60 + startMin) / 60 * HOUR_HEIGHT
      const endTop = (endHour * 60 + endMin) / 60 * HOUR_HEIGHT
      return Math.max(0, endTop - startTop)
    } catch (error) {
      return timelineHeight
    }
  }, [operatingHours?.start, operatingHours?.end, timelineHeight])
  
  const getOperatingHoursBottom = useMemo(() => {
    return getOperatingHoursTop + getOperatingHoursHeight
  }, [getOperatingHoursTop, getOperatingHoursHeight])
  
  // Verificar se há horários antes/depois do padrão
  const hasHoursBefore = useMemo(() => {
    return getOperatingHoursTop > 0
  }, [getOperatingHoursTop])
  
  const hasHoursAfter = useMemo(() => {
    return getOperatingHoursBottom < timelineHeight
  }, [getOperatingHoursBottom, timelineHeight])
  
  // Configurar event listener para wheel com passive: false para permitir preventDefault
  useEffect(() => {
    const scrollContainer = calendarScrollRef.current
    if (!scrollContainer) return

    const handleWheel = (e) => {
      // Prevenir scroll com wheel quando os botões estão ocultos
      if (!scrollContainer) return
      
      const scrollTop = scrollContainer.scrollTop
      const scrollHeight = scrollContainer.scrollHeight
      const clientHeight = scrollContainer.clientHeight
      
      let minScrollTop = 0
      let maxScrollTop = scrollHeight - clientHeight
      
      if (!showBeforeHours) {
        minScrollTop = getOperatingHoursTop
      }
      
      if (!showAfterHours) {
        maxScrollTop = Math.max(0, getOperatingHoursBottom - clientHeight)
      }
      
      // Se está tentando rolar para cima e já está no limite mínimo
      if (e.deltaY < 0 && scrollTop <= minScrollTop && !showBeforeHours) {
        e.preventDefault()
        return
      }
      
      // Se está tentando rolar para baixo e já está no limite máximo
      if (e.deltaY > 0 && scrollTop >= maxScrollTop && !showAfterHours) {
        e.preventDefault()
        return
      }
    }

    scrollContainer.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      scrollContainer.removeEventListener('wheel', handleWheel)
    }
  }, [showBeforeHours, showAfterHours, getOperatingHoursTop, getOperatingHoursBottom])
  
  // Handler para controlar o scroll e bloquear áreas não expandidas
  const handleCalendarScroll = (e) => {
    const scrollContainer = e.target
    if (!scrollContainer) return
    
    const scrollTop = scrollContainer.scrollTop
    const scrollHeight = scrollContainer.scrollHeight
    const clientHeight = scrollContainer.clientHeight
    
    // Calcular limites de scroll baseado no estado dos botões
    let minScrollTop = 0
    let maxScrollTop = scrollHeight - clientHeight
    
    // Se showBeforeHours está false, não permitir scroll acima do início do horário padrão
    if (!showBeforeHours) {
      minScrollTop = getOperatingHoursTop
    }
    
    // Se showAfterHours está false, não permitir scroll abaixo do fim do horário padrão
    if (!showAfterHours) {
      maxScrollTop = Math.max(0, getOperatingHoursBottom - clientHeight)
    }
    
    // Se o scroll está fora dos limites permitidos, forçar de volta
    if (scrollTop < minScrollTop) {
      scrollContainer.scrollTop = minScrollTop
    } else if (scrollTop > maxScrollTop) {
      scrollContainer.scrollTop = maxScrollTop
    }
  }
  
  // Ajustar scroll quando os botões são clicados para expandir/recolher
  useEffect(() => {
    if (!calendarScrollRef.current) return
    
    const scrollContainer = calendarScrollRef.current
    const scrollTop = scrollContainer.scrollTop
    const clientHeight = scrollContainer.clientHeight
    
    // Se recolheu horários anteriores, garantir que não está acima do início do horário padrão
    if (!showBeforeHours && scrollTop < getOperatingHoursTop) {
      scrollContainer.scrollTop = getOperatingHoursTop
    }
    
    // Se recolheu horários posteriores, garantir que não está abaixo do fim do horário padrão
    if (!showAfterHours) {
      const maxScrollTop = Math.max(0, getOperatingHoursBottom - clientHeight)
      if (scrollTop > maxScrollTop) {
        scrollContainer.scrollTop = maxScrollTop
      }
    }
  }, [showBeforeHours, showAfterHours, getOperatingHoursTop, getOperatingHoursBottom])

  const stats = useMemo(() => {
    const dayApps = dayAppointments
    
    return {
      total: dayApps.length,
      scheduled: dayApps.filter(a => a.status === 'scheduled' || a.status === 'rescheduled').length,
      checkedIn: dayApps.filter(a => {
        if (a.status !== 'checked_in') return false
        if (!a.check_in_time) return false
        const checkInDate = new Date(a.check_in_time).toISOString().split('T')[0]
        return checkInDate === currentDateISO
      }).length,
      checkedOut: dayApps.filter(a => {
        // Finalizados do Dia: agendamentos que foram agendados para aquele dia E foram finalizados
        // Considera apenas agendamentos do dia (date) que têm status checked_out
        return a.status === 'checked_out'
      }).length
    }
  }, [dayAppointments, currentDateISO])

  const handleFilterClick = (filter) => {
    if (activeFilter === filter) {
      setActiveFilter('all')
    } else {
      setActiveFilter(filter)
    }
  }

  // Tela de Usuários - Apenas para administradores
  if (showUsersScreen) {
    // Bloquear acesso se não for admin
    if (user?.role !== 'admin') {
      return (
        <div className="max-w-7xl mx-auto space-y-6 p-6">
          <Alert variant="destructive">
            <AlertDescription>
              Acesso negado. Apenas administradores podem acessar a funcionalidade de Usuários.
            </AlertDescription>
          </Alert>
          <Button onClick={() => setShowUsersScreen(false)} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>
      )
    }
    return (
      <UsersScreen
        onBack={() => {
          setShowUsersScreen(false)
        }}
      />
    )
  }

  // Tela de Configurar Horários
  if (showUnifiedScheduleConfig) {
    // Se não tiver permissão, mostrar mensagem em vez de tela em branco
    if (!hasViewPermission('configure_plant_hours')) {
      return (
        <div className="max-w-7xl mx-auto space-y-6 p-6">
          <Alert variant="destructive">
            <AlertDescription>
              Você não possui permissão para acessar esta funcionalidade.
            </AlertDescription>
          </Alert>
          <Button onClick={() => {
            setShowUnifiedScheduleConfig(false)
            setSelectedPlantForSchedule(null)
          }} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>
      )
    }
    return (
      <UnifiedScheduleConfig
        plantId={selectedPlantForSchedule?.id}
        plantName={selectedPlantForSchedule?.name}
        user={user}
        onBack={() => {
          setShowUnifiedScheduleConfig(false)
          setSelectedPlantForSchedule(null)
        }}
      />
    )
  }

  // Tela de Plantas
  // REGRA DE NEGÓCIO: Bloquear acesso se não tiver permissão viewer
  if (showPlantsScreen) {
    if (!hasPermission('view_plants', 'viewer')) {
      return (
        <div className="max-w-7xl mx-auto space-y-6 p-6">
          <Alert variant="destructive">
            <AlertDescription>
              Você não possui permissão para acessar esta funcionalidade.
            </AlertDescription>
          </Alert>
          <Button onClick={() => setShowPlantsScreen(false)} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>
      )
    }
    return (
      <div className="max-w-7xl mx-auto space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Plantas</h1>
            <p className="text-gray-600">Gerencie as plantas cadastradas no sistema</p>
          </div>
          <Button onClick={() => setShowPlantsScreen(false)} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>

        {hasPermission('create_plant', 'editor') && (
          <div className="flex justify-end">
            <Button 
              onClick={() => setShowPlantForm(true)} 
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nova Planta
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Clock className="w-6 h-6 animate-spin mr-2" />
            Carregando plantas...
          </div>
        ) : !Array.isArray(plants) || plants.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Nenhuma planta cadastrada</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plants.map((plant) => (
              <Card key={plant.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      {plant.name}
                    </div>
                    <Badge className={plant.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {plant.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {plant.code && `Código: ${plant.code}`}
                    {plant.cnpj && ` • CNPJ: ${plant.cnpj}`}
                    {plant.email && ` • ${plant.email}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {plant.street && (
                      <p className="text-xs text-gray-600">
                        {plant.street}
                        {plant.number && `, ${plant.number}`}
                        {plant.neighborhood && ` - ${plant.neighborhood}`}
                      </p>
                    )}
                    {plant.phone && (
                      <p className="text-xs text-gray-600">
                        Telefone: {plant.phone}
                      </p>
                    )}
                    
                    <div className="flex gap-2">
                      {hasViewPermission('edit_plant') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleManagePlant(plant)}
                          className="flex items-center gap-1 text-xs"
                        >
                          <Edit className="w-3 h-3" />
                          Gerenciar
                        </Button>
                      )}
                      {hasViewPermission('configure_plant_hours') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedPlantForSchedule(plant)
                            setShowUnifiedScheduleConfig(true)
                          }}
                          className="flex items-center gap-1 text-xs"
                        >
                          <Clock className="w-3 h-3" />
                          Configurar Horários
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {showPlantForm && hasPermission('create_plant', 'editor') && (
          <PlantForm
            onCancel={() => setShowPlantForm(false)}
            onSubmit={handlePlantFormSubmit}
          />
        )}

        {showPlantManagement && managingPlant && (
          <PlantManagement
            plant={managingPlant}
            onBack={() => {
              setShowPlantManagement(false)
              setManagingPlant(null)
              loadPlants()
            }}
            onUpdate={handlePlantManagementUpdate}
            user={user}
            permissionType={getPermissionType('edit_plant') || 'viewer'}
          />
        )}
      </div>
    )
  }

  // Tela de Fornecedores
  // REGRA DE NEGÓCIO: Bloquear acesso se não tiver permissão viewer
  if (showSuppliersScreen) {
    if (!hasPermission('view_suppliers', 'viewer')) {
      return (
        <div className="max-w-7xl mx-auto space-y-6 p-6">
          <Alert variant="destructive">
            <AlertDescription>
              Você não possui permissão para acessar esta funcionalidade.
            </AlertDescription>
          </Alert>
          <Button onClick={() => setShowSuppliersScreen(false)} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>
      )
    }
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fornecedores</h1>
            <p className="text-gray-600">Gerencie os fornecedores cadastrados no sistema</p>
          </div>
          <Button onClick={() => setShowSuppliersScreen(false)} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>

        {hasPermission('create_supplier', 'editor') && (
          <div className="flex justify-end">
            <Button onClick={() => setShowSupplierForm(true)} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Novo Fornecedor
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Clock className="w-6 h-6 animate-spin mr-2" />
            Carregando fornecedores...
          </div>
        ) : suppliers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Nenhum fornecedor cadastrado</p>
              {hasPermission('create_supplier', 'editor') && (
                <Button onClick={() => setShowSupplierForm(true)} variant="outline" className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar primeiro fornecedor
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map((supplier) => (
              <Card key={supplier.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      {supplier.description}
                    </div>
                    <Badge className={supplier.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {supplier.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    CNPJ: {supplier.cnpj}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-xs text-gray-600">
                      Agendamentos hoje: {appointments.filter(a => a.supplier_id === supplier.id && getDateString(a.date) === currentDateISO).length}
                    </p>
                    
                    {hasViewPermission('edit_supplier') && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleManageSupplier(supplier)}
                          className="flex items-center gap-1 text-xs"
                        >
                          <Edit className="w-3 h-3" />
                          Gerenciar
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {showSupplierForm && hasPermission('create_supplier', 'editor') && (
          <SupplierForm
            onCancel={() => setShowSupplierForm(false)}
            onSubmit={handleSupplierFormSubmit}
          />
        )}

        {showSupplierManagement && hasViewPermission('edit_supplier') && (
          <SupplierManagement
            supplier={managingSupplier}
            onBack={() => setShowSupplierManagement(false)}
            onUpdate={handleSupplierManagementUpdate}
            user={user}
          />
        )}
      </div>
    )
  }

  if (showSupplierForm && !showSuppliersScreen && hasPermission('create_supplier', 'editor')) {
    return (
      <SupplierForm
        onSubmit={handleSupplierFormSubmit}
        onCancel={() => setShowSupplierForm(false)}
      />
    )
  }

  if (showAppointmentForm && editingAppointment) {
    return (
      <AppointmentEditForm
        appointment={editingAppointment}
        suppliers={suppliers}
        plants={plants}
        onSubmit={handleAppointmentFormSubmit}
        onCancel={() => {
          setShowAppointmentForm(false)
          setEditingAppointment(null)
        }}
        user={user}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {plantInfo ? `Portaria - ${plantInfo.name}` : 'Portaria'}
          </h1>
          <p className="text-gray-600">Gerencie fornecedores e agendamentos</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Estatísticas - Cards Filtráveis do Dia */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in duration-300">
        <Card 
          className={`cursor-pointer transition-all hover:shadow-lg ${
            activeFilter === 'all' ? 'ring-2 ring-blue-500 shadow-lg' : 'hover:ring-1 hover:ring-gray-300'
          }`}
          onClick={() => handleFilterClick('all')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleFilterClick('all')
            }
          }}
          aria-label="Filtrar: Total do Dia"
          aria-pressed={activeFilter === 'all'}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Total do Dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600 transition-all duration-300">{stats.total}</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-lg ${
            activeFilter === 'scheduled' ? 'ring-2 ring-orange-500 shadow-lg' : 'hover:ring-1 hover:ring-gray-300'
          }`}
          onClick={() => handleFilterClick('scheduled')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleFilterClick('scheduled')
            }
          }}
          aria-label="Filtrar: Agendados do Dia"
          aria-pressed={activeFilter === 'scheduled'}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Agendados do Dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600 transition-all duration-300">{stats.scheduled}</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-lg ${
            activeFilter === 'checked_in' ? 'ring-2 ring-yellow-500 shadow-lg' : 'hover:ring-1 hover:ring-gray-300'
          }`}
          onClick={() => handleFilterClick('checked_in')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleFilterClick('checked_in')
            }
          }}
          aria-label="Filtrar: Em Check-in"
          aria-pressed={activeFilter === 'checked_in'}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <LogIn className="w-4 h-4" />
              Em Check-in
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600 transition-all duration-300">{stats.checkedIn}</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-lg ${
            activeFilter === 'checked_out' ? 'ring-2 ring-green-500 shadow-lg' : 'hover:ring-1 hover:ring-gray-300'
          }`}
          onClick={() => handleFilterClick('checked_out')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleFilterClick('checked_out')
            }
          }}
          aria-label="Filtrar: Finalizados do Dia"
          aria-pressed={activeFilter === 'checked_out'}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Finalizados do Dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600 transition-all duration-300">{stats.checkedOut}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={`grid w-full ${hasPermission('view_system_config', 'viewer') ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <TabsTrigger value="appointments">Agendamentos</TabsTrigger>
          {hasPermission('view_system_config', 'viewer') && (
            <TabsTrigger value="suppliers">Configurações</TabsTrigger>
          )}
        </TabsList>

        {/* Tab de Agendamentos */}
        <TabsContent value="appointments" className="space-y-4">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <Button variant="outline" size="sm" onClick={handlePreviousDay}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  
                  <div className="flex-1 flex items-center justify-center gap-3">
                    <Input
                      type="date"
                      value={dateUtils.toISODate(currentDate)}
                      onChange={(e) => handleDateChange(e.target.value)}
                      className="max-w-xs"
                    />
                    <div className="text-center">
                      <CardTitle className="text-lg">
                        {dateUtils.getDayName(currentDate)} - {dateUtils.formatDate(currentDate)}
                      </CardTitle>
                      {dateUtils.isToday(currentDate) && (
                        <p className="text-xs text-[#FF6B35] mt-1 font-medium">Hoje</p>
                      )}
                    </div>
                  </div>

                  <Button variant="outline" size="sm" onClick={handleNextDay}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>

          </div>

          {/* Visualização Tipo Agenda Diária */}
          <>
          <div className="space-y-2">
            {/* Linha com botões: Novo Agendamento à esquerda e Mostrar horários anteriores próximo ao calendário */}
            <div className="flex items-center justify-between gap-4">
              {/* Botão Novo Agendamento - À ESQUERDA */}
              {hasPermission('create_appointment', 'editor') && (
                <Button
                  onClick={() => {
                    setEditingAppointment({
                      date: currentDateISO
                    })
                    setShowAppointmentForm(true)
                  }}
                  className="bg-[#FF6B35] hover:bg-[#E55A2B] text-white shadow-lg hover:shadow-xl transition-all duration-200 px-8 py-6 text-base font-semibold rounded-lg flex items-center justify-center gap-2"
                  size="lg"
                >
                  <Plus className="w-5 h-5" />
                  <span>Novo Agendamento</span>
                </Button>
              )}
              
              {/* Espaço flexível no meio */}
              <div className="flex-1"></div>
              
              {/* Botão para expandir horários anteriores - PRÓXIMO À DIVISA DO CALENDÁRIO */}
              {hasHoursBefore && !showBeforeHours && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBeforeHours(true)}
                  className="shadow-md hover:shadow-lg transition-shadow"
                >
                  <ChevronUp className="w-4 h-4 mr-2" />
                  Mostrar horário (00:00 - {operatingHours.start || '00:00'})
                </Button>
              )}
              
              {/* Botão para recolher horários anteriores */}
              {hasHoursBefore && showBeforeHours && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBeforeHours(false)}
                  className="shadow-md hover:shadow-lg transition-shadow"
                >
                  <ChevronDown className="w-4 h-4 mr-2" />
                  Ocultar horário (00:00 - {operatingHours.start || '00:00'})
                </Button>
              )}
            </div>

          <Card className="overflow-hidden">
            <div className="h-[calc(100vh-450px)] min-h-[500px] overflow-x-auto">
              {/* Container com scroll - aproveitando todo o espaço */}
              <div 
                ref={(el) => {
                  calendarScrollRef.current = el
                  // Scroll inicial para o início do horário padrão quando carregar (sempre, já que ambos vêm ocultos por padrão)
                  if (el && !showBeforeHours && !showAfterHours) {
                    setTimeout(() => {
                      el.scrollTop = getOperatingHoursTop
                    }, 100)
                  }
                }}
                className="overflow-y-auto overflow-x-hidden w-full"
                style={{ height: '100%' }}
                onScroll={handleCalendarScroll}
                onTouchMove={(e) => {
                  // Prevenir scroll touch quando os botões estão ocultos
                  const scrollContainer = e.currentTarget
                  if (!scrollContainer) return
                  
                  const scrollTop = scrollContainer.scrollTop
                  const scrollHeight = scrollContainer.scrollHeight
                  const clientHeight = scrollContainer.clientHeight
                  
                  let minScrollTop = 0
                  let maxScrollTop = scrollHeight - clientHeight
                  
                  if (!showBeforeHours) {
                    minScrollTop = getOperatingHoursTop
                  }
                  
                  if (!showAfterHours) {
                    maxScrollTop = Math.max(0, getOperatingHoursBottom - clientHeight)
                  }
                  
                  if (scrollTop < minScrollTop || scrollTop > maxScrollTop) {
                    e.preventDefault()
                  }
                }}
              >
              <div className="hidden md:flex relative" style={{ minHeight: `${timelineHeight}px`, minWidth: maxCapacity >= 5 ? `${maxCapacity * 200}px` : '100%' }}>
                {/* Coluna de Horários */}
                <div className="w-24 flex-shrink-0 bg-gray-50 border-r border-gray-200 relative sticky left-0 z-10" style={{ minHeight: `${timelineHeight}px` }}>
                  {Array.from({ length: 24 }, (_, i) => {
                    const hour = i
                    const top = i * HOUR_HEIGHT
                    return (
                      <div
                        key={`time-guide-${hour}`}
                        className="absolute left-0 right-0 border-b border-gray-200"
                        style={{ top: `${top}px`, height: `${HOUR_HEIGHT}px` }}
                      >
                        <div className="p-2 h-full flex items-start justify-end pr-3">
                          <span className="font-semibold text-sm text-gray-700">{hour.toString().padStart(2, '0')}:00</span>
                        </div>
                      </div>
                    )
                  })}
                  
                  {Array.from({ length: 48 }, (_, i) => {
                    const hour = Math.floor(i / 2)
                    const isHalfHour = i % 2 === 1
                    const top = hour * HOUR_HEIGHT + (isHalfHour ? HOUR_HEIGHT / 2 : 0)
                    if (isHalfHour) {
                      return (
                        <div
                          key={`time-half-${i}`}
                          className="absolute left-0 right-0 border-b border-dashed border-gray-200"
                          style={{ top: `${top}px`, height: `${HOUR_HEIGHT / 2}px` }}
                        >
                          <div className="p-1 h-full flex items-start justify-end pr-2">
                            <span className="text-xs text-gray-400">{hour.toString().padStart(2, '0')}:30</span>
                          </div>
                        </div>
                      )
                    }
                    return null
                  })}
                </div>

                {/* Área de Colunas de Agendamentos */}
                <div 
                  className="flex-1 relative"
                  style={{ 
                    minHeight: `${timelineHeight}px`,
                    display: 'grid',
                    gridTemplateColumns: `repeat(${Math.max(1, maxCapacity)}, ${maxCapacity >= 5 ? '200px' : '1fr'})`,
                    gap: '4px',
                    padding: '4px',
                    minWidth: maxCapacity >= 5 ? `${maxCapacity * 200}px` : 'auto'
                  }}
                >
                  {Array.from({ length: Math.max(1, maxCapacity) }, (_, colIndex) => (
                    <div 
                      key={`column-${colIndex}`}
                      className="relative border-r border-gray-200/50 last:border-r-0"
                      style={{ minHeight: `${timelineHeight}px`, position: 'relative' }}
                    >
                      <div className="absolute inset-0 bg-gray-50/30 pointer-events-none" />
                      
                      {/* Linhas de guia - renderizadas primeiro com pointer-events-none */}
                      {Array.from({ length: 24 }, (_, i) => {
                        const hour = i
                        const top = i * HOUR_HEIGHT
                        return (
                          <div
                            key={`guide-col-${colIndex}-${hour}`}
                            className="absolute left-0 right-0 border-b border-gray-200"
                            style={{ top: `${top}px`, height: `${HOUR_HEIGHT}px`, pointerEvents: 'none', zIndex: 1 }}
                          />
                        )
                      })}
                      
                      {Array.from({ length: 48 }, (_, i) => {
                        const hour = Math.floor(i / 2)
                        const isHalfHour = i % 2 === 1
                        const top = hour * HOUR_HEIGHT + (isHalfHour ? HOUR_HEIGHT / 2 : 0)
                        return (
                          <div
                            key={`guide-half-col-${colIndex}-${i}`}
                            className="absolute left-0 right-0 border-b border-dashed border-gray-100"
                            style={{ top: `${top}px`, height: `${HOUR_HEIGHT / 2}px`, pointerEvents: 'none', zIndex: 1 }}
                          />
                        )
                      })}
                      
                      {/* Áreas clicáveis vazias em todas as colunas - slots de 30 minutos - renderizadas depois para ficarem acima */}
                      {hasPermission('create_appointment', 'editor') && Array.from({ length: 48 }, (_, i) => {
                        const hour = Math.floor(i / 2)
                        const isHalfHour = i % 2 === 1
                        const top = hour * HOUR_HEIGHT + (isHalfHour ? HOUR_HEIGHT / 2 : 0)
                        const timeString = `${hour.toString().padStart(2, '0')}:${isHalfHour ? '30' : '00'}`
                        
                        // Verificar se a coluna está dentro da capacidade máxima
                        const isWithinCapacity = colIndex < maxCapacity
                        
                        // Verificar se está dentro do horário de funcionamento
                        const isWithinHours = isTimeWithinOperatingHours(timeString)
                        
                        // Verificar se há capacidade disponível nesta coluna
                        const hasCapacity = hasCapacityAvailable(timeString, colIndex)
                        
                        // Verificar se a área está vazia
                        const isEmpty = isAreaEmpty(top, HOUR_HEIGHT / 2, colIndex)
                        
                        // Área clicável apenas se: dentro da capacidade, dentro do funcionamento, tem capacidade, está vazia
                        const isClickable = isWithinCapacity && isWithinHours && hasCapacity && isEmpty
                        
                        return (
                          <div
                            key={`clickable-slot-${colIndex}-${i}`}
                            className={`absolute left-1 right-1 transition-all duration-200 ${
                              isClickable
                                ? 'border-2 border-dashed border-green-400 bg-green-50/40 hover:border-green-500 hover:bg-green-100/60 cursor-pointer group rounded'
                                : 'border-transparent'
                            }`}
                            style={{ 
                              top: `${top + 2}px`, 
                              height: `${HOUR_HEIGHT / 2 - 4}px`,
                              zIndex: isClickable ? 8 : 0, // Acima das linhas de guia (z-index 1), abaixo dos cards (z-index 10+)
                              pointerEvents: isClickable ? 'auto' : 'none'
                            }}
                            onClick={(e) => {
                              e.stopPropagation() // Evitar propagação
                              e.preventDefault() // Prevenir comportamento padrão
                              if (isClickable) {
                                handleEmptyAreaClick(timeString, colIndex)
                              }
                            }}
                            title={
                              isClickable
                                ? `Clique para agendar às ${timeString} (Coluna ${colIndex + 1})`
                                : !isWithinCapacity
                                  ? `Coluna ${colIndex + 1} fora da capacidade máxima (${maxCapacity})`
                                  : !isWithinHours
                                    ? 'Fora do horário de funcionamento'
                                    : !hasCapacity
                                      ? 'Capacidade máxima atingida'
                                      : !isEmpty
                                        ? 'Horário ocupado'
                                        : `Coluna ${colIndex + 1} - Indisponível`
                            }
                          >
                            {isClickable && (
                              <>
                                {/* Texto "Disponível" sempre visível, mas mais sutil */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-40 group-hover:opacity-0 transition-opacity duration-200 pointer-events-none">
                                  <span className="text-[10px] text-green-600 font-medium">Disponível</span>
                                </div>
                                {/* Badge com horário no hover */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                                  <div className="bg-green-500/90 text-white text-xs font-medium px-2 py-1 rounded shadow-lg">
                                    {timeString}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        )
                      })}

                      {appointmentsByColumn[colIndex]?.map((appointment, aptIndex) => {
                          const startTime = dateUtils.formatTime(appointment.time)
                          const top = calculateCardTop(startTime)
                          const height = calculateCardHeight(appointment)
                          const contentLevel = getCardContentLevel(height)
                          const supplierName = suppliers.find(s => s.id === appointment.supplier_id)?.description || appointment.supplier?.description || 'Fornecedor'
                          
                          // Calcular z-index baseado na ordem (cards mais recentes ficam acima)
                          const zIndex = 10 + aptIndex

                          return (
                            <div
                              key={appointment.id}
                              className="absolute"
                              style={{
                                top: `${top}px`,
                                left: '4px',
                                right: '4px',
                                width: 'calc(100% - 8px)',
                                height: `${height}px`,
                                zIndex: zIndex
                              }}
                            >
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Card 
                                className={`h-full w-full bg-white border-l-4 ${getStatusBorderColor(appointment.status)} hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer group`}
                                onClick={() => handleCardClick(appointment)}
                              >
                                <CardContent className="p-2 h-full w-full flex flex-col justify-center">
                                  <div className="flex items-start justify-between gap-1.5">
                                    <div className="flex-1 min-w-0">
                                      {/* Número do agendamento no canto superior esquerdo */}
                                      {appointment.appointment_number && (
                                        <p className="text-xs font-mono font-semibold text-[#FF6B35] truncate leading-tight mb-0.5">
                                          {appointment.appointment_number}
                                        </p>
                                      )}
                                      <CardTitle className="text-sm font-bold text-gray-900 truncate leading-tight">
                                        {supplierName}
                                      </CardTitle>
                                      <p className="text-xs text-gray-500 mt-0.5 leading-tight">
                                        {dateUtils.formatTimeRange(appointment.time, appointment.time_end)}
                                      </p>
                                    </div>
                                    <Badge className={`text-[10px] px-1.5 py-0.5 shrink-0 ${statusUtils.getStatusColor(appointment.status)}`}>
                                      {statusUtils.getStatusLabel(appointment.status)}
                                    </Badge>
                                  </div>
                                  
                                  {contentLevel === 'minimal' ? (
                                    // Cards pequenos não mostram conteúdo adicional
                                    null
                                  ) : contentLevel === 'summary' ? (
                                    <div className="mt-1.5 space-y-0.5 text-xs text-gray-600 overflow-hidden">
                                      <p className="truncate leading-tight">
                                        <span className="font-medium">PO:</span> {appointment.purchase_order}
                                      </p>
                                      <p className="truncate leading-tight">
                                        <span className="font-medium">Placa:</span> {appointment.truck_plate}
                                      </p>
                                      {appointment.status === 'rescheduled' && appointment.motivo_reagendamento && (
                                        <p className="truncate leading-tight text-purple-600 italic text-[10px]">
                                          <span className="font-medium">Motivo:</span> {appointment.motivo_reagendamento}
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="mt-1.5 space-y-0.5 text-xs text-gray-600 overflow-hidden">
                                      <p className="truncate leading-tight">
                                        <span className="font-medium">PO:</span> {appointment.purchase_order}
                                      </p>
                                      <p className="truncate leading-tight">
                                        <span className="font-medium">Placa:</span> {appointment.truck_plate}
                                      </p>
                                      {appointment.driver_name && (
                                        <p className="truncate leading-tight">
                                          <span className="font-medium">Motorista:</span> {appointment.driver_name}
                                        </p>
                                      )}
                                      {appointment.status === 'rescheduled' && appointment.motivo_reagendamento && (
                                        <p className="truncate leading-tight text-purple-600 italic">
                                          <span className="font-medium">Motivo:</span> {appointment.motivo_reagendamento}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs p-3">
                              <div className="space-y-2">
                                <div>
                                  <p className="font-semibold text-sm">{supplierName}</p>
                                  <p className="text-xs text-gray-500 mt-0.5">{dateUtils.formatTimeRange(appointment.time, appointment.time_end)}</p>
                                </div>
                                <div className="space-y-1 text-xs border-t pt-2">
                                  {appointment.appointment_number && (
                                    <p className="font-mono text-[#FF6B35]">
                                      <span className="font-medium">Nº:</span> {appointment.appointment_number}
                                    </p>
                                  )}
                                  <p><span className="font-medium">PO:</span> {appointment.purchase_order}</p>
                                  <p><span className="font-medium">Placa:</span> {appointment.truck_plate}</p>
                                  {appointment.driver_name && (
                                    <p><span className="font-medium">Motorista:</span> {appointment.driver_name}</p>
                                  )}
                                  {appointment.status === 'rescheduled' && appointment.motivo_reagendamento && (
                                    <div className="mt-2 pt-2 border-t border-purple-200">
                                      <p className="font-medium text-purple-700">Motivo do Reagendamento:</p>
                                      <p className="text-purple-600 italic">{appointment.motivo_reagendamento}</p>
                                    </div>
                                  )}
                                  <p className="text-gray-500 mt-1">Clique para ver detalhes completos</p>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        
                        <div className="absolute bottom-1 right-1 flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity z-20">
                          <TooltipProvider>
                            {(appointment.status !== 'checked_in' && appointment.status !== 'checked_out') && hasPermission('edit_appointment', 'editor') && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 hover:bg-gray-200/70 hover:scale-110 transition-all bg-white/80 backdrop-blur-sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleEditAppointment(appointment)
                                  }}
                                  aria-label="Editar"
                                >
                                  <Edit className="w-3.5 h-3.5 text-gray-700" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Editar agendamento</TooltipContent>
                            </Tooltip>
                            )}
                            
                            {(appointment.status !== 'checked_in' && appointment.status !== 'checked_out') && hasPermission('delete_appointment', 'editor') && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 hover:bg-red-100 hover:scale-110 transition-all bg-white/80 backdrop-blur-sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDeleteAppointment(appointment.id)
                                    }}
                                    aria-label="Excluir"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Excluir agendamento</TooltipContent>
                              </Tooltip>
                            )}
                            
                            {(appointment.status === 'scheduled' || appointment.status === 'rescheduled') && hasPermission('check_in', 'editor') && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 hover:bg-green-100 hover:scale-110 transition-all bg-white/80 backdrop-blur-sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleCheckIn(appointment.id)
                                    }}
                                    aria-label="Check-in"
                                  >
                                    <LogIn className="w-3.5 h-3.5 text-green-600" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Realizar check-in</TooltipContent>
                              </Tooltip>
                            )}
                            
                            {appointment.status === 'checked_in' && hasPermission('check_out', 'editor') && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 hover:bg-blue-100 hover:scale-110 transition-all bg-white/80 backdrop-blur-sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleCheckOut(appointment.id)
                                    }}
                                    aria-label="Check-out"
                                  >
                                    <LogOut className="w-3.5 h-3.5 text-[#FF6B35]" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Realizar check-out</TooltipContent>
                              </Tooltip>
                            )}
                          </TooltipProvider>
                        </div>
                      </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Versão Mobile */}
              <div className="md:hidden space-y-4 p-4">
                {dayAppointments
                  .sort((a, b) => {
                    const timeA = dateUtils.formatTime(a.time)
                    const timeB = dateUtils.formatTime(b.time)
                    return timeA.localeCompare(timeB)
                  })
                  .map((appointment) => {
                    const startTime = dateUtils.formatTime(appointment.time)
                    const slotAppointments = appointmentsByTime[startTime] || []
                    const isAtCapacity = slotAppointments.length >= maxCapacity
                    const isFirstInSlot = slotAppointments[0]?.id === appointment.id
                    
                    return (
                      <div key={`mobile-${appointment.id}`}>
                        {isFirstInSlot && (
                          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-base text-gray-900">{startTime}</span>
                              <Badge variant="outline" className="text-xs">
                                {slotAppointments.length}/{maxCapacity}
                              </Badge>
                              {isAtCapacity && (
                                <Badge variant="destructive" className="text-xs">
                                  Máx.
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                        
                        <div className={isFirstInSlot ? '' : 'mt-2'}>
                          <Card 
                            key={`mobile-appt-${appointment.id}`}
                            className="bg-white border-l-4 border-l-blue-500 hover:border-l-blue-600 shadow-md"
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex-1 min-w-0">
                                  <CardTitle className="text-sm font-semibold text-gray-900 truncate">
                                    {suppliers.find(s => s.id === appointment.supplier_id)?.description || appointment.supplier?.description || 'Fornecedor'}
                                  </CardTitle>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {dateUtils.formatTimeRange(appointment.time, appointment.time_end)}
                                  </p>
                                  {appointment.appointment_number && (
                                    <p className="text-xs font-mono text-[#FF6B35] mt-0.5">
                                      Nº: {appointment.appointment_number}
                                    </p>
                                  )}
                                </div>
                                <Badge className={`text-[10px] px-1.5 py-0 shrink-0 ${statusUtils.getStatusColor(appointment.status)}`}>
                                  {statusUtils.getStatusLabel(appointment.status)}
                                </Badge>
                              </div>
                              
                              <div className="space-y-1 text-xs text-gray-600 mb-3">
                                {appointment.appointment_number && (
                                  <p className="truncate font-mono text-[#FF6B35]">
                                    <span className="font-medium">Nº:</span> {appointment.appointment_number}
                                  </p>
                                )}
                                <p className="truncate">
                                  <span className="font-medium">PO:</span> {appointment.purchase_order}
                                </p>
                                <p className="truncate">
                                  <span className="font-medium">Placa:</span> {appointment.truck_plate}
                                </p>
                                <p className="truncate">
                                  <span className="font-medium">Motorista:</span> {appointment.driver_name}
                                </p>
                              </div>

                              <div className="flex items-center justify-end gap-1 pt-2 border-t border-gray-100">
                                {(appointment.status !== 'checked_in' && appointment.status !== 'checked_out') && (
                                  <>
                                {hasPermission('edit_appointment', 'editor') && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    onClick={() => handleEditAppointment(appointment)}
                                    title="Editar"
                                  >
                                    <Edit className="w-4 h-4 text-gray-600" />
                                  </Button>
                                )}
                                
                                  {hasPermission('delete_appointment', 'editor') && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      onClick={() => handleDeleteAppointment(appointment.id)}
                                      title="Excluir"
                                    >
                                      <Trash2 className="w-4 h-4 text-red-600" />
                                    </Button>
                                  )}
                                  </>
                                )}
                                
                                {(appointment.status === 'scheduled' || appointment.status === 'rescheduled') && hasPermission('check_in', 'editor') && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    onClick={() => handleCheckIn(appointment.id)}
                                    title="Check-in"
                                  >
                                    <LogIn className="w-4 h-4 text-green-600" />
                                  </Button>
                                )}
                                
                                {appointment.status === 'checked_in' && hasPermission('check_out', 'editor') && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    onClick={() => handleCheckOut(appointment.id)}
                                    title="Check-out"
                                  >
                                    <LogOut className="w-4 h-4 text-[#FF6B35]" />
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </Card>

          {/* Botão para expandir horários posteriores - ABAIXO do calendário */}
          {hasHoursAfter && !showAfterHours && (
            <div className="flex justify-end py-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAfterHours(true)}
                className="shadow-md hover:shadow-lg transition-shadow"
              >
                <ChevronDown className="w-4 h-4 mr-2" />
                Mostrar horário ({operatingHours.end || '23:59'} - 23:59)
              </Button>
            </div>
          )}
          
          {/* Botão para recolher horários posteriores - ABAIXO do calendário */}
          {hasHoursAfter && showAfterHours && (
            <div className="flex justify-end py-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAfterHours(false)}
                className="shadow-md hover:shadow-lg transition-shadow"
              >
                <ChevronUp className="w-4 h-4 mr-2" />
                Ocultar horário ({operatingHours.end || '23:59'} - 23:59)
              </Button>
            </div>
          )}
          </div>
          </>
        </TabsContent>

        {/* Tab de Configurações */}
        {hasPermission('view_system_config', 'viewer') && (
        <TabsContent value="suppliers" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Configurações</h2>
          </div>

          {/* Botões de Acesso Rápido */}
          {permissionsLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="w-6 h-6 animate-spin mx-auto mb-2" />
                <p className="text-gray-600">Carregando configurações...</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {(() => {
                // Contar quantas opções estão disponíveis
                const availableOptions = [
                  hasPermission('view_suppliers', 'viewer'),
                  hasPermission('view_plants', 'viewer'),
                  user?.role === 'admin'
                ].filter(Boolean).length
                
                // Se houver apenas 2 opções e não for admin, usar layout expandido
                const isExpandedLayout = availableOptions === 2 && user?.role !== 'admin'
                
                return (
                  <div className={isExpandedLayout 
                    ? "grid grid-cols-1 md:grid-cols-2 gap-6" 
                    : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
                  }>
                    {hasPermission('view_suppliers', 'viewer') && (
                      <Button 
                        variant="outline"
                        className={isExpandedLayout
                          ? "h-40 flex flex-col items-center justify-center gap-3 hover:shadow-lg transition-shadow"
                          : "h-24 flex flex-col items-center justify-center gap-2"
                        }
                        onClick={() => setShowSuppliersScreen(true)}
                      >
                        <Users className={isExpandedLayout ? "w-10 h-10" : "w-6 h-6"} />
                        <span className={isExpandedLayout ? "font-semibold text-lg" : "font-medium"}>Fornecedores</span>
                      </Button>
                    )}
                    {hasPermission('view_plants', 'viewer') && (
                      <Button
                        variant="outline"
                        className={isExpandedLayout
                          ? "h-40 flex flex-col items-center justify-center gap-3 hover:shadow-lg transition-shadow"
                          : "h-24 flex flex-col items-center justify-center gap-2"
                        }
                        onClick={() => setShowPlantsScreen(true)}
                      >
                        <Building2 className={isExpandedLayout ? "w-10 h-10" : "w-6 h-6"} />
                        <span className={isExpandedLayout ? "font-semibold text-lg" : "font-medium"}>Plantas</span>
                      </Button>
                    )}
                    {user?.role === 'admin' && (
                      <Button
                        variant="outline"
                        className="h-24 flex flex-col items-center justify-center gap-2"
                        onClick={() => setShowUsersScreen(true)}
                      >
                        <Users className="w-6 h-6" />
                        <span className="font-medium">Usuários</span>
                      </Button>
                    )}
                  </div>
                )
              })()}

              {/* Mensagem quando não há opções disponíveis */}
              {!hasPermission('view_suppliers', 'viewer') &&
               !hasPermission('view_plants', 'viewer') &&
               user?.role !== 'admin' &&
               !hasPermission('view_system_config', 'viewer') && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Você não tem permissão para acessar nenhuma configuração.</p>
                    <p className="text-sm text-gray-500 mt-2">Entre em contato com o administrador do sistema.</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
        )}
      </Tabs>

      {loading && (
        <div className="text-center py-8">
          <p className="text-gray-600">Carregando...</p>
        </div>
      )}

      {/* Drawer para visualização completa do agendamento */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[90vh]">
          {selectedAppointment && (
            <>
              <DrawerHeader>
                <DrawerTitle className="text-xl">
                  {suppliers.find(s => s.id === selectedAppointment.supplier_id)?.description || selectedAppointment.supplier?.description || 'Fornecedor'}
                </DrawerTitle>
                <DrawerDescription>
                  Detalhes completos do agendamento
                </DrawerDescription>
              </DrawerHeader>
              
              <div className="px-4 pb-4 overflow-y-auto">
                <div className="space-y-4">
                  {selectedAppointment.appointment_number && (
                    <div className="pb-4 border-b">
                      <Label className="text-xs text-gray-500">Número do Agendamento</Label>
                      <p className="text-sm font-medium font-mono text-[#FF6B35]">
                        {selectedAppointment.appointment_number}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-gray-500">Data</Label>
                      <p className="text-sm font-medium">
                        {dateUtils.formatDate(selectedAppointment.date)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Horário</Label>
                      <p className="text-sm font-medium">
                        {dateUtils.formatTimeRange(selectedAppointment.time, selectedAppointment.time_end)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Status</Label>
                      <Badge className={`mt-1 ${statusUtils.getStatusColor(selectedAppointment.status)}`}>
                        {statusUtils.getStatusLabel(selectedAppointment.status)}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Fornecedor</Label>
                      <p className="text-sm font-medium">
                        {suppliers.find(s => s.id === selectedAppointment.supplier_id)?.description || selectedAppointment.supplier?.description || 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-3">
                    <div>
                      <Label className="text-xs text-gray-500">Pedido de Compra (PO)</Label>
                      <p className="text-sm font-medium">{selectedAppointment.purchase_order}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Placa do Caminhão</Label>
                      <p className="text-sm font-medium">{selectedAppointment.truck_plate}</p>
                    </div>
                    {selectedAppointment.driver_name && (
                      <div>
                        <Label className="text-xs text-gray-500">Nome do Motorista</Label>
                        <p className="text-sm font-medium">{selectedAppointment.driver_name}</p>
                      </div>
                    )}
                    {selectedAppointment.status === 'rescheduled' && selectedAppointment.motivo_reagendamento && (
                      <div className="border-t pt-4 mt-4">
                        <Label className="text-xs text-purple-600 font-semibold">Motivo do Reagendamento</Label>
                        <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-md">
                          <p className="text-sm text-purple-700 italic">{selectedAppointment.motivo_reagendamento}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <DrawerFooter className="flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDrawerOpen(false)}
                  className="flex-1"
                >
                  Fechar
                </Button>
                {(selectedAppointment.status !== 'checked_in' && selectedAppointment.status !== 'checked_out') && hasPermission('edit_appointment', 'editor') && (
                <Button
                  variant="default"
                  onClick={() => {
                    setDrawerOpen(false)
                    handleEditAppointment(selectedAppointment)
                  }}
                  className="flex-1"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Editar
                </Button>
                )}
                {(selectedAppointment.status === 'scheduled' || selectedAppointment.status === 'rescheduled') && hasPermission('check_in', 'editor') && (
                  <Button
                    variant="default"
                    onClick={() => {
                      setDrawerOpen(false)
                      handleCheckIn(selectedAppointment.id)
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    Check-in
                  </Button>
                )}
                {selectedAppointment.status === 'checked_in' && hasPermission('check_out', 'editor') && (
                  <Button
                    variant="default"
                    onClick={() => {
                      setDrawerOpen(false)
                      handleCheckOut(selectedAppointment.id)
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Check-out
                  </Button>
                )}
                {(selectedAppointment.status !== 'checked_in' && selectedAppointment.status !== 'checked_out') && hasPermission('delete_appointment', 'editor') && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setDrawerOpen(false)
                      handleDeleteAppointment(selectedAppointment.id)
                    }}
                    className="flex-1"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir
                  </Button>
                )}
              </DrawerFooter>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  )
}

export default PlantDashboard
