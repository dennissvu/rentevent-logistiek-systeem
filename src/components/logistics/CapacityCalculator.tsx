import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calculator, Check, X, Truck, Caravan, Link2 } from 'lucide-react';
import { vehicleTypes, VehicleType } from '@/data/transportData';
import { useTransport } from '@/context/TransportContext';
import { calculateMixedCapacity, VehicleLoad, formatVehicleType } from '@/utils/capacityCalculator';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function CapacityCalculator() {
  const { bakwagens, aanhangers, combis } = useTransport();
  const [selectedTransport, setSelectedTransport] = useState<string>('');
  const [load, setLoad] = useState<{ [key in VehicleType]: number }>({
    'e-choppers': 0,
    'e-fatbikes': 0,
    'fietsen': 0,
    'e-bikes': 0,
    'tweepers': 0,
  });

  // Vind geselecteerde transport
  const allTransports = [...bakwagens, ...aanhangers, ...combis];
  const transport = allTransports.find(t => t.id === selectedTransport) || allTransports[0];

  // Maak load array voor berekening
  const loadArray: VehicleLoad[] = Object.entries(load)
    .filter(([_, qty]) => qty > 0)
    .map(([type, quantity]) => ({ type: type as VehicleType, quantity }));

  const result = calculateMixedCapacity(transport, loadArray);

  const handleLoadChange = (type: VehicleType, value: string) => {
    const qty = parseInt(value) || 0;
    setLoad(prev => ({ ...prev, [type]: Math.max(0, qty) }));
  };

  const getTransportIcon = (id: string) => {
    if (id.startsWith('combi')) return <Link2 className="h-4 w-4" />;
    if (id.startsWith('bakwagen')) return <Truck className="h-4 w-4" />;
    return <Caravan className="h-4 w-4" />;
  };

  const getTransportType = (id: string) => {
    if (id.startsWith('combi')) return 'Combi';
    if (id.startsWith('bakwagen')) return 'Bakwagen';
    return 'Aanhanger';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="h-5 w-5" />
          Capaciteitsberekening
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Transport selectie */}
        <div className="space-y-2">
          <Label>Transportmiddel</Label>
          <Select value={selectedTransport} onValueChange={setSelectedTransport}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Bakwagens</div>
              {bakwagens.map(t => (
                <SelectItem key={t.id} value={t.id}>
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    {t.name}
                  </div>
                </SelectItem>
              ))}
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Aanhangers</div>
              {aanhangers.map(t => (
                <SelectItem key={t.id} value={t.id}>
                  <div className="flex items-center gap-2">
                    <Caravan className="h-4 w-4" />
                    {t.name}
                  </div>
                </SelectItem>
              ))}
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Combi's</div>
              {combis.map(t => (
                <SelectItem key={t.id} value={t.id}>
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    {t.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Geselecteerd transport info */}
        <div className="p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            {getTransportIcon(transport.id)}
            <span className="font-medium">{transport.name}</span>
            <Badge variant="outline" className="text-xs">{getTransportType(transport.id)}</Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            Max capaciteit: {transport.capacity['e-choppers']} choppers, {transport.capacity['e-fatbikes']} fatbikes, {transport.capacity['fietsen']} fietsen, {transport.capacity['e-bikes']} e-bikes, {transport.capacity['tweepers']} tweepers
          </div>
        </div>

        {/* Lading invoer */}
        <div className="space-y-3">
          <Label>Lading samenstellen</Label>
          <div className="grid grid-cols-2 gap-3">
            {vehicleTypes.map(vt => (
              <div key={vt.id} className="flex items-center gap-2">
                <span className="text-lg">{vt.icon}</span>
                <Input
                  type="number"
                  min="0"
                  value={load[vt.id] || ''}
                  onChange={(e) => handleLoadChange(vt.id, e.target.value)}
                  placeholder="0"
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">{vt.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Resultaat */}
        <div className="space-y-3 pt-3 border-t">
          <div className="flex items-center justify-between">
            <span className="font-medium">Resultaat</span>
            {result.fits ? (
              <Badge className="bg-emerald-500 hover:bg-emerald-600">
                <Check className="h-3 w-3 mr-1" />
                Past
              </Badge>
            ) : (
              <Badge variant="destructive">
                <X className="h-3 w-3 mr-1" />
                Past niet
              </Badge>
            )}
          </div>

          {/* Capaciteit meter */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span>Bezetting</span>
              <span className={cn(
                "font-medium",
                result.usedCapacity > 100 ? "text-destructive" : 
                result.usedCapacity > 80 ? "text-amber-600" : "text-emerald-600"
              )}>
                {result.usedCapacity}%
              </span>
            </div>
            <Progress 
              value={Math.min(result.usedCapacity, 100)} 
              className={cn(
                "h-3",
                result.usedCapacity > 100 && "[&>div]:bg-destructive"
              )}
            />
          </div>

          {/* Breakdown per type */}
          {result.breakdown.length > 0 && (
            <div className="space-y-1 text-sm">
              {result.breakdown.map((item, i) => (
                <div key={i} className="flex justify-between text-muted-foreground">
                  <span>{item.quantity}x {formatVehicleType(item.type)}</span>
                  <span>{item.spaceUsed.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}

          {/* Resterende ruimte */}
          {result.fits && result.usedCapacity < 100 && (
            <div className="mt-3 p-3 bg-emerald-50 rounded-lg">
              <div className="text-sm font-medium text-emerald-800 mb-1">
                Resterende ruimte ({100 - result.usedCapacity}%)
              </div>
              <div className="text-xs text-emerald-700 space-y-0.5">
                <div>+ {result.remainingSpace['e-choppers']} e-choppers</div>
                <div>+ {result.remainingSpace['e-fatbikes']} e-fatbikes</div>
                <div>+ {result.remainingSpace['fietsen']} fietsen</div>
                <div>+ {result.remainingSpace['e-bikes']} e-bikes</div>
                <div>+ {result.remainingSpace['tweepers']} tweepers</div>
              </div>
            </div>
          )}
        </div>

        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => setLoad({ 'e-choppers': 0, 'e-fatbikes': 0, 'fietsen': 0, 'e-bikes': 0, 'tweepers': 0 })}
        >
          Reset
        </Button>
      </CardContent>
    </Card>
  );
}
