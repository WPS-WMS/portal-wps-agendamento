import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BarChart3, Calendar, TrendingUp, Users, Building2, Loader2 } from 'lucide-react'
import { adminAPI } from '../lib/api'
import { toast } from 'sonner'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const ReportsTab = ({ user, token }) => {
  const [loading, setLoading] = useState(true)
  const [summaryData, setSummaryData] = useState(null)
  const [plantStats, setPlantStats] = useState(null)
  const [supplierStats, setSupplierStats] = useState(null)
  const [plants, setPlants] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [selectedPlantId, setSelectedPlantId] = useState(null)
  const [selectedSupplierId, setSelectedSupplierId] = useState(null)
  const [activeReportTab, setActiveReportTab] = useState('summary')
  
  // Período padrão: últimos 30 dias
  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(today.getDate() - 30)
  
  const [startDate, setStartDate] = useState(thirtyDaysAgo.toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0])

  useEffect(() => {
    loadPlants()
    loadSuppliers()
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      loadSummaryData()
    }
  }, [startDate, endDate])

  useEffect(() => {
    if (selectedPlantId && startDate && endDate) {
      loadPlantStats()
    }
  }, [selectedPlantId, startDate, endDate])

  useEffect(() => {
    if (selectedSupplierId && startDate && endDate) {
      loadSupplierStats()
    }
  }, [selectedSupplierId, startDate, endDate])

  const loadPlants = async () => {
    try {
      const data = await adminAPI.getPlants()
      setPlants(data.filter(p => p.is_active))
    } catch (err) {
      console.error('Erro ao carregar plantas:', err)
    }
  }

  const loadSuppliers = async () => {
    try {
      const data = await adminAPI.getSuppliers()
      setSuppliers(data.filter(s => s.is_active && !s.is_deleted))
    } catch (err) {
      console.error('Erro ao carregar fornecedores:', err)
    }
  }

  const loadSummaryData = async () => {
    try {
      setLoading(true)
      const data = await adminAPI.getDashboardSummary(startDate, endDate)
      setSummaryData(data)
    } catch (err) {
      toast.error('Erro ao carregar resumo', {
        description: err.response?.data?.error || err.message
      })
    } finally {
      setLoading(false)
    }
  }

  const loadPlantStats = async () => {
    try {
      setLoading(true)
      const data = await adminAPI.getPlantStats(selectedPlantId, startDate, endDate)
      setPlantStats(data)
    } catch (err) {
      toast.error('Erro ao carregar estatísticas da planta', {
        description: err.response?.data?.error || err.message
      })
    } finally {
      setLoading(false)
    }
  }

  const loadSupplierStats = async () => {
    try {
      setLoading(true)
      const data = await adminAPI.getSupplierStats(selectedSupplierId, startDate, endDate)
      setSupplierStats(data)
    } catch (err) {
      toast.error('Erro ao carregar estatísticas do fornecedor', {
        description: err.response?.data?.error || err.message
      })
    } finally {
      setLoading(false)
    }
  }

  const statusColors = {
    scheduled: '#3b82f6',
    checked_in: '#10b981',
    checked_out: '#6366f1',
    rescheduled: '#f59e0b',
    cancelled: '#ef4444'
  }

  const statusLabels = {
    scheduled: 'Agendados',
    checked_in: 'Check-in',
    checked_out: 'Check-out',
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

  // Preparar dados para gráfico de linha (agendamentos por dia)
  const dailyChartData = plantStats?.daily_appointments || supplierStats?.daily_appointments || []

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Relatórios</h2>
      </div>

      {/* Filtros de Período */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Data Inicial</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">Data Final</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Período Rápido</Label>
              <Select
                value=""
                onValueChange={(value) => {
                  const today = new Date()
                  const end = today.toISOString().split('T')[0]
                  let start = new Date(today)
                  
                  switch(value) {
                    case '7':
                      start.setDate(today.getDate() - 7)
                      break
                    case '30':
                      start.setDate(today.getDate() - 30)
                      break
                    case '90':
                      start.setDate(today.getDate() - 90)
                      break
                    default:
                      return
                  }
                  
                  setStartDate(start.toISOString().split('T')[0])
                  setEndDate(end)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={loadSummaryData} className="w-full">
                Atualizar
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
                  {summaryData?.average_occupation_rate?.toFixed(1) || '0.0'}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Média das plantas
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
                  Cadastrados no sistema
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Plantas Ativas
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {summaryData?.active_plants || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Cadastradas no sistema
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs de Relatórios */}
      <Tabs value={activeReportTab} onValueChange={setActiveReportTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="summary">Resumo Geral</TabsTrigger>
          <TabsTrigger value="plant">Relatório de Planta</TabsTrigger>
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
                    <CardTitle>Agendamentos por Status</CardTitle>
                    <CardDescription>
                      Distribuição de agendamentos no período selecionado
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer
                      config={{
                        scheduled: { label: 'Agendados', color: '#3b82f6' },
                        checked_in: { label: 'Check-in', color: '#10b981' },
                        checked_out: { label: 'Check-out', color: '#6366f1' },
                        rescheduled: { label: 'Reagendados', color: '#f59e0b' },
                        cancelled: { label: 'Cancelados', color: '#ef4444' }
                      }}
                    >
                      <PieChart>
                        <Pie
                          data={statusChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label
                        >
                          {statusChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Tab Relatório de Planta */}
        <TabsContent value="plant" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Selecionar Planta</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedPlantId?.toString() || ''} onValueChange={(value) => setSelectedPlantId(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma planta..." />
                </SelectTrigger>
                <SelectContent>
                  {plants.map((plant) => (
                    <SelectItem key={plant.id} value={plant.id.toString()}>
                      {plant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedPlantId && plantStats && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Total de Agendamentos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{plantStats.total_appointments}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Taxa de Ocupação</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{plantStats.occupation_rate?.toFixed(1)}%</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Planta</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm font-medium">{plantStats.plant?.name}</div>
                    <div className="text-xs text-muted-foreground">Capacidade: {plantStats.plant?.max_capacity}</div>
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
                        count: { label: 'Agendamentos', color: '#3b82f6' }
                      }}
                    >
                      <LineChart data={dailyChartData}>
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
                        <Line 
                          type="monotone" 
                          dataKey="count" 
                          stroke="#3b82f6" 
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              )}

              {/* Top Fornecedores */}
              {plantStats.top_suppliers && plantStats.top_suppliers.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Top Fornecedores</CardTitle>
                    <CardDescription>
                      Fornecedores com mais agendamentos nesta planta
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {plantStats.top_suppliers.map((supplier, index) => (
                        <div key={supplier.supplier_id} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">#{index + 1}</span>
                            <span>{supplier.supplier_name}</span>
                          </div>
                          <span className="font-bold">{supplier.count} agendamentos</span>
                        </div>
                      ))}
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
              <CardTitle>Selecionar Fornecedor</CardTitle>
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

              {/* Top Plantas */}
              {supplierStats.top_plants && supplierStats.top_plants.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Top Plantas</CardTitle>
                    <CardDescription>
                      Plantas mais utilizadas por este fornecedor
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {supplierStats.top_plants.map((plant, index) => (
                        <div key={plant.plant_id} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">#{index + 1}</span>
                            <span>{plant.plant_name}</span>
                          </div>
                          <span className="font-bold">{plant.count} agendamentos</span>
                        </div>
                      ))}
                    </div>
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

export default ReportsTab
