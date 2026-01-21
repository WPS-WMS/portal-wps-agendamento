import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Função utilitária para combinar classes Tailwind
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// Utilitários de data
export const dateUtils = {
  // Formata data para ISO (YYYY-MM-DD)
  // IMPORTANTE: Usa métodos locais para evitar problemas de fuso horário
  // Não usar toISOString() pois converte para UTC e pode causar deslocamento de 1 dia
  toISODate: (date) => {
    if (!date) return ''
    const d = date instanceof Date ? date : new Date(date)
    if (isNaN(d.getTime())) return ''
    // Usar métodos locais para preservar a data exata sem conversão de timezone
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  // Formata hora para HH:mm
  formatTime: (time) => {
    if (!time) return ''
    if (typeof time === 'string') {
      // Se já está no formato HH:mm ou HH:mm:ss, retorna apenas HH:mm
      return time.substring(0, 5)
    }
    // Se for um objeto time do Python, pode vir como string no formato HH:MM:SS
    return String(time).substring(0, 5)
  },

  // Formata data para exibição (DD/MM/YYYY)
  formatDate: (date) => {
    if (!date) return ''
    const d = date instanceof Date ? date : new Date(date)
    if (isNaN(d.getTime())) return ''
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}/${month}/${year}`
  },

  // Formata data e hora para exibição
  formatDateTime: (datetime) => {
    if (!datetime) return ''
    const d = new Date(datetime)
    if (isNaN(d.getTime())) return ''
    const dateStr = dateUtils.formatDate(d)
    const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    return `${dateStr} ${timeStr}`
  },

  // Formata intervalo de tempo
  formatTimeRange: (startTime, endTime) => {
    const start = dateUtils.formatTime(startTime)
    const end = endTime ? dateUtils.formatTime(endTime) : ''
    return end ? `${start} - ${end}` : start
  },

  // Obtém o nome do dia da semana
  getDayName: (date) => {
    if (!date) return ''
    const d = date instanceof Date ? date : new Date(date)
    if (isNaN(d.getTime())) return ''
    const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
    return days[d.getDay()]
  },

  // Verifica se é hoje
  isToday: (date) => {
    if (!date) return false
    const d = date instanceof Date ? date : new Date(date)
    if (isNaN(d.getTime())) return false
    const today = new Date()
    return d.toDateString() === today.toDateString()
  },

  // Obtém o início da semana (domingo)
  getWeekStart: (date) => {
    if (!date) return new Date()
    const d = date instanceof Date ? date : new Date(date)
    if (isNaN(d.getTime())) return new Date()
    const day = d.getDay()
    const diff = d.getDate() - day
    const weekStart = new Date(d.setDate(diff))
    weekStart.setHours(0, 0, 0, 0)
    return weekStart
  }
}

// Utilitários de status
export const statusUtils = {
  getStatusLabel: (status) => {
    const labels = {
      scheduled: 'Agendado',
      rescheduled: 'Reagendado',
      checked_in: 'Em atendimento',
      checked_out: 'Finalizado',
      cancelled: 'Cancelado'
    }
    return labels[status] || status
  },

  getStatusColor: (status) => {
    const colors = {
      scheduled: 'bg-blue-100 text-blue-800 border-blue-200',
      rescheduled: 'bg-purple-100 text-purple-800 border-purple-200',
      checked_in: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      checked_out: 'bg-green-100 text-green-800 border-green-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200'
    }
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

// Utilitários de validação
export const validation = {
  isValidEmail: (email) => {
    if (!email) return false
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  },

  isValidCNPJ: (cnpj) => {
    if (!cnpj) return false
    // Remove caracteres não numéricos
    const cleanCNPJ = cnpj.replace(/[^\d]/g, '')
    // Verifica se tem 14 dígitos
    if (cleanCNPJ.length !== 14) return false
    // Verifica se não é uma sequência de números repetidos
    if (/^(\d)\1+$/.test(cleanCNPJ)) return false
    return true
  }
}
