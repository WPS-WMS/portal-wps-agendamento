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
  // IMPORTANTE: Usa métodos locais para evitar problemas de fuso horário
  formatDate: (date) => {
    if (!date) return ''
    
    // Se for string no formato ISO (YYYY-MM-DD), parsear diretamente sem usar Date
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
      const [year, month, day] = date.split('T')[0].split('-')
      return `${day}/${month}/${year}`
    }
    
    // Se for Date object ou outra string, usar métodos locais
    const d = date instanceof Date ? date : new Date(date)
    if (isNaN(d.getTime())) return ''
    
    // Usar métodos locais para preservar a data exata sem conversão de timezone
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

// Utilitários para exportação CSV
export const csvUtils = {
  /**
   * Converte array de objetos para formato CSV
   * @param {Array} data - Array de objetos a serem convertidos
   * @param {Array} headers - Array com os cabeçalhos das colunas
   * @param {Object} fieldMap - Mapeamento de campos do objeto para colunas do CSV
   * @returns {string} - String CSV formatada
   */
  arrayToCSV: (data, headers, fieldMap = {}) => {
    if (!data || data.length === 0) {
      return headers.join(',') + '\n'
    }

    // Criar linha de cabeçalhos
    const csvHeaders = headers.join(',')
    
    // Criar linhas de dados
    const csvRows = data.map(item => {
      const row = headers.map(header => {
        const field = fieldMap[header] || header.toLowerCase().replace(/\s+/g, '_')
        let value = item[field] || ''
        
        // Se o valor contém vírgula, aspas ou quebra de linha, envolver em aspas
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          value = `"${value.replace(/"/g, '""')}"`
        }
        
        return value
      })
      return row.join(',')
    })
    
    return [csvHeaders, ...csvRows].join('\n')
  },

  /**
   * Converte objeto de status para formato CSV
   * @param {Object} statusData - Objeto com status como chave e contagem como valor
   * @param {Object} statusLabels - Mapeamento de status para labels
   * @returns {string} - String CSV formatada
   */
  statusToCSV: (statusData, statusLabels = {}) => {
    const headers = ['Status', 'Quantidade']
    const rows = Object.entries(statusData).map(([status, count]) => [
      statusLabels[status] || status,
      count
    ])
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
  },

  /**
   * Faz download de um arquivo CSV
   * @param {string} csvContent - Conteúdo CSV como string
   * @param {string} filename - Nome do arquivo (sem extensão .csv)
   */
  downloadCSV: (csvContent, filename) => {
    // Adicionar BOM para suporte a caracteres especiais no Excel
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', `${filename}.csv`)
    link.style.visibility = 'hidden'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    URL.revokeObjectURL(url)
  },

  /**
   * Formata data para CSV (DD/MM/YYYY)
   */
  formatDateForCSV: (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString
    
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    
    return `${day}/${month}/${year}`
  }
}
