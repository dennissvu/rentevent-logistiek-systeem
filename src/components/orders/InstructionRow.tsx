import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Warehouse, Store, ParkingCircle } from 'lucide-react';
import { vehicleTypes, VehicleType } from '@/data/transportData';
import { LoadUnloadInstruction } from '@/hooks/useLoadUnloadInstructions';
import { Driver } from '@/data/planningData';

// ─── Driver checkboxes ────────────────────────────────────────────────────────

interface DriverCheckboxesProps {
  allDrivers: Driver[];
  selectedDriverIds: string[];
  onToggle: (driverId: string) => void;
}

function DriverCheckboxes({ allDrivers, selectedDriverIds, onToggle }: DriverCheckboxesProps) {
  if (allDrivers.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 ml-6">
      {allDrivers.map(driver => (
        <label
          key={driver.id}
          className="flex items-center gap-1.5 text-xs cursor-pointer select-none"
        >
          <Checkbox
            checked={selectedDriverIds.includes(driver.id)}
            onCheckedChange={() => onToggle(driver.id)}
            className="h-3.5 w-3.5"
          />
          <span className={selectedDriverIds.includes(driver.id) ? 'font-medium' : 'text-muted-foreground'}>
            {driver.name}
          </span>
        </label>
      ))}
    </div>
  );
}

// ─── Instruction row ──────────────────────────────────────────────────────────

interface InstructionRowProps {
  instruction: LoadUnloadInstruction;
  availableVehicleTypes: { type: VehicleType; count: number }[];
  allDrivers: Driver[];
  onUpdate: (id: string, updates: Partial<LoadUnloadInstruction>) => void;
  onDelete: (id: string) => void;
  index: number;
}

export function InstructionRow({ instruction, availableVehicleTypes, allDrivers, onUpdate, onDelete, index }: InstructionRowProps) {
  const handleToggleDriver = (driverId: string) => {
    const current = instruction.helperDriverIds || [];
    const next = current.includes(driverId)
      ? current.filter(id => id !== driverId)
      : [...current, driverId];
    onUpdate(instruction.id, { helperDriverIds: next, helperCount: next.length });
  };

  const isBlijftStaan = instruction.location === 'blijft_staan';

  return (
    <div className="space-y-1.5 p-2.5 bg-background/80 rounded-md border border-border/50">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground w-5 shrink-0">{index + 1}.</span>
        
        {/* Location */}
        <Select
          value={instruction.location}
          onValueChange={(v) => onUpdate(instruction.id, { location: v as 'winkel' | 'loods' | 'blijft_staan' })}
        >
          <SelectTrigger className="h-8 w-[120px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="winkel">
              <div className="flex items-center gap-1.5">
                <Store className="h-3 w-3" />
                Winkel
              </div>
            </SelectItem>
            <SelectItem value="loods">
              <div className="flex items-center gap-1.5">
                <Warehouse className="h-3 w-3" />
                Loods
              </div>
            </SelectItem>
            <SelectItem value="blijft_staan">
              <div className="flex items-center gap-1.5">
                <ParkingCircle className="h-3 w-3" />
                Blijft staan
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Vehicle type */}
        <Select
          value={instruction.vehicleType}
          onValueChange={(v) => onUpdate(instruction.id, { vehicleType: v })}
        >
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableVehicleTypes.map(vt => {
              const info = vehicleTypes.find(v => v.id === vt.type);
              return (
                <SelectItem key={vt.type} value={vt.type}>
                  <span>{info?.icon} {info?.name}</span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Count */}
        <Input
          type="number"
          min={1}
          value={instruction.vehicleCount}
          onChange={(e) => onUpdate(instruction.id, { vehicleCount: parseInt(e.target.value) || 1 })}
          className="h-8 w-16 text-xs text-center"
        />

        {/* Delete */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive shrink-0 ml-auto"
          onClick={() => onDelete(instruction.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Driver checkboxes - not shown for "blijft staan" */}
      {!isBlijftStaan && (
        <DriverCheckboxes
          allDrivers={allDrivers}
          selectedDriverIds={instruction.helperDriverIds || []}
          onToggle={handleToggleDriver}
        />
      )}
    </div>
  );
}
