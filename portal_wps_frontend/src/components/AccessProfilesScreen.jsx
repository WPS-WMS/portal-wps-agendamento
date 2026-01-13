import React, { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowLeft, Save, RotateCcw, CheckCircle, Search, ChevronDown, ChevronUp, CheckCircle2, Eye as EyeIcon, XCircle, AlertTriangle, Copy, Layers } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { adminAPI } from '../lib/api'

// Tipos de permissão
const PERMISSION_TYPES = {
  EDITOR: 'editor',
  VIEWER: 'viewer',
  NONE: 'none'
}

// Ícones e cores para cada tipo de permissão
const PERMISSION_CONFIG = {
  [PERMISSION_TYPES.EDITOR]: {
    icon: CheckCircle2,
    color: 'bg-blue-500',
    textColor: 'text-blue-700',
    label: 'Editor',
    description: 'Acesso completo (criar, editar, excluir)'
  },
  [PERMISSION_TYPES.VIEWER]: {
    icon: EyeIcon,
    color: 'bg-green-500',
    textColor: 'text-green-700',
    label: 'Visualizador',
    description: 'Apenas visualização'
  },
  [PERMISSION_TYPES.NONE]: {
    icon: XCircle,
    color: 'bg-gray-300',
    textColor: 'text-gray-600',
    label: 'Sem acesso',
    description: 'Sem permissão'
  }
}

// Estrutura completa de módulos e funcionalidades
const MODULES = [
  {
    id: 'appointments',
    name: 'Agendamentos',
    color: 'bg-blue-100 text-blue-700 border-blue-300',
    functions: [
      { id: 'create_appointment', name: 'Criar agendamento', icon: '📅' },
      { id: 'view_appointments', name: 'Visualizar agendamentos', icon: '👁️' },
      { id: 'edit_appointment', name: 'Editar agendamento', icon: '✏️' },
      { id: 'delete_appointment', name: 'Excluir agendamento', icon: '🗑️' },
      { id: 'check_in', name: 'Check-in', icon: '✅' },
      { id: 'check_out', name: 'Check-out', icon: '🏁' },
      { id: 'reschedule', name: 'Reagendar', icon: '🔄' }
    ]
  },
  {
    id: 'suppliers',
    name: 'Fornecedores',
    color: 'bg-purple-100 text-purple-700 border-purple-300',
    functions: [
      { id: 'create_supplier', name: 'Criar fornecedor', icon: '➕' },
      { id: 'view_suppliers', name: 'Visualizar fornecedores', icon: '👁️' },
      { id: 'edit_supplier', name: 'Editar fornecedor', icon: '✏️' },
      { id: 'inactivate_supplier', name: 'Inativar/Ativar fornecedor', icon: '🔒' },
      { id: 'delete_supplier', name: 'Excluir fornecedor', icon: '🗑️' }
    ]
  },
  {
    id: 'plants',
    name: 'Plantas',
    color: 'bg-green-100 text-green-700 border-green-300',
    functions: [
      { id: 'create_plant', name: 'Criar planta', icon: '➕' },
      { id: 'view_plants', name: 'Visualizar plantas', icon: '👁️' },
      { id: 'edit_plant', name: 'Editar planta', icon: '✏️' },
      { id: 'inactivate_plant', name: 'Inativar/Ativar planta', icon: '🔒' },
      { id: 'delete_plant', name: 'Excluir planta', icon: '🗑️' },
      { id: 'configure_plant_hours', name: 'Configurar horários da planta', icon: '⏰' }
    ]
  },
  {
    id: 'schedule_config',
    name: 'Configurações de Horários',
    color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    functions: [
      { id: 'configure_default_hours', name: 'Horário Padrão', icon: '🕐' },
      { id: 'configure_weekly_block', name: 'Bloqueio Semanal', icon: '📆' },
      { id: 'configure_date_block', name: 'Bloqueio por Data', icon: '📅' },
      { id: 'view_available_hours', name: 'Visualizar horários disponíveis', icon: '👁️' }
    ]
  }
]

// Perfis do sistema (Admin não aparece pois tem acesso total a tudo)
const PROFILES = [
  { id: 'supplier', name: 'Fornecedor' },
  { id: 'plant', name: 'Planta' }
]

// Inicializar todas as permissões como "Editor" por padrão
const initializePermissions = () => {
  const permissions = {}
  MODULES.forEach(module => {
    module.functions.forEach(func => {
      permissions[func.id] = {
        supplier: PERMISSION_TYPES.EDITOR,
        plant: PERMISSION_TYPES.EDITOR
      }
    })
  })
  return permissions
}

