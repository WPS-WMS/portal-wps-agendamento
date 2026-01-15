import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Settings, Bell, Eye, Globe } from 'lucide-react'

const SettingsModal = ({ isOpen, onClose, user }) => {
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: false,
    showEmail: true,
    language: 'pt-BR'
  })

  const handleToggle = (key) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const isAdmin = user?.role === 'admin'

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações
          </DialogTitle>
          <DialogDescription>
            Personalize sua experiência no Cargo Flow
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Notificações */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-gray-500" />
              <h3 className="text-sm font-semibold">Notificações</h3>
            </div>
            
            <div className="space-y-4 pl-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-notifications">Notificações por Email</Label>
                  <p className="text-xs text-gray-500">
                    Receba atualizações sobre seus agendamentos por email
                  </p>
                </div>
                <Switch
                  id="email-notifications"
                  checked={settings.emailNotifications}
                  onCheckedChange={() => handleToggle('emailNotifications')}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="push-notifications">Notificações Push</Label>
                  <p className="text-xs text-gray-500">
                    Receba notificações em tempo real no navegador
                  </p>
                </div>
                <Switch
                  id="push-notifications"
                  checked={settings.pushNotifications}
                  onCheckedChange={() => handleToggle('pushNotifications')}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Privacidade */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-gray-500" />
              <h3 className="text-sm font-semibold">Privacidade</h3>
            </div>
            
            <div className="space-y-4 pl-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="show-email">Exibir Email</Label>
                  <p className="text-xs text-gray-500">
                    Mostrar seu email nos agendamentos
                  </p>
                </div>
                <Switch
                  id="show-email"
                  checked={settings.showEmail}
                  onCheckedChange={() => handleToggle('showEmail')}
                />
              </div>
            </div>
          </div>

          {isAdmin && (
            <>
              <Separator />

              {/* Configurações do Sistema (apenas Admin) */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-gray-500" />
                  <h3 className="text-sm font-semibold">Sistema</h3>
                </div>
                
                <div className="space-y-4 pl-6">
                  <div className="space-y-1">
                    <Label>Idioma</Label>
                    <p className="text-sm text-gray-700">Português (Brasil)</p>
                  </div>

                  <div className="space-y-1">
                    <Label>Versão do Sistema</Label>
                    <p className="text-sm text-gray-700">1.0.0</p>
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Informações da Conta */}
          <div className="space-y-2 bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-700">Informações da Conta</h4>
            <div className="space-y-1 text-xs text-gray-600">
              <p><strong>Email:</strong> {user?.email}</p>
              <p><strong>Perfil:</strong> {
                user?.role === 'admin' ? 'Administrador' :
                user?.role === 'supplier' ? 'Fornecedor' :
                user?.role === 'plant' ? 'Planta' : user?.role
              }</p>
              {user?.supplier_id && (
                <p><strong>ID Fornecedor:</strong> {user.supplier_id}</p>
              )}
              {user?.plant_id && (
                <p><strong>ID Planta:</strong> {user.plant_id}</p>
              )}
            </div>
          </div>
        </div>

        <div className="text-xs text-gray-500 text-center pb-2">
          As configurações são salvas automaticamente
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default SettingsModal

