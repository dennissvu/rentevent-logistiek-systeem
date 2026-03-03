import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowDown,
  ArrowUp,
  Clock,
  MapPin,
  Truck,
  Package,
  AlertTriangle,
  GripVertical,
} from 'lucide-react';
import type { UnassignedStop } from '@/hooks/useDayRouteBuilder';

interface UnassignedOrdersPanelProps {
  stops: UnassignedStop[];
  onDragStart: (e: React.DragEvent, stop: UnassignedStop) => void;
}

export function UnassignedOrdersPanel({ stops, onDragStart }: UnassignedOrdersPanelProps) {
  // Group by order
  const grouped = stops.reduce<Record<string, UnassignedStop[]>>((acc, stop) => {
    const key = stop.orderId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(stop);
    return acc;
  }, {});

  const orderKeys = Object.keys(grouped);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">In te plannen</h3>
          <Badge variant={stops.length > 0 ? 'destructive' : 'secondary'} className="text-xs">
            {stops.length}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Sleep naar een chauffeur om toe te wijzen
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {stops.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>Alle orders zijn ingepland</p>
            </div>
          ) : (
            orderKeys.map(orderId => {
              const orderStops = grouped[orderId];
              return orderStops.map((stop, idx) => (
                <UnassignedStopCard
                  key={`${stop.orderId}-${stop.segment}-${stop.assignmentId || idx}`}
                  stop={stop}
                  onDragStart={onDragStart}
                />
              ));
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function UnassignedStopCard({
  stop,
  onDragStart,
}: {
  stop: UnassignedStop;
  onDragStart: (e: React.DragEvent, stop: UnassignedStop) => void;
}) {
  const isLeveren = stop.segment === 'leveren';

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, stop)}
      className={`rounded-lg border p-3 cursor-grab active:cursor-grabbing transition-all
        hover:shadow-md hover:scale-[1.02] select-none
        ${isLeveren
          ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20'
          : 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20'
        }
      `}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        {isLeveren ? (
          <ArrowDown className="h-3.5 w-3.5 text-green-600 shrink-0" />
        ) : (
          <ArrowUp className="h-3.5 w-3.5 text-red-600 shrink-0" />
        )}
        <span className={`text-xs font-bold ${isLeveren ? 'text-green-700' : 'text-red-700'}`}>
          {isLeveren ? 'Leveren' : 'Ophalen'}
        </span>
        {stop.isPartial && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-300 text-amber-700">
            Deels ingepland
          </Badge>
        )}
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto">
          {stop.orderNumber}
        </Badge>
      </div>

      {/* Customer */}
      <p className="text-xs font-semibold mt-1.5 truncate">{stop.customerName}</p>

      {/* Location */}
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1">
        <MapPin className="h-3 w-3 shrink-0" />
        <span className="truncate">{stop.location}</span>
      </div>

      {/* Time */}
      <div className="flex items-center gap-2 mt-1.5 text-[11px]">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="font-semibold">{stop.time}</span>
        </div>
        {stop.windowStart && (
          <span className="text-green-600 dark:text-green-400">
            (vanaf {stop.windowStart.slice(0, 5)})
          </span>
        )}
      </div>

      {/* Vehicles - show remaining when partial */}
      <div className="flex items-center gap-1.5 mt-1.5 text-[11px]">
        <Truck className="h-3 w-3 shrink-0 text-muted-foreground" />
        {stop.isPartial ? (
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-amber-700 dark:text-amber-400">
              Nog: {stop.remainingVehicleSummary}
            </span>
            <span className="text-muted-foreground">
              Totaal: {stop.vehicleSummary}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground truncate">{stop.vehicleSummary}</span>
        )}
      </div>

      {/* Transport */}
      {stop.transportName && (
        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 mt-1.5">
          {stop.transportName}
        </Badge>
      )}

      {/* Notes */}
      {stop.notes && (
        <div className="flex items-start gap-1 mt-1.5 text-[10px] text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
          <span className="line-clamp-2">{stop.notes}</span>
        </div>
      )}
    </div>
  );
}
