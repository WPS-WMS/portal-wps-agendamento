import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Shield, 
  Eye as EyeIcon, 
  CheckCircle2, 
  XCircle, 
  ExternalLink,
  Info
} from 'lucide-react'
import { adminAPI } from '../lib/api'

const PERMISSION_TYPES = {
  EDITOR: 'editor',
  VIEWER: 'viewer',
  NONE: 'none'
}

const PERMISSION_CONFIG = {
  [PERMISSION_TYPES.EDITOR]: {
    icon: CheckCircle2,
    color: 'bg-blue-500',
    textColor: 'text-blue-700',
    label: 'Editor',
    description: 'Acesso completo'
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

const MODULES = [
  {
    id: 'appointments',
    name: 'Agendamentos',
    functions: ['create_appointment', 'view_appointments', 'edit_appointment', 'delete_appointment', 'check_in', 'check_out']
  },
  {
    id: 'suppliers',
    name: 'Fornecedores',
    functions: ['create_supplier', 'view_suppliers', 'edit_supplier', 'inactivate_supplier', 'delete_supplier']
  },
  {
    id: 'plants',
    name: 'Plantas',
    functions: ['create_plant', 'view_plants', 'edit_plant', 'inactivate_plant', 'delete_plant', 'configure_plant_hours']
  },
  {
    id: 'schedule_config',
    name: 'Configurações de Horários',
    functions: ['configure_default_hours', 'configure_weekly_block', 'configure_date_block']
  },
  {
    id: 'system_config',
    name: 'Configurações do Sistema',
    functions: ['configure_max_capacity', 'view_statistics', 'manage_users']
  }
]

const UserPermissionsPreview = ({ userRole, onNavigateToAccessProfiles }) => {
  const [permissions, setPermissions] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!userRole) {
      setLoading(false)
      return
    }

    const loadPermissions = async () => {
      try {
        setLoading(true)
        const data = await adminAPI.getPermissions()
        
        if (data && Object.keys(data).length > 0) {
          setPermissions(data)
        } else {
          setPermissions({})
        }
        setError('')
      } catch (err) {
        console.error('Erro ao carregar permissões:', err)
        setError('Erro ao carregar permissões')
        setPermissions({})
      } finally {
        setLoading(false)
      }
    }

    loadPermissions()
  }, [userRole])

  if (!userRole) {
    return null
  }

  // Admin sempre tem acesso completo
  if (userRole === 'admin') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Permissões do Usuário
          </CardTitle>
          <CardDescription>
            Permissões baseadas no perfil de acesso configurado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="bg-purple-50 border-purple-200">
            <Shield className="w-4 h-4 text-purple-600" />
            <AlertDescription className="text-purple-800">
              <strong>Administrador:</strong> Este usuário tem acesso completo a todas as funcionalidades do sistema.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  // Contar permissões por tipo
  const permissionCounts = {
    editor: 0,
    viewer: 0,
    none: 0
  }

  const viewPermissions = [
    'view_suppliers', 'view_plants', 'view_appointments', 
    'view_profile', 'view_system_config',
    'view_statistics'
  ]

  MODULES.forEach(module => {
    module.functions.forEach(funcId => {
      const permission = permissions[funcId]?.[userRole]
      const defaultPermission = viewPermissions.includes(funcId) ? PERMISSION_TYPES.VIEWER : PERMISSION_TYPES.NONE
      const finalPermission = permission || defaultPermission
      permissionCounts[finalPermission] = (permissionCounts[finalPermission] || 0) + 1
    })
  })

  const totalPermissions = Object.values(permissionCounts).reduce((a, b) => a + b, 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Permissões do Usuário
            </CardTitle>
            <CardDescription>
              Permissões baseadas no perfil "{userRole === 'supplier' ? 'Fornecedor' : 'Planta'}" configurado em Perfis de Acesso
            </CardDescription>
          </div>
          {onNavigateToAccessProfiles && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateToAccessProfiles}
              className="flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Configurar Perfis
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-center py-4 text-gray-500">
            Carregando permissões...
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <>
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="w-4 h-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                As permissões deste usuário são controladas pela configuração do perfil "{userRole === 'supplier' ? 'Fornecedor' : 'Planta'}" na tela de <strong>Perfis de Acesso</strong>.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(PERMISSION_CONFIG).map(([key, config]) => {
                const count = permissionCounts[key] || 0
                const Icon = config.icon
                const bgColor = config.color.replace('bg-', 'bg-').replace('-500', '-50')
                const borderColor = config.textColor.replace('text-', 'border-').replace('-700', '-200')
                return (
                  <div
                    key={key}
                    className={`p-3 rounded-lg border-2 ${bgColor} ${borderColor}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-8 h-8 rounded flex items-center justify-center ${config.color}`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <span className="font-semibold text-sm">{config.label}</span>
                    </div>
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-xs text-gray-600">{config.description}</div>
                  </div>
                )
              })}
            </div>

            <div className="pt-2 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Total de funcionalidades:</span>
                <span className="font-semibold">{totalPermissions}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default UserPermissionsPreview

