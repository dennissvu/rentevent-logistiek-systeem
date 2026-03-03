import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, TrendingDown } from 'lucide-react';
import { 
  calculateCombinedUnloadTime, 
  estimateLoadUnloadTime,
  needsTrailer as checkNeedsTrailer 
} from '@/utils/driverScheduleCalculator';

interface Assignment {
  id: string;
  transportId: string;
  driverId?: string | null;
  driverName?: string;
  transportName?: string;
}

interface CombinedUnloadingCardProps {
  assignments: Assignment[];
  vehicleCount: number;
  segment: 'leveren' | 'ophalen';
  isCombined: boolean;
  onCombinedChange: (combined: boolean) => void;
}

export function CombinedUnloadingCard({
  assignments,
  vehicleCount,
  segment,
  isCombined,
  onCombinedChange,
}: CombinedUnloadingCardProps) {
  const [combinedResult, setCombinedResult] = useState<{
    driver1Time: number;
    driver2Time: number;
    combinedWallClockTime: number;
    timeSaved: number;
  } | null>(null);

  // Alleen tonen bij 2 chauffeurs
  const hasMultipleDrivers = assignments.length >= 2;
  
  useEffect(() => {
    if (!hasMultipleDrivers) return;
    
    // Bereken gecombineerde tijd voor eerste 2 assignments
    const [a1, a2] = assignments;
    const driver1HasTrailer = checkNeedsTrailer(a1.transportId);
    const driver2HasTrailer = checkNeedsTrailer(a2.transportId);
    
    // Verdeel voertuigen over chauffeurs (evenredig)
    const driver1VehicleCount = Math.ceil(vehicleCount / 2);
    const driver2VehicleCount = Math.floor(vehicleCount / 2);
    
    const result = calculateCombinedUnloadTime({
      segment,
      driver1VehicleCount,
      driver1HasTrailer,
      driver2VehicleCount,
      driver2HasTrailer,
    });
    
    setCombinedResult(result);
  }, [assignments, vehicleCount, segment, hasMultipleDrivers]);

  if (!hasMultipleDrivers || !combinedResult) {
    return null;
  }

  const segmentLabel = segment === 'leveren' ? 'uitladen' : 'inladen';
  const totalSeparate = combinedResult.driver1Time + combinedResult.driver2Time;
  
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Gecombineerd {segmentLabel}
          </CardTitle>
          <Badge variant="outline" className="bg-background">
            {assignments.length} chauffeurs
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Checkbox */}
        <div className="flex items-start gap-3">
          <Checkbox
            id="combined-unloading"
            checked={isCombined}
            onCheckedChange={(checked) => onCombinedChange(checked === true)}
          />
          <div className="flex-1">
            <Label 
              htmlFor="combined-unloading" 
              className="text-sm font-medium cursor-pointer"
            >
              Chauffeurs werken samen
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Kortste klus eerst klaar, daarna helpt die chauffeur de andere
            </p>
          </div>
        </div>

        {/* Tijdvergelijking */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-3 rounded-lg bg-background">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span>Apart {segmentLabel}</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Chauffeur 1:</span>
                <span className="font-medium">{combinedResult.driver1Time} min</span>
              </div>
              <div className="flex justify-between">
                <span>Chauffeur 2:</span>
                <span className="font-medium">{combinedResult.driver2Time} min</span>
              </div>
              <div className="flex justify-between pt-1 border-t text-muted-foreground">
                <span>Totaal:</span>
                <span>{totalSeparate} min</span>
              </div>
            </div>
          </div>

          <div className={`p-3 rounded-lg transition-colors ${
            isCombined ? 'bg-accent border border-primary/30' : 'bg-background'
          }`}>
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span>Samen {segmentLabel}</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Wall clock:</span>
                <span className="font-bold text-primary">
                  {combinedResult.combinedWallClockTime} min
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t">
                <span className="flex items-center gap-1 text-primary">
                  <TrendingDown className="h-3 w-3" />
                  Bespaard:
                </span>
                <span className="font-medium text-primary">
                  {combinedResult.timeSaved} min
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Uitleg wanneer actief */}
        {isCombined && (
          <div className="text-xs text-muted-foreground bg-background p-2 rounded">
            <strong>Berekening:</strong> {assignments[0]?.driverName || 'Chauffeur 1'} 
            {combinedResult.driver1Time <= combinedResult.driver2Time 
              ? ` is na ${combinedResult.driver1Time} min klaar en helpt daarna ${assignments[1]?.driverName || 'Chauffeur 2'}`
              : ` wordt na ${Math.round(combinedResult.driver1Time - combinedResult.timeSaved)} min geholpen door ${assignments[1]?.driverName || 'Chauffeur 2'}`
            }
          </div>
        )}
      </CardContent>
    </Card>
  );
}
