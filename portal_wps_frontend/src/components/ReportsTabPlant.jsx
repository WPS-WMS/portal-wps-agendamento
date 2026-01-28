import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BarChart3, Calendar, TrendingUp, Users, Building2, Loader2, Download } from 'lucide-react'
import { plantAPI } from '../lib/api'
import { toast } from 'sonner'
import { csvUtils, dateUtils } from '../lib/utils'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid } from 'recharts'

const ReportsTabPlant = ({ user, token, plantInfo }) => {
  const [loading, setLoading] = useState(true)
  const [summaryData, setSummaryData] = useState(null)
  const [supplierStats, setSupplierStats] = useState(null)
  const [suppliers, setSuppliers] = useState([])
  const [selectedSupplierId, setSelectedSupplierId] = useState(null)
  const [activeReportTab, setActiveReportTab] = useState('summary')
  
  // Período padrão: últimos 30 dias
  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(today.getDate() - 30)
  
  const [startDate, setStartDate] = useState(thirtyDaysAgo.toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0])

  useEffect(() => {
    loadSuppliers()
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      loadSummaryData()
    }
  }, [startDate, endDate])

  useEffect(() => {
    if (selectedSupplierId && startDate && endDate) {
      loadSupplierStats()
    }
  }, [selectedSupplierId, startDate, endDate])

  const loadSuppliers = async () => {
    try {
      const data = await plantAPI.getSuppliers()
      setSuppliers(data.filter(s => s.is_active && !s.is_deleted))
    } catch (err) {
      console.error('Erro ao carregar fornecedores:', err)
    }
  }

  const loadSummaryData = async () => {
    try {
      setLoading(true)
      const data = await plantAPI.getDashboardSummary(startDate, endDate)
      setSummaryData(data)
    } catch (err) {
      toast.error('Erro ao carregar resumo', {
        description: err.response?.data?.error || err.message
      })
    } finally {
      setLoading(false)
    }
  }

  const loadSupplierStats = async () => {
    try {
      setLoading(true)
      const data = await plantAPI.getSupplierStats(selectedSupplierId, startDate, endDate)
      setSupplierStats(data)
    } catch (err) {
      toast.error('Erro ao carregar estatísticas do fornecedor', {
        description: err.response?.data?.error || err.message
      })
    } finally {
      setLoading(false)
    }
  }

  // Cores alinhadas com os cards de agendamento
  const statusColors = {
    scheduled: '#3b82f6', // Azul
    checked_in: '#f97316', // Laranja
    checked_out: '#22c55e', // Verde (finalizados)
    rescheduled: '#8b5cf6', // Roxo
    cancelled: '#ef4444'
  }

  const statusLabels = {
    scheduled: 'Agendados',
    checked_in: 'Check-in',
    checked_out: 'Finalizados',
    rescheduled: 'Reagendados',
    cancelled: 'Cancelados'
  }

  // Preparar dados para gráfico de status
  const statusChartData = summaryData?.appointments_by_status 
    ? Object.entries(summaryData.appointments_by_status).map(([status, count]) => ({
        name: statusLabels[status] || status,
        value: count,
        fill: statusColors[status] || '#6b7280'
      }))
    : []

  // Preparar dados para gráfico de barras (agendamentos por dia)
  const dailyChartData = supplierStats?.daily_appointments || []

  // Funções de exportação CSV
  const exportSummaryCSV = () => {
    if (!summaryData) {
      toast.error('Nenhum dado disponível para exportar')
      return
    }

    const lines = []
    lines.push(`Relatório da Planta - ${summaryData.plant?.name || plantInfo?.name || 'N/A'}`)
    lines.push(`Período: ${dateUtils.formatDate(summaryData.period.start_date)} a ${dateUtils.formatDate(summaryData.period.end_date)}`)
    lines.push('')
    lines.push('Métricas da Planta')
    lines.push('Métrica,Valor')
    lines.push(`Total de Agendamentos,${summaryData.total_appointments}`)
    lines.push(`Taxa de Ocupação,${summaryData.occupation_rate?.toFixed(2)}%`)
    lines.push(`Capacidade Máxima,${summaryData.plant?.max_capacity || plantInfo?.max_capacity || 'N/A'}`)
    lines.push(`Fornecedores Ativos,${summaryData.active_suppliers}`)
    lines.push('')
    lines.push('Agendamentos por Status')
    lines.push('Status,Quantidade')
    
    Object.entries(summaryData.appointments_by_status || {}).forEach(([status, count]) => {
      lines.push(`${statusLabels[status] || status},${count}`)
    })

    const csvContent = lines.join('\n')
    const filename = `relatorio_planta_${summaryData.plant?.name?.replace(/\s+/g, '_') || plantInfo?.name?.replace(/\s+/g, '_') || 'planta'}_${startDate}_${endDate}`
    csvUtils.downloadCSV(csvContent, filename)
    toast.success('Relatório exportado com sucesso!')
  }

  const exportSupplierStatsCSV = () => {
    if (!supplierStats) {
      toast.error('Nenhum dado disponível para exportar')
      return
    }

    const lines = []
    lines.push(`Relatório de Fornecedor - ${supplierStats.supplier?.description || 'N/A'}`)
    lines.push(`Planta: ${summaryData?.plant?.name || plantInfo?.name || 'N/A'}`)
    lines.push(`Período: ${dateUtils.formatDate(supplierStats.period.start_date)} a ${dateUtils.formatDate(supplierStats.period.end_date)}`)
    lines.push('')
    lines.push('Métricas do Fornecedor')
    lines.push('Métrica,Valor')
    lines.push(`Total de Agendamentos,${supplierStats.total_appointments}`)
    lines.push(`Taxa de Comparecimento,${supplierStats.attendance_rate?.toFixed(2)}%`)
    lines.push('')
    lines.push('Agendamentos por Status')
    lines.push('Status,Quantidade')
    
    Object.entries(supplierStats.appointments_by_status || {}).forEach(([status, count]) => {
      lines.push(`${statusLabels[status] || status},${count}`)
    })

    if (supplierStats.daily_appointments && supplierStats.daily_appointments.length > 0) {
      lines.push('')
      lines.push('Agendamentos por Dia')
      lines.push('Data,Quantidade')
      supplierStats.daily_appointments.forEach(item => {
        lines.push(`${csvUtils.formatDateForCSV(item.date)},${item.count}`)
      })
    }

    const csvContent = lines.join('\n')
    const filename = `relatorio_fornecedor_${supplierStats.supplier?.description?.replace(/\s+/g, '_') || 'fornecedor'}_${startDate}_${endDate}`
    csvUtils.downloadCSV(csvContent, filename)
    toast.success('Relatório exportado com sucesso!')
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Relatórios</h2>
      </div>

      {/* Filtros de Período */}
      <Card className="border-2">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            {/* Períodos Rápidos */}
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium text-gray-700 self-center mr-2">Período:</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = new Date()
                  const end = today.toISOString().split('T')[0]
                  const start = new Date(today)
                  start.setDate(today.getDate() - 7)
                  setStartDate(start.toISOString().split('T')[0])
                  setEndDate(end)
                }}
                className="text-xs"
              >
                7 dias
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = new Date()
                  const end = today.toISOString().split('T')[0]
                  const start = new Date(today)
                  start.setDate(today.getDate() - 30)
                  setStartDate(start.toISOString().split('T')[0])
                  setEndDate(end)
                }}
                className="text-xs"
              >
                30 dias
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = new Date()
                  const end = today.toISOString().split('T')[0]
                  const start = new Date(today)
                  start.setDate(today.getDate() - 90)
                  setStartDate(start.toISOString().split('T')[0])
                  setEndDate(end)
                }}
                className="text-xs"
              >
                90 dias
              </Button>
            </div>

            {/* Datas Customizadas */}
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="start-date" className="text-xs text-gray-600">Data Inicial</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="end-date" className="text-xs text-gray-600">Data Final</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
              <Button 
                onClick={loadSummaryData} 
                className="bg-[#FF6B35] hover:bg-[#E55A2B] text-white h-9 px-6"
              >
                Aplicar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Agendamentos
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {summaryData?.total_appointments || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  No período selecionado
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Taxa de Ocupação
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {summaryData?.occupation_rate?.toFixed(1) || '0.0'}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Da sua planta
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Fornecedores Ativos
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {summaryData?.active_suppliers || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Que agendam aqui
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Planta
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {summaryData?.plant?.name || plantInfo?.name || '-'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Capacidade: {summaryData?.plant?.max_capacity || plantInfo?.max_capacity || '-'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs de Relatórios */}
      <Tabs value={activeReportTab} onValueChange={setActiveReportTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="summary">Resumo Geral</TabsTrigger>
          <TabsTrigger value="supplier">Relatório de Fornecedor</TabsTrigger>
        </TabsList>

        {/* Tab Resumo Geral */}
        <TabsContent value="summary" className="space-y-4">
          {summaryData && (
            <>
              {/* Gráfico de Status */}
              {statusChartData.length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>Agendamentos por Status</CardTitle>
                        <CardDescription>
                          Distribuição de agendamentos no período selecionado
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportSummaryCSV}
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Exportar CSV
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col md:flex-row gap-6 md:items-center">
                      {/* Legenda à esquerda */}
                      <div className="md:w-56">
                        <div className="text-sm font-medium text-gray-700 mb-3">Legenda</div>
                        <div className="space-y-2">
                          {statusChartData.map((item) => (
                            <div key={item.name} className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="h-3 w-3 rounded-sm shrink-0"
                                  style={{ backgroundColor: item.fill }}
                                />
                                <span className="text-sm text-gray-700 truncate">{item.name}</span>
                              </div>
                              <span className="text-sm font-semibold text-gray-900 tabular-nums">
                                {item.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Gráfico maior */}
                      <div className="flex-1">
                        <ChartContainer
                          className="h-[360px] md:h-[440px] w-full"
                          config={{
                            scheduled: { label: 'Agendados', color: statusColors.scheduled },
                            checked_in: { label: 'Check-in', color: statusColors.checked_in },
                            checked_out: { label: 'Finalizados', color: statusColors.checked_out },
                            rescheduled: { label: 'Reagendados', color: statusColors.rescheduled },
                            cancelled: { label: 'Cancelados', color: statusColors.cancelled }
                          }}
                        >
                          <PieChart>
                            <Pie
                              data={statusChartData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={140}
                              innerRadius={55}
                              paddingAngle={2}
                              labelLine={false}
                            >
                              {statusChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Pie>
                            <ChartTooltip content={<ChartTooltipContent />} />
                          </PieChart>
                        </ChartContainer>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Tab Relatório de Fornecedor */}
        <TabsContent value="supplier" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Selecionar Fornecedor</CardTitle>
                {selectedSupplierId && supplierStats && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportSupplierStatsCSV}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Exportar CSV
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Select value={selectedSupplierId?.toString() || ''} onValueChange={(value) => setSelectedSupplierId(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um fornecedor..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id.toString()}>
                      {supplier.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedSupplierId && supplierStats && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Total de Agendamentos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{supplierStats.total_appointments}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Taxa de Comparecimento</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{supplierStats.attendance_rate?.toFixed(1)}%</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Fornecedor</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm font-medium">{supplierStats.supplier?.description}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Gráfico de Agendamentos por Dia */}
              {dailyChartData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Agendamentos por Dia</CardTitle>
                    <CardDescription>
                      Evolução diária de agendamentos
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer
                      config={{
                        count: { label: 'Agendamentos', color: '#10b981' }
                      }}
                    >
                      <BarChart data={dailyChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(value) => {
                            const date = new Date(value)
                            return `${date.getDate()}/${date.getMonth() + 1}`
                          }}
                        />
                        <YAxis />
                        <ChartTooltip 
                          content={<ChartTooltipContent />}
                          labelFormatter={(value) => {
                            const date = new Date(value)
                            return date.toLocaleDateString('pt-BR')
                          }}
                        />
                        <Bar dataKey="count" fill="#10b981" />
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default ReportsTabPlant
