import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Plus, Clock, Edit, Trash2, UserCheck, UserX, Shield, Building2, Users } from 'lucide-react'
import { adminAPI } from '../lib/api'
import UserForm from './UserForm'
import UserManagement from './UserManagement'

const UsersScreen = ({ onBack, onNavigateToAccessProfiles }) => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showUserForm, setShowUserForm] = useState(false)
  const [showUserManagement, setShowUserManagement] = useState(false)
  const [managingUser, setManagingUser] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  const loadUsers = async () => {
    try {
      setLoading(true)
      const data = await adminAPI.getUsers()
      console.log('Usuários carregados:', data)
      setUsers(Array.isArray(data) ? data : [])
      setError('')
    } catch (err) {
      console.error('Erro ao carregar usuários:', err)
      setError('Erro ao carregar usuários: ' + err.message)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleManageUser = (user) => {
    setManagingUser(user)
    setShowUserManagement(true)
  }

  const handleUserManagementUpdate = () => {
    loadUsers()
    setShowUserManagement(false)
    setManagingUser(null)
  }

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Administrador',
      supplier: 'Fornecedor',
      plant: 'Planta'
    }
    return labels[role] || role
  }

  const getRoleColor = (role) => {
    const colors = {
      admin: 'bg-purple-100 text-purple-700 border-purple-300',
      supplier: 'bg-blue-100 text-blue-700 border-blue-300',
      plant: 'bg-green-100 text-green-700 border-green-300'
    }
    return colors[role] || 'bg-gray-100 text-gray-700 border-gray-300'
  }

  // Filtrar usuários baseado na busca
  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase()
    return (
      user.email.toLowerCase().includes(searchLower) ||
      getRoleLabel(user.role).toLowerCase().includes(searchLower) ||
      (user.supplier?.description?.toLowerCase().includes(searchLower)) ||
      (user.plant?.name?.toLowerCase().includes(searchLower))
    )
  })

  // Tela de Formulário de Usuário
  if (showUserForm) {
    return (
      <UserForm
        onBack={() => {
          setShowUserForm(false)
          loadUsers()
        }}
        onSuccess={() => {
          setShowUserForm(false)
          loadUsers()
        }}
        onNavigateToAccessProfiles={onNavigateToAccessProfiles}
      />
    )
  }

  // Tela de Gerenciamento de Usuário
  if (showUserManagement && managingUser) {
    return (
      <UserManagement
        user={managingUser}
        onBack={() => {
          setShowUserManagement(false)
          setManagingUser(null)
          loadUsers()
        }}
        onUpdate={handleUserManagementUpdate}
      />
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
          <p className="text-gray-600">Gerencie os usuários do sistema</p>
        </div>
        <Button onClick={onBack} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
      </div>

      {/* Botão Novo Usuário */}
      <div className="flex justify-between items-center">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Input
              placeholder="Buscar por email, perfil ou associação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
            <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          </div>
        </div>
        <Button 
          onClick={() => setShowUserForm(true)} 
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Usuário
        </Button>
      </div>

      {/* Lista de Usuários */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Clock className="w-6 h-6 animate-spin mr-2" />
          Carregando usuários...
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : filteredUsers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">
              {searchTerm ? 'Nenhum usuário encontrado com os filtros aplicados.' : 'Nenhum usuário cadastrado.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((user) => (
            <Card 
              key={user.id}
              className={`transition-all hover:shadow-lg ${
                !user.is_active ? 'opacity-60' : ''
              }`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Shield className="w-5 h-5" />
                      {user.email}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      <Badge className={getRoleColor(user.role)}>
                        {getRoleLabel(user.role)}
                      </Badge>
                    </CardDescription>
                  </div>
                  <Badge 
                    variant={user.is_active ? 'default' : 'secondary'}
                    className={user.is_active ? 'bg-green-500' : 'bg-gray-400'}
                  >
                    {user.is_active ? (
                      <><UserCheck className="w-3 h-3 mr-1" /> Ativo</>
                    ) : (
                      <><UserX className="w-3 h-3 mr-1" /> Inativo</>
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {user.supplier && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Users className="w-4 h-4" />
                      <span>Fornecedor: {user.supplier.description}</span>
                    </div>
                  )}
                  {user.plant && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Building2 className="w-4 h-4" />
                      <span>Planta: {user.plant.name}</span>
                    </div>
                  )}
                  {!user.supplier && !user.plant && user.role === 'admin' && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Shield className="w-4 h-4" />
                      <span>Administrador do sistema</span>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleManageUser(user)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Gerenciar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default UsersScreen

