import { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Clock, 
  MapPin, 
  Truck, 
  User, 
  AlertCircle,
  Navigation,
  Timer,
  Package,
  Printer,
} from 'lucide-react';
import { 
  calculateDriverSchedule, 
  calculateDriverScheduleSync,
  DriverSchedule,
  LOCATIONS,
  TIME_CONSTANTS,
  needsTrailer as checkNeedsTrailer,
  estimateLoadUnloadTime
} from '@/utils/driverScheduleCalculator';
import { openTripPrintDocument, TripPrintData, PrintRouteStep, PrintLoadStep } from '@/utils/tripPrintDocument';
import { Skeleton } from '@/components/ui/skeleton';

// Helper to adjust a HH:MM time string by delta minutes
function adjustTime(timeStr: string, deltaMinutes: number): string {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + deltaMinutes;
  const adjTotal = ((total % 1440) + 1440) % 1440; // wrap around midnight
  return `${String(Math.floor(adjTotal / 60)).padStart(2, '0')}:${String(adjTotal % 60).padStart(2, '0')}`;
}

/** Renders specific load/unload instruction details inline in the timeline */
function LoadUnloadDetails({ steps, action, fallbackMinutes, location }: {
  steps?: PrintLoadStep[];
  action: 'laden' | 'lossen';
  fallbackMinutes: number;
  location?: string; // filter by location (e.g. 'Winkel' or 'Loods')
}) {
  let filtered = steps?.filter(s => s.action === action) || [];
  if (location) {
    filtered = filtered.filter(s => s.location.toLowerCase() === location.toLowerCase());
  }
  // Exclude "blijft staan" from time-based load/unload details
  const activeSteps = filtered.filter(s => s.location.toLowerCase() !== 'blijft staan');
  const staySteps = filtered.filter(s => s.location.toLowerCase() === 'blijft staan');

  if (activeSteps.length === 0 && staySteps.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {fallbackMinutes} min {action}
      </p>
    );
  }
  return (
    <div className="space-y-0.5 mt-0.5">
      {activeSteps.map((step, i) => (
        <p key={i} className="text-xs text-muted-foreground">
          {step.vehicleIcon} <span className="font-medium">{step.vehicleCount}x</span> {step.vehicleType}
          {step.transportName ? ` → ${step.transportName}` : ''}
        </p>
      ))}
      {staySteps.map((step, i) => (
        <p key={`stay-${i}`} className="text-xs text-blue-600 dark:text-blue-400 font-medium">
          {step.vehicleIcon} {step.vehicleCount}x {step.vehicleType} → blijft staan
          {step.transportName ? ` (${step.transportName})` : ''}
        </p>
      ))}
      {fallbackMinutes > 0 && activeSteps.length > 0 && (
        <p className="text-xs text-muted-foreground italic">{fallbackMinutes} min totaal</p>
      )}
    </div>
  );
}

export interface TripPrintContext {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  companyName?: string;
  bookingDate: string;
  customerEndTime: string;
  numberOfPersons: number;
  vehiclesSummary: string;
  deliveryLocation: string;
  pickupLocation: string;
  loadSteps: PrintLoadStep[];
  notes?: string;
}

interface DriverScheduleCardProps {
  customerStartTime: string;
  customerAddress: string;
  vehicleCount: number;
  transportId?: string;
  transportName?: string;
  driverId?: string | null;
  driverName?: string;
  date: Date;
  compact?: boolean;
  assignmentNumber?: number;
  segment?: 'leveren' | 'ophalen';
  // Gecombineerd uitladen props
  isCombined?: boolean;
  combinedWallClockTime?: number;
  timeSaved?: number;
  // Shop-side load/unload times from confirmed plan
  shopLoadMinutes?: number;
  shopUnloadMinutes?: number;
  shopUnloadWinkelMinutes?: number;
  shopUnloadLoodsMinutes?: number;
  // Print context for full trip document
  printContext?: TripPrintContext;
}

