import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowDown,
  ArrowUp,
  Clock,
  MapPin,
  Truck,
  X,
  GripVertical,
  Package,
  AlertTriangle,
  MessageSquare,
  Settings,
} from 'lucide-react';
import { vehicleTypes as vehicleTypesList } from '@/data/transportData';
import type { RouteBuilderStop } from '@/hooks/useDayRouteBuilder';

interface StopCardProps {
  stop: RouteBuilderStop;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onRemove?: (stopId: string) => void;
  onEdit?: (stop: RouteBuilderStop) => void;
  compact?: boolean;
  // Drag reorder props
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  isDragOver?: boolean;
}

const stopTypeLabels: Record<string, string> = {
  laden_winkel: 'Laden bij winkel',
  vertrek_winkel: 'Vertrek winkel',
  aankoppelen_loods: 'Aanhanger koppelen',
  leveren: 'Leveren',
  ophalen: 'Ophalen',
  lossen_winkel: 'Lossen bij winkel',
  afkoppelen_loods: 'Aanhanger afkoppelen',
  aankomst_winkel: 'Aankomst winkel',
  wachttijd: 'Wachttijd',
  tussenstop: 'Tussenstop',
};

const stopTypeColors: Record<string, string> = {
  laden_winkel: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
  vertrek_winkel: 'bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-700',
  aankoppelen_loods: 'bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700',
  leveren: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800',
  ophalen: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
  lossen_winkel: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
  afkoppelen_loods: 'bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700',
  aankomst_winkel: 'bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-700',
  wachttijd: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
  tussenstop: 'bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-800',
};

