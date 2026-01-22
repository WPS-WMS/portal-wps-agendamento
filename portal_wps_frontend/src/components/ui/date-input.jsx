import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CalendarIcon } from 'lucide-react'

const DateInput = ({ value, onChange, onBlur, disabled, className, placeholder = '__/__/____', minDate, maxDate, ...props }) => {
  const [displayValue, setDisplayValue] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const inputRef = useRef(null)
  const hiddenInputRef = useRef(null)

  // Formatar data para exibição DD/MM/AAAA
  const formatDateForDisplay = (dateStr) => {
    if (!dateStr) return ''
    
    // Se vem no formato YYYY-MM-DD (ISO), converter para DD/MM/AAAA
    if (dateStr.includes('-') && dateStr.length === 10) {
      const [year, month, day] = dateStr.split('-')
      return `${day}/${month}/${year}`
    }
    
    // Se já está no formato DD/MM/AAAA, retornar como está
    if (dateStr.includes('/') && dateStr.length === 10) {
      return dateStr
    }
    
    return dateStr
  }

  // Converter DD/MM/AAAA para YYYY-MM-DD
  const formatDateForInput = (dateStr) => {
    if (!dateStr) return ''
    
    // Se está no formato DD/MM/AAAA
    if (dateStr.includes('/') && dateStr.length === 10) {
      const [day, month, year] = dateStr.split('/')
      return `${year}-${month}-${day}`
    }
    
    // Se já está no formato YYYY-MM-DD
    if (dateStr.includes('-') && dateStr.length === 10) {
      return dateStr
    }
    
    return dateStr
  }

  // Formatar valor digitado com máscara
  const formatDateInput = (inputValue) => {
    if (!inputValue) return ''
    
    // Remover caracteres não numéricos
    const numbers = inputValue.replace(/\D/g, '')
    
    if (numbers.length === 0) return ''
    if (numbers.length <= 2) return numbers
    if (numbers.length <= 4) {
      return `${numbers.slice(0, 2)}/${numbers.slice(2)}`
    }
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`
  }

  // Validar data
  const isValidDate = (dateStr) => {
    if (!dateStr || dateStr.length !== 10) return false
    
    if (dateStr.includes('/')) {
      const [day, month, year] = dateStr.split('/').map(Number)
      if (isNaN(day) || isNaN(month) || isNaN(year)) return false
      if (day < 1 || day > 31) return false
      if (month < 1 || month > 12) return false
      if (year < 1900 || year > 2100) return false
      
      // Validar se a data é válida (ex: não permitir 31/02)
      const date = new Date(year, month - 1, day)
      if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
        return false
      }
      
      // Validar minDate e maxDate se fornecidos
      if (minDate) {
        const minDateObj = new Date(formatDateForInput(minDate))
        if (date < minDateObj) return false
      }
      if (maxDate) {
        const maxDateObj = new Date(formatDateForInput(maxDate))
        if (date > maxDateObj) return false
      }
      
      return true
    }
    
    return false
  }

  // Inicializar displayValue quando value muda externamente
  useEffect(() => {
    if (value) {
      // Se o value já está no formato YYYY-MM-DD, usar diretamente
      let isoDate = value
      if (value.includes('/')) {
        // Se está no formato DD/MM/AAAA, converter
        isoDate = formatDateForInput(value)
      }
      
      const formatted = formatDateForDisplay(isoDate)
      setDisplayValue(formatted)
      
      if (isoDate && hiddenInputRef.current) {
        hiddenInputRef.current.value = isoDate
        setSelectedDate(isoDate)
      }
    } else if (!value && !displayValue) {
      // Só limpar se não houver displayValue (evitar limpar durante inicialização)
      setDisplayValue('')
      if (hiddenInputRef.current) {
        hiddenInputRef.current.value = ''
        setSelectedDate(null)
      }
    }
  }, [value])

  // Inicializar com data atual se não houver valor (apenas na primeira renderização)
  useEffect(() => {
    // Se não há value e não há displayValue, inicializar com data atual
    if (!value && !displayValue) {
      const today = new Date()
      // IMPORTANTE: Usar métodos locais para evitar problemas de fuso horário
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const day = String(today.getDate()).padStart(2, '0')
      const todayStr = `${year}-${month}-${day}` // YYYY-MM-DD
      const todayDisplay = formatDateForDisplay(todayStr)
      setDisplayValue(todayDisplay)
      setSelectedDate(todayStr)
      if (hiddenInputRef.current) {
        hiddenInputRef.current.value = todayStr
      }
      // Chamar onChange para notificar o componente pai
      onChange?.(todayStr)
    }
  }, [])

  const handleChange = (e) => {
    const inputValue = e.target.value
    const formatted = formatDateInput(inputValue)
    setDisplayValue(formatted)
    
    // Se o valor está completo (DD/MM/AAAA), validar
    if (formatted.length === 10) {
      if (isValidDate(formatted)) {
        const isoDate = formatDateForInput(formatted)
        setSelectedDate(isoDate)
        if (hiddenInputRef.current) {
          hiddenInputRef.current.value = isoDate
        }
        onChange?.(isoDate)
      }
    } else {
      onChange?.(formatted)
    }
  }

  const handleDatePickerChange = (e) => {
    const isoDate = e.target.value // YYYY-MM-DD
    if (isoDate) {
      const formatted = formatDateForDisplay(isoDate)
      setDisplayValue(formatted)
      setSelectedDate(isoDate)
      onChange?.(isoDate)
      setShowPicker(false)
      inputRef.current?.blur()
    }
  }

  const handleBlur = (e) => {
    // Não processar blur se o picker está aberto
    if (showPicker) {
      return
    }
    
    // Se o valor está incompleto ou inválido, tentar completar ou limpar
    if (displayValue.length === 10) {
      if (isValidDate(displayValue)) {
        const isoDate = formatDateForInput(displayValue)
        setSelectedDate(isoDate)
        if (hiddenInputRef.current) {
          hiddenInputRef.current.value = isoDate
        }
        onChange?.(isoDate)
      } else {
        // Se inválido, limpar
        setDisplayValue('')
        setSelectedDate(null)
        if (hiddenInputRef.current) {
          hiddenInputRef.current.value = ''
        }
        onChange?.('')
      }
    } else if (displayValue.length > 0 && displayValue.length < 10) {
      // Tentar completar com zeros ou limpar
      setDisplayValue('')
      setSelectedDate(null)
      if (hiddenInputRef.current) {
        hiddenInputRef.current.value = ''
      }
      onChange?.('')
    }
    
    onBlur?.(e)
  }

  const handleKeyDown = (e) => {
    // Permitir navegação e edição
    if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
      return
    }
    
    // Permitir apenas números
    if (!/[0-9]/.test(e.key) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
    }
  }

  const handleCalendarSelect = (date) => {
    if (date) {
      // IMPORTANTE: Usar métodos locais para evitar problemas de fuso horário
      // Não usar toISOString() pois converte para UTC e pode causar deslocamento de 1 dia
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const isoDate = `${year}-${month}-${day}` // YYYY-MM-DD
      const formatted = formatDateForDisplay(isoDate)
      setDisplayValue(formatted)
      setSelectedDate(isoDate)
      if (hiddenInputRef.current) {
        hiddenInputRef.current.value = isoDate
      }
      onChange?.(isoDate)
      setShowPicker(false)
    }
  }

  // IMPORTANTE: Criar datas usando setHours(12,0,0,0) para evitar problemas de fuso horário
  // Quando criamos new Date('YYYY-MM-DD'), o JavaScript interpreta como UTC 00:00:00
  // que pode ser convertido para o dia anterior no fuso horário local
  // Usando setHours(12,0,0,0) garantimos que a data seja interpretada corretamente
  const calendarDate = selectedDate ? (() => {
    const [year, month, day] = selectedDate.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    date.setHours(12, 0, 0, 0) // Normalizar para meio-dia para evitar problemas de timezone
    return date
  })() : undefined
  const minDateObj = minDate ? (() => {
    const minDateFormatted = formatDateForInput(minDate)
    const [year, month, day] = minDateFormatted.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    date.setHours(12, 0, 0, 0)
    return date
  })() : undefined
  const maxDateObj = maxDate ? (() => {
    const maxDateFormatted = formatDateForInput(maxDate)
    const [year, month, day] = maxDateFormatted.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    date.setHours(12, 0, 0, 0)
    return date
  })() : undefined

  return (
    <div className="relative">
      <Popover open={showPicker && !disabled} onOpenChange={setShowPicker}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              ref={inputRef}
              type="text"
              value={displayValue || ''}
              onChange={handleChange}
              onBlur={(e) => {
                setTimeout(() => {
                  if (!showPicker) {
                    handleBlur(e)
                  }
                }, 150)
              }}
              onFocus={(e) => {
                if (!disabled) {
                  setShowPicker(true)
                }
              }}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder={placeholder}
              maxLength={10}
              className={cn(
                "font-mono pr-10",
                !isValidDate(displayValue) && displayValue.length === 10 && "border-orange-500",
                className
              )}
              {...props}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={(e) => {
                e.preventDefault()
                if (!disabled) {
                  setShowPicker(!showPicker)
                }
              }}
            >
              <CalendarIcon className="h-4 w-4 text-gray-400" />
            </Button>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
          <Calendar
            mode="single"
            selected={calendarDate}
            onSelect={handleCalendarSelect}
            disabled={(date) => {
              if (minDateObj && date < minDateObj) return true
              if (maxDateObj && date > maxDateObj) return true
              return false
            }}
            initialFocus
          />
          <div className="p-3 border-t">
            <p className="text-xs text-gray-500 text-center">
              Ou digite no formato DD/MM/AAAA
            </p>
          </div>
        </PopoverContent>
      </Popover>
      {displayValue.length === 10 && !isValidDate(displayValue) && (
        <p className="text-xs text-orange-600 mt-1">
          Data inválida. Use o formato DD/MM/AAAA
        </p>
      )}
    </div>
  )
}

export default DateInput

