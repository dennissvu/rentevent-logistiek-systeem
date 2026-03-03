import { useState, useCallback } from 'react';
import { format, addDays, subDays } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Printer,
  Loader2,
  Route,
  Users,
  AlertTriangle,
} from 'lucide-react';
import { useDayRouteBuilder } from '@/hooks/useDayRouteBuilder';
import { DriverRouteTimeline } from '@/components/planning/route-builder/DriverRouteTimeline';
import { UnassignedOrdersPanel } from '@/components/planning/route-builder/UnassignedOrdersPanel';
import { QuantityAssignDialog } from '@/components/planning/route-builder/QuantityAssignDialog';
import {
  fetchDriverRijlijst,
  openDriverRijlijst,
  printAllDriverRijlijsten,
} from '@/utils/driverRijlijstPrint';
import { useToast } from '@/hooks/use-toast';
import type { UnassignedStop, VehicleQuantity } from '@/hooks/useDayRouteBuilder';

export default function DayRouteBuilder() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [printingAll, setPrintingAll] = useState(false);
  const [printingDriverId, setPrintingDriverId] = useState<string | null>(null);
  const [dragOverDriverId, setDragOverDriverId] = useState<string | null>(null);

  // Quantity assignment dialog state
  const [quantityDialogOpen, setQuantityDialogOpen] = useState(false);
  const [pendingDrop, setPendingDrop] = useState<{
    stop: UnassignedStop;
    driverId: string;
    driverName: string;
  } | null>(null);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const {
    orders,
    drivers,
    unassigned,
    isLoading,
    addStopToDriver,
    removeStop,
    reorderStops,
    assignTransportMaterial,
    isAdding,
  } = useDayRouteBuilder(dateStr);

  // ── Drag & drop (unassigned → driver) ───────────────

  const handleDragStart = useCallback(
    (e: React.DragEvent, stop: UnassignedStop) => {
      e.dataTransfer.setData('application/json', JSON.stringify(stop));
      e.dataTransfer.effectAllowed = 'move';
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDragOverDriver = useCallback(
    (e: React.DragEvent, driverId: string) => {
      // Don't set dragOverDriverId for internal stop reorder
      if (e.dataTransfer.types.includes('text/stop-reorder')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverDriverId(driverId);
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    setDragOverDriverId(null);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, driverId: string) => {
      e.preventDefault();
      setDragOverDriverId(null);

      // Ignore internal stop reorder drops
      if (e.dataTransfer.types.includes('text/stop-reorder')) return;

      try {
        const data = JSON.parse(e.dataTransfer.getData('application/json')) as UnassignedStop;
        const driver = drivers.find(d => d.id === driverId);
        const driverName = driver?.name || 'chauffeur';

        // Always show the quantity dialog so user can specify how many
        setPendingDrop({ stop: data, driverId, driverName });
        setQuantityDialogOpen(true);
      } catch (err) {
        console.error('Drop error:', err);
        toast({
          title: 'Fout bij toewijzen',
          variant: 'destructive',
        });
      }
    },
    [drivers, toast]
  );

  const handleQuantityConfirm = useCallback(
    async (assignedVehicles: VehicleQuantity[]) => {
      if (!pendingDrop) return;

      const { stop, driverId } = pendingDrop;

      try {
        await addStopToDriver({
          driverId,
          orderId: stop.orderId,
          assignmentId: stop.assignmentId,
          segment: stop.segment,
          stopType: stop.segment, // leveren or ophalen
          locationAddress: stop.location,
          assignedVehicles,
          notes: stop.notes || undefined,
        });

        const totalAssigned = assignedVehicles.reduce((s, v) => s + v.count, 0);
        toast({
          title: `${stop.segment === 'leveren' ? 'Levering' : 'Ophaling'} toegewezen`,
          description: `${stop.orderNumber}: ${totalAssigned} stuks toegevoegd aan route`,
        });
      } catch (err) {
        console.error('Assign error:', err);
        toast({
          title: 'Fout bij toewijzen',
          variant: 'destructive',
        });
      }

      setPendingDrop(null);
    },
    [pendingDrop, addStopToDriver, toast]
  );

  // ── Reorder stops ───────────────────────────────────

  const handleReorderStops = useCallback(
    async (routeId: string, stopIds: string[]) => {
      try {
        await reorderStops({ routeId, stopIds });
      } catch (err) {
        console.error('Reorder error:', err);
        toast({ title: 'Fout bij herordenen', variant: 'destructive' });
      }
    },
    [reorderStops, toast]
  );

  // ── Assign transport ────────────────────────────────

  const handleAssignTransport = useCallback(
    async (driverId: string, transportMaterialId: string | null) => {
      try {
        await assignTransportMaterial({ driverId, transportMaterialId });
        toast({
          title: transportMaterialId
            ? 'Transportmiddel toegewezen'
            : 'Transportmiddel verwijderd',
        });
      } catch (err) {
        console.error('Transport assign error:', err);
        toast({ title: 'Fout bij toewijzen transportmiddel', variant: 'destructive' });
      }
    },
    [assignTransportMaterial, toast]
  );

  // ── Print handlers ─────────────────────────────────────

  const handlePrintDriver = useCallback(
    async (driverId: string) => {
      setPrintingDriverId(driverId);
      try {
        const data = await fetchDriverRijlijst(driverId, dateStr);
        if (data) {
          openDriverRijlijst(data);
        } else {
          toast({ title: 'Geen route gevonden', variant: 'destructive' });
        }
      } catch (err) {
        console.error('Print error:', err);
        toast({ title: 'Fout bij genereren rijlijst', variant: 'destructive' });
      } finally {
        setPrintingDriverId(null);
      }
    },
    [dateStr, toast]
  );

  const handlePrintAll = useCallback(async () => {
    setPrintingAll(true);
    try {
      await printAllDriverRijlijsten(dateStr);
    } catch (err) {
      console.error('Print all error:', err);
      toast({ title: 'Fout bij genereren rijlijsten', variant: 'destructive' });
    } finally {
      setPrintingAll(false);
    }
  }, [dateStr, toast]);

  // ── Derived data ───────────────────────────────────────

  const busyDrivers = drivers.filter(d => d.stops.length > 0);
  const freeDrivers = drivers.filter(d => d.stops.length === 0);
  const totalStops = busyDrivers.reduce((s, d) => s + d.stops.length, 0);

  return (
    <div className="h-[calc(100vh-3.5rem)] flex">
      {/* Left: Unassigned orders panel */}
      <div className="w-[300px] shrink-0 border-r bg-muted/5 overflow-hidden">
        <UnassignedOrdersPanel stops={unassigned} onDragStart={handleDragStart} />
      </div>

      {/* Center: Main planning area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="flex items-center gap-2">
              <Route className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold">Route Builder</h1>
            </div>

            {/* Date navigation */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSelectedDate(d => subDays(d, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <CalendarDays className="h-4 w-4" />
                    {format(selectedDate, 'EEEE d MMMM yyyy', { locale: nl })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={d => d && setSelectedDate(d)}
                    locale={nl}
                  />
                </PopoverContent>
              </Popover>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSelectedDate(d => addDays(d, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="gap-1">
                <Users className="h-3 w-3" />
                {busyDrivers.length} chauffeurs
              </Badge>
              <Badge variant="outline">{orders.length} orders</Badge>
              {unassigned.length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {unassigned.length} niet ingepland
                </Badge>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 ml-auto">
              <Button
                onClick={handlePrintAll}
                disabled={printingAll || busyDrivers.length === 0}
                variant="outline"
                size="sm"
                className="gap-1.5"
              >
                {printingAll ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                Alle rijlijsten
              </Button>
            </div>
          </div>

          {/* Loading state */}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-32 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Busy drivers */}
              {busyDrivers.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Ingeplande chauffeurs ({busyDrivers.length})
                  </h2>
                  <div className="space-y-3">
                    {busyDrivers.map(driver => (
                      <DriverRouteTimeline
                        key={driver.id}
                        driver={driver}
                        onRemoveStop={removeStop}
                        onPrintRijlijst={handlePrintDriver}
                        onReorderStops={handleReorderStops}
                        onAssignTransport={handleAssignTransport}
                        dragOverDriverId={dragOverDriverId}
                        onDragOver={e => handleDragOverDriver(e, driver.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Free drivers */}
              {freeDrivers.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Beschikbare chauffeurs ({freeDrivers.length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {freeDrivers.map(driver => (
                      <DriverRouteTimeline
                        key={driver.id}
                        driver={driver}
                        onRemoveStop={removeStop}
                        onPrintRijlijst={handlePrintDriver}
                        onReorderStops={handleReorderStops}
                        onAssignTransport={handleAssignTransport}
                        dragOverDriverId={dragOverDriverId}
                        onDragOver={e => handleDragOverDriver(e, driver.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {orders.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <Route className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-lg font-medium">Geen orders op deze dag</p>
                  <p className="text-sm mt-1">
                    Selecteer een andere datum om routes te plannen
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quantity assignment dialog */}
      <QuantityAssignDialog
        open={quantityDialogOpen}
        onOpenChange={open => {
          setQuantityDialogOpen(open);
          if (!open) setPendingDrop(null);
        }}
        stop={pendingDrop?.stop || null}
        driverName={pendingDrop?.driverName || ''}
        onConfirm={handleQuantityConfirm}
      />
    </div>
  );
}
