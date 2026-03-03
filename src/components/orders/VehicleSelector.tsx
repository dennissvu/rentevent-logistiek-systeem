import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Minus, Bike } from 'lucide-react';
import { VehicleType, vehicleTypes } from '@/data/transportData';

export interface VehicleSelection {
  type: VehicleType;
  count: number;
}

interface VehicleSelectorProps {
  value: VehicleSelection[];
  onChange: (vehicles: VehicleSelection[]) => void;
  disabled?: boolean;
}

export function VehicleSelector({ value, onChange, disabled = false }: VehicleSelectorProps) {
  const getCount = (type: VehicleType): number => {
    return value.find(v => v.type === type)?.count || 0;
  };

  const updateCount = (type: VehicleType, newCount: number) => {
    if (newCount < 0) return;
    
    const existing = value.filter(v => v.type !== type);
    if (newCount > 0) {
      onChange([...existing, { type, count: newCount }]);
    } else {
      onChange(existing);
    }
  };

  const incrementCount = (type: VehicleType) => {
    updateCount(type, getCount(type) + 1);
  };

  const decrementCount = (type: VehicleType) => {
    updateCount(type, getCount(type) - 1);
  };

  const totalVehicles = value.reduce((sum, v) => sum + v.count, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Bike className="h-4 w-4" />
          Voertuigen
        </Label>
        {totalVehicles > 0 && (
          <span className="text-sm text-muted-foreground">
            Totaal: <span className="font-medium text-foreground">{totalVehicles}</span>
          </span>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {vehicleTypes.map((vehicle) => {
          const count = getCount(vehicle.id);
          const isActive = count > 0;
          
          return (
            <Card 
              key={vehicle.id} 
              className={`transition-colors ${
                isActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border'
              }`}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{vehicle.icon}</span>
                    <span className="text-sm font-medium">{vehicle.name}</span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => decrementCount(vehicle.id)}
                      disabled={disabled || count === 0}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    
                    <Input
                      type="number"
                      min={0}
                      value={count}
                      onChange={(e) => updateCount(vehicle.id, parseInt(e.target.value) || 0)}
                      className="w-14 h-7 text-center px-1"
                      disabled={disabled}
                    />
                    
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => incrementCount(vehicle.id)}
                      disabled={disabled}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
