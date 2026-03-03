import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Clock, 
  Store, 
  MapPin,
  ArrowRight,
  Coffee,
  AlertCircle,
  Check,
  X
} from 'lucide-react';
import { 
  analyzeWaitTime, 
  analyzeWaitTimeSync,
  WaitTimeAnalysis,
  MIN_SHOP_TIME_MINUTES 
} from '@/utils/waitTimeCalculator';
import { LOCATIONS } from '@/utils/driverScheduleCalculator';
import { Skeleton } from '@/components/ui/skeleton';

interface WaitTimeCardProps {
  deliveryCompleteTime: string; // HH:MM
  pickupStartTime: string; // HH:MM
  customerAddress: string;
  date: Date;
  driverReturnsToShop?: boolean | null; // Override value
  onOverrideChange?: (value: boolean | null) => void;
}

export function WaitTimeCard({
  deliveryCompleteTime,
  pickupStartTime,
  customerAddress,
  date,
  driverReturnsToShop,
  onOverrideChange,
}: WaitTimeCardProps) {
  const [analysis, setAnalysis] = useState<WaitTimeAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Quick sync calculation for immediate feedback
  const quickCalc = analyzeWaitTimeSync({
    deliveryCompleteTime,
    pickupStartTime,
    forceReturn: driverReturnsToShop,
  });

  useEffect(() => {
    let cancelled = false;
    
    async function loadAnalysis() {
      setLoading(true);
      try {
        const result = await analyzeWaitTime({
          deliveryCompleteTime,
          pickupStartTime,
          customerAddress,
          date,
          forceReturn: driverReturnsToShop,
        });
        if (!cancelled) {
          setAnalysis(result);
        }
      } catch (err) {
        console.error('Failed to load wait time analysis:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    
    loadAnalysis();
    
    return () => {
      cancelled = true;
    };
  }, [deliveryCompleteTime, pickupStartTime, customerAddress, date, driverReturnsToShop]);

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours} uur`;
    return `${hours}u ${mins}m`;
  };

  const shouldReturn = analysis?.shouldReturnToShop ?? quickCalc.shouldReturnToShop;
  const isManualOverride = driverReturnsToShop !== null && driverReturnsToShop !== undefined;

  return (
    <Card className="border-dashed border-2 border-muted">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Coffee className="h-5 w-5" />
            Wachttijd analyse
          </CardTitle>
          <div className="flex items-center gap-2">
            {isManualOverride && (
              <Badge variant="secondary" className="text-xs">
                Handmatig
              </Badge>
            )}
            {(analysis?.isEstimate || !analysis) && (
              <Badge variant="outline" className="text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />
                Geschat
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tijd overview */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Levering klaar</p>
            <p className="text-lg font-bold">{deliveryCompleteTime}</p>
          </div>
          <div className="flex items-center justify-center">
            <div className="text-center">
              <Clock className="h-5 w-5 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium">
                {loading ? (
                  <Skeleton className="h-4 w-12 mx-auto" />
                ) : (
                  formatDuration(analysis?.totalWaitMinutes ?? quickCalc.totalWaitMinutes)
                )}
              </p>
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Ophalen</p>
            <p className="text-lg font-bold">{pickupStartTime}</p>
          </div>
        </div>

        {/* Beslissing */}
        <div className={`rounded-lg p-4 ${shouldReturn ? 'bg-emerald-50 border border-emerald-200' : 'bg-orange-50 border border-orange-200'}`}>
          <div className="flex items-start gap-3">
            {shouldReturn ? (
              <Store className="h-5 w-5 text-emerald-600 mt-0.5" />
            ) : (
              <MapPin className="h-5 w-5 text-orange-600 mt-0.5" />
            )}
            <div className="flex-1">
              <p className={`font-medium ${shouldReturn ? 'text-emerald-700' : 'text-orange-700'}`}>
                {shouldReturn ? 'Chauffeur keert terug naar winkel' : 'Chauffeur wacht bij klant'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {analysis?.returnReason || (shouldReturn 
                  ? `≥${MIN_SHOP_TIME_MINUTES / 60} uur nuttige winkeltijd` 
                  : `<${MIN_SHOP_TIME_MINUTES / 60} uur nuttige winkeltijd`
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Retour route details */}
        {shouldReturn && analysis?.returnRoute && (
          <div className="space-y-2 pt-2">
            <p className="text-sm font-medium text-muted-foreground">Retour route</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-muted-foreground">Klant</span>
                <span className="font-medium">{analysis.returnRoute.departFromCustomer}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-2 text-sm ml-4">
                <span className="text-xs text-muted-foreground">
                  ({analysis.driveToShopMinutes} min rijden)
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">Winkel</span>
                <span className="font-medium">{analysis.returnRoute.arriveAtShop}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-medium">{analysis.returnRoute.departFromShop}</span>
              </div>
              <div className="flex items-center gap-2 text-sm ml-4">
                <span className="text-xs text-muted-foreground">
                  ({formatDuration(analysis.usableShopTimeMinutes)} in winkel)
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-orange-500" />
                <span className="text-muted-foreground">Terug bij klant</span>
                <span className="font-medium">{analysis.returnRoute.arriveBackAtCustomer}</span>
              </div>
            </div>
          </div>
        )}

        {/* Rijtijd stats */}
        {analysis && (
          <div className="space-y-3 pt-2 border-t text-sm">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-muted-foreground text-xs">Klant → Winkel</p>
                <p className="font-medium">{formatDuration(analysis.driveToShopMinutes)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Winkel → Klant</p>
                <p className="font-medium">{formatDuration(analysis.driveBackMinutes)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Totaal retour</p>
                <p className="font-medium">{formatDuration(analysis.totalRoundTripMinutes)}</p>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-2">
              <p className="text-muted-foreground text-xs">Netto winkeltijd</p>
              <p className={`font-medium ${analysis.usableShopTimeMinutes >= MIN_SHOP_TIME_MINUTES ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                {formatDuration(Math.max(0, analysis.usableShopTimeMinutes))}
              </p>
            </div>
          </div>
        )}

        {/* Override controls */}
        {onOverrideChange && (
          <div className="pt-3 border-t">
            <p className="text-xs text-muted-foreground mb-2">Handmatig aanpassen:</p>
            <div className="flex gap-2">
              <Button
                variant={driverReturnsToShop === null || driverReturnsToShop === undefined ? 'default' : 'outline'}
                size="sm"
                onClick={() => onOverrideChange(null)}
                className="flex-1"
              >
                Auto
              </Button>
              <Button
                variant={driverReturnsToShop === true ? 'default' : 'outline'}
                size="sm"
                onClick={() => onOverrideChange(true)}
                className="flex-1"
              >
                <Check className="h-3 w-3 mr-1" />
                Terugkeren
              </Button>
              <Button
                variant={driverReturnsToShop === false ? 'default' : 'outline'}
                size="sm"
                onClick={() => onOverrideChange(false)}
                className="flex-1"
              >
                <X className="h-3 w-3 mr-1" />
                Wachten
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
