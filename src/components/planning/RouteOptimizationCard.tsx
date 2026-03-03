import { useState } from 'react';
import {
  Route,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Truck,
  Timer,
  Navigation,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useRouteOptimization, type OptimizedRoute } from '@/hooks/useRouteOptimization';
import type { DriverTrip } from '@/hooks/useDriverAssignments';

interface RouteOptimizationCardProps {
  driverId: string;
  date: string;
  trips: DriverTrip[];
}

export function RouteOptimizationCard({ driverId, date, trips }: RouteOptimizationCardProps) {
  const { optimize, clear, isOptimizing, result, error } = useRouteOptimization();
  const [expanded, setExpanded] = useState(false);

  if (trips.length < 2) return null; // Only show for multi-order days

  const handleOptimize = () => {
    optimize(driverId, date, trips);
    setExpanded(true);
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Route-optimalisatie</h3>
          </div>
          {!result && !isOptimizing && (
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs gap-1.5"
              onClick={handleOptimize}
            >
              <Navigation className="h-3 w-3" />
              Bereken route
            </Button>
          )}
          {result && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
                onClick={handleOptimize}
              >
                <Navigation className="h-3 w-3" />
                Herbereken
              </Button>
            </div>
          )}
        </div>

        {/* Loading */}
        {isOptimizing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Rijtijden berekenen via Google Maps...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Result summary */}
        {result && (
          <>
            <RouteSummary route={result} />
            {expanded && <RouteTimeline route={result} />}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RouteSummary({ route }: { route: OptimizedRoute }) {
  return (
    <div className="space-y-2">
      {/* Status + times */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge
          variant={route.feasible ? 'default' : 'destructive'}
          className="text-xs gap-1"
        >
          {route.feasible ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <AlertTriangle className="h-3 w-3" />
          )}
          {route.feasible ? 'Haalbaar' : 'Niet haalbaar'}
        </Badge>

        <div className="flex items-center gap-1.5 text-sm">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-semibold">{route.workStartTime}</span>
          <span className="text-muted-foreground">→</span>
          <span className="font-semibold">{route.workEndTime}</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Truck className="h-3 w-3" />
          <span>{route.totalDriveMinutes} min rijden</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Timer className="h-3 w-3" />
          <span>{Math.floor(route.totalWorkMinutes / 60)}u{route.totalWorkMinutes % 60 > 0 ? ` ${route.totalWorkMinutes % 60}m` : ''} totaal</span>
        </div>
      </div>

      {/* Suggested sequence */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-muted-foreground">Volgorde:</span>
        {route.orderSequence.map((item, idx) => (
          <div key={`${item.orderId}-${item.segment}`} className="flex items-center gap-1">
            {idx > 0 && <span className="text-muted-foreground text-xs">→</span>}
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0",
                item.segment === 'leveren'
                  ? 'border-green-300 text-green-700 dark:text-green-400'
                  : 'border-red-300 text-red-700 dark:text-red-400',
              )}
            >
              {item.segment === 'leveren' ? '▼' : '▲'} {item.orderNumber}
            </Badge>
          </div>
        ))}
      </div>

      {/* Warnings */}
      {route.warnings.length > 0 && (
        <div className="space-y-1">
          {route.warnings.map((warning, idx) => (
            <div key={idx} className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RouteTimeline({ route }: { route: OptimizedRoute }) {
  return (
    <div className="mt-3 pt-3 border-t space-y-0">
      {route.stops.map((stop, idx) => {
        const dotColor =
          stop.type === 'vertrek_winkel' || stop.type === 'aankomst_winkel' ? 'bg-blue-500'
          : stop.type === 'leveren' ? 'bg-green-500'
          : stop.type === 'ophalen' ? 'bg-red-500'
          : stop.type === 'aankoppelen_loods' || stop.type === 'afkoppelen_loods' ? 'bg-purple-500'
          : stop.type === 'laden_winkel' || stop.type === 'lossen_winkel' ? 'bg-amber-500'
          : stop.type === 'wachttijd' ? 'bg-gray-400'
          : 'bg-gray-500';

        const isLast = idx === route.stops.length - 1;

        return (
          <div key={idx}>
            {/* Drive time tag */}
            {stop.driveTimeFromPrevious > 0 && (
              <div className="pl-6 py-0.5">
                <span className={cn(
                  "inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full",
                  stop.isEstimate ? 'bg-muted text-muted-foreground italic' : 'bg-muted text-muted-foreground',
                )}>
                  🚗 {stop.driveTimeFromPrevious} min
                  {stop.driveDistanceKm > 0 && ` · ${Math.round(stop.driveDistanceKm)} km`}
                </span>
              </div>
            )}

            {/* Stop */}
            <div className="relative flex items-start gap-3 py-1.5 pl-2">
              {/* Dot + line */}
              <div className="relative flex flex-col items-center">
                <div className={cn("w-2.5 h-2.5 rounded-full mt-1 shrink-0", dotColor)} />
                {!isLast && (
                  <div className="w-0.5 bg-border flex-1 min-h-[12px]" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 -mt-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{stop.label}</span>
                  {stop.orderNumber && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      {stop.orderNumber}
                    </Badge>
                  )}
                  {stop.isLate && (
                    <Badge variant="destructive" className="text-[9px] px-1 py-0 gap-0.5">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      {stop.minutesLate} min te laat
                    </Badge>
                  )}
                  {stop.minutesEarly > 10 && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-green-300 text-green-700 dark:text-green-400">
                      {stop.minutesEarly} min marge
                    </Badge>
                  )}
                </div>
                {stop.type === 'wachttijd' ? (
                  <span className="text-[10px] text-muted-foreground">
                    {stop.durationMinutes} min wachten
                  </span>
                ) : (
                  <>
                    {stop.durationMinutes > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {stop.durationMinutes} min
                        {stop.customerDeadline && ` · Klant ${stop.customerDeadline}`}
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Time */}
              <div className="text-right shrink-0">
                <span className="text-xs font-bold">{stop.estimatedArrival}</span>
                {stop.estimatedDeparture !== stop.estimatedArrival && (
                  <span className="text-[10px] text-muted-foreground block">
                    → {stop.estimatedDeparture}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
