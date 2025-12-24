import React, { useState, useEffect, useMemo } from 'react'
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
import { adminAPI } from '../lib/api'
import { dateUtils, statusUtils } from '../lib/utils'
import { UI_CONFIG } from '../lib/constants'
import SupplierForm from './SupplierForm'
import SupplierManagement from './SupplierManagement'
import PlantManagement from './PlantManagement'
import ScheduleConfig from './ScheduleConfig'
import DefaultScheduleConfig from './DefaultScheduleConfig'
import AppointmentEditForm from './AppointmentEditForm'
import PlantForm from './PlantForm'

// Constante para altura proporcional por hora
const HOUR_HEIGHT = UI_CONFIG.HOUR_HEIGHT

const AdminDashboard = ({ user, token }) => {
  const [suppliers, setSuppliers] = useState([])
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [showSupplierManagement, setShowSupplierManagement] = useState(false)
  const [managingSupplier, setManagingSupplier] = useState(null)
  const [showScheduleConfig, setShowScheduleConfig] = useState(false)
  const [showDefaultScheduleConfig, setShowDefaultScheduleConfig] = useState(false)
  const [showSuppliersScreen, setShowSuppliersScreen] = useState(false)
  const [showPlantsScreen, setShowPlantsScreen] = useState(false)
  const [showPlantForm, setShowPlantForm] = useState(false)
  const [showPlantManagement, setShowPlantManagement] = useState(false)
  const [managingPlant, setManagingPlant] = useState(null)
  const [plants, setPlants] = useState([])
  const [showAppointmentForm, setShowAppointmentForm] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState(null)
  const [activeTab, setActiveTab] = useState('appointments')
  const [activeFilter, setActiveFilter] = useState('all') // 'all', 'scheduled', 'checked_in', 'checked_out'
  const [maxCapacity, setMaxCapacity] = useState(1)
  const [maxCapacityLoading, setMaxCapacityLoading] = useState(false)
  const [maxCapacityError, setMaxCapacityError] = useState('')
  const [maxCapacitySuccess, setMaxCapacitySuccess] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState(null)

  const loadSuppliers = async () => {
    try {
      const data = await adminAPI.getSuppliers()
      setSuppliers(data)
    } catch (err) {
      setError('Erro ao carregar fornecedores: ' + err.message)
    }
  }

  const loadPlants = async () => {
    try {
      const data = await adminAPI.getPlants()
      // Garantir que sempre seja um array
      if (Array.isArray(data)) {
        setPlants(data)
      } else {
        setPlants([])
      }
    } catch (err) {
      setPlants([])
      setError('Erro ao carregar plantas: ' + (err.message || 'Erro desconhecido'))
    }
  }

  const loadAppointments = async (date) => {
    try {
      setLoading(true)
      // Passar o objeto Date diretamente, a API vai converter
      const data = await adminAPI.getAppointments(date)
      setAppointments(data)
      setError('')
    } catch (err) {
      setError('Erro ao carregar agendamentos: ' + (err.response?.data?.error || err.message))
    } finally {
      setLoading(false)
    }
  }

  const loadMaxCapacity = async () => {
    try {
      const data = await adminAPI.getMaxCapacity()
      setMaxCapacity(data.max_capacity || 1)
    } catch (err) {
    }
  }

  const handleSaveMaxCapacity = async () => {
    if (maxCapacity < 1) {
      setMaxCapacityError('A capacidade mínima é 1')
      return
    }

    setMaxCapacityLoading(true)
    setMaxCapacityError('')
    setMaxCapacitySuccess('')

    try {
      await adminAPI.setMaxCapacity(maxCapacity)
      // Recarregar o valor do servidor para garantir sincronização
      await loadMaxCapacity()
      setMaxCapacitySuccess('Configuração salva com sucesso!')
      setTimeout(() => setMaxCapacitySuccess(''), 3000)
    } catch (err) {
      setMaxCapacityError('Erro ao salvar configuração: ' + (err.response?.data?.error || err.message))
    } finally {
      setMaxCapacityLoading(false)
    }
  }

  // Carregar capacidade máxima sempre que o componente monta
  useEffect(() => {
    loadMaxCapacity()
  }, [])

  useEffect(() => {
    loadSuppliers()
    loadPlants()
    loadAppointments(currentDate)
  }, [currentDate, activeTab])

  // Carregar plantas quando a tela de Plantas é aberta
  useEffect(() => {
    if (showPlantsScreen) {
      loadPlants()
    }
  }, [showPlantsScreen])

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
      setCurrentDate(new Date(dateString))
    }
  }

  const handleCheckIn = async (appointmentId) => {
    try {
      const result = await adminAPI.checkIn(appointmentId)
      
      // Recarregar agendamentos para atualizar a UI
      const dateToLoad = currentDate instanceof Date ? currentDate : new Date(currentDate)
      await loadAppointments(dateToLoad)
      
      // Mostrar payload do ERP
      alert(`Check-in realizado com sucesso!\n\nPayload ERP:\n${JSON.stringify(result.erp_payload, null, 2)}`)
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Erro desconhecido'
      setError('Erro ao realizar check-in: ' + errorMessage)
      alert(`Erro ao realizar check-in: ${errorMessage}`)
    }
  }

  const handleCheckOut = async (appointmentId) => {
    try {
      const result = await adminAPI.checkOut(appointmentId)
      
      // Atualizar o agendamento específico no estado antes de recarregar
      setAppointments(prev => prev.map(apt => 
        apt.id === appointmentId 
          ? { ...apt, status: 'checked_out', check_out_time: result.appointment?.check_out_time }
          : apt
      ))
      
      // Recarregar agendamentos para garantir sincronização
      await loadAppointments(currentDate)
    } catch (err) {
      setError('Erro ao realizar check-out: ' + (err.response?.data?.error || err.message))
    }
  }

  const handleEditAppointment = (appointment) => {
    setEditingAppointment(appointment)
    setShowAppointmentForm(true)
  }

  const handleSupplierFormSubmit = async () => {
    setShowSupplierForm(false)
    await loadSuppliers()
  }

  const handleManageSupplier = (supplier) => {
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
    setManagingPlant(plant)
    setShowPlantManagement(true)
  }

  const handlePlantManagementUpdate = async () => {
    setShowPlantManagement(false)
    setManagingPlant(null)
    await loadPlants()
  }

  const handleDeleteAppointment = async (appointmentId) => {
    if (!confirm('Tem certeza que deseja excluir este agendamento?')) return

    try {
      await adminAPI.deleteAppointment(appointmentId)
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

  // Data atual em formato ISO para filtros
  const currentDateISO = dateUtils.toISODate(currentDate)
  
  // Filtrar agendamentos do dia selecionado primeiro
  const dayAppointments = appointments.filter(apt => apt.date === currentDateISO)
  
  // Filtrar agendamentos baseado no filtro ativo (após filtrar por data)
  const filteredAppointments = activeFilter === 'all' 
    ? dayAppointments 
    : dayAppointments.filter(appointment => appointment.status === activeFilter)

  // Agrupar agendamentos por horário inicial exato (incluindo minutos)
  // Ex: 09:20, 09:30, 10:00, etc.
  const appointmentsByTime = {}
  filteredAppointments.forEach(apt => {
    const startTime = dateUtils.formatTime(apt.time) // Formato: HH:mm
    
    if (!appointmentsByTime[startTime]) {
      appointmentsByTime[startTime] = []
    }
    
    // Adicionar o agendamento apenas se ainda não estiver na lista
    if (!appointmentsByTime[startTime].find(a => a.id === apt.id)) {
      appointmentsByTime[startTime].push(apt)
    }
  })
  
  // Ordenar agendamentos dentro de cada horário por horário de início
  Object.keys(appointmentsByTime).forEach(timeSlot => {
    appointmentsByTime[timeSlot].sort((a, b) => {
      const timeA = dateUtils.formatTime(a.time)
      const timeB = dateUtils.formatTime(b.time)
      return timeA.localeCompare(timeB)
    })
  })

  // Criar lista de horários únicos baseada nos agendamentos + horários padrão
  // Ordenar todos os horários únicos
  const uniqueTimes = new Set()
  
  // Adicionar horários dos agendamentos
  filteredAppointments.forEach(apt => {
    uniqueTimes.add(dateUtils.formatTime(apt.time))
  })
  
  // Adicionar horários padrão (8h às 17h) para manter estrutura visual
  for (let hour = 8; hour <= 17; hour++) {
    uniqueTimes.add(`${hour.toString().padStart(2, '0')}:00`)
  }
  
  // Converter para array e ordenar
  const availableHours = Array.from(uniqueTimes).sort((a, b) => {
    const [h1, m1] = a.split(':').map(Number)
    const [h2, m2] = b.split(':').map(Number)
    return h1 * 60 + m1 - (h2 * 60 + m2)
  })

  // Função para calcular altura do card baseada no range de tempo (proporcional)
  const calculateCardHeight = (appointment) => {
    const startTime = dateUtils.formatTime(appointment.time)
    const endTime = appointment.time_end ? dateUtils.formatTime(appointment.time_end) : startTime
    
    // Converter para horas desde 08:00
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    
    const startMinutes = (startHour - 8) * 60 + startMin
    const endMinutes = (endHour - 8) * 60 + endMin
    
    // Altura proporcional: HOUR_HEIGHT pixels por hora
    const durationHours = Math.max((endMinutes - startMinutes) / 60, 0.25) // Mínimo 15 minutos (0.25h)
    const height = durationHours * HOUR_HEIGHT
    
    // Altura mínima para legibilidade
    return Math.max(height, 80)
  }

  // Função para calcular posição vertical do card (proporcional)
  const calculateCardTop = (timeString) => {
    const [hour, min] = timeString.split(':').map(Number)
    const minutesFrom8 = (hour - 8) * 60 + min
    const hoursFrom8 = minutesFrom8 / 60
    return hoursFrom8 * HOUR_HEIGHT // Posição proporcional baseada em HOUR_HEIGHT
  }

  // Função para obter cor da borda baseada no status
  const getStatusBorderColor = (status) => {
    switch (status) {
      case 'rescheduled':
        return 'border-l-purple-500' // Roxo - Reagendado
      case 'scheduled':
        return 'border-l-blue-500' // Azul - Agendado
      case 'checked_in':
        return 'border-l-orange-500' // Laranja - Em Pátio / Check-in
      case 'checked_out':
        return 'border-l-green-500' // Verde - Concluído
      default:
        return 'border-l-red-500' // Vermelho - Atrasado ou outros
    }
  }

  // Função para determinar o conteúdo baseado na altura do card
  const getCardContentLevel = (height) => {
    const MIN_HEIGHT_FOR_SUMMARY = UI_CONFIG.MIN_HEIGHT_FOR_SUMMARY
    const MIN_HEIGHT_FOR_FULL = UI_CONFIG.MIN_HEIGHT_FOR_FULL
    
    if (height < MIN_HEIGHT_FOR_SUMMARY) {
      return 'minimal' // Apenas fornecedor e horário
    } else if (height < MIN_HEIGHT_FOR_FULL) {
      return 'summary' // Fornecedor, horário, PO e placa
    } else {
      return 'full' // Todos os dados
    }
  }

  // Handler para abrir drawer com detalhes do agendamento
  const handleCardClick = (appointment) => {
    setSelectedAppointment(appointment)
    setDrawerOpen(true)
  }

  // Função para verificar se dois agendamentos se sobrepõem
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
    
    // Verificar sobreposição: start1 < end2 && start2 < end1
    return start1Min < end2Min && start2Min < end1Min
  }

  // Distribuir agendamentos nas colunas verticais (lado a lado para agendamentos que se sobrepõem)
  const appointmentsByColumn = useMemo(() => {
    // Garantir que maxCapacity seja pelo menos 1
    const capacity = Math.max(1, maxCapacity)
    
    // Criar array de colunas (cada coluna é um array de agendamentos)
    const columns = Array.from({ length: capacity }, () => [])
    
    // Ordenar agendamentos por horário de início
    const sortedAppointments = [...filteredAppointments].sort((a, b) => {
      const timeA = dateUtils.formatTime(a.time)
      const timeB = dateUtils.formatTime(b.time)
      const [h1, m1] = timeA.split(':').map(Number)
      const [h2, m2] = timeB.split(':').map(Number)
      return (h1 * 60 + m1) - (h2 * 60 + m2)
    })
    
    // Mapa para rastrear em qual coluna cada agendamento foi colocado
    const appointmentColumnMap = new Map()
    
    // Processar agendamentos em ordem cronológica
    sortedAppointments.forEach(appointment => {
      // Se já foi atribuído, pular
      if (appointmentColumnMap.has(appointment.id)) {
        return
      }
      
      // Encontrar todos os agendamentos que se sobrepõem com este (mesmo range)
      const overlappingAppointments = sortedAppointments.filter(apt => 
        apt.id !== appointment.id && 
        !appointmentColumnMap.has(apt.id) &&
        appointmentsOverlap(appointment, apt)
      )
      
      // Criar grupo de agendamentos sobrepostos (incluindo o atual)
      const overlappingGroup = [appointment, ...overlappingAppointments]
      
      // Ordenar o grupo por ID para distribuição consistente
      overlappingGroup.sort((a, b) => a.id - b.id)
      
      // Distribuir o grupo lado a lado nas colunas disponíveis
      // Limitar ao número de colunas disponíveis (capacidade máxima)
      overlappingGroup.forEach((apt, index) => {
        // Usar módulo para distribuir circularmente nas colunas (lado a lado)
        // Isso garante que agendamentos sobrepostos fiquem lado a lado
        const colIndex = index % capacity
        columns[colIndex].push(apt)
        appointmentColumnMap.set(apt.id, colIndex)
      })
    })
    
    return columns
  }, [filteredAppointments, maxCapacity])

  // Calcular altura da timeline baseada no último agendamento (proporcional)
  let timelineHeight = 10 * HOUR_HEIGHT // Altura padrão (10 horas)
  if (filteredAppointments.length > 0) {
    const lastAppointment = filteredAppointments.reduce((latest, apt) => {
      const aptTime = dateUtils.formatTime(apt.time_end || apt.time)
      const latestTime = dateUtils.formatTime(latest.time_end || latest.time)
      return aptTime > latestTime ? apt : latest
    }, filteredAppointments[0])
    
    const lastTime = dateUtils.formatTime(lastAppointment.time_end || lastAppointment.time)
    timelineHeight = Math.max(calculateCardTop(lastTime) + calculateCardHeight(lastAppointment) + 100, 10 * HOUR_HEIGHT)
  }

  // Estatísticas do dia selecionado
  const stats = useMemo(() => {
    const dayApps = dayAppointments
    
    return {
      total: dayApps.length,
      scheduled: dayApps.filter(a => a.status === 'scheduled' || a.status === 'rescheduled').length,
      checkedIn: dayApps.filter(a => {
        // Em Check-in: iniciados na data selecionada e ainda não finalizados
        // Considera agendamentos que foram iniciados hoje (check_in_time na data atual)
        // e ainda estão em check-in (não foram finalizados)
        if (a.status !== 'checked_in') return false
        if (!a.check_in_time) return false
        const checkInDate = new Date(a.check_in_time).toISOString().split('T')[0]
        return checkInDate === currentDateISO
      }).length,
      checkedOut: dayApps.filter(a => {
        // Finalizados do Dia: finalizados na data selecionada
        // Considera apenas agendamentos que foram finalizados hoje (check_out_time na data atual)
        if (a.status !== 'checked_out') return false
        if (!a.check_out_time) return false
        const checkOutDate = new Date(a.check_out_time).toISOString().split('T')[0]
        return checkOutDate === currentDateISO
      }).length
    }
  }, [dayAppointments, currentDateISO])

  // Handlers para clique nos cards de filtro
  const handleFilterClick = (filter) => {
    // Se clicar no card já ativo, remove o filtro (volta para 'all')
    if (activeFilter === filter) {
      setActiveFilter('all')
    } else {
      setActiveFilter(filter)
    }
  }

  // Tela de Plantas
  if (showPlantsScreen) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 p-6">
        {/* Cabeçalho */}
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

        {/* Botão Nova Planta */}
        <div className="flex justify-end">
          <Button 
            onClick={() => setShowPlantForm(true)} 
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nova Planta
          </Button>
        </div>

        {/* Lista de Plantas */}
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
                      {plant.is_active ? 'Ativo' : 'Bloqueado'}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {plant.code && `Código: ${plant.code}`}
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleManagePlant(plant)}
                        className="flex items-center gap-1 text-xs"
                      >
                        <Edit className="w-3 h-3" />
                        Gerenciar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modal de Planta */}
        {showPlantForm && (
          <PlantForm
            onCancel={() => setShowPlantForm(false)}
            onSubmit={handlePlantFormSubmit}
          />
        )}

        {/* Gerenciamento de Planta */}
        {showPlantManagement && (
          <PlantManagement
            plant={managingPlant}
            onBack={() => setShowPlantManagement(false)}
            onUpdate={handlePlantManagementUpdate}
          />
        )}
      </div>
    )
  }


  // Tela de Fornecedores
  if (showSuppliersScreen) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Cabeçalho */}
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

        {/* Botão Novo Fornecedor */}
        <div className="flex justify-end">
          <Button onClick={() => setShowSupplierForm(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Novo Fornecedor
          </Button>
        </div>

        {/* Lista de Fornecedores */}
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
              <Button onClick={() => setShowSupplierForm(true)} variant="outline" className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Criar primeiro fornecedor
              </Button>
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
                      {supplier.is_active ? 'Ativo' : 'Bloqueado'}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    CNPJ: {supplier.cnpj}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-xs text-gray-600">
                      Agendamentos hoje: {appointments.filter(a => a.supplier_id === supplier.id && a.date === currentDateISO).length}
                    </p>
                    
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modais de Fornecedor */}
        {showSupplierForm && (
          <SupplierForm
            onCancel={() => setShowSupplierForm(false)}
            onSubmit={handleSupplierFormSubmit}
          />
        )}

        {showSupplierManagement && (
          <SupplierManagement
            supplier={managingSupplier}
            onBack={() => setShowSupplierManagement(false)}
            onUpdate={handleSupplierManagementUpdate}
          />
        )}
      </div>
    )
  }

  // Modais de Fornecedor (quando não está na tela de Fornecedores)
  if (showSupplierForm && !showSuppliersScreen) {
    return (
      <SupplierForm
        onSubmit={handleSupplierFormSubmit}
        onCancel={() => setShowSupplierForm(false)}
      />
    )
  }


  if (showScheduleConfig) {
    return (
      <ScheduleConfig
        onBack={() => setShowScheduleConfig(false)}
      />
    )
  }

  if (showDefaultScheduleConfig) {
    return (
      <DefaultScheduleConfig
        onBack={() => setShowDefaultScheduleConfig(false)}
      />
    )
  }

  if (showAppointmentForm && editingAppointment) {
    return (
      <AppointmentEditForm
        appointment={editingAppointment}
        suppliers={suppliers}
        onSubmit={handleAppointmentFormSubmit}
        onCancel={() => {
          setShowAppointmentForm(false)
          setEditingAppointment(null)
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Painel Administrativo</h1>
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
          {/* Cabeçalho com Navegação e Botão Agendar */}
          <div className="space-y-4">
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

            {/* Botão Agendar - Único, Destacado e Funcional */}
            <div className="flex justify-center sm:justify-start">
              <Button
                onClick={() => {
                  setEditingAppointment({
                    date: currentDateISO
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
          </div>

          {/* Visualização Tipo Agenda Diária - Layout Estilo Agenda Visual */}
          <Card className="overflow-hidden">
            <div className="h-[calc(100vh-400px)] min-h-[600px] overflow-y-auto">
              {/* Container Principal - Desktop: Layout com Colunas Verticais */}
              <div className="hidden md:flex relative" style={{ minHeight: `${timelineHeight}px` }}>
                {/* Coluna de Horários - Fixa à Esquerda */}
                <div className="w-24 flex-shrink-0 bg-gray-50 border-r border-gray-200 relative" style={{ minHeight: `${timelineHeight}px` }}>
                  {/* Linhas de horário guia (8h às 17h) - Proporcionais */}
                  {Array.from({ length: 10 }, (_, i) => {
                    const hour = 8 + i
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
                  
                  {/* Linhas guia de meia hora - Proporcionais */}
                  {Array.from({ length: 18 }, (_, i) => {
                    const hour = 8 + Math.floor(i / 2)
                    const isHalfHour = i % 2 === 1
                    const top = (hour - 8) * HOUR_HEIGHT + (isHalfHour ? HOUR_HEIGHT / 2 : 0)
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

                {/* Área de Colunas de Agendamentos - Grid com Colunas Fixas */}
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
                  {/* Criar colunas baseadas na capacidade máxima */}
                  {Array.from({ length: Math.max(1, maxCapacity) }, (_, colIndex) => (
                    <div 
                      key={`column-${colIndex}`}
                      className="relative border-r border-gray-200/50 last:border-r-0"
                      style={{ minHeight: `${timelineHeight}px` }}
                    >
                      {/* Fundo sutil para indicar lane disponível */}
                      <div className="absolute inset-0 bg-gray-50/30" />
                      
                      {/* Linhas guia de horário dentro de cada coluna - Proporcionais */}
                      {Array.from({ length: 10 }, (_, i) => {
                        const hour = 8 + i
                        const top = i * HOUR_HEIGHT
                        return (
                          <div
                            key={`guide-col-${colIndex}-${hour}`}
                            className="absolute left-0 right-0 border-b border-gray-200"
                            style={{ top: `${top}px`, height: `${HOUR_HEIGHT}px`, pointerEvents: 'none' }}
                          />
                        )
                      })}
                      
                      {/* Linhas guia de meia hora - Proporcionais */}
                      {Array.from({ length: 18 }, (_, i) => {
                        const hour = 8 + Math.floor(i / 2)
                        const isHalfHour = i % 2 === 1
                        const top = (hour - 8) * HOUR_HEIGHT + (isHalfHour ? HOUR_HEIGHT / 2 : 0)
                        return (
                          <div
                            key={`guide-half-col-${colIndex}-${i}`}
                            className="absolute left-0 right-0 border-b border-dashed border-gray-100"
                            style={{ top: `${top}px`, height: `${HOUR_HEIGHT / 2}px`, pointerEvents: 'none' }}
                          />
                        )
                      })}

                      {/* Cards de Agendamentos nesta coluna */}
                      {appointmentsByColumn[colIndex]?.map((appointment) => {
                          const startTime = dateUtils.formatTime(appointment.time)
                          const top = calculateCardTop(startTime)
                          const height = calculateCardHeight(appointment)
                          const contentLevel = getCardContentLevel(height)
                          const supplierName = suppliers.find(s => s.id === appointment.supplier_id)?.description || 'Fornecedor'

                          return (
                            <div
                              key={appointment.id}
                              className="absolute z-10"
                              style={{
                                top: `${top}px`,
                                left: '4px',
                                right: '4px',
                                width: 'calc(100% - 8px)',
                                height: `${height}px`
                              }}
                            >
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Card 
                                className={`h-full w-full bg-white border-l-4 ${getStatusBorderColor(appointment.status)} hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer group`}
                                onClick={() => handleCardClick(appointment)}
                              >
                                <CardContent className="p-2 h-full w-full flex flex-col">
                                  <div className="flex items-start justify-between gap-1.5 mb-1.5">
                                    <div className="flex-1 min-w-0">
                                      {/* Nome do Fornecedor em Negrito (Hierarquia Visual) */}
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
                                  
                                  {/* Conteúdo condicional baseado na altura do card */}
                                  {contentLevel === 'minimal' ? (
                                    // Apenas fornecedor e horário (já exibidos acima)
                                    null
                                  ) : contentLevel === 'summary' ? (
                                    // Resumo: PO e Placa
                                    <div className="flex-1 space-y-0.5 text-xs text-gray-600 overflow-hidden">
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
                                    // Todos os dados
                                    <div className="flex-1 space-y-0.5 text-xs text-gray-600 overflow-hidden">
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
                        
                        {/* Ações com área de clique aumentada */}
                        <div className="absolute bottom-1 right-1 flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity z-20">

                          <TooltipProvider>
                            {(appointment.status !== 'checked_in' && appointment.status !== 'checked_out') && (
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
                            
                            {(appointment.status !== 'checked_in' && appointment.status !== 'checked_out') && (
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
                            
                            {(appointment.status === 'scheduled' || appointment.status === 'rescheduled') && (
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
                            
                            {appointment.status === 'checked_in' && (
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

              {/* Versão Mobile - Cards Empilhados Verticalmente */}
              <div className="md:hidden space-y-4 p-4">
                {/* Ordenar agendamentos por horário para mobile */}
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
                    
                    // Mostrar apenas o primeiro agendamento de cada horário como cabeçalho
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
                        
                        {/* Card de Agendamento - Mobile */}
                        <div className={isFirstInSlot ? '' : 'mt-2'}>
                          <Card 
                            key={`mobile-appt-${appointment.id}`}
                            className="bg-white border-l-4 border-l-blue-500 hover:border-l-blue-600 shadow-md"
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex-1 min-w-0">
                                  <CardTitle className="text-sm font-semibold text-gray-900 truncate">
                                    {suppliers.find(s => s.id === appointment.supplier_id)?.description || 'Fornecedor'}
                                  </CardTitle>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {dateUtils.formatTimeRange(appointment.time, appointment.time_end)}
                                  </p>
                                </div>
                                <Badge className={`text-[10px] px-1.5 py-0 shrink-0 ${statusUtils.getStatusColor(appointment.status)}`}>
                                  {statusUtils.getStatusLabel(appointment.status)}
                                </Badge>
                              </div>
                              
                              <div className="space-y-1 text-xs text-gray-600 mb-3">
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

                              {/* Ações - Mobile */}
                              <div className="flex items-center justify-end gap-1 pt-2 border-t border-gray-100">
                                {(appointment.status !== 'checked_in' && appointment.status !== 'checked_out') && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      onClick={() => handleEditAppointment(appointment)}
                                      title="Editar"
                                    >
                                      <Edit className="w-4 h-4 text-gray-600" />
                                    </Button>
                                    
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      onClick={() => handleDeleteAppointment(appointment.id)}
                                      title="Excluir"
                                    >
                                      <Trash2 className="w-4 h-4 text-red-600" />
                                    </Button>
                                  </>
                                )}
                                
                                {(appointment.status === 'scheduled' || appointment.status === 'rescheduled') && (
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
                                
                                {appointment.status === 'checked_in' && (
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
        </TabsContent>

        {/* Tab de Configurações */}
        <TabsContent value="suppliers" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Configurações</h2>
            <div className="flex gap-2">
              <Button 
                onClick={() => setShowDefaultScheduleConfig(true)} 
                variant="outline"
                className="flex items-center gap-2"
              >
                <Clock className="w-4 h-4" />
                Horários Padrão
              </Button>
              <Button 
                onClick={() => setShowScheduleConfig(true)} 
                variant="outline"
                className="flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Configurar Horários
              </Button>
            </div>
          </div>

          {/* Botões de Acesso Rápido */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-2"
              onClick={() => setShowSuppliersScreen(true)}
            >
              <Users className="w-6 h-6" />
              <span className="font-medium">Fornecedores</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-2"
              onClick={() => setShowPlantsScreen(true)}
            >
              <Building2 className="w-6 h-6" />
              <span className="font-medium">Plantas</span>
            </Button>
          </div>

          {/* Card de Configuração de Capacidade Máxima */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Capacidade Máxima de Recebimentos por Horário
              </CardTitle>
              <CardDescription>
                Defina quantos fornecedores/entregas podem ser agendados no mesmo horário
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="maxCapacity">Capacidade máxima de recebimentos por horário</Label>
                  <Input
                    id="maxCapacity"
                    type="number"
                    min="1"
                    value={maxCapacity}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1
                      setMaxCapacity(value)
                      setMaxCapacityError('')
                      setMaxCapacitySuccess('')
                    }}
                    className="max-w-xs"
                  />
                  <p className="text-sm text-gray-500">
                    Valor mínimo: 1. Quando o número de agendamentos atingir este limite, novos agendamentos para o mesmo horário serão bloqueados.
                  </p>
                </div>

                {maxCapacityError && (
                  <Alert variant="destructive">
                    <AlertDescription>{maxCapacityError}</AlertDescription>
                  </Alert>
                )}

                {maxCapacitySuccess && (
                  <Alert className="bg-green-50 border-green-200">
                    <AlertDescription className="text-green-800">{maxCapacitySuccess}</AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={handleSaveMaxCapacity}
                  disabled={maxCapacityLoading || maxCapacity < 1}
                  className="flex items-center gap-2"
                >
                  {maxCapacityLoading ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Settings className="w-4 h-4" />
                      Salvar Configuração
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
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
                  {suppliers.find(s => s.id === selectedAppointment.supplier_id)?.description || 'Fornecedor'}
                </DrawerTitle>
                <DrawerDescription>
                  Detalhes completos do agendamento
                </DrawerDescription>
              </DrawerHeader>
              
              <div className="px-4 pb-4 overflow-y-auto">
                <div className="space-y-4">
                  {/* Informações principais */}
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
                        {suppliers.find(s => s.id === selectedAppointment.supplier_id)?.description || 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Informações do agendamento */}
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
                {(selectedAppointment.status !== 'checked_in' && selectedAppointment.status !== 'checked_out') && (
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
                {(selectedAppointment.status === 'scheduled' || selectedAppointment.status === 'rescheduled') && (
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
                {selectedAppointment.status === 'checked_in' && (
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
                {(selectedAppointment.status !== 'checked_in' && selectedAppointment.status !== 'checked_out') && (
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

export default AdminDashboard