export function StopCard({
  stop,
  index,
  isFirst,
  isLast,
  onRemove,
  onEdit,
  compact,
  draggable,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  isDragOver,
}: StopCardProps) {
  const isCustomerStop = stop.stopType === 'leveren' || stop.stopType === 'ophalen';
  const isDelivery = isCustomerStop ? stop.segment === 'leveren' : ['laden_winkel', 'vertrek_winkel', 'aankoppelen_loods', 'leveren'].includes(stop.stopType);
  const colorClass = stopTypeColors[stop.stopType] || 'bg-muted/30 border-border';
  const hasAssignedVehicles = stop.assignedVehicles && stop.assignedVehicles.length > 0;

  // Build vehicle display: show assigned/total per type
  const vehicleDisplay = hasAssignedVehicles
    ? stop.assignedVehicles!.map(av => {
        const vt = vehicleTypesList.find(v => v.id === av.type);
        const totalForType = stop.vehicleTypes.find(v => v.type === av.type)?.count || av.count;
        if (av.count < totalForType) {
          return `${av.count}/${totalForType} ${vt?.name || av.type}`;
        }
        return `${av.count}x ${vt?.name || av.type}`;
      }).join(', ')
    : stop.vehicleSummary;

  // Timing warning only for customer stops (leveren/ophalen)
  const isTimingWarning = isCustomerStop && stop.estimatedArrival && stop.customerTime && (() => {
    const [aH, aM] = stop.estimatedArrival!.split(':').map(Number);
    const [cH, cM] = stop.customerTime.split(':').map(Number);
    const arrivalMin = aH * 60 + aM;
    const customerMin = cH * 60 + cM;
    if (isDelivery) {
      // Leveren: moet 15 min voor klant-tijd klaar staan
      return arrivalMin > customerMin - 15;
    }
    // Ophalen: moet op tijd zijn
    return arrivalMin > customerMin + 5;
  })();

  if (compact) {
    return (
      <div
        draggable={draggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs ${colorClass} ${
          draggable ? 'cursor-grab active:cursor-grabbing' : ''
        } ${isDragOver ? 'ring-2 ring-primary border-primary' : ''}`}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab shrink-0" />
        {isDelivery ? (
          <ArrowDown className="h-3 w-3 text-green-600 shrink-0" />
        ) : (
          <ArrowUp className="h-3 w-3 text-red-600 shrink-0" />
        )}
        <span className="font-semibold min-w-[40px]">
          {stop.estimatedArrival || '--:--'}
        </span>
        <span className="font-medium truncate">{isCustomerStop ? stop.orderNumber : '—'}</span>
        <span className="text-muted-foreground truncate">{isCustomerStop ? stop.customerName : (stopTypeLabels[stop.stopType] || stop.stopType)}</span>
        {hasAssignedVehicles && (
          <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">
            {stop.assignedTotalVehicles} stuks
          </Badge>
        )}
        {stop.driveTimeFromPrevious != null && stop.driveTimeFromPrevious > 0 && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">
            {stop.driveTimeFromPrevious} min
          </Badge>
        )}
        {isTimingWarning && (
          <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
        )}
        {onRemove && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0 ml-auto"
            onClick={() => onRemove(stop.id)}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Drop indicator above */}
      {isDragOver && (
        <div className="h-1 bg-primary rounded-full mx-4 mb-1" />
      )}

      {/* Stop card */}
      <div
        draggable={draggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`rounded-lg border p-3 ${colorClass} ${isTimingWarning ? 'ring-2 ring-amber-400' : ''} ${
          draggable ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
      >
        <div className="flex items-start gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0 mt-0.5" />

          {/* Sequence dot */}
          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0
            ${isDelivery ? 'bg-green-600' : 'bg-red-600'}
          `}>
            {index + 1}
          </div>

          <div className="flex-1 min-w-0">
            {/* Header row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm">
                  {stopTypeLabels[stop.stopType] || stop.stopType}
                </span>
                {isCustomerStop && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {stop.orderNumber}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {isTimingWarning && (
                  <Badge variant="destructive" className="text-[9px] px-1.5 py-0 gap-1">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    Te laat
                  </Badge>
                )}
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onEdit(stop)}
                    title="Tijd en opmerking aanpassen"
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </Button>
                )}
                {onRemove && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onRemove(stop.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Customer / location info */}
            {isCustomerStop ? (
              <p className="text-xs font-medium mt-1">{stop.customerName}</p>
            ) : (
              (stop.locationAddress && (
                <p className="text-xs text-muted-foreground mt-1 truncate">{stop.locationAddress}</p>
              ))
            )}

            {/* Location */}
            {(isCustomerStop || stop.locationAddress) && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{stop.locationAddress}</span>
              </div>
            )}


            {/* Timing info */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs">
              {/* Estimated arrival */}
              {stop.estimatedArrival && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-blue-600" />
                  <span className="font-semibold">{stop.estimatedArrival}</span>
                  {stop.estimatedDeparture && (
                    <span className="text-muted-foreground">→ {stop.estimatedDeparture}</span>
                  )}
                </div>
              )}

              {/* Customer time */}
              {isCustomerStop && stop.customerTime && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <span>Klant: {stop.customerTime}</span>
                  {stop.windowStart && (
                    <span className="text-green-600">(vanaf {stop.windowStart.slice(0, 5)})</span>
                  )}
                </div>
              )}

              {/* Load/unload duration */}
              {stop.loadUnloadMinutes != null && stop.loadUnloadMinutes > 0 && (
                <div className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  <span>{stop.loadUnloadMinutes} min</span>
                </div>
              )}
            </div>

            {/* Vehicle info - show assigned/total when partial */}
            {isCustomerStop && (
              <div className="flex items-center gap-2 mt-1.5 text-xs">
                <Truck className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className={`${hasAssignedVehicles ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                  {vehicleDisplay}
                </span>
                {stop.transportName && (
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                    {stop.transportName}
                  </Badge>
                )}
              </div>
            )}

            {/* Notes / comment - always visible when present */}
            {(stop.notes != null && stop.notes !== '') && (
              <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-muted-foreground bg-muted/30 rounded px-2 py-1">
                <MessageSquare className="h-3 w-3 shrink-0 mt-0.5" />
                <span className="break-words">{stop.notes}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
