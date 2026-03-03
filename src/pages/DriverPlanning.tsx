import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, isToday, isTomorrow, isPast } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  User,
  Truck,
  MapPin,
  Clock,
  Users,
  Calendar,
  ArrowDown,
  ArrowUp,
  Package,
  Store,
  Warehouse,
  Route,
  AlertTriangle,
  Sparkles,
  FileText,
  Loader2,
} from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useDriversDb } from '@/hooks/useDriversDb';
import { useDriverAssignments, DriverTrip } from '@/hooks/useDriverAssignments';
import { vehicleTypes as vehicleTypesList } from '@/data/transportData';
import { fetchAndPrintCombinedDayTrip } from '@/utils/combinedDayPrint';
import { useToast } from '@/hooks/use-toast';
import { RouteOptimizationCard } from '@/components/planning/RouteOptimizationCard';


function getDateLabel(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Vandaag';
  if (isTomorrow(date)) return 'Morgen';
  return format(date, 'EEEE d MMMM', { locale: nl });
}

function getDateSublabel(dateStr: string): string | null {
  const date = parseISO(dateStr);
  if (isToday(date) || isTomorrow(date)) {
    return format(date, 'd MMMM yyyy', { locale: nl });
  }
  return null;
}

function isDatePast(dateStr: string): boolean {
  const date = parseISO(dateStr);
  return isPast(date) && !isToday(date);
}

function getVehicleName(type: string): string {
  const info = vehicleTypesList.find(v => v.id === type);
  return info?.name || type;
}

// Group trips by date
function groupByDate(trips: DriverTrip[]): Map<string, DriverTrip[]> {
  const groups = new Map<string, DriverTrip[]>();
  for (const trip of trips) {
    const existing = groups.get(trip.date) || [];
    existing.push(trip);
    groups.set(trip.date, existing);
  }
  return groups;
}

// Calculate combined day summary
function getDaySummary(dateTrips: DriverTrip[]) {
  const allSegments = dateTrips.flatMap(t => t.segments);
  const hasLeveren = allSegments.some(s => s.segment === 'leveren');
  const hasOphalen = allSegments.some(s => s.segment === 'ophalen');
  
  // Earliest work start, latest work end
  const workStarts = dateTrips.map(t => t.workStartTime).filter(Boolean).sort();
  const workEnds = dateTrips.map(t => t.workEndTime).filter(Boolean).sort();
  
  const totalVehicles = dateTrips.reduce((sum, t) => sum + t.totalVehicles, 0);
  const uniqueLocations = new Set<string>();
  dateTrips.forEach(t => {
    if (t.deliveryCity) uniqueLocations.add(t.deliveryCity);
    if (t.pickupCity) uniqueLocations.add(t.pickupCity);
  });

  return {
    hasLeveren,
    hasOphalen,
    workStart: workStarts[0] || '–',
    workEnd: workEnds[workEnds.length - 1] || '–',
    totalVehicles,
    locations: [...uniqueLocations],
    orderCount: dateTrips.length,
  };
}