// Dependências de permissões (funcionalidade requer outra)
// RN-05: Permissões de edição, exclusão, inativação ou configuração dependem da permissão de visualização
const PERMISSION_DEPENDENCIES = {
  // Agendamentos
  edit_appointment: ['view_appointments'],
  delete_appointment: ['view_appointments'],
  check_in: ['view_appointments'], // Para fazer check-in, precisa visualizar agendamentos
  check_out: ['check_in'], // Check-out depende de check-in
  reschedule: ['view_appointments'], // Para reagendar, precisa visualizar agendamentos
  // Fornecedores
  edit_supplier: ['view_suppliers'],
  inactivate_supplier: ['view_suppliers'],
  delete_supplier: ['view_suppliers'],
  // Plantas
  edit_plant: ['view_plants'],
  inactivate_plant: ['view_plants'],
  delete_plant: ['view_plants'],
  configure_plant_hours: ['view_plants'],
  // Configurações de Horários
  configure_weekly_block: ['view_available_hours'],
  configure_date_block: ['view_available_hours'],
  configure_default_hours: ['view_available_hours']
}

const AccessProfilesScreen = ({ onBack, user }) => {
  // VALIDAÇÃO DE ACESSO: Apenas administradores podem acessar esta tela
  // Esta validação garante segurança mesmo se o componente for acessado diretamente
  if (!user || user.role !== 'admin') {
    return (
      <div className="max-w-7xl mx-auto space-y-6 p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Acesso negado. Apenas administradores podem acessar a funcionalidade de Perfis de Acesso.
          </AlertDescription>
        </Alert>
        <Button onClick={onBack} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
      </div>
    )
  }

  const [permissions, setPermissions] = useState(initializePermissions())
  const [originalPermissions, setOriginalPermissions] = useState(initializePermissions())
  const [expandedModules, setExpandedModules] = useState(MODULES.map(m => m.id))
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedModule, setSelectedModule] = useState(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)
  const [showBackConfirm, setShowBackConfirm] = useState(false)

  // Calcular alterações
  const changesSummary = useMemo(() => {
    const changes = []
    let totalChanges = 0
    
    MODULES.forEach(module => {
      module.functions.forEach(func => {
        PROFILES.forEach(profile => {
          const current = permissions[func.id]?.[profile.id] || PERMISSION_TYPES.NONE
          const original = originalPermissions[func.id]?.[profile.id] || PERMISSION_TYPES.NONE
          
          if (current !== original) {
            totalChanges++
            const currentLabel = PERMISSION_CONFIG[current].label
            const originalLabel = PERMISSION_CONFIG[original].label
            
            changes.push({
              function: func.name,
              profile: profile.name,
              from: originalLabel,
              to: currentLabel,
              module: module.name
            })
          }
        })
      })
    })
    
    return { total: totalChanges, details: changes }
  }, [permissions, originalPermissions])

  // Verificar se há alterações
  const hasChanges = changesSummary.total > 0

  // Filtrar módulos e funcionalidades baseado na busca
  const filteredModules = MODULES.map(module => {
    const filteredFunctions = module.functions.filter(func =>
      func.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      module.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    return { ...module, functions: filteredFunctions }
  }).filter(module => module.functions.length > 0 || !searchTerm)

  // Validar dependências (função auxiliar para ações em massa)
  // CORREÇÃO: Esta função agora é usada apenas para ações em massa, onde recebemos o estado atualizado
  const validateDependencies = (functionId, profileId, newPermission, currentPermissions) => {
    const dependencies = PERMISSION_DEPENDENCIES[functionId] || []
    
    if (newPermission !== PERMISSION_TYPES.NONE && dependencies.length > 0) {
      // Aplicar dependências diretamente no objeto de permissões recebido
      dependencies.forEach(depId => {
        const depPermission = currentPermissions[depId]?.[profileId] || PERMISSION_TYPES.NONE
        if (depPermission === PERMISSION_TYPES.NONE) {
          // Auto-aplicar permissão de visualização se necessário
          if (!currentPermissions[depId]) {
            currentPermissions[depId] = {}
          }
          currentPermissions[depId][profileId] = PERMISSION_TYPES.VIEWER
        }
      })
    }
  }

  // Alternar permissão
  // COMPORTAMENTO OBRIGATÓRIO: Ciclo Editor → Visualizador → Sem acesso → Editor
  const togglePermission = (functionId, profileId) => {
    // Garantir que sempre tenha um valor válido (padrão: NONE se não existir)
    const currentPermission = permissions[functionId]?.[profileId] || PERMISSION_TYPES.NONE
    const permissionOrder = [
      PERMISSION_TYPES.EDITOR,
      PERMISSION_TYPES.VIEWER,
      PERMISSION_TYPES.NONE
    ]
    const currentIndex = permissionOrder.indexOf(currentPermission)
    const nextIndex = (currentIndex + 1) % permissionOrder.length
    const nextPermission = permissionOrder[nextIndex]

    // CORREÇÃO: Atualizar estado e validar dependências em uma única operação
    setPermissions(prev => {
      const updated = {
        ...prev,
        [functionId]: {
          ...(prev[functionId] || {}),
          [profileId]: nextPermission
        }
      }
      
      // Validar e aplicar dependências imediatamente no mesmo estado
      const dependencies = PERMISSION_DEPENDENCIES[functionId] || []
      if (nextPermission !== PERMISSION_TYPES.NONE && dependencies.length > 0) {
        dependencies.forEach(depId => {
          const depPermission = updated[depId]?.[profileId] || PERMISSION_TYPES.NONE
          if (depPermission === PERMISSION_TYPES.NONE) {
            if (!updated[depId]) {
              updated[depId] = {}
            }
            updated[depId][profileId] = PERMISSION_TYPES.VIEWER
          }
        })
      }
      
      return updated
    })
    
    setSuccess('')
    setError('')
  }

  // Ações em massa por módulo
  // CORREÇÃO: Validar dependências após atualizar todas as permissões
  const applyBulkPermission = (moduleId, profileId, permissionType) => {
    const module = MODULES.find(m => m.id === moduleId)
    if (!module) return

    setPermissions(prev => {
      const newPermissions = { ...prev }
      module.functions.forEach(func => {
        if (!newPermissions[func.id]) {
          newPermissions[func.id] = {}
        }
        newPermissions[func.id][profileId] = permissionType
      })
      
      // Validar dependências após todas as atualizações
      module.functions.forEach(func => {
        validateDependencies(func.id, profileId, permissionType, newPermissions)
      })
      
      return newPermissions
    })
    setSuccess('')
    setError('')
  }

  // Alternar expansão de módulo
  const toggleModule = (moduleId) => {
    setExpandedModules(prev =>
      prev.includes(moduleId)
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    )
  }

  // Salvar alterações
  const handleSave = async () => {
    try {
      setSaving(true)
      setError('')
      setShowSaveConfirm(false)
      
      // Remover 'admin' das permissões antes de salvar (admin tem acesso total)
      const permissionsToSave = {}
      Object.keys(permissions).forEach(functionId => {
        permissionsToSave[functionId] = { ...permissions[functionId] }
        delete permissionsToSave[functionId].admin
      })
      
      // Salvar no backend via API
      const response = await adminAPI.savePermissions(permissionsToSave)
      
      // Recarregar do backend para garantir sincronização
      const savedPermissions = response?.permissions || await adminAPI.getPermissions()
      
      if (savedPermissions && Object.keys(savedPermissions).length > 0) {
        // Mesclar com valores padrão NONE para garantir que todas as funcionalidades estejam presentes
        const mergedPermissions = initializePermissions()
        // Substituir valores padrão EDITOR por NONE primeiro
        Object.keys(mergedPermissions).forEach(functionId => {
          Object.keys(mergedPermissions[functionId]).forEach(role => {
            mergedPermissions[functionId][role] = PERMISSION_TYPES.NONE
          })
        })
        // Mesclar com dados salvos do backend (filtrar 'admin')
        Object.keys(savedPermissions).forEach(functionId => {
          if (mergedPermissions[functionId]) {
            // Remover 'admin' das permissões do backend antes de mesclar
            const backendPermissions = { ...savedPermissions[functionId] }
            delete backendPermissions.admin
            
            mergedPermissions[functionId] = {
              ...mergedPermissions[functionId],
              ...backendPermissions
            }
          } else {
            // Remover 'admin' das permissões do backend
            const backendPermissions = { ...savedPermissions[functionId] }
            delete backendPermissions.admin
            mergedPermissions[functionId] = backendPermissions
          }
        })
        setPermissions(mergedPermissions)
        setOriginalPermissions(JSON.parse(JSON.stringify(mergedPermissions)))
        // Também salvar no localStorage como backup
        localStorage.setItem('access_profiles', JSON.stringify(mergedPermissions))
      } else {
        // Fallback: usar o que foi enviado
        setOriginalPermissions(JSON.parse(JSON.stringify(permissions)))
        localStorage.setItem('access_profiles', JSON.stringify(permissions))
      }
      
      setSuccess('Permissões salvas com sucesso!')
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Erro ao salvar permissões: ' + (err.response?.data?.error || err.message))
    } finally {
      setSaving(false)
    }
  }

  // Abrir modal de confirmação
  const handleSaveClick = () => {
    if (hasChanges) {
      setShowSaveConfirm(true)
    }
  }

  // Reverter alterações
  const handleRevert = () => {
    setPermissions(JSON.parse(JSON.stringify(originalPermissions)))
    setSuccess('')
    setError('')
  }

  // RN-08: Botão Voltar deve descartar alterações não salvas
  const handleBack = () => {
    if (hasChanges) {
      setShowBackConfirm(true)
    } else {
      onBack()
    }
  }

  // Confirmar descarte de alterações e voltar
  const handleConfirmBack = () => {
    setShowBackConfirm(false)
    onBack()
  }

  // Carregar permissões salvas
  useEffect(() => {
    const loadPermissions = async () => {
      try {
        // Tentar carregar do backend primeiro
        const data = await adminAPI.getPermissions()
        if (data && Object.keys(data).length > 0) {
          // Inicializar com valores padrão NONE (não EDITOR) e depois mesclar com dados do backend
          const mergedPermissions = initializePermissions()
          // Substituir valores padrão EDITOR por NONE primeiro
          Object.keys(mergedPermissions).forEach(functionId => {
            Object.keys(mergedPermissions[functionId]).forEach(role => {
              mergedPermissions[functionId][role] = PERMISSION_TYPES.NONE
            })
          })
          // Agora mesclar com dados do backend (isso sobrescreve apenas as permissões salvas)
          // Filtrar 'admin' das permissões do backend, pois admin tem acesso total
          Object.keys(data).forEach(functionId => {
            if (mergedPermissions[functionId]) {
              // Remover 'admin' das permissões do backend antes de mesclar
              const backendPermissions = { ...data[functionId] }
              delete backendPermissions.admin
              
              mergedPermissions[functionId] = {
                ...mergedPermissions[functionId],
                ...backendPermissions
              }
            } else {
              // Remover 'admin' das permissões do backend
              const backendPermissions = { ...data[functionId] }
              delete backendPermissions.admin
              mergedPermissions[functionId] = backendPermissions
            }
          })
          setPermissions(mergedPermissions)
          setOriginalPermissions(JSON.parse(JSON.stringify(mergedPermissions)))
        } else {
          // Se não houver no backend, tentar localStorage
          const saved = localStorage.getItem('access_profiles')
          if (saved) {
            try {
              const parsed = JSON.parse(saved)
              // Mesclar com valores padrão NONE
              const mergedPermissions = initializePermissions()
              Object.keys(mergedPermissions).forEach(functionId => {
                Object.keys(mergedPermissions[functionId]).forEach(role => {
                  mergedPermissions[functionId][role] = PERMISSION_TYPES.NONE
                })
              })
              Object.keys(parsed).forEach(functionId => {
                if (mergedPermissions[functionId]) {
                  // Remover 'admin' das permissões do localStorage antes de mesclar
                  const localStoragePermissions = { ...parsed[functionId] }
                  delete localStoragePermissions.admin
                  
                  mergedPermissions[functionId] = {
                    ...mergedPermissions[functionId],
                    ...localStoragePermissions
                  }
                } else {
                  // Remover 'admin' das permissões do localStorage
                  const localStoragePermissions = { ...parsed[functionId] }
                  delete localStoragePermissions.admin
                  mergedPermissions[functionId] = localStoragePermissions
                }
              })
              setPermissions(mergedPermissions)
              setOriginalPermissions(JSON.parse(JSON.stringify(mergedPermissions)))
            } catch (e) {
              console.error('Erro ao carregar permissões do localStorage:', e)
            }
          }
        }
      } catch (err) {
        console.error('Erro ao carregar permissões do backend:', err)
        // Fallback para localStorage
        const saved = localStorage.getItem('access_profiles')
        if (saved) {
          try {
            const parsed = JSON.parse(saved)
            // Mesclar com valores padrão NONE
            const mergedPermissions = initializePermissions()
            Object.keys(mergedPermissions).forEach(functionId => {
              Object.keys(mergedPermissions[functionId]).forEach(role => {
                mergedPermissions[functionId][role] = PERMISSION_TYPES.NONE
              })
            })
            Object.keys(parsed).forEach(functionId => {
              if (mergedPermissions[functionId]) {
                // Remover 'admin' das permissões do localStorage antes de mesclar
                const localStoragePermissions = { ...parsed[functionId] }
                delete localStoragePermissions.admin
                
                mergedPermissions[functionId] = {
                  ...mergedPermissions[functionId],
                  ...localStoragePermissions
                }
              } else {
                // Remover 'admin' das permissões do localStorage
                const localStoragePermissions = { ...parsed[functionId] }
                delete localStoragePermissions.admin
                mergedPermissions[functionId] = localStoragePermissions
              }
            })
            setPermissions(mergedPermissions)
            setOriginalPermissions(JSON.parse(JSON.stringify(mergedPermissions)))
          } catch (e) {
            console.error('Erro ao carregar permissões do localStorage:', e)
          }
        }
      }
    }

    loadPermissions()
  }, [])

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Perfis de Acesso</h1>
          <p className="text-gray-600">Gerencie as permissões de acesso para cada perfil do sistema</p>
        </div>
        {/* RN-08: Botão Voltar descarta alterações não salvas */}
        <Button onClick={handleBack} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
      </div>

      {/* Mensagens de sucesso/erro */}
      {success && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Legenda */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Legenda de Permissões</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {Object.entries(PERMISSION_CONFIG).map(([key, config]) => {
              const Icon = config.icon
              return (
                <TooltipProvider key={key}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 cursor-help">
                        <div className={`w-6 h-6 rounded flex items-center justify-center ${config.color}`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-sm font-medium">{config.label}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{config.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar funcionalidade ou módulo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {MODULES.map(module => (
                <Badge
                  key={module.id}
                  variant={selectedModule === module.id ? 'default' : 'outline'}
                  className={`cursor-pointer ${module.color}`}
                  onClick={() => setSelectedModule(selectedModule === module.id ? null : module.id)}
                >
                  {module.name}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botões de ação */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600">
          {hasChanges && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <span className="text-orange-600 font-medium">
                {changesSummary.total} alteração(ões) não salva(s)
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <Button onClick={handleRevert} variant="outline">
              <RotateCcw className="w-4 h-4 mr-2" />
              Reverter
            </Button>
          )}
          {/* COMPORTAMENTO OBRIGATÓRIO: Botão Salvar desabilitado quando não há alterações */}
          <Button onClick={handleSaveClick} disabled={!hasChanges || saving}>
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salvar Alterações {hasChanges && `(${changesSummary.total})`}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Modal de Confirmação - Voltar (RN-08) */}
      <Dialog open={showBackConfirm} onOpenChange={setShowBackConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              Descartar Alterações?
            </DialogTitle>
            <DialogDescription>
              Você tem {changesSummary.total} alteração(ões) não salva(s). Deseja descartá-las e voltar para a tela de Configurações?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBackConfirm(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmBack}>
              Descartar e Voltar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação - Salvar */}
      <Dialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              Confirmar Alterações de Permissões
            </DialogTitle>
            <DialogDescription>
              Você está prestes a salvar {changesSummary.total} alteração(ões) nas permissões do sistema.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <strong>Atenção:</strong> Estas alterações afetarão o acesso de todos os usuários com os perfis modificados.
              </AlertDescription>
            </Alert>

            {changesSummary.details.length > 0 && (
              <div className="space-y-2">
                <p className="font-semibold text-sm text-gray-700">Resumo das alterações:</p>
                <div className="max-h-60 overflow-y-auto border rounded-lg p-3 space-y-2">
                  {changesSummary.details.slice(0, 20).map((change, index) => (
                    <div key={index} className="text-sm bg-gray-50 p-2 rounded">
                      <span className="font-medium">{change.function}</span> ({change.profile}): 
                      <span className="text-gray-600"> {change.from}</span> → 
                      <span className="text-green-600 font-medium"> {change.to}</span>
                    </div>
                  ))}
                  {changesSummary.details.length > 20 && (
                    <p className="text-xs text-gray-500 text-center pt-2">
                      ... e mais {changesSummary.details.length - 20} alteração(ões)
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveConfirm(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Confirmar e Salvar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tabela de Permissões */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[calc(100vh-400px)]">
            <table className="w-full">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr className="border-b">
                  <th className="text-left p-4 font-semibold text-gray-700 min-w-[300px] bg-gray-50">
                    Funcionalidade
                  </th>
                  {PROFILES.map(profile => (
                    <th
                      key={profile.id}
                      className="text-center p-4 font-semibold text-gray-700 min-w-[150px] align-middle bg-gray-50"
                    >
                      <div className="flex flex-col justify-center items-center gap-1">
                        <span>{profile.name}</span>
                        <div className="flex gap-1 mt-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => {
                                    filteredModules.forEach(module => {
                                      if (expandedModules.includes(module.id)) {
                                        applyBulkPermission(module.id, profile.id, PERMISSION_TYPES.EDITOR)
                                      }
                                    })
                                  }}
                                  className="w-6 h-6 rounded bg-blue-100 hover:bg-blue-200 flex items-center justify-center text-xs transition-colors"
                                  title="Tornar tudo Editor"
                                >
                                  <CheckCircle2 className="w-3 h-3 text-blue-600" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Tornar tudo Editor</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => {
                                    filteredModules.forEach(module => {
                                      if (expandedModules.includes(module.id)) {
                                        applyBulkPermission(module.id, profile.id, PERMISSION_TYPES.VIEWER)
                                      }
                                    })
                                  }}
                                  className="w-6 h-6 rounded bg-green-100 hover:bg-green-200 flex items-center justify-center text-xs transition-colors"
                                  title="Tornar tudo Visualizador"
                                >
                                  <EyeIcon className="w-3 h-3 text-green-600" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Tornar tudo Visualizador</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => {
                                    filteredModules.forEach(module => {
                                      if (expandedModules.includes(module.id)) {
                                        applyBulkPermission(module.id, profile.id, PERMISSION_TYPES.NONE)
                                      }
                                    })
                                  }}
                                  className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-xs transition-colors"
                                  title="Remover tudo"
                                >
                                  <XCircle className="w-3 h-3 text-gray-600" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Remover tudo</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredModules
                  .filter(module => !selectedModule || module.id === selectedModule)
                  .map(module => (
                    <React.Fragment key={module.id}>
                      {/* Cabeçalho do Módulo */}
                      <tr className="bg-gray-50 border-b">
                        <td colSpan={PROFILES.length + 1} className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge className={module.color}>{module.name}</Badge>
                              <span className="text-sm text-gray-600">
                                {module.functions.length} funcionalidade(s)
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {expandedModules.includes(module.id) && (
                                <div className="flex gap-1">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            PROFILES.forEach(profile => {
                                              applyBulkPermission(module.id, profile.id, PERMISSION_TYPES.EDITOR)
                                            })
                                          }}
                                          className="h-7 px-2"
                                        >
                                          <Layers className="w-3 h-3" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Aplicar Editor a todos os perfis neste módulo</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleModule(module.id)}
                              >
                                {expandedModules.includes(module.id) ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Funcionalidades do Módulo */}
                      {expandedModules.includes(module.id) &&
                        module.functions.map((func, index) => (
                          <tr
                            key={func.id}
                            className={`border-b hover:bg-gray-50 transition-colors ${
                              index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                            }`}
                          >
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{func.icon}</span>
                                <span className="font-medium text-gray-800">{func.name}</span>
                              </div>
                            </td>
                            {PROFILES.map(profile => {
                              const permission = permissions[func.id]?.[profile.id] || PERMISSION_TYPES.NONE
                              const config = PERMISSION_CONFIG[permission]
                              const Icon = config.icon

                              return (
                                <td key={profile.id} className="p-4 text-center align-middle">
                                  <div className="flex justify-center items-center">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            onClick={() => togglePermission(func.id, profile.id)}
                                            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all hover:scale-110 ${config.color} cursor-pointer`}
                                          >
                                            <Icon className="w-5 h-5 text-white" />
                                          </button>
                                        </TooltipTrigger>
                                      <TooltipContent>
                                        <div className="text-center">
                                          <p className="font-semibold">{config.label}</p>
                                          <p className="text-xs">{config.description}</p>
                                          <p className="text-xs mt-1 text-gray-400">
                                            Clique para alterar
                                          </p>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  </div>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                    </React.Fragment>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}

export default AccessProfilesScreen

