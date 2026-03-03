import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, ArrowUp, Truck } from 'lucide-react';
import { vehicleTypes as vehicleTypesList } from '@/data/transportData';
import type { VehicleQuantity, UnassignedStop } from '@/hooks/useDayRouteBuilder';

interface QuantityAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stop: UnassignedStop | null;
  driverName: string;
  onConfirm: (assignedVehicles: VehicleQuantity[]) => void;
}

export function QuantityAssignDialog({
  open,
  onOpenChange,
  stop,
  driverName,
  onConfirm,
}: QuantityAssignDialogProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Initialize with remaining quantities
  useEffect(() => {
    if (stop) {
      const initial: Record<string, number> = {};
      for (const vt of stop.remainingVehicles) {
        initial[vt.type] = vt.count;
      }
      setQuantities(initial);
    }
  }, [stop]);

  if (!stop) return null;

  const isLeveren = stop.segment === 'leveren';
  const totalAssigned = Object.values(quantities).reduce((s, v) => s + v, 0);

  const handleConfirm = () => {
    const assignedVehicles: VehicleQuantity[] = Object.entries(quantities)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => ({ type, count }));

    onConfirm(assignedVehicles);
    onOpenChange(false);
  };

  const handleSetAll = () => {
    const all: Record<string, number> = {};
    for (const vt of stop.remainingVehicles) {
      all[vt.type] = vt.count;
    }
    setQuantities(all);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isLeveren ? (
              <ArrowDown className="h-4 w-4 text-green-600" />
            ) : (
              <ArrowUp className="h-4 w-4 text-red-600" />
            )}
            Hoeveel meegeven aan {driverName}?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order info */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{stop.orderNumber}</span>
              <Badge variant={isLeveren ? 'default' : 'destructive'} className="text-xs">
                {isLeveren ? 'Leveren' : 'Ophalen'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{stop.customerName}</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <Truck className="h-3 w-3" />
              <span>Totaal: {stop.vehicleSummary}</span>
            </div>
            {stop.isPartial && (
              <p className="text-xs text-amber-600 mt-1">
                Nog over: {stop.remainingVehicleSummary}
              </p>
            )}
          </div>

          {/* Quantity inputs */}
          <div className="space-y-3">
            {stop.remainingVehicles.map(vt => {
              const vtInfo = vehicleTypesList.find(v => v.id === vt.type);
              const max = vt.count;
              const current = quantities[vt.type] || 0;

              return (
                <div key={vt.type} className="flex items-center gap-3">
                  <Label className="flex-1 text-sm">
                    {vtInfo?.name || vt.type}
                    <span className="text-muted-foreground ml-1">(max {max})</span>
                  </Label>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() =>
                        setQuantities(q => ({
                          ...q,
                          [vt.type]: Math.max(0, (q[vt.type] || 0) - 1),
                        }))
                      }
                      disabled={current <= 0}
                    >
                      -
                    </Button>
                    <Input
                      type="number"
                      min={0}
                      max={max}
                      value={current}
                      onChange={e => {
                        const val = Math.min(max, Math.max(0, parseInt(e.target.value) || 0));
                        setQuantities(q => ({ ...q, [vt.type]: val }));
                      }}
                      className="w-16 h-7 text-center text-sm"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() =>
                        setQuantities(q => ({
                          ...q,
                          [vt.type]: Math.min(max, (q[vt.type] || 0) + 1),
                        }))
                      }
                      disabled={current >= max}
                    >
                      +
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="bg-muted/30 rounded-lg p-3 text-sm">
            <div className="flex justify-between">
              <span>Meegeven:</span>
              <span className="font-semibold">{totalAssigned} stuks</span>
            </div>
            {stop.remainingVehicles.length > 0 && (
              <div className="flex justify-between text-muted-foreground mt-1">
                <span>Blijft over:</span>
                <span>
                  {stop.remainingVehicles
                    .map(vt => {
                      const assigned = quantities[vt.type] || 0;
                      return vt.count - assigned;
                    })
                    .reduce((s, v) => s + v, 0)}{' '}
                  stuks
                </span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleSetAll}>
            Alles
          </Button>
          <Button onClick={handleConfirm} disabled={totalAssigned === 0}>
            Toewijzen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
