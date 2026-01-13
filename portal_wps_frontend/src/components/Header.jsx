import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LogOut, Truck, User, Settings } from 'lucide-react'
import ProfileModal from './ProfileModal'
import SettingsModal from './SettingsModal'

const Header = ({ user, onLogout }) => {
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  const getUserInitials = (email) => {
    if (!email) return 'US'
    return email.split('@')[0].substring(0, 2).toUpperCase()
  }

  const getRoleLabel = (role) => {
    return role === 'admin' ? 'Administrador' : 'Fornecedor'
  }

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  const handleToggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen)
  }

  const handleOpenProfile = () => {
    setIsProfileModalOpen(true)
    setIsDropdownOpen(false)
  }

  const handleOpenSettings = () => {
    setIsSettingsModalOpen(true)
    setIsDropdownOpen(false)
  }

  const handleLogout = () => {
    setIsDropdownOpen(false)
    // Limpar todos os dados de autenticação
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    // Chamar função de logout
    onLogout()
  }

  const handleUpdateSuccess = (updatedUser) => {
    // Atualizar dados do usuário no localStorage se necessário
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
    const newUser = { ...currentUser, ...updatedUser }
    localStorage.setItem('user', JSON.stringify(newUser))
  }

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 relative">
          {/* Logo e Título */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Cargo Flow</h1>
              <p className="text-sm text-gray-500">Agendamento de Carga</p>
            </div>
          </div>

          {/* Menu do Usuário */}
          <div className="flex items-center space-x-4">
            <div className="hidden md:block text-right">
              <p className="text-sm font-medium text-gray-900">{user.email}</p>
              <p className="text-xs text-gray-500">{getRoleLabel(user.role)}</p>
            </div>
            
            {/* Dropdown Customizado */}
            <div className="relative" ref={dropdownRef}>
              <Button 
                variant="ghost" 
                className="relative h-10 w-10 rounded-full hover:ring-2 hover:ring-blue-500 hover:ring-offset-2 transition-all p-0"
                aria-label="Menu do usuário"
                onClick={handleToggleDropdown}
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold cursor-pointer">
                    {getUserInitials(user?.email)}
                  </AvatarFallback>
                </Avatar>
              </Button>

              {/* Dropdown Content */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg border border-gray-200 z-50 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200">
                  {/* Nome e Perfil - Não clicável */}
                  <div className="px-3 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">
                      {user?.email}
                    </p>
                    <p className="text-xs text-gray-500">
                      {getRoleLabel(user?.role)}
                    </p>
                  </div>
                  
                  {/* Opções do Menu */}
                  <div className="py-1">
                    {/* Opção: Perfil */}
                    <button
                      onClick={handleOpenProfile}
                      className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <User className="mr-2 h-4 w-4" />
                      <span>Perfil</span>
                    </button>
                    
                    {/* Opção: Configurações */}
                    <button
                      onClick={handleOpenSettings}
                      className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Configurações</span>
                    </button>
                  </div>

                  <div className="border-t border-gray-100">
                    {/* Opção: Sair */}
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Sair</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Modais */}
            <ProfileModal
              isOpen={isProfileModalOpen}
              onClose={() => setIsProfileModalOpen(false)}
              user={user}
              onUpdateSuccess={handleUpdateSuccess}
            />
            
            <SettingsModal
              isOpen={isSettingsModalOpen}
              onClose={() => setIsSettingsModalOpen(false)}
              user={user}
            />
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
