import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  User,
  Truck,
  Clock,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Printer,
} from 'lucide-react';
import { StopCard } from './StopCard';
import { useTransport } from '@/context/TransportContext';
import type { RouteBuilderDriver, RouteBuilderStop, UnassignedStop } from '@/hooks/useDayRouteBuilder';

interface DriverRouteTimelineProps {
  driver: RouteBuilderDriver;
  onRemoveStop?: (stopId: string) => void;
  onAddStop?: (driverId: string, stop: UnassignedStop) => void;
  onPrintRijlijst?: (driverId: string) => void;
  onReorderStops?: (routeId: string, stopIds: string[]) => void;
  onAssignTransport?: (driverId: string, transportMaterialId: string | null) => void;
  dragOverDriverId?: string | null;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent, driverId: string) => void;
}

const routeStatusLabels: Record<string, string> = {
  concept: 'Concept',
  bevestigd: 'Bevestigd',
  onderweg: 'Onderweg',
  afgerond: 'Afgerond',
};

const routeStatusColors: Record<string, string> = {
  concept: 'bg-muted text-muted-foreground',
  bevestigd: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  onderweg: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  afgerond: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
};

export function DriverRouteTimeline({
  driver,
  onRemoveStop,
  onPrintRijlijst,
  onReorderStops,
  onAssignTransport,
  dragOverDriverId,
  onDragOver,
  onDragLeave,
  onDrop,
}: DriverRouteTimelineProps) {
  const [expanded, setExpanded] = useState(driver.stops.length > 0);
  const [dragOverStopIdx, setDragOverStopIdx] = useState<number | null>(null);
  const [draggingStopIdx, setDraggingStopIdx] = useState<number | null>(null);
  const { allTransportMaterials, combis } = useTransport();

  const hasStops = driver.stops.length > 0;
  const isDragTarget = dragOverDriverId === driver.id;

  // Build transport options list
  const transportOptions = [
    ...allTransportMaterials.map(t => ({ id: t.id, name: t.name, type: t.type })),
    ...combis.map(c => ({ id: c.id, name: c.name, type: 'combi' as const })),
  ];

  // Calculate total working time
  const totalMinutes = driver.totalDriveMinutes + driver.totalLoadMinutes;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  // Count customer stops (not utility stops like laden_winkel)
  const customerStops = driver.stops.filter(
    s => s.stopType === 'leveren' || s.stopType === 'ophalen'
  );
  const leverenCount = customerStops.filter(s => s.stopType === 'leveren').length;
  const ophalenCount = customerStops.filter(s => s.stopType === 'ophalen').length;

  // Check for timing warnings
  const hasWarnings = driver.stops.some(stop => {
    if (stop.stopType !== 'leveren' && stop.stopType !== 'ophalen') return false;
    if (!stop.estimatedArrival || !stop.customerTime) return false;
    const [aH, aM] = stop.estimatedArrival.split(':').map(Number);
    const [cH, cM] = stop.customerTime.split(':').map(Number);
    const arrivalMin = aH * 60 + aM;
    const customerMin = cH * 60 + cM;
    if (stop.segment === 'leveren') return arrivalMin > customerMin - 15;
    return arrivalMin > customerMin + 5;
  });

  // ── Stop reorder drag handlers ─────────────────────────
  const handleStopDragStart = useCallback(
    (e: React.DragEvent, idx: number) => {
      e.stopPropagation();
      setDraggingStopIdx(idx);
      e.dataTransfer.setData('text/stop-reorder', String(idx));
      e.dataTransfer.effectAllowed = 'move';
    },
    []
  );

  const handleStopDragOver = useCallback(
    (e: React.DragEvent, idx: number) => {
      // Only handle internal stop reorder
      if (!e.dataTransfer.types.includes('text/stop-reorder')) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      setDragOverStopIdx(idx);
    },
    []
  );

  const handleStopDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.stopPropagation();
      setDragOverStopIdx(null);
    },
    []
  );

  const handleStopDrop = useCallback(
    (e: React.DragEvent, targetIdx: number) => {
      if (!e.dataTransfer.types.includes('text/stop-reorder')) return;
      e.preventDefault();
      e.stopPropagation();

      const sourceIdx = parseInt(e.dataTransfer.getData('text/stop-reorder'), 10);
      setDragOverStopIdx(null);
      setDraggingStopIdx(null);

      if (sourceIdx === targetIdx || !driver.routeId) return;

      // Reorder the stops
      const newOrder = [...driver.stops];
      const [moved] = newOrder.splice(sourceIdx, 1);
      newOrder.splice(targetIdx, 0, moved);
      const newStopIds = newOrder.map(s => s.id);

      onReorderStops?.(driver.routeId, newStopIds);
    },
    [driver.stops, driver.routeId, onReorderStops]
  );

  const handleStopDragEnd = useCallback(() => {
    setDraggingStopIdx(null);
    setDragOverStopIdx(null);
  }, []);

  return (
    <Card
      className={`transition-all ${
        isDragTarget
          ? 'ring-2 ring-primary shadow-lg scale-[1.01]'
          : hasStops
          ? 'shadow-sm'
          : 'opacity-70'
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={e => onDrop?.(e, driver.id)}
    >
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          {/* Driver info */}
          <div className="flex items-center gap-2">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                hasStops ? 'bg-primary' : 'bg-muted-foreground/50'
              }`}
            >
              {driver.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm">{driver.name}</span>
                {driver.canDriveTrailer && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0">
                    <Truck className="h-2.5 w-2.5 mr-0.5" />
                    AH
                  </Badge>
                )}
                {hasWarnings && (
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                )}
              </div>
              {hasStops && (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  {driver.estimatedStartTime && driver.estimatedEndTime && (
                    <span className="flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {driver.estimatedStartTime} - {driver.estimatedEndTime}
                    </span>
                  )}
                  {totalMinutes > 0 && (
                    <span>
                      {hours > 0 ? `${hours}u${mins > 0 ? `${mins}m` : ''}` : `${mins}m`}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right side: stats + actions */}
          <div className="flex items-center gap-2">
            {hasStops && (
              <div className="flex items-center gap-1.5 text-xs mr-1">
                {leverenCount > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 border-green-300 text-green-700 dark:text-green-400"
                  >
                    {leverenCount} leveren
                  </Badge>
                )}
                {ophalenCount > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 border-red-300 text-red-700 dark:text-red-400"
                  >
                    {ophalenCount} ophalen
                  </Badge>
                )}
                <Badge className={`text-[9px] px-1.5 py-0 ${routeStatusColors[driver.routeStatus]}`}>
                  {routeStatusLabels[driver.routeStatus] || driver.routeStatus}
                </Badge>
              </div>
            )}
            {hasStops && onPrintRijlijst && (
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => onPrintRijlijst(driver.id)}
                title="Print rijlijst"
              >
                <Printer className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Transport material selector */}
        {hasStops && onAssignTransport && (
          <div className="flex items-center gap-2 mt-2">
            <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Select
              value={driver.transportMaterialId || 'none'}
              onValueChange={val =>
                onAssignTransport(driver.id, val === 'none' ? null : val)
              }
            >
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue placeholder="Transportmiddel kiezen..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Geen transportmiddel</SelectItem>
                {transportOptions.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.type === 'combi' && ' (combi)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 pb-3 px-4">
          {hasStops ? (
            <div className="space-y-0 mt-1">
              {driver.stops.map((stop, idx) => (
                <StopCard
                  key={stop.id}
                  stop={stop}
                  index={idx}
                  isFirst={idx === 0}
                  isLast={idx === driver.stops.length - 1}
                  onRemove={onRemoveStop}
                  draggable
                  onDragStart={e => handleStopDragStart(e, idx)}
                  onDragOver={e => handleStopDragOver(e, idx)}
                  onDragLeave={handleStopDragLeave}
                  onDrop={e => handleStopDrop(e, idx)}
                  isDragOver={dragOverStopIdx === idx && draggingStopIdx !== idx}
                />
              ))}
            </div>
          ) : (
            <div
              className={`mt-1 rounded-lg border-2 border-dashed p-4 text-center text-sm text-muted-foreground ${
                isDragTarget
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/20'
              }`}
            >
              {isDragTarget ? (
                <span className="font-medium text-primary">Laat los om toe te voegen</span>
              ) : (
                <span>Sleep een order hierheen om een stop toe te voegen</span>
              )}
            </div>
          )}

          {/* Drop zone at bottom for drivers with stops */}
          {hasStops && isDragTarget && (
            <div className="mt-2 rounded-lg border-2 border-dashed border-primary bg-primary/5 p-2 text-center text-xs font-medium text-primary">
              Laat los om stop toe te voegen
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
