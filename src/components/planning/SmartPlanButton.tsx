import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Wand2,
  Loader2,
  Check,
  AlertTriangle,
  Clock,
  Truck,
  ArrowDown,
  ArrowUp,
  MapPin,
  Timer,
  Route,
  CheckCircle2,
  XCircle,
  Package,
} from 'lucide-react';
import { useTransport } from '@/context/TransportContext';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  calculateSmartDayPlan,
  applySmartPlan,
  SmartPlanResult,
  SmartPlanDriverRoute,
  TransportUtilization,
} from '@/utils/smartDayPlanner';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { vehicleTypes } from '@/data/transportData';

interface SmartPlanButtonProps {
  date: string;
}

export function SmartPlanButton({ date }: SmartPlanButtonProps) {
  const { allTransportMaterials, combis } = useTransport();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCalculating, setIsCalculating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [plan, setPlan] = useState<SmartPlanResult | null>(null);

  const handleCalculate = async () => {
    setIsCalculating(true);
    setProgressText('Bezig met berekenen...');
    try {
      const allTransport = [...allTransportMaterials, ...combis];
      const result = await calculateSmartDayPlan(date, allTransport, (step) => {
        setProgressText(step);
      });

      if (result.totalOrders === 0) {
        toast({ title: 'Geen orders gevonden op deze dag' });
        return;
      }

      setPlan(result);
      setIsDialogOpen(true);
    } catch (err) {
      console.error('Smart plan error:', err);
      toast({ title: 'Fout bij berekenen dagplan', variant: 'destructive' });
    } finally {
      setIsCalculating(false);
      setProgressText('');
    }
  };

  const handleApply = async () => {
    if (!plan) return;
    setIsApplying(true);
    try {
      await applySmartPlan(plan);

      queryClient.invalidateQueries({ queryKey: ['daily-planning'] });
      queryClient.invalidateQueries({ queryKey: ['driver-day-overview'] });
      queryClient.invalidateQueries({ queryKey: ['daily-transport'] });
      queryClient.invalidateQueries({ queryKey: ['order-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['all-order-assignments'] });

      const count = plan.driverRoutes.reduce((sum, dr) => sum + dr.orders.length, 0);
      toast({ title: `Dagplan toegepast: ${count} toewijzingen voor ${plan.driverRoutes.length} chauffeur(s)` });
      setIsDialogOpen(false);
    } catch (err) {
      console.error('Apply smart plan error:', err);
      toast({ title: 'Fout bij toepassen dagplan', variant: 'destructive' });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleCalculate}
        disabled={isCalculating}
        className="gap-2"
        size="default"
      >
        {isCalculating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {progressText || 'Berekenen...'}
          </>
        ) : (
          <>
            <Wand2 className="h-4 w-4" />
            Slim Plannen
          </>
        )}
      </Button>

      {plan && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5" />
                Dagplan — {plan.totalOrders} orders, {plan.totalDrivers} chauffeurs
              </DialogTitle>
              <DialogDescription className="flex items-center gap-3">
                {plan.allFeasible ? (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Alles haalbaar
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    Niet alles haalbaar
                  </Badge>
                )}
                {plan.transportSuggestions.length > 0 && (
                  <span className="text-xs">
                    {plan.transportSuggestions.length} nieuw transport-toewijzing(en)
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-4 py-2">
                {/* Warnings */}
                {plan.unplannedWarnings.length > 0 && (
                  <div className="border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      Aandachtspunten
                    </div>
                    <ul className="text-xs space-y-0.5 text-amber-700 dark:text-amber-400">
                      {plan.unplannedWarnings.map((w, i) => (
                        <li key={i}>• {w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Transport suggestions */}
                {plan.transportSuggestions.length > 0 && (
                  <div className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      Nieuwe transport-toewijzingen
                    </div>
                    <div className="space-y-1">
                      {plan.transportSuggestions.map((ts, idx) => (
                        <div key={`${ts.orderId}-${ts.sequenceNumber}-${idx}`} className="flex items-center gap-2 text-xs py-1">
                          <Badge variant="outline" className="text-[10px]">{ts.orderNumber}</Badge>
                          {ts.tripCount > 1 && (
                            <Badge variant="secondary" className="text-[10px]">
                              Rit {ts.sequenceNumber}/{ts.tripCount}
                            </Badge>
                          )}
                          <span>→</span>
                          <span className="font-medium">{ts.suggestedTransportName}</span>
                          <span className="text-muted-foreground">({ts.utilizationPercent}% benut)</span>
                          {ts.isCombi && (
                            <Badge variant="secondary" className="text-[10px]">Combi</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transport capacity utilization */}
                {plan.transportUtilization.length > 0 && (
                  <div className="border rounded-lg p-3 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      Capaciteitsbenutting transport
                    </div>
                    <div className="space-y-3">
                      {plan.transportUtilization.map(tu => (
                        <TransportCapacityRow key={tu.transportId} utilization={tu} />
                      ))}
                    </div>
                  </div>
                )}

                <Separator />
                <Accordion type="multiple" defaultValue={plan.driverRoutes.map((_, i) => `driver-${i}`)}>
                  {plan.driverRoutes.map((dr, i) => (
                    <DriverRouteCard key={dr.driverId} driver={dr} index={i} />
                  ))}
                </Accordion>
              </div>
            </ScrollArea>

            <DialogFooter className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {plan.driverRoutes.reduce((sum, dr) => sum + dr.orders.length, 0)} toewijzingen
                {plan.transportSuggestions.length > 0 && ` + ${plan.transportSuggestions.length} transport`}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annuleren
                </Button>
                <Button
                  onClick={handleApply}
                  disabled={isApplying}
                  className="gap-2"
                >
                  {isApplying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Dagplan toepassen
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function DriverRouteCard({ driver, index }: { driver: SmartPlanDriverRoute; index: number }) {
  const hasFeasibilityIssue = driver.route && !driver.route.feasible;
  const hasWarnings = driver.warnings.length > 0;

  return (
    <AccordionItem value={`driver-${index}`} className="border rounded-lg px-3">
      <AccordionTrigger className="py-3 hover:no-underline">
        <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{driver.driverName}</span>
            {driver.canDriveTrailer && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">AH</Badge>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto mr-4">
            {driver.route && (
              <>
                <Badge variant="secondary" className="text-[10px] gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  {driver.route.workStartTime} – {driver.route.workEndTime}
                </Badge>
                <Badge variant="secondary" className="text-[10px] gap-1">
                  <Timer className="h-2.5 w-2.5" />
                  {Math.floor(driver.route.totalWorkMinutes / 60)}u{String(driver.route.totalWorkMinutes % 60).padStart(2, '0')}
                </Badge>
                <Badge variant="secondary" className="text-[10px] gap-1">
                  <Route className="h-2.5 w-2.5" />
                  {driver.route.totalDriveMinutes} min rijden
                </Badge>
              </>
            )}
            {hasFeasibilityIssue ? (
              <Badge variant="destructive" className="text-[10px] gap-1">
                <XCircle className="h-2.5 w-2.5" />
                Niet haalbaar
              </Badge>
            ) : hasWarnings ? (
              <Badge className="bg-amber-100 text-amber-700 text-[10px] gap-1">
                <AlertTriangle className="h-2.5 w-2.5" />
                Let op
              </Badge>
            ) : (
              <Badge className="bg-green-100 text-green-700 text-[10px] gap-1">
                <CheckCircle2 className="h-2.5 w-2.5" />
                OK
              </Badge>
            )}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-3 pb-2">
          {/* Orders */}
          <div className="space-y-1">
            {driver.orders.map((order, j) => (
              <div key={j} className="flex items-center gap-2 text-xs py-0.5">
                {order.segment === 'leveren' ? (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 text-[10px] gap-0.5 px-1.5">
                    <ArrowDown className="h-2.5 w-2.5" />
                    Lev
                  </Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 text-[10px] gap-0.5 px-1.5">
                    <ArrowUp className="h-2.5 w-2.5" />
                    Oph
                  </Badge>
                )}
                <span className="font-medium">{order.time}</span>
                <span>{order.orderNumber}</span>
                <span className="text-muted-foreground">{order.customerName}</span>
                <span className="text-muted-foreground ml-auto">{order.transportName}</span>
              </div>
            ))}
          </div>

          {/* Route timeline */}
          {driver.route && driver.route.stops.length > 0 && (
            <>
              <Separator />
              <div className="space-y-0.5">
                <div className="text-xs font-medium text-muted-foreground mb-1">Route-tijdlijn</div>
                {driver.route.stops.map((stop, j) => (
                  <div
                    key={j}
                    className={`flex items-start gap-2 text-xs py-0.5 ${
                      stop.isLate ? 'text-red-600 dark:text-red-400 font-medium' : ''
                    }`}
                  >
                    <span className="font-mono w-10 shrink-0 text-right">
                      {stop.estimatedArrival}
                    </span>
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      {stop.driveTimeFromPrevious > 0 && (
                        <span className="text-muted-foreground shrink-0">
                          ({stop.driveTimeFromPrevious}min)
                        </span>
                      )}
                      <span className="truncate">{stop.label}</span>
                      {stop.durationMinutes > 0 && (
                        <span className="text-muted-foreground shrink-0">
                          [{stop.durationMinutes}min]
                        </span>
                      )}
                    </div>
                    {stop.isLate && (
                      <Badge variant="destructive" className="text-[9px] px-1 py-0 shrink-0">
                        +{stop.minutesLate}min te laat
                      </Badge>
                    )}
                    {stop.isEstimate && (
                      <span className="text-amber-500 text-[9px] shrink-0">~</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Warnings */}
          {driver.warnings.length > 0 && (
            <div className="space-y-0.5">
              {driver.warnings.map((w, j) => (
                <div key={j} className="flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {w}
                </div>
              ))}
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function TransportCapacityRow({ utilization }: { utilization: TransportUtilization }) {
  const percent = Math.min(utilization.utilizationPercent, 100);
  const isOver = utilization.utilizationPercent > 100;
  const loadWithValues = utilization.totalLoad.filter(l => l.quantity > 0);
  const remainingWithValues = Object.entries(utilization.remainingSpace)
    .filter(([_, count]) => count > 0)
    .map(([type, count]) => {
      const info = vehicleTypes.find(v => v.id === type);
      return { type, count, icon: info?.icon || '', name: info?.name || type };
    });

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{utilization.transportName}</span>
          {utilization.isCombi && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Combi</Badge>
          )}
        </div>
        <span className={`text-xs font-semibold ${
          isOver ? 'text-destructive' : percent >= 80 ? 'text-amber-600' : 'text-muted-foreground'
        }`}>
          {utilization.utilizationPercent}%
        </span>
      </div>
      <Progress
        value={percent}
        className={`h-2 ${isOver ? '[&>div]:bg-destructive' : percent >= 80 ? '[&>div]:bg-amber-500' : ''}`}
      />
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {loadWithValues.map(l => {
          const info = vehicleTypes.find(v => v.id === l.type);
          return (
            <span key={l.type} className="text-[10px] text-muted-foreground">
              {info?.icon} {l.quantity}× {info?.name}
            </span>
          );
        })}
      </div>
      {remainingWithValues.length > 0 && !isOver && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          <span className="text-[10px] text-muted-foreground font-medium">Nog ruimte:</span>
          {remainingWithValues.map(r => (
            <span key={r.type} className="text-[10px] text-muted-foreground">
              {r.icon} {r.count} {r.name}
            </span>
          ))}
        </div>
      )}
      {isOver && (
        <div className="flex items-center gap-1 text-[10px] text-destructive font-medium">
          <XCircle className="h-3 w-3" />
          Past niet — capaciteit overschreden
        </div>
      )}
      <div className="text-[10px] text-muted-foreground">
        Orders: {utilization.orderNumbers.join(', ')}
      </div>
    </div>
  );
}