export function DriverScheduleCard({
  customerStartTime,
  customerAddress,
  vehicleCount,
  transportId,
  transportName,
  driverId,
  driverName,
  date,
  compact = false,
  assignmentNumber,
  segment = 'leveren',
  isCombined = false,
  combinedWallClockTime,
  timeSaved,
  shopLoadMinutes = 0,
  shopUnloadMinutes = 0,
  shopUnloadWinkelMinutes,
  shopUnloadLoodsMinutes,
  printContext,
}: DriverScheduleCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [schedule, setSchedule] = useState<DriverSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  
  const hasTrailer = transportId ? checkNeedsTrailer(transportId) : false;
  const isPickup = segment === 'ophalen';
  
  // Bepaal de werkelijke laad/lostijd (gecombineerd of individueel)
  const individualLoadUnloadTime = estimateLoadUnloadTime({ segment, vehicleCount, hasTrailer });
  const effectiveLoadUnloadTime = isCombined && combinedWallClockTime 
    ? combinedWallClockTime 
    : individualLoadUnloadTime;
  
  // Snelle synchrone berekening voor directe weergave
  const quickCalc = calculateDriverScheduleSync({
    customerStartTime,
    vehicleCount,
    needsTrailer: hasTrailer,
    segment,
  });

  // Adjusted quick start (accounting for shop loading)
  const quickAdjustedStart = shopLoadMinutes > 0
    ? adjustTime(quickCalc.driverStartTime, -shopLoadMinutes)
    : quickCalc.driverStartTime;

  useEffect(() => {
    let cancelled = false;
    
    async function loadSchedule() {
      setLoading(true);
      try {
        const result = await calculateDriverSchedule({
          customerStartTime,
          customerAddress,
          vehicleCount,
          transportId,
          date,
          segment,
        });
        if (!cancelled) {
          setSchedule(result);
        }
      } catch (err) {
        console.error('Failed to load schedule:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    
    loadSchedule();
    
    return () => {
      cancelled = true;
    };
  }, [customerStartTime, customerAddress, vehicleCount, transportId, date, segment]);

  // Compute adjusted times from schedule
  const adjustedStartTime = schedule?.totals.driverStartTime
    ? (shopLoadMinutes > 0 ? adjustTime(schedule.totals.driverStartTime, -shopLoadMinutes) : schedule.totals.driverStartTime)
    : null;
  
  const adjustedEndTime = schedule?.totals.driverEndTime
    ? (shopUnloadMinutes > 0 ? adjustTime(schedule.totals.driverEndTime, shopUnloadMinutes) : schedule.totals.driverEndTime)
    : null;

  const displayStartTime = adjustedStartTime || quickAdjustedStart;

  const handlePrint = useCallback(() => {
    if (!schedule || !printContext) return;

    // Build route steps from schedule
    const routeSteps: PrintRouteStep[] = [];

    // Helper to format load steps for print detail
    const formatPrintDetail = (action: 'laden' | 'lossen', minutes: number, filterLocation?: string): string => {
      let filtered = printContext.loadSteps.filter(s => s.action === action);
      if (filterLocation) {
        filtered = filtered.filter(s => s.location.toLowerCase() === filterLocation.toLowerCase());
      }
      // Exclude "blijft staan" from timed actions
      const activeSteps = filtered.filter(s => s.location.toLowerCase() !== 'blijft staan');
      const staySteps = filtered.filter(s => s.location.toLowerCase() === 'blijft staan');
      
      const lines: string[] = [];
      for (const s of activeSteps) {
        lines.push(`${s.vehicleIcon} ${s.vehicleCount}x ${s.vehicleType}${s.transportName ? ` → ${s.transportName}` : ''}`);
      }
      for (const s of staySteps) {
        lines.push(`${s.vehicleIcon} ${s.vehicleCount}x ${s.vehicleType} → blijft staan`);
      }
      if (lines.length === 0) return `${minutes} min ${action}`;
      return lines.join(' · ') + (minutes > 0 ? ` — ${minutes} min totaal` : '');
    };

    // Calculate split unload times by location
    const winkelUnload = shopUnloadWinkelMinutes ?? shopUnloadMinutes;
    const loodsUnload = shopUnloadLoodsMinutes ?? 0;

    // Shop loading
    if (shopLoadMinutes > 0) {
      routeSteps.push({
        time: displayStartTime,
        label: 'Laden bij winkel/loods',
        detail: formatPrintDetail('laden', shopLoadMinutes),
        type: 'action',
      });
    }

    // Winkel start
    routeSteps.push({
      time: schedule.delivery.startAtWinkel,
      label: 'Winkel Volendam',
      detail: !isPickup ? `${TIME_CONSTANTS.STARTUP_TIME_WINKEL} min opstarten` : undefined,
      type: 'start',
    });

    // Loods (heenrit)
    if (hasTrailer && schedule.delivery.arriveAtLoods) {
      routeSteps.push({
        time: schedule.delivery.arriveAtLoods,
        endTime: schedule.delivery.departFromLoods,
        label: 'Loods Purmerend',
        detail: `${TIME_CONSTANTS.TRAILER_COUPLING_TIME} min aanhanger koppelen`,
        type: 'stop',
      });
    }

    // Klant
    if (isPickup) {
      routeSteps.push({
        time: schedule.delivery.arriveAtCustomer,
        label: 'Aankomst bij klant',
        sublabel: customerAddress,
        type: 'destination',
      });
      routeSteps.push({
        time: schedule.delivery.arriveAtCustomer,
        endTime: schedule.delivery.unloadComplete,
        label: 'Inladen voertuigen',
        detail: `${effectiveLoadUnloadTime} min laden (${vehicleCount} voertuigen)`,
        type: 'action',
      });
      routeSteps.push({
        time: schedule.delivery.unloadComplete || '',
        label: 'Klaar voor vertrek',
        sublabel: 'Retour naar winkel/loods',
        type: 'destination',
      });
    } else {
      routeSteps.push({
        time: schedule.delivery.arriveAtCustomer,
        label: 'Klant locatie',
        sublabel: customerAddress,
        detail: `${effectiveLoadUnloadTime} min uitladen (${vehicleCount} voertuigen)`,
        type: 'destination',
      });
      routeSteps.push({
        time: schedule.delivery.readyForCustomer,
        label: 'Klaar voor klant',
        detail: `15 min voor starttijd (${customerStartTime})`,
        type: 'destination',
      });
    }

    // Return trip
    if (schedule.returnTrip) {
      routeSteps.push({
        time: schedule.returnTrip.departFromCustomer,
        label: 'Vertrek van klant',
        sublabel: customerAddress,
        type: 'return',
      });

      if (isPickup && hasTrailer && schedule.returnTrip.arriveAtWinkelForUnload) {
        // Pickup+trailer: Customer → Winkel (lossen winkel) → Loods (lossen loods + afkoppelen) → Winkel
        routeSteps.push({
          time: schedule.returnTrip.arriveAtWinkelForUnload,
          label: 'Aankomst Winkel Volendam',
          type: 'return',
        });
        if (winkelUnload > 0) {
          routeSteps.push({
            time: schedule.returnTrip.arriveAtWinkelForUnload,
            endTime: adjustTime(schedule.returnTrip.arriveAtWinkelForUnload, winkelUnload),
            label: 'Lossen winkel',
            detail: formatPrintDetail('lossen', winkelUnload, 'Winkel'),
            type: 'action',
          });
        }
        const loodsArriveOffset = winkelUnload;
        routeSteps.push({
          time: adjustTime(schedule.returnTrip.arriveAtLoods || '', loodsArriveOffset),
          endTime: adjustTime(schedule.returnTrip.departFromLoods || '', loodsArriveOffset + loodsUnload),
          label: 'Loods Purmerend',
          detail: (loodsUnload > 0 ? formatPrintDetail('lossen', loodsUnload, 'Loods') + ' · ' : '') + `${TIME_CONSTANTS.TRAILER_COUPLING_TIME} min aanhanger afkoppelen`,
          type: 'stop',
        });
        routeSteps.push({
          time: adjustedEndTime || schedule.returnTrip.arriveAtWinkel,
          label: 'Aankomst Winkel Volendam',
          type: 'return',
        });
      } else {
        // Standard: Customer → Loods → Winkel OR Customer → Winkel
        if (schedule.returnTrip.arriveAtLoods) {
          routeSteps.push({
            time: schedule.returnTrip.arriveAtLoods,
            endTime: schedule.returnTrip.departFromLoods,
            label: 'Loods Purmerend',
            detail: `${TIME_CONSTANTS.TRAILER_COUPLING_TIME} min aanhanger afkoppelen`,
            type: 'stop',
          });
        }
        routeSteps.push({
          time: schedule.returnTrip.arriveAtWinkel,
          label: 'Aankomst Winkel Volendam',
          type: 'return',
        });
        if (shopUnloadMinutes > 0) {
          routeSteps.push({
            time: schedule.returnTrip.arriveAtWinkel,
            endTime: adjustedEndTime || '',
            label: 'Lossen winkel',
            detail: formatPrintDetail('lossen', shopUnloadMinutes, 'Winkel'),
            type: 'action',
          });
        }
      }
    }

    const printData: TripPrintData = {
      segment: segment as 'leveren' | 'ophalen',
      assignmentNumber,
      driverName: driverName || 'Chauffeur',
      transportName: transportName || 'Onbekend',
      startTime: displayStartTime,
      endTime: adjustedEndTime || schedule.totals.driverEndTime || '-',
      hasTrailer,
      orderNumber: printContext.orderNumber,
      customerName: printContext.customerName,
      customerPhone: printContext.customerPhone,
      customerEmail: printContext.customerEmail,
      companyName: printContext.companyName,
      bookingDate: printContext.bookingDate,
      customerStartTime,
      customerEndTime: printContext.customerEndTime,
      numberOfPersons: printContext.numberOfPersons,
      vehiclesSummary: printContext.vehiclesSummary,
      deliveryLocation: printContext.deliveryLocation,
      pickupLocation: printContext.pickupLocation,
      routeSteps,
      driveTimeOutbound: `${schedule.totals.totalDriveMinutes} min`,
      driveTimeReturn: schedule.returnTrip ? `${schedule.returnTrip.totalReturnMinutes} min` : '-',
      loadSteps: printContext.loadSteps,
      notes: printContext.notes,
    };

    openTripPrintDocument(printData);
  }, [schedule, printContext, displayStartTime, adjustedEndTime, isPickup, hasTrailer, shopLoadMinutes, shopUnloadMinutes, segment, assignmentNumber, driverName, transportName, customerStartTime, customerAddress, vehicleCount, effectiveLoadUnloadTime]);

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <span className="font-medium">
          Start: {displayStartTime}
        </span>
        {(schedule?.isEstimate || !schedule) && (
          <Badge variant="outline" className="text-[10px] px-1">
            ~
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Card ref={cardRef}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Timer className="h-5 w-5" />
            {isPickup ? 'Ophaalplanning' : 'Ritplanning'}{assignmentNumber ? ` #${assignmentNumber}` : ''}
          </CardTitle>
          <div className="flex items-center gap-2">
            {transportName && (
              <Badge variant="secondary" className="text-xs">
                <Truck className="h-3 w-3 mr-1" />
                {transportName}
              </Badge>
            )}
            {(shopLoadMinutes > 0 || shopUnloadMinutes > 0) && (
              <Badge variant="default" className="text-xs">
                <Package className="h-3 w-3 mr-1" />
                Laadplan
              </Badge>
            )}
            {(schedule?.isEstimate || !schedule) && (
              <Badge variant="outline" className="text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />
                Geschat
              </Badge>
            )}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 print-hide"
              onClick={handlePrint}
              disabled={!schedule || !printContext}
              title="Ritplanning printen"
            >
              <Printer className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Chauffeur info */}
        <div className="bg-primary/10 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <div>
                <span className="font-medium">
                  {driverName || 'Chauffeur'}
                </span>
                {!driverName && driverId && (
                  <span className="text-xs text-muted-foreground ml-2">
                    (niet toegewezen)
                  </span>
                )}
              </div>
            </div>
            <span className="text-2xl font-bold text-primary">
              {loading && !schedule ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                displayStartTime
              )}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {schedule ? (
              <>Start {schedule.totals.totalDriveMinutes + schedule.totals.totalPrepMinutes + schedule.totals.unloadMinutes + shopLoadMinutes + (isPickup ? 0 : TIME_CONSTANTS.READY_BEFORE_START)} minuten voor {isPickup ? 'ophaaltijd' : 'klant starttijd'}</>
            ) : (
              <>Start ~{quickCalc.totalMinutesBefore + shopLoadMinutes} minuten voor {isPickup ? 'ophaaltijd' : 'klant starttijd'} (schatting)</>
            )}
          </p>
        </div>

        {/* Route details */}
        <div className="space-y-3">
          {/* Shop loading step - only when plan is confirmed */}
          {shopLoadMinutes > 0 && (
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <div className="w-0.5 h-8 bg-border" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm text-amber-700 dark:text-amber-400">
                  Laden bij winkel/loods
                </p>
                <LoadUnloadDetails steps={printContext?.loadSteps} action="laden" fallbackMinutes={shopLoadMinutes} />
              </div>
              <div className="text-sm font-medium text-amber-700 dark:text-amber-400">
                {displayStartTime}
              </div>
            </div>
          )}

          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <div className="w-0.5 h-8 bg-border" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">Winkel Volendam</p>
              <p className="text-xs text-muted-foreground">{LOCATIONS.winkel}</p>
              {!isPickup && (
                <p className="text-xs text-muted-foreground">
                  {TIME_CONSTANTS.STARTUP_TIME_WINKEL} min opstarten
                </p>
              )}
            </div>
            <div className="text-sm font-medium">
              {schedule?.delivery.startAtWinkel || '-'}
            </div>
          </div>

          {hasTrailer && (
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <div className="w-0.5 h-8 bg-border" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Loods Purmerend</p>
                <p className="text-xs text-muted-foreground">{LOCATIONS.loods}</p>
                <p className="text-xs text-muted-foreground">
                  {TIME_CONSTANTS.TRAILER_COUPLING_TIME} min aanhanger koppelen
                </p>
              </div>
              <div className="text-sm">
                <div className="font-medium">{schedule?.delivery.arriveAtLoods || '-'}</div>
                <div className="text-xs text-muted-foreground">
                  → {schedule?.delivery.departFromLoods || '-'}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              {isPickup && <div className="w-0.5 h-8 bg-border" />}
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">
                {isPickup ? 'Aankomst bij klant' : 'Klant locatie'}
              </p>
              <p className="text-xs text-muted-foreground">{customerAddress}</p>
              {!isPickup && (
                <p className="text-xs text-muted-foreground">
                  {isCombined && combinedWallClockTime ? (
                    <span className="text-primary font-medium">
                      {combinedWallClockTime} min uitladen (samen, -{timeSaved} min)
                    </span>
                  ) : (
                    <>{individualLoadUnloadTime} min uitladen ({vehicleCount} voertuigen)</>
                  )}
                </p>
              )}
            </div>
            <div className="text-sm font-medium">
              {schedule?.delivery.arriveAtCustomer || '-'}
            </div>
          </div>

          {isPickup ? (
            <>
              {/* Bij ophalen: laden NA aankomst */}
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <div className="w-0.5 h-8 bg-border" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Inladen voertuigen</p>
                  <p className="text-xs text-muted-foreground">
                    {isCombined && combinedWallClockTime ? (
                      <span className="text-primary font-medium">
                        {combinedWallClockTime} min laden (samen, -{timeSaved} min)
                      </span>
                    ) : (
                      <>{individualLoadUnloadTime} min laden ({vehicleCount} voertuigen)</>
                    )}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {schedule?.delivery.arriveAtCustomer || '-'} → {schedule?.delivery.unloadComplete || '-'}
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-emerald-600" />
                  <div className="w-0.5 h-8 bg-border" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm text-emerald-600">Klaar voor vertrek</p>
                  <p className="text-xs text-muted-foreground">
                    Retour naar winkel/loods
                  </p>
                </div>
                <div className="text-sm font-medium text-emerald-600">
                  {schedule?.delivery.unloadComplete || '-'}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-emerald-600" />
                <div className="w-0.5 h-8 bg-border" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm text-emerald-600">Klaar voor klant</p>
                <p className="text-xs text-muted-foreground">
                  15 min voor starttijd ({customerStartTime})
                </p>
              </div>
              <div className="text-sm font-medium text-emerald-600">
                {schedule?.delivery.readyForCustomer || '-'}
              </div>
            </div>
          )}

          {/* Retourrit */}
          {schedule?.returnTrip && (
            <>
              <div className="border-t my-3 pt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Retourrit
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <div className="w-0.5 h-8 bg-border" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Vertrek van klant</p>
                  <p className="text-xs text-muted-foreground">{customerAddress}</p>
                </div>
                <div className="text-sm font-medium">
                  {schedule.returnTrip.departFromCustomer}
                </div>
              </div>

              {isPickup && hasTrailer && schedule.returnTrip.arriveAtWinkelForUnload ? (
                <>
                  {/* Ophalen+aanhanger: Klant -> Winkel (lossen winkel) -> Loods (lossen loods + afkoppelen) -> Winkel */}
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-primary" />
                      <div className="w-0.5 h-8 bg-border" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">Aankomst Winkel Volendam</p>
                      <p className="text-xs text-muted-foreground">{LOCATIONS.winkel}</p>
                    </div>
                    <div className="text-sm font-medium">
                      {schedule.returnTrip.arriveAtWinkelForUnload}
                    </div>
                  </div>

                  {/* Lossen winkel */}
                  {(shopUnloadWinkelMinutes ?? 0) > 0 && (
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full bg-amber-500" />
                        <div className="w-0.5 h-8 bg-border" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm text-amber-700 dark:text-amber-400">
                          Lossen winkel
                        </p>
                        <LoadUnloadDetails steps={printContext?.loadSteps} action="lossen" fallbackMinutes={shopUnloadWinkelMinutes ?? 0} location="Winkel" />
                      </div>
                      <div className="text-sm text-amber-700 dark:text-amber-400">
                        {schedule.returnTrip.arriveAtWinkelForUnload} → {adjustTime(schedule.returnTrip.arriveAtWinkelForUnload, shopUnloadWinkelMinutes ?? 0)}
                      </div>
                    </div>
                  )}

                  {/* Loods - lossen loods + aanhanger afkoppelen */}
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-orange-500" />
                      <div className="w-0.5 h-8 bg-border" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">Loods Purmerend</p>
                      <p className="text-xs text-muted-foreground">{LOCATIONS.loods}</p>
                      {(shopUnloadLoodsMinutes ?? 0) > 0 && (
                        <LoadUnloadDetails steps={printContext?.loadSteps} action="lossen" fallbackMinutes={shopUnloadLoodsMinutes ?? 0} location="Loods" />
                      )}
                      <p className="text-xs text-muted-foreground">
                        {TIME_CONSTANTS.TRAILER_COUPLING_TIME} min aanhanger afkoppelen
                      </p>
                    </div>
                    <div className="text-sm">
                      <div className="font-medium">{adjustTime(schedule.returnTrip.arriveAtLoods || '', shopUnloadWinkelMinutes ?? shopUnloadMinutes)}</div>
                      <div className="text-xs text-muted-foreground">
                        → {adjustTime(schedule.returnTrip.departFromLoods || '', (shopUnloadWinkelMinutes ?? shopUnloadMinutes) + (shopUnloadLoodsMinutes ?? 0))}
                      </div>
                    </div>
                  </div>

                  {/* Terug bij Winkel */}
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">Aankomst Winkel Volendam</p>
                      <p className="text-xs text-muted-foreground">{LOCATIONS.winkel}</p>
                    </div>
                    <div className="text-sm font-medium">
                      {adjustedEndTime || schedule.returnTrip.arriveAtWinkel}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Leveren/zonder aanhanger: standaard route */}
                  {schedule.returnTrip.arriveAtLoods && (
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full bg-orange-500" />
                        <div className="w-0.5 h-8 bg-border" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">Loods Purmerend</p>
                        <p className="text-xs text-muted-foreground">{LOCATIONS.loods}</p>
                        <p className="text-xs text-muted-foreground">
                          {TIME_CONSTANTS.TRAILER_COUPLING_TIME} min aanhanger afkoppelen
                        </p>
                      </div>
                      <div className="text-sm">
                        <div className="font-medium">{schedule.returnTrip.arriveAtLoods}</div>
                        <div className="text-xs text-muted-foreground">
                          → {schedule.returnTrip.departFromLoods || '-'}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-primary" />
                      {shopUnloadMinutes > 0 && <div className="w-0.5 h-8 bg-border" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">Aankomst Winkel Volendam</p>
                      <p className="text-xs text-muted-foreground">{LOCATIONS.winkel}</p>
                    </div>
                    <div className="text-sm font-medium">
                      {schedule.returnTrip.arriveAtWinkel}
                    </div>
                  </div>

                  {/* Shop unloading step - only when plan is confirmed */}
                  {shopUnloadMinutes > 0 && (
                    <div className="flex items-start gap-3">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <div className="flex-1">
                        <p className="font-medium text-sm text-amber-700 dark:text-amber-400">
                          Lossen winkel
                        </p>
                        <LoadUnloadDetails steps={printContext?.loadSteps} action="lossen" fallbackMinutes={shopUnloadMinutes} location="Winkel" />
                      </div>
                      <div className="text-sm font-medium text-amber-700 dark:text-amber-400">
                        {schedule.returnTrip.arriveAtWinkel} → {adjustedEndTime || '-'}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Rijtijden samenvatting */}
        {schedule && (
          <div className="border-t pt-3 mt-3">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Navigation className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Heenrit</p>
                  <p className="font-medium">{schedule.totals.totalDriveMinutes} min</p>
                </div>
              </div>
              {schedule.returnTrip && (
                <div className="flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-muted-foreground rotate-180" />
                  <div>
                    <p className="text-muted-foreground">Retourrit</p>
                    <p className="font-medium">{schedule.returnTrip.totalReturnMinutes} min</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Transport</p>
                  <p className="font-medium">
                    {hasTrailer ? 'Met aanhanger' : 'Alleen bakwagen'}
                  </p>
                </div>
              </div>
            </div>

            {/* Laad/los tijden uit plan */}
            {(shopLoadMinutes > 0 || shopUnloadMinutes > 0) && (
              <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-4 text-sm">
                {shopLoadMinutes > 0 && (
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-amber-600" />
                    <div>
                      <p className="text-muted-foreground">Laden (winkel/loods)</p>
                      <p className="font-medium">{shopLoadMinutes} min</p>
                    </div>
                  </div>
                )}
                {shopUnloadMinutes > 0 && (
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-amber-600" />
                    <div>
                      <p className="text-muted-foreground">Lossen (winkel/loods)</p>
                      <p className="font-medium">{shopUnloadMinutes} min</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {(adjustedEndTime || schedule.totals.driverEndTime) && (
              <div className="mt-3 pt-3 border-t flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Chauffeur klaar</span>
                <span className="text-lg font-bold text-primary">
                  {adjustedEndTime || schedule.totals.driverEndTime}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
