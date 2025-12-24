import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const TimeInput = ({ value, onChange, onBlur, disabled, className, placeholder = '--:--', intervalMinutes = 30, ...props }) => {
  const [displayValue, setDisplayValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const inputRef = useRef(null)

  // Gerar opções de horários em intervalos de 30 minutos (apenas horários úteis: 08:00 a 18:00)
  const generateTimeOptions = () => {
    const options = []
    for (let hour = 8; hour <= 18; hour++) {
      for (let minute = 0; minute < 60; minute += intervalMinutes) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        options.push(timeStr)
      }
    }
    return options
  }

  const timeOptions = generateTimeOptions()

  // Formatar valor para exibição
  const formatTime = (timeStr) => {
    if (!timeStr) return ''
    // Remover caracteres não numéricos
    const numbers = timeStr.replace(/\D/g, '')
    
    if (numbers.length === 0) return ''
    if (numbers.length <= 2) return numbers
    if (numbers.length <= 4) {
      return `${numbers.slice(0, 2)}:${numbers.slice(2)}`
    }
    return `${numbers.slice(0, 2)}:${numbers.slice(2, 4)}`
  }

  // Validar e arredondar para intervalo de 30 minutos
  const roundToInterval = (timeStr) => {
    if (!timeStr || timeStr.length < 5) return timeStr
    
    const [hours, minutes] = timeStr.split(':').map(Number)
    
    if (isNaN(hours) || isNaN(minutes)) return timeStr
    
    // Arredondar minutos para o intervalo mais próximo
    const roundedMinutes = Math.round(minutes / intervalMinutes) * intervalMinutes
    
    let finalHours = hours
    let finalMinutes = roundedMinutes
    
    // Ajustar se minutos ultrapassarem 59
    if (finalMinutes >= 60) {
      finalHours += 1
      finalMinutes = 0
    }
    
    // Validar horas
    if (finalHours >= 24) {
      finalHours = 23
      finalMinutes = 59
    }
    
    return `${finalHours.toString().padStart(2, '0')}:${finalMinutes.toString().padStart(2, '0')}`
  }

  // Verificar se o horário está no formato válido e no intervalo
  const isValidTime = (timeStr) => {
    if (!timeStr || timeStr.length !== 5) return false
    const [hours, minutes] = timeStr.split(':').map(Number)
    if (isNaN(hours) || isNaN(minutes)) return false
    if (hours < 0 || hours > 23) return false
    if (minutes < 0 || minutes > 59) return false
    // Verificar se está no intervalo de 30 minutos
    return minutes % intervalMinutes === 0
  }

  // Inicializar displayValue quando value muda externamente
  useEffect(() => {
    if (value && value !== displayValue) {
      // Se o valor vem no formato HH:MM:SS, converter para HH:MM
      const normalizedValue = value.length > 5 ? value.slice(0, 5) : value
      setDisplayValue(normalizedValue)
    } else if (!value) {
      setDisplayValue('')
    }
  }, [value])

  const handleChange = (e) => {
    const inputValue = e.target.value
    const formatted = formatTime(inputValue)
    setDisplayValue(formatted)
    
    // Se o valor está completo (HH:MM), validar e arredondar
    if (formatted.length === 5) {
      const rounded = roundToInterval(formatted)
      setDisplayValue(rounded)
      
      if (isValidTime(rounded)) {
        onChange?.(rounded)
      }
    } else {
      // Atualizar mesmo se incompleto para permitir digitação
      onChange?.(formatted)
    }
  }

  const handleBlur = (e) => {
    // Não processar blur se o picker está aberto
    if (showPicker) {
      return
    }
    
    setIsFocused(false)
    
    // Se o valor está incompleto ou inválido, tentar completar ou limpar
    if (displayValue.length === 5) {
      const rounded = roundToInterval(displayValue)
      if (isValidTime(rounded)) {
        setDisplayValue(rounded)
        onChange?.(rounded)
      } else {
        // Se inválido, limpar
        setDisplayValue('')
        onChange?.('')
      }
    } else if (displayValue.length > 0 && displayValue.length < 5) {
      // Tentar completar com zeros
      const numbers = displayValue.replace(/\D/g, '')
      if (numbers.length === 1) {
        const completed = `0${numbers}:00`
        setDisplayValue(completed)
        onChange?.(completed)
      } else if (numbers.length === 2) {
        const completed = `${numbers}:00`
        setDisplayValue(completed)
        onChange?.(completed)
      } else if (numbers.length === 3) {
        const completed = `${numbers.slice(0, 2)}:0${numbers.slice(2)}`
        setDisplayValue(completed)
        onChange?.(completed)
      } else {
        setDisplayValue('')
        onChange?.('')
      }
    }
    
    onBlur?.(e)
  }

  const handleFocus = () => {
    setIsFocused(true)
  }

  const handleTimeSelect = (selectedTime) => {
    setDisplayValue(selectedTime)
    onChange?.(selectedTime)
    setShowPicker(false)
    inputRef.current?.blur()
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
            handleFocus()
            if (!disabled) {
              setShowPicker(true)
            }
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={5}
          className={cn(
            "font-mono text-left",
            !isValidTime(displayValue) && displayValue.length === 5 && "border-orange-500",
            className
          )}
          {...props}
        />
        <PopoverContent className="w-auto p-2" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="grid grid-cols-4 gap-1 max-h-[300px] overflow-y-auto">
            {timeOptions.map((timeOption) => (
              <Button
                key={timeOption}
                type="button"
                variant={displayValue === timeOption ? "default" : "outline"}
                size="sm"
                className={cn(
                  "font-mono text-xs h-8",
                  displayValue === timeOption && "bg-primary text-primary-foreground"
                )}
                onClick={() => handleTimeSelect(timeOption)}
              >
                {timeOption}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      {displayValue.length === 5 && !isValidTime(displayValue) && (
        <p className="text-xs text-orange-600 mt-1">
          Horário será ajustado para o intervalo de {intervalMinutes} minutos mais próximo
        </p>
      )}
    </div>
  )
}

export default TimeInput

