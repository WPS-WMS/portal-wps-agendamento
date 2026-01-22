import axios from 'axios'

// Em produção (Firebase), use VITE_API_URL (ex: https://web-production-76a65.up.railway.app)
// Em desenvolvimento, mantenha '/api' para o proxy do Vite (localhost:5000)
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

// Configuração do axios com interceptors para adicionar token
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Interceptor para adicionar token em todas as requisições
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Interceptor para tratar erros de autenticação
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Não redirecionar em erro 401 se for:
    // 1. Erro de senha incorreta no perfil
    // 2. Erro de login (email/senha incorretos)
    if (error.response?.status === 401) {
      const url = error.config?.url || ''
      
      // Deixar o erro passar para ser tratado pelo componente nestes casos:
      if (url.includes('/profile') || url.includes('/login')) {
        return Promise.reject(error)
      }
      
      // Para outros casos de 401, fazer logout e redirecionar
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/'
    }
    return Promise.reject(error)
  }
)

// Exportar apiClient para uso em componentes
export { apiClient }

// API de Autenticação
export const authAPI = {
  login: async (credentials) => {
    const response = await apiClient.post('/login', credentials)
    return response.data
  },
  forgotPassword: async (email) => {
    const response = await apiClient.post('/forgot-password', { email })
    return response.data
  },
  verify: async () => {
    const response = await apiClient.get('/verify')
    return response.data
  },
  verifyResetToken: async (token) => {
    const response = await apiClient.post('/verify-reset-token', { token })
    return response.data
  },
  resetPassword: async (token, password) => {
    const response = await apiClient.post('/reset-password', { token, password })
    return response.data
  }
}

// API de Admin
export const adminAPI = {
  // Suppliers
  getSuppliers: async () => {
    const response = await apiClient.get('/admin/suppliers')
    return response.data
  },
  createSupplier: async (data) => {
    const response = await apiClient.post('/admin/suppliers', data)
    return response.data
  },
  updateSupplier: async (id, data) => {
    const response = await apiClient.put(`/admin/suppliers/${id}`, data)
    return response.data
  },
  deleteSupplier: async (id) => {
    const response = await apiClient.delete(`/admin/suppliers/${id}`)
    return response.data
  },

  // Plants
  getPlants: async () => {
    const response = await apiClient.get('/admin/plants')
    return response.data
  },
  createPlant: async (data) => {
    const response = await apiClient.post('/admin/plants', data)
    return response.data
  },
  updatePlant: async (id, data) => {
    const response = await apiClient.put(`/admin/plants/${id}`, data)
    return response.data
  },
  deletePlant: async (id) => {
    const response = await apiClient.delete(`/admin/plants/${id}`)
    return response.data
  },
  getPlantMaxCapacity: async (plantId) => {
    const response = await apiClient.get(`/admin/plants/${plantId}/max-capacity`)
    return response.data
  },
  setPlantMaxCapacity: async (plantId, maxCapacity) => {
    const response = await apiClient.put(`/admin/plants/${plantId}/max-capacity`, { max_capacity: maxCapacity })
    return response.data
  },

  // Appointments
  getAppointments: async (date, plantId = null) => {
    const params = { date }
    if (plantId) {
      params.plant_id = plantId
    }
    const response = await apiClient.get('/admin/appointments', { params })
    return response.data
  },
  createAppointment: async (data) => {
    const response = await apiClient.post('/admin/appointments', data)
    return response.data
  },
  updateAppointment: async (id, data) => {
    const response = await apiClient.put(`/admin/appointments/${id}`, data)
    return response.data
  },
  checkIn: async (appointmentId) => {
    const response = await apiClient.post(`/admin/appointments/${appointmentId}/check-in`)
    return response.data
  },
  checkOut: async (appointmentId) => {
    const response = await apiClient.post(`/admin/appointments/${appointmentId}/check-out`)
    return response.data
  },
  deleteAppointment: async (appointmentId) => {
    const response = await apiClient.delete(`/admin/appointments/${appointmentId}`)
    return response.data
  },

  // Users
  getUsers: async () => {
    const response = await apiClient.get('/admin/users')
    return response.data
  },
  createUser: async (data) => {
    const response = await apiClient.post('/admin/users', data)
    return response.data
  },
  updateUser: async (id, data) => {
    const response = await apiClient.put(`/admin/users/${id}`, data)
    return response.data
  },
  deleteUser: async (id) => {
    const response = await apiClient.delete(`/admin/users/${id}`)
    return response.data
  },
  resetUserPassword: async (id, password) => {
    const response = await apiClient.post(`/admin/users/${id}/reset-password`, { password })
    return response.data
  },

  // Permissions
  getPermissions: async () => {
    const response = await apiClient.get('/admin/permissions')
    return response.data
  },
  getMyPermissions: async () => {
    const response = await apiClient.get('/admin/permissions/my-permissions')
    return response.data
  },
  savePermissions: async (permissions) => {
    // Enviar diretamente o objeto de permissões, sem wrapper
    // Backend espera: { function_id: { role: permission_type } }
    const response = await apiClient.post('/admin/permissions', permissions)
    return response.data
  },

  // Schedule Configuration
  getDefaultSchedule: async (plantId) => {
    const response = await apiClient.get(`/admin/plants/${plantId}/default-schedule`)
    return response.data
  },
  getAvailableTimes: async (date, plantId) => {
    const response = await apiClient.get(`/admin/available-times`, {
      params: { date, plant_id: plantId }
    })
    return response.data
  },
  getOperatingHours: async (plantId) => {
    const response = await apiClient.get(`/admin/plants/${plantId}/operating-hours`)
    return response.data
  },
  saveOperatingHours: async (defaultSchedule, plantId) => {
    const response = await apiClient.post(`/admin/plants/${plantId}/operating-hours`, {
      default_schedule: defaultSchedule
    })
    return response.data
  },
  createDefaultSchedule: async (data) => {
    const response = await apiClient.post('/admin/default-schedule', data)
    return response.data
  },
  deleteDefaultSchedule: async (id) => {
    const response = await apiClient.delete(`/admin/default-schedule/${id}`)
    return response.data
  },
  createScheduleConfig: async (data) => {
    const response = await apiClient.post('/admin/schedule-config', data)
    return response.data
  }
}

