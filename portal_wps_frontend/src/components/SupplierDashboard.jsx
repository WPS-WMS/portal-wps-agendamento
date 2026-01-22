import React, { useState, useEffect, useRef, useMemo } from 'react'
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
import { supplierAPI, adminAPI } from '../lib/api'
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
import PlantSelector from './PlantSelector'

// Constante para altura proporcional por hora
const HOUR_HEIGHT = UI_CONFIG.HOUR_HEIGHT

const SupplierDashboard = ({ user, token }) => {
  const { hasPermission, hasViewPermission, getPermissionType, loading: permissionsLoading, permissions } = usePermissions(user)
  
  const [suppliers, setSuppliers] = useState([])
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())
  // Ref para rastrear a última data carregada e evitar chamadas duplicadas
  const lastLoadedDateRef = useRef(null)
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
  // Planta selecionada para visualização de agendamentos
  const [selectedPlantId, setSelectedPlantId] = useState(null)
  // Capacidade máxima calculada dinamicamente baseada nas plantas dos agendamentos
  const [maxCapacity, setMaxCapacity] = useState(1)
  // Mapa de capacidades por planta: { plantId: capacity }
  const [plantCapacities, setPlantCapacities] = useState(new Map())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [showUsersScreen, setShowUsersScreen] = useState(false)

  // Helper para escolher API baseada em permissões
  const getAPI = (resource) => {
    if (hasPermission(`view_${resource}`, 'viewer')) {
      return supplierAPI
    }
    return supplierAPI // Fallback para supplierAPI
  }

  const loadSuppliers = async () => {
    if (!hasPermission('view_suppliers', 'viewer')) {
      setSuppliers([])
      return
    }
    try {
      const data = await supplierAPI.getSuppliers()
      
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
    // IMPORTANTE: Fornecedores sempre precisam visualizar plantas para criar agendamentos
    // O backend permite acesso mesmo sem permissão configurada, então sempre tentar carregar
    if (!user || user.role !== 'supplier') {
      setPlants([])
      return
    }
    
    try {
      const data = await supplierAPI.getPlants()
      
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

  const loadAppointments = async (date, plantId = null) => {
    try {
      setLoading(true)
      // Garantir que date seja válido
      if (!date) {
        date = new Date()
      }
      // Converter para Date se for string
      if (typeof date === 'string') {
        date = new Date(date)
      }
      // Validar se a data é válida
      if (isNaN(date.getTime())) {
        date = new Date()
      }
      // IMPORTANTE: Criar uma cópia da data antes de chamar getWeekStart
      // porque getWeekStart pode modificar o objeto Date original
      const dateCopy = new Date(date.getTime())
      // A API do fornecedor espera o início da semana (week)
      const weekStart = dateUtils.getWeekStart(dateCopy)
      const weekStartISO = dateUtils.toISODate(weekStart)
      
      // Garantir que weekStartISO seja uma string válida
      if (!weekStartISO || typeof weekStartISO !== 'string') {
        throw new Error('Data inválida para carregar agendamentos')
      }
      
      // Usar supplierAPI.getAppointments() que já está configurado com apiClient
      // Passar weekStartISO como primeiro parâmetro (a API vai converter para 'week')
      const data = await supplierAPI.getAppointments(weekStartISO, plantId)
      setAppointments(Array.isArray(data) ? data : [])
      setError('')
    } catch (err) {
      setError('Erro ao carregar agendamentos: ' + (err.response?.data?.error || err.message))
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }


  // Carregar plantas e fornecedores quando o componente montar ou o usuário mudar
  useEffect(() => {
    if (!user || user.role !== 'supplier') {
      return
    }
    
    // Carregar plantas imediatamente (não depende de permissões)
    loadPlants()
    
    // Carregar fornecedores apenas se tiver permissão (ou aguardar permissões carregarem)
    if (!permissionsLoading) {
      loadSuppliers()
    } else {
      // Aguardar permissões carregarem antes de tentar carregar fornecedores
      const timer = setTimeout(() => {
        loadSuppliers()
      }, 500)
      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]) // Executar quando usuário mudar

  // Carregar agendamentos quando a data, aba ou planta selecionada mudar
  useEffect(() => {
    if (!currentDate || isNaN(currentDate.getTime())) {
      return
    }
    
    // Criar uma chave única para a combinação de data, aba e planta
    const dateKey = currentDate.getTime()
    const loadKey = `${dateKey}-${activeTab}-${selectedPlantId || 'none'}`
    
    // Evitar carregar se já foi carregado com os mesmos parâmetros
    if (lastLoadedDateRef.current === loadKey) {
      return
    }
    
    // Atualizar a referência antes de carregar
    lastLoadedDateRef.current = loadKey
    
    // Criar uma cópia da data para garantir que não seja modificada
    const dateToLoad = new Date(currentDate.getTime())
    
    // Carregar agendamentos
    loadAppointments(dateToLoad, selectedPlantId || null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate?.getTime(), activeTab, selectedPlantId])
  
  // Handler para mudança de planta
  const handlePlantChange = (plantId) => {
    setSelectedPlantId(plantId)
    // Manter a data atual, apenas recarregar agendamentos
  }

  // Fallback: Tentar carregar plantas após um delay se ainda não foram carregadas
  useEffect(() => {
    if (!user || user.role !== 'supplier') return
    
    // Se já temos plantas carregadas, não fazer nada
    if (plants.length > 0) return
    
    // Aguardar 2 segundos após a montagem para tentar carregar novamente
    const timer = setTimeout(() => {
      loadPlants()
    }, 2000)
    
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, plants.length]) // Executar quando usuário mudar ou plantas ainda estiverem vazias

  useEffect(() => {
    if (!user || user.role !== 'supplier') return
    
    if (showPlantsScreen) {
      loadPlants()
    }
  }, [showPlantsScreen, user?.id])
  
  useEffect(() => {
    if (!user || user.role !== 'supplier') return
    
    if (showPlantsScreen && !showPlantManagement && !showPlantForm) {
      loadPlants()
    }
  }, [showPlantsScreen, showPlantManagement, showPlantForm, user?.id])

  // Carregar fornecedores quando a tela de fornecedores é aberta
  useEffect(() => {
    if (showSuppliersScreen && hasPermission('view_suppliers', 'viewer')) {
      loadSuppliers()
    }
  }, [showSuppliersScreen, showSupplierForm, showSupplierManagement])

  // Carregar plantas quando o formulário de agendamento é aberto (para criar novo agendamento)
  useEffect(() => {
    if (!user || user.role !== 'supplier') return
    
    if (showAppointmentForm && (!editingAppointment || !editingAppointment.id)) {
      // É um novo agendamento - sempre carregar plantas para garantir que estejam disponíveis
      loadPlants()
    }
  }, [showAppointmentForm, editingAppointment, user?.id])

  const handlePreviousDay = () => {
    if (!currentDate) return
    // Criar nova data sem modificar a original
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const day = currentDate.getDate()
    const newDate = new Date(year, month, day - 1)
    setCurrentDate(newDate)
  }

  const handleNextDay = () => {
    if (!currentDate) return
    // Criar nova data sem modificar a original
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const day = currentDate.getDate()
    const newDate = new Date(year, month, day + 1)
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
      const result = await supplierAPI.checkIn(appointmentId)
      const dateToLoad = currentDate instanceof Date ? currentDate : new Date(currentDate)
      await loadAppointments(dateToLoad, selectedPlantId)
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
      const result = await supplierAPI.checkOut(appointmentId)
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
    await loadAppointments(currentDate, selectedPlantId)
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
      const data = await supplierAPI.getPlants()
      if (Array.isArray(data)) {
        setPlants(data)
        if (managingPlant) {
          const updatedPlant = data.find(p => p.id === managingPlant.id)
          if (updatedPlant) {
            setManagingPlant(updatedPlant)
          }
        }
      }
    } catch (err) {
      await loadPlants()
    }
  }

  const handleDeleteAppointment = async (appointmentId) => {
    if (!hasPermission('delete_appointment', 'editor')) {
      setError('Você não tem permissão para excluir agendamentos')
      return
    }
    
    if (!confirm('Tem certeza que deseja excluir este agendamento?')) {
      return
    }

    try {
      // Chamar a API primeiro antes de atualizar a UI
      await supplierAPI.deleteAppointment(appointmentId)
      
      // Verificar se a resposta indica sucesso (mesmo que vazia)
      // Status 200-299 são considerados sucesso pelo axios
      
      // Remover o agendamento da lista após confirmação do backend
      setAppointments(prev => prev.filter(apt => apt.id !== appointmentId))
      
      // Fechar drawer se estiver aberto com o agendamento excluído
      if (selectedAppointment && selectedAppointment.id === appointmentId) {
        setDrawerOpen(false)
        setSelectedAppointment(null)
      }
      
      // Recarregar agendamentos para garantir sincronização com o backend
      await loadAppointments(currentDate, selectedPlantId)
    } catch (err) {
      // Se houver erro, recarregar a lista para restaurar o estado correto
      await loadAppointments(currentDate, selectedPlantId)
      
      const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || 'Erro desconhecido ao excluir agendamento'
      setError('Erro ao excluir agendamento: ' + errorMessage)
      alert('Erro ao excluir agendamento: ' + errorMessage)
    }
  }

  const handleAppointmentFormSubmit = async () => {
    setShowAppointmentForm(false)
    setEditingAppointment(null)
    await loadAppointments(currentDate, selectedPlantId)
  }

  // Função para normalizar datas sem problemas de timezone
  // IMPORTANTE: Tratar strings diretamente sem converter para Date primeiro
  const getDateString = (date) => {
    if (!date) return null
    if (typeof date === 'string') {
      // Se já é uma string no formato YYYY-MM-DD, retornar diretamente
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date
      }
      // Se tem timezone (ex: "2026-01-28T00:00:00" ou "2026-01-28T00:00:00Z"), pegar apenas a parte da data
      return date.split('T')[0]
    }
    // Se é um objeto Date, converter para YYYY-MM-DD usando métodos locais
    const d = new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  const currentDateISO = dateUtils.toISODate(currentDate)
  
  // Filtrar agendamentos do dia selecionado
  // IMPORTANTE: Todos os agendamentos aparecem na data original do agendamento (date),
  // independente do status (scheduled, checked_in, checked_out, rescheduled)
  let dayAppointments = appointments.filter(apt => {
    if (!apt.date) {
      return false
    }
    
    // Normalizar ambas as datas para comparação usando getDateString para evitar problemas de timezone
    const aptDate = getDateString(apt.date)
    return aptDate === currentDateISO
  })
  
  // Filtrar pela planta selecionada (se houver)
  // REGRA DE NEGÓCIO: Nenhum dado deve ser exibido sem que uma planta esteja selecionada
  if (selectedPlantId) {
    // Filtrar APENAS agendamentos da planta selecionada
    // Não incluir agendamentos sem plant_id para evitar mistura de dados entre plantas
    dayAppointments = dayAppointments.filter(apt => apt.plant_id === selectedPlantId)
  } else {
    // Se nenhuma planta estiver selecionada, não mostrar agendamentos
    dayAppointments = []
  }
  
  // Filtrar agendamentos baseado no filtro ativo (após filtrar por data e planta)
  // IMPORTANTE: Quando activeFilter é 'all', mostrar TODOS os agendamentos do dia
  // VALIDAÇÃO ADICIONAL: Garantir que todos os agendamentos filtrados são realmente do dia selecionado
  const filteredAppointments = (activeFilter === 'all' 
    ? dayAppointments 
    : dayAppointments.filter(appointment => {
        // Para filtros específicos, verificar o status exato
        if (activeFilter === 'scheduled') {
          return appointment.status === 'scheduled' || appointment.status === 'rescheduled'
        }
        return appointment.status === activeFilter
      })
  ).filter(appointment => {
    // VALIDAÇÃO FINAL: Garantir que a data do agendamento corresponde à data selecionada
    if (!appointment.date) return false
    const aptDate = getDateString(appointment.date)
    return aptDate === currentDateISO
  })

  // Carregar capacidade da planta selecionada imediatamente quando selecionada
  useEffect(() => {
    if (!selectedPlantId) {
      setMaxCapacity(1)
      setPlantCapacities(new Map())
      return
    }
    
    // Carregar capacidade da planta selecionada diretamente
    const loadPlantCapacity = async () => {
      try {
        // Usar supplierAPI para buscar capacidade da planta
        const data = await supplierAPI.getPlantMaxCapacity(selectedPlantId)
        
        const capacity = data.max_capacity || 1
        
        // Criar mapa com a capacidade da planta selecionada
        const capacitiesMap = new Map()
        capacitiesMap.set(selectedPlantId, capacity)
        
        setPlantCapacities(capacitiesMap)
        setMaxCapacity(capacity)
      } catch (err) {
        setMaxCapacity(1)
        setPlantCapacities(new Map())
      }
    }
    
    loadPlantCapacity()
  }, [selectedPlantId])

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
    
    return Math.max(height, 80)
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
    // VALIDAÇÃO INICIAL: Garantir que todos os agendamentos são realmente do dia selecionado
    const validatedAppointments = filteredAppointments.filter(apt => {
      if (!apt.date) {
        return false
      }
      const aptDate = getDateString(apt.date)
      return aptDate === currentDateISO
    })
    
    // Garantir que maxCapacity seja pelo menos 1
    const totalColumns = Math.max(1, maxCapacity)
    
    // Criar array de colunas (cada coluna é um array de agendamentos)
    const columns = Array.from({ length: totalColumns }, () => [])
    
    // Agrupar agendamentos por planta primeiro
    const appointmentsByPlant = new Map()
    validatedAppointments.forEach(apt => {
      const plantId = apt.plant_id || null
      if (!appointmentsByPlant.has(plantId)) {
        appointmentsByPlant.set(plantId, [])
      }
      appointmentsByPlant.get(plantId).push(apt)
    })
    
    // Processar cada planta separadamente
    appointmentsByPlant.forEach((plantAppointments, plantId) => {
      // Obter capacidade específica desta planta
      // Se plantId é null (agendamentos antigos) e há uma planta selecionada, usar a capacidade da planta selecionada
      let plantCapacity = 1
      if (plantId === null && selectedPlantId) {
        plantCapacity = plantCapacities.get(selectedPlantId) || maxCapacity || 1
      } else if (plantId !== null) {
        plantCapacity = plantCapacities.get(plantId) || maxCapacity || 1
      } else {
        plantCapacity = maxCapacity || 1
      }
      
      // Ordenar agendamentos desta planta por horário de início
      const sortedAppointments = [...plantAppointments].sort((a, b) => {
        const timeA = dateUtils.formatTime(a.time)
        const timeB = dateUtils.formatTime(b.time)
        const [h1, m1] = timeA.split(':').map(Number)
        const [h2, m2] = timeB.split(':').map(Number)
        return (h1 * 60 + m1) - (h2 * 60 + m2)
      })
      
      // Mapa para rastrear em qual coluna cada agendamento desta planta foi colocado
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
        for (let colIndex = 0; colIndex < plantCapacity; colIndex++) {
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
      
      // Processar agendamentos desta planta em ordem cronológica
      sortedAppointments.forEach(appointment => {
        // Se já foi atribuído, pular
        if (appointmentColumnMap.has(appointment.id)) {
          return
        }
        
        // Encontrar a melhor coluna para este agendamento
        const colIndex = findBestColumn(appointment)
        columns[colIndex].push(appointment)
        appointmentColumnMap.set(appointment.id, colIndex)
      })
    })
    
    return columns
  }, [filteredAppointments, maxCapacity, plantCapacities, selectedPlantId, currentDateISO])

  let timelineHeight = 24 * HOUR_HEIGHT
  if (filteredAppointments.length > 0) {
    const lastAppointment = filteredAppointments.reduce((latest, apt) => {
      const aptTime = dateUtils.formatTime(apt.time_end || apt.time)
      const latestTime = dateUtils.formatTime(latest.time_end || latest.time)
      return aptTime > latestTime ? apt : latest
    }, filteredAppointments[0])
    
    const lastTime = dateUtils.formatTime(lastAppointment.time_end || lastAppointment.time)
    timelineHeight = Math.max(calculateCardTop(lastTime) + calculateCardHeight(lastAppointment) + 100, 24 * HOUR_HEIGHT)
  }

  const stats = useMemo(() => {
    // Filtrar agendamentos pela planta selecionada
    let dayApps = dayAppointments
    if (selectedPlantId) {
      // Filtrar apenas agendamentos da planta selecionada
      dayApps = dayApps.filter(a => a.plant_id === selectedPlantId)
    } else {
      // Se nenhuma planta estiver selecionada, retornar zeros
      return {
        total: 0,
        scheduled: 0,
        checkedIn: 0,
        checkedOut: 0
      }
    }
    
    return {
      total: dayApps.length,
      scheduled: dayApps.filter(a => a.status === 'scheduled' || a.status === 'rescheduled').length,
      checkedIn: dayApps.filter(a => {
        if (a.status !== 'checked_in') return false
        if (!a.check_in_time) return false
        // Usar getDateString para evitar problemas de timezone
        const checkInDate = getDateString(a.check_in_time)
        return checkInDate === currentDateISO
      }).length,
      checkedOut: dayApps.filter(a => {
        // Finalizados do Dia: agendamentos que foram agendados para aquele dia E foram finalizados
        // Considera apenas agendamentos do dia (date) que têm status checked_out
        return a.status === 'checked_out'
      }).length
    }
  }, [dayAppointments, currentDateISO, selectedPlantId])

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
          <h1 className="text-2xl font-bold text-gray-900">Painel do Fornecedor</h1>
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
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="appointments">Agendamentos</TabsTrigger>
          <TabsTrigger value="suppliers">Configurações</TabsTrigger>
        </TabsList>

        {/* Tab de Agendamentos */}
        <TabsContent value="appointments" className="space-y-4">
          <div className="space-y-4">
            {/* Seletor de Planta - Destaque */}
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-gray-800 mb-2">
                  Seleção de Planta
                </CardTitle>
                <PlantSelector
                  plants={plants}
                  selectedPlantId={selectedPlantId}
                  onPlantChange={handlePlantChange}
                  placeholder="Selecione uma planta para visualizar agendamentos"
                />
              </CardHeader>
            </Card>

            {/* Navegação do Dia */}
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
                        <p className="text-xs text-blue-600 mt-1 font-medium">Hoje</p>
                      )}
                    </div>
                  </div>

                  <Button variant="outline" size="sm" onClick={handleNextDay}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {hasPermission('create_appointment', 'editor') && (
              <div className="flex justify-center sm:justify-start">
                <Button
                  onClick={() => {
                    setEditingAppointment({
                      date: currentDateISO,
                      plant_id: selectedPlantId
                    })
                    setShowAppointmentForm(true)
                  }}
                  className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-200 px-8 py-6 text-base font-semibold rounded-lg flex items-center justify-center gap-2"
                  size="lg"
                >
                  <Plus className="w-5 h-5" />
                  <span>Novo Agendamento</span>
                </Button>
              </div>
            )}

            {/* Estado vazio quando nenhuma planta está selecionada */}
            {!selectedPlantId && (
              <Card className="py-12">
                <CardContent className="flex flex-col items-center justify-center text-center">
                  <Building2 className="w-16 h-16 text-gray-300 mb-4" />
                  <CardTitle className="text-xl text-gray-600 mb-2">
                    Selecione uma planta
                  </CardTitle>
                  <p className="text-gray-500">
                    Escolha uma planta acima para visualizar os agendamentos
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Visualização Tipo Agenda Diária - Layout Estilo Agenda Visual */}
          {selectedPlantId && (
          <Card className="overflow-hidden">
            <div className="h-[calc(100vh-400px)] min-h-[600px] overflow-y-auto">
              <div className="hidden md:flex relative" style={{ minHeight: `${timelineHeight}px` }}>
                {/* Coluna de Horários - Fixa à Esquerda */}
                <div className="w-24 flex-shrink-0 bg-gray-50 border-r border-gray-200 relative" style={{ minHeight: `${timelineHeight}px` }}>
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
                    gridTemplateColumns: `repeat(${Math.max(1, maxCapacity)}, 1fr)`,
                    gap: '4px',
                    padding: '4px'
                  }}
                >
                  {Array.from({ length: Math.max(1, maxCapacity) }, (_, colIndex) => (
                    <div 
                      key={`column-${colIndex}`}
                      className="relative border-r border-gray-200/50 last:border-r-0"
                      style={{ minHeight: `${timelineHeight}px` }}
                    >
                      <div className="absolute inset-0 bg-gray-50/30" />
                      
                      {Array.from({ length: 24 }, (_, i) => {
                        const hour = i
                        const top = i * HOUR_HEIGHT
                        return (
                          <div
                            key={`guide-col-${colIndex}-${hour}`}
                            className="absolute left-0 right-0 border-b border-gray-200"
                            style={{ top: `${top}px`, height: `${HOUR_HEIGHT}px`, pointerEvents: 'none' }}
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
                            style={{ top: `${top}px`, height: `${HOUR_HEIGHT / 2}px`, pointerEvents: 'none' }}
                          />
                        )
                      })}

                      {appointmentsByColumn[colIndex]?.map((appointment, aptIndex) => {
                          // VALIDAÇÃO FINAL ANTES DE RENDERIZAR: Garantir que o agendamento é do dia correto
                          if (!appointment.date) {
                            return null
                          }
                          const aptDate = getDateString(appointment.date)
                          if (aptDate !== currentDateISO) {
                            return null // Não renderizar agendamentos de outras datas
                          }
                          
                          const startTime = dateUtils.formatTime(appointment.time)
                          const top = calculateCardTop(startTime)
                          const height = calculateCardHeight(appointment)
                          const contentLevel = getCardContentLevel(height)
                          const supplierName = appointment.supplier?.description || suppliers.find(s => s.id === appointment.supplier_id)?.description || 'Fornecedor'
                          
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
                                        <p className="text-xs font-mono font-semibold text-blue-600 truncate leading-tight mb-0.5">
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
                                    <p className="font-mono text-blue-600">
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
                                    <LogOut className="w-3.5 h-3.5 text-blue-600" />
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
                                    {appointment.supplier?.description || suppliers.find(s => s.id === appointment.supplier_id)?.description || 'Fornecedor'}
                                  </CardTitle>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {dateUtils.formatTimeRange(appointment.time, appointment.time_end)}
                                  </p>
                                  {appointment.appointment_number && (
                                    <p className="text-xs font-mono text-blue-600 mt-0.5">
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
                                  <p className="truncate font-mono text-blue-600">
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
                                    <LogOut className="w-4 h-4 text-blue-600" />
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
          </Card>
          )}
        </TabsContent>

        {/* Tab de Configurações */}
        <TabsContent value="suppliers" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Configurações</h2>
          </div>

          {/* Botões de Acesso Rápido */}
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
        </TabsContent>
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
                  {selectedAppointment.supplier?.description || suppliers.find(s => s.id === selectedAppointment.supplier_id)?.description || 'Fornecedor'}
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
                      <p className="text-sm font-medium font-mono text-blue-600">
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
                        {selectedAppointment.supplier?.description || suppliers.find(s => s.id === selectedAppointment.supplier_id)?.description || 'N/A'}
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

export default SupplierDashboard
