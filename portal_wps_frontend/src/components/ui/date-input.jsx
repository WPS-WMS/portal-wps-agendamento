import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

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
      const todayStr = today.toISOString().split('T')[0] // YYYY-MM-DD
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

  return (
    <div className="relative">
      <Popover open={showPicker && !disabled} onOpenChange={setShowPicker}>
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
            "font-mono",
            !isValidDate(displayValue) && displayValue.length === 10 && "border-orange-500",
            className
          )}
          {...props}
        />
        <PopoverContent className="w-auto p-3" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="space-y-2">
            <input
              ref={hiddenInputRef}
              type="date"
              value={selectedDate || ''}
              onChange={handleDatePickerChange}
              min={minDate ? formatDateForInput(minDate) : undefined}
              max={maxDate ? formatDateForInput(maxDate) : undefined}
              className="w-full h-10 px-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
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

