import { useMemo } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { vehicleTypes, VehicleType } from '@/data/transportData';
import { LoadUnloadInstruction } from '@/hooks/useLoadUnloadInstructions';

interface RemainingVehiclesProps {
  orderVehicleTypes: { type: VehicleType; count: number }[];
  instructions: LoadUnloadInstruction[];
  action: 'laden' | 'lossen';
  assignmentIds: string[];
  transportCapacities?: { label: string; capacity: Record<string, number> }[];
}

export function RemainingVehicles({ orderVehicleTypes, instructions, action, assignmentIds, transportCapacities }: RemainingVehiclesProps) {
  const relevantInstructions = instructions.filter(
    i => i.action === action && assignmentIds.includes(i.assignmentId)
  );

  const allocated = useMemo(() => {
    const map: Record<string, number> = {};
    for (const inst of relevantInstructions) {
      map[inst.vehicleType] = (map[inst.vehicleType] || 0) + inst.vehicleCount;
    }
    return map;
  }, [relevantInstructions]);

  const allComplete = orderVehicleTypes.every(vt => {
    const alloc = allocated[vt.type] || 0;
    return alloc >= vt.count;
  });

  if (orderVehicleTypes.length === 0) return null;

  return (
    <div className="space-y-2 p-3 rounded-lg bg-muted/50 border border-border/50">
      <div className="flex items-center gap-2 mb-1">
        {allComplete ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
        )}
        <span className="text-xs font-medium">
          {allComplete ? 'Alle voertuigen toegewezen' : 'Nog toe te wijzen'}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {orderVehicleTypes.map(vt => {
          const info = vehicleTypes.find(v => v.id === vt.type);
          const alloc = allocated[vt.type] || 0;
          const remaining = vt.count - alloc;
          return (
            <div
              key={vt.type}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${
                remaining <= 0
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
              }`}
            >
              <span>{info?.icon}</span>
              <span>
                {remaining > 0
                  ? `${remaining}/${vt.count} ${info?.name}`
                  : `✓ ${vt.count} ${info?.name}`}
              </span>
            </div>
          );
        })}
      </div>
      {transportCapacities && transportCapacities.length > 0 && (
        <div className="mt-2 space-y-1">
          {transportCapacities.map(tc => (
            <div key={tc.label} className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="font-medium">{tc.label}:</span>
              {orderVehicleTypes.map(vt => {
                const cap = tc.capacity[vt.type] || 0;
                const info = vehicleTypes.find(v => v.id === vt.type);
                return cap > 0 ? (
                  <span key={vt.type}>max {cap} {info?.name}</span>
                ) : null;
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
