import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Building2 } from 'lucide-react'
import { Label } from '@/components/ui/label'

const PlantSelector = ({ plants, selectedPlantId, onPlantChange, placeholder = "Selecione uma planta" }) => {
  return (
    <div className="flex flex-col gap-2 w-full">
      <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        <Building2 className="h-4 w-4 text-blue-600" />
        Planta
      </Label>
      <Select value={selectedPlantId?.toString() || ""} onValueChange={(value) => onPlantChange(value ? parseInt(value) : null)}>
        <SelectTrigger className="w-full h-11 bg-white border-2 border-gray-300 hover:border-blue-400 focus:border-blue-500 text-base font-medium shadow-sm">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {!plants || plants.length === 0 ? (
            <SelectItem value="empty" disabled>
              Nenhuma planta disponível
            </SelectItem>
          ) : (
            plants.map((plant) => (
              <SelectItem 
                key={plant.id} 
                value={plant.id.toString()}
                disabled={!plant.is_active}
                className={!plant.is_active ? 'opacity-60' : ''}
              >
                {plant.name} {!plant.is_active && '(Inativa)'}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  )
}

export default PlantSelector