// API de Supplier
export const supplierAPI = {
  getSuppliers: async () => {
    const response = await apiClient.get('/supplier/suppliers')
    return response.data
  },
  getPlants: async () => {
    const response = await apiClient.get('/supplier/plants')
    return response.data
  },
  getAppointments: async (week, plantId = null) => {
    // O backend do fornecedor espera 'week' (início da semana) em vez de 'date'
    // Converter week para string ISO se necessário
    let weekParam = week
    if (week instanceof Date) {
      // Se for Date, converter para ISO string (YYYY-MM-DD)
      weekParam = week.toISOString().split('T')[0]
    } else if (typeof week !== 'string') {
      weekParam = String(week)
    }
    
    const params = { week: weekParam }
    if (plantId) {
      params.plant_id = plantId
    }
    const response = await apiClient.get('/supplier/appointments', { params })
    return response.data
  },
  createAppointment: async (data) => {
    const response = await apiClient.post('/supplier/appointments', data)
    return response.data
  },
  updateAppointment: async (id, data) => {
    const response = await apiClient.put(`/supplier/appointments/${id}`, data)
    return response.data
  },
  checkIn: async (appointmentId) => {
    const response = await apiClient.post(`/supplier/appointments/${appointmentId}/check-in`)
    return response.data
  },
  checkOut: async (appointmentId) => {
    const response = await apiClient.post(`/supplier/appointments/${appointmentId}/check-out`)
    return response.data
  },
  deleteAppointment: async (appointmentId) => {
    const response = await apiClient.delete(`/supplier/appointments/${appointmentId}`)
    return response.data
  },
  getPlantMaxCapacity: async (plantId) => {
    const response = await apiClient.get(`/supplier/plants/${plantId}/max-capacity`)
    return response.data
  },
  getPlantScheduleConfig: async (plantId, date = null) => {
    const params = date ? { date } : {}
    const response = await apiClient.get(`/supplier/plants/${plantId}/schedule-config`, { params })
    return response.data
  }
}

// API de Plant
export const plantAPI = {
  getSuppliers: async () => {
    const response = await apiClient.get('/plant/suppliers')
    return response.data
  },
  getPlants: async () => {
    const response = await apiClient.get('/plant/plants')
    return response.data
  },
  getAppointments: async (date) => {
    const response = await apiClient.get('/plant/appointments', { params: { date } })
    return response.data
  },
  createAppointment: async (data) => {
    const response = await apiClient.post('/plant/appointments', data)
    return response.data
  },
  updateAppointment: async (id, data) => {
    const response = await apiClient.put(`/plant/appointments/${id}`, data)
    return response.data
  },
  getProfile: async () => {
    const response = await apiClient.get('/plant/profile')
    return response.data
  },
  checkIn: async (appointmentId) => {
    const response = await apiClient.post(`/plant/appointments/${appointmentId}/check-in`)
    return response.data
  },
  checkOut: async (appointmentId) => {
    const response = await apiClient.post(`/plant/appointments/${appointmentId}/check-out`)
    return response.data
  },
  deleteAppointment: async (appointmentId) => {
    const response = await apiClient.delete(`/plant/appointments/${appointmentId}`)
    return response.data
  }
}
