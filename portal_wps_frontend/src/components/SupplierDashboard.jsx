import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock,
  Edit,
  Trash2,
  Building2,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { supplierAPI } from '../lib/api'
import { dateUtils, statusUtils } from '../lib/utils'
import AppointmentForm from './AppointmentForm'

const SupplierDashboard = ({ user, token }) => {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentWeek, setCurrentWeek] = useState(dateUtils.getWeekStart())
  const [showAppointmentForm, setShowAppointmentForm] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedTime, setSelectedTime] = useState(null)

  const loadAppointments = async (weekStart) => {
    try {
      setLoading(true)
      const weekStartISO = dateUtils.toISODate(weekStart)
      const data = await supplierAPI.getAppointments(weekStartISO)
      setAppointments(data)
      setError('')
    } catch (err) {
      setError('Erro ao carregar agendamentos: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAppointments(currentWeek)
  }, [currentWeek])

  const handlePreviousWeek = () => {
    const newWeek = new Date(currentWeek)
    newWeek.setDate(newWeek.getDate() - 7)
    setCurrentWeek(newWeek)
  }

  const handleNextWeek = () => {
    const newWeek = new Date(currentWeek)
    newWeek.setDate(newWeek.getDate() + 7)
    setCurrentWeek(newWeek)
  }

  const handleNewAppointment = (date = null, time = null) => {
    setSelectedDate(date)
    setSelectedTime(time)
    setEditingAppointment(null)
    setShowAppointmentForm(true)
  }

  const handleEditAppointment = (appointment) => {
    setEditingAppointment(appointment)
    setSelectedDate(null)
    setSelectedTime(null)
    setShowAppointmentForm(true)
  }

  const handleDeleteAppointment = async (appointmentId) => {
    if (!confirm('Tem certeza que deseja cancelar este agendamento?')) return

    try {
      await supplierAPI.deleteAppointment(appointmentId)
      await loadAppointments(currentWeek)
    } catch (err) {
      setError('Erro ao cancelar agendamento: ' + err.message)
    }
  }

  const handleAppointmentFormSubmit = async () => {
    setShowAppointmentForm(false)
    setEditingAppointment(null)
    setSelectedDate(null)
    setSelectedTime(null)
    await loadAppointments(currentWeek)
  }

  const weekDates = dateUtils.getWeekDates(currentWeek)
  const weekEnd = dateUtils.getWeekEnd(currentWeek)

  // Agrupar agendamentos por data
  const appointmentsByDate = appointments.reduce((acc, appointment) => {
    const date = appointment.date
    if (!acc[date]) acc[date] = []
    acc[date].push(appointment)
    return acc
  }, {})

  // Horários disponíveis (8h às 17h)
  const availableHours = []
  for (let hour = 8; hour <= 17; hour++) {
    availableHours.push(`${hour.toString().padStart(2, '0')}:00`)
  }

  if (showAppointmentForm) {
    return (
      <AppointmentForm
        appointment={editingAppointment}
        preSelectedDate={selectedDate}
        preSelectedTime={selectedTime}
        onSubmit={handleAppointmentFormSubmit}
        onCancel={() => {
          setShowAppointmentForm(false)
          setEditingAppointment(null)
          setSelectedDate(null)
          setSelectedTime(null)
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Painel do Fornecedor</h1>
          <p className="text-gray-600">Gerencie seus agendamentos de entrega</p>
        </div>
        <Button onClick={() => handleNewAppointment()} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Novo Agendamento
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Total da Semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{appointments.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Agendados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">
              {appointments.filter(a => a.status === 'scheduled').length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Check-in
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">
              {appointments.filter(a => a.status === 'checked_in').length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Finalizados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {appointments.filter(a => a.status === 'checked_out').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Navegação da Semana */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={handlePreviousWeek}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <CardTitle className="text-lg">
              {dateUtils.formatDate(currentWeek)} - {dateUtils.formatDate(weekEnd)}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleNextWeek}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Grade da Semana com Horários */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
        {weekDates.map((date, index) => {
          const dateISO = dateUtils.toISODate(date)
          const dayAppointments = appointmentsByDate[dateISO] || []
          const isToday = dateUtils.isToday(date)
          const isPast = dateUtils.isPast(date)

              // Criar mapa de agendamentos por horário
              const appointmentsByTime = dayAppointments.reduce((acc, apt) => {
                const timeStr = dateUtils.formatTime(apt.time)
                acc[timeStr] = apt
                return acc
              }, {})

          return (
            <Card key={index} className={`${isToday ? 'ring-2 ring-blue-500' : ''} ${isPast ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-center">
                  {dateUtils.getDayName(date)}
                </CardTitle>
                <CardDescription className="text-xs text-center">
                  {dateUtils.formatDate(date)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                {availableHours.map((timeSlot) => {
                  const appointment = appointmentsByTime[timeSlot]
                  const isOwnAppointment = appointment && appointment.is_own
                  const isOtherSupplierAppointment = appointment && !appointment.is_own
                  const canSchedule = !isPast && !appointment
                  const canEdit = appointment && appointment.can_edit

                  return (
                    <div
                      key={timeSlot}
                      className={`p-2 rounded border text-xs transition-all ${
                        isOwnAppointment
                          ? 'bg-blue-50 border-blue-200 cursor-pointer hover:bg-blue-100'
                          : isOtherSupplierAppointment
                          ? 'bg-red-50 border-red-200 cursor-not-allowed'
                          : canSchedule
                          ? 'bg-gray-50 border-gray-200 cursor-pointer hover:bg-green-50 hover:border-green-300'
                          : 'bg-gray-100 border-gray-200 opacity-50'
                      }`}
                      onClick={() => {
                        if (isOwnAppointment && canEdit && appointment.status !== 'checked_in' && appointment.status !== 'checked_out') {
                          // Se é agendamento próprio e pode editar (e não está com check-in/out)
                          handleEditAppointment(appointment)
                        } else if (canSchedule) {
                          // Se não há agendamento e pode agendar, criar novo
                          handleNewAppointment(dateISO, timeSlot)
                        }
                        // Se é de outro fornecedor ou está com check-in/out, não faz nada
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{timeSlot}</span>
                        {appointment && (
                          <Badge className={`text-xs ${statusUtils.getStatusColor(appointment.status)}`}>
                            {statusUtils.getStatusLabel(appointment.status)}
                          </Badge>
                        )}
                      </div>

                      {isOwnAppointment ? (
                        <div className="space-y-1">
                          <p className="font-medium text-gray-900 truncate">
                            PO: {appointment.purchase_order}
                          </p>
                          <p className="text-gray-600 truncate">
                            {appointment.truck_plate}
                          </p>
                          <p className="text-gray-600 truncate">
                            {appointment.driver_name}
                          </p>
                          
                          {canEdit && appointment.status !== 'checked_in' && appointment.status !== 'checked_out' && (
                            <div className="flex gap-1 pt-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-5 px-1 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditAppointment(appointment)
                                }}
                              >
                                <Edit className="w-2 h-2" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-5 px-1 text-xs text-red-600 hover:text-red-700"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteAppointment(appointment.id)
                                }}
                              >
                                <Trash2 className="w-2 h-2" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : isOtherSupplierAppointment ? (
                        <div className="text-center text-red-600">
                          <XCircle className="w-3 h-3 mx-auto mb-1" />
                          <span className="font-medium">Indisponível</span>
                          <p className="text-xs mt-1">Ocupado por outro fornecedor</p>
                        </div>
                      ) : canSchedule ? (
                        <div className="text-center text-gray-500">
                          <Plus className="w-3 h-3 mx-auto mb-1" />
                          <span>Disponível</span>
                        </div>
                      ) : (
                        <div className="text-center text-gray-400">
                          <XCircle className="w-3 h-3 mx-auto mb-1" />
                          <span>Indisponível</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Legenda */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Legenda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-50 border border-blue-200 rounded"></div>
              <span>Agendamento existente (clique para editar)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-50 border border-gray-200 rounded"></div>
              <span>Horário disponível (clique para agendar)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-100 border border-gray-200 rounded opacity-50"></div>
              <span>Horário indisponível</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span>Dia atual</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="text-center py-8">
          <p className="text-gray-600">Carregando agendamentos...</p>
        </div>
      )}
    </div>
  )
}

export default SupplierDashboard