function TripCard({ trip, onClick }: { trip: DriverTrip; onClick: () => void }) {
  const past = isDatePast(trip.date);

  return (
    <Card
      className={`cursor-pointer transition-all active:scale-[0.98] ${past ? 'opacity-60' : 'hover:shadow-md'}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Top row: work times + segments */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 rounded-lg px-3 py-1.5 text-center">
              <p className="text-lg font-bold text-primary leading-tight">
                {trip.workStartTime || '–'}
              </p>
              <p className="text-[10px] text-muted-foreground">start</p>
            </div>
            <span className="text-muted-foreground text-sm">→</span>
            <div className="bg-primary/10 rounded-lg px-3 py-1.5 text-center">
              <p className="text-lg font-bold text-primary leading-tight">
                {trip.workEndTime || '–'}
              </p>
              <p className="text-[10px] text-muted-foreground">klaar</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {trip.segments.map((seg, i) => (
                <Badge
                  key={i}
                  variant={seg.segment === 'leveren' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {seg.segment === 'leveren' ? (
                    <ArrowDown className="h-3 w-3 mr-1" />
                  ) : (
                    <ArrowUp className="h-3 w-3 mr-1" />
                  )}
                  {seg.segment === 'leveren' ? 'Leveren' : 'Ophalen'}
                </Badge>
              ))}
            </div>
            {trip.isCombinedTrip && (
              <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                Hele dag
              </Badge>
            )}
          </div>
        </div>

        {/* Customer + location */}
        <div className="mb-3">
          <p className="font-semibold text-base">{trip.customerName}</p>
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>
              {trip.segments.some(s => s.segment === 'leveren') 
                ? trip.deliveryCity 
                : trip.pickupCity}
              {trip.isCombinedTrip && trip.deliveryCity !== trip.pickupCity && (
                <> → {trip.pickupCity}</>
              )}
            </span>
          </div>
        </div>

        {/* Customer time + vehicles row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Klant {trip.startTime} – {trip.endTime}</span>
          </div>

          <div className="flex items-center gap-1 text-sm">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">{trip.totalVehicles}x</span>
            <span className="text-muted-foreground">
              {trip.vehicleTypes.length === 1
                ? getVehicleName(trip.vehicleTypes[0].type)
                : 'mix'}
            </span>
          </div>
        </div>

        {/* Transport + co-drivers */}
        <div className="mt-3 pt-3 border-t flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Truck className="h-3.5 w-3.5" />
            <span>
              {[...new Set(trip.segments.map(s => s.transportName))].join(', ')}
            </span>
          </div>

          {trip.coDrivers.length > 0 && (
            <Badge variant="outline" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              +{[...new Set(trip.coDrivers.map(c => c.driverName))].join(', ')}
            </Badge>
          )}
        </div>

        {/* Load/unload plan */}
        {trip.loadSteps.length > 0 && (
          <div className="mt-3 pt-3 border-t space-y-2">
            {trip.loadSteps.some(s => s.action === 'laden') && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  <ArrowUp className="h-3 w-3 inline mr-1" />
                  Laden
                </p>
                <div className="space-y-1">
                  {trip.loadSteps.filter(s => s.action === 'laden').map((step, i) => (
                    <div key={`laden-${i}`} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span>{step.vehicleIcon}</span>
                        <span className="font-medium">{step.vehicleCount}x</span>
                        <span className="text-muted-foreground">{step.vehicleTypeName}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium">{step.transportName || '–'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                          {step.location === 'winkel' ? <Store className="h-2.5 w-2.5 mr-0.5" /> : <Warehouse className="h-2.5 w-2.5 mr-0.5" />}
                          {step.location}
                        </Badge>
                        {step.helperNames.length > 0 && (
                          <span className="text-muted-foreground">{step.helperNames.join(', ')}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {trip.loadSteps.some(s => s.action === 'lossen') && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  <ArrowDown className="h-3 w-3 inline mr-1" />
                  Lossen
                </p>
                <div className="space-y-1">
                  {trip.loadSteps.filter(s => s.action === 'lossen').map((step, i) => {
                    const isBlijftStaan = step.location === 'blijft_staan';
                    return (
                      <div key={`lossen-${i}`} className={`flex items-center justify-between text-xs ${isBlijftStaan ? 'bg-blue-50/50 dark:bg-blue-950/20 rounded px-1 py-0.5' : ''}`}>
                        <div className="flex items-center gap-1.5">
                          <span>{step.vehicleIcon}</span>
                          <span className="font-medium">{step.vehicleCount}x</span>
                          <span className="text-muted-foreground">{step.vehicleTypeName}</span>
                          {isBlijftStaan ? (
                            <span className="text-blue-600 dark:text-blue-400 font-medium">→ blijft staan</span>
                          ) : (
                            <>
                              <span className="text-muted-foreground">→</span>
                              <span className="font-medium">{step.transportName || '–'}</span>
                            </>
                          )}
                        </div>
                        {!isBlijftStaan && (
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                              {step.location === 'winkel' ? <Store className="h-2.5 w-2.5 mr-0.5" /> : <Warehouse className="h-2.5 w-2.5 mr-0.5" />}
                              {step.location}
                            </Badge>
                            {step.helperNames.length > 0 && (
                              <span className="text-muted-foreground">{step.helperNames.join(', ')}</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Banner shown when a date has multiple orders */
function CombinedDayBanner({ summary }: { summary: ReturnType<typeof getDaySummary> }) {
  if (summary.orderCount <= 1) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm">
      <Route className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
      <div>
        <span className="font-semibold text-amber-800 dark:text-amber-300">
          Gecombineerde dag: {summary.orderCount} orders
        </span>
        <span className="text-amber-700 dark:text-amber-400 ml-2">
          {summary.totalVehicles} voertuigen · {summary.locations.join(' → ')}
        </span>
      </div>
    </div>
  );
}

/** Combined work time header for multi-order days */
function DayWorkTimeBanner({ summary }: { summary: ReturnType<typeof getDaySummary> }) {
  if (summary.orderCount <= 1) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/5 border border-primary/20">
      <div className="bg-primary/10 rounded-lg px-3 py-1.5 text-center">
        <p className="text-xl font-bold text-primary leading-tight">{summary.workStart}</p>
        <p className="text-[10px] text-muted-foreground">start werkdag</p>
      </div>
      <span className="text-muted-foreground text-lg">→</span>
      <div className="bg-primary/10 rounded-lg px-3 py-1.5 text-center">
        <p className="text-xl font-bold text-primary leading-tight">{summary.workEnd}</p>
        <p className="text-[10px] text-muted-foreground">einde werkdag</p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {summary.hasLeveren && (
          <Badge variant="default" className="text-xs">
            <ArrowDown className="h-3 w-3 mr-1" />Leveren
          </Badge>
        )}
        {summary.hasOphalen && (
          <Badge variant="secondary" className="text-xs">
            <ArrowUp className="h-3 w-3 mr-1" />Ophalen
          </Badge>
        )}
      </div>
    </div>
  );
}

export default function DriverPlanning() {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [printingDate, setPrintingDate] = useState<string | null>(null);
  const { drivers, isLoading: driversLoading } = useDriversDb();
  const { data: trips = [], isLoading: tripsLoading } = useDriverAssignments(selectedDriverId);
  const navigate = useNavigate();
  const { toast } = useToast();

  const activeDrivers = drivers.filter(d => d.available !== false);
  const selectedDriver = activeDrivers.find(d => d.id === selectedDriverId);
  const groupedTrips = groupByDate(trips);

  const handlePrintDayTrip = async (date: string) => {
    if (!selectedDriverId) return;
    setPrintingDate(date);
    try {
      await fetchAndPrintCombinedDayTrip(selectedDriverId, date);
    } catch (err) {
      console.error('Print error:', err);
      toast({ title: 'Fout bij genereren dagritplanning', variant: 'destructive' });
    } finally {
      setPrintingDate(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Mijn Ritten</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Selecteer een medewerker om de ingeplande ritten te zien
        </p>
      </div>

      {/* Driver selector */}
      <Select
        value={selectedDriverId || ''}
        onValueChange={(val) => setSelectedDriverId(val || null)}
      >
        <SelectTrigger className="w-full h-12 text-base">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <SelectValue placeholder="Kies medewerker..." />
          </div>
        </SelectTrigger>
        <SelectContent>
          {driversLoading ? (
            <div className="p-2">
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            activeDrivers.map((driver) => (
              <SelectItem key={driver.id} value={driver.id} className="text-base py-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {driver.name}
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {/* Trips list */}
      {selectedDriverId && (
        <div className="space-y-6">
          {tripsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-32 w-full rounded-xl" />
              ))}
            </div>
          ) : trips.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">
                Geen ritten ingepland voor {selectedDriver?.name}
              </p>
            </div>
          ) : (
            Array.from(groupedTrips.entries()).map(([date, dateTrips]) => {
              const summary = getDaySummary(dateTrips);
              const isMultiOrder = summary.orderCount > 1;

              return (
                <div key={date} className="space-y-3">
                   {/* Date header */}
                   <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-2">
                     <div className="flex items-center gap-2">
                       <Calendar className="h-4 w-4 text-primary" />
                       <h2 className="font-semibold text-base capitalize">
                         {getDateLabel(date)}
                       </h2>
                       {getDateSublabel(date) && (
                         <span className="text-sm text-muted-foreground">
                           {getDateSublabel(date)}
                         </span>
                       )}
                       {isMultiOrder && (
                         <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 dark:text-amber-400">
                           <Route className="h-3 w-3 mr-1" />
                           {summary.orderCount} orders
                         </Badge>
                       )}
                       <Button
                         variant="outline"
                         size="sm"
                         className="ml-auto h-7 text-xs gap-1.5"
                         disabled={printingDate === date}
                         onClick={() => handlePrintDayTrip(date)}
                       >
                         {printingDate === date ? (
                           <Loader2 className="h-3 w-3 animate-spin" />
                         ) : (
                           <FileText className="h-3 w-3" />
                         )}
                         Dagrit
                       </Button>
                     </div>
                   </div>

                   {/* Combined day info banners */}
                   <DayWorkTimeBanner summary={summary} />
                   <CombinedDayBanner summary={summary} />

                   {/* Route optimization for multi-order days */}
                   {isMultiOrder && selectedDriverId && (
                     <RouteOptimizationCard
                       driverId={selectedDriverId}
                       date={date}
                       trips={dateTrips}
                     />
                   )}

                  {/* Trip cards for this date */}
                  <div className="space-y-3">
                    {dateTrips.map((trip, idx) => (
                      <div key={`${trip.orderId}-${trip.segments.map(s => s.segment).join('-')}`}>
                        {/* Order sequence indicator for multi-order days */}
                        {isMultiOrder && (
                          <div className="flex items-center gap-2 mb-2 ml-1">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                              {idx + 1}
                            </div>
                            <span className="text-xs text-muted-foreground font-medium">
                              {trip.segments.map(s => s.segment === 'leveren' ? 'Leveren' : 'Ophalen').join(' + ')}
                              {' · '}
                              {trip.segments.some(s => s.segment === 'leveren') 
                                ? trip.deliveryCity 
                                : trip.pickupCity}
                            </span>
                          </div>
                        )}
                        <TripCard
                          trip={trip}
                          onClick={() => navigate(`/orders/${trip.orderId}`)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}

          {/* Summary */}
          {trips.length > 0 && (
            <div className="text-center text-sm text-muted-foreground pt-4 pb-8">
              {trips.length} {trips.length === 1 ? 'rit' : 'ritten'} ingepland
              {(() => {
                const multiDays = Array.from(groupedTrips.values()).filter(t => t.length > 1);
                return multiDays.length > 0
                  ? ` · ${multiDays.length} gecombineerde ${multiDays.length === 1 ? 'dag' : 'dagen'}`
                  : '';
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
