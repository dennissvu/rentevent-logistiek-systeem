import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Truck, User, Package, RotateCcw, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { VehicleType, TransportMaterial, CombiTransport } from '@/data/transportData';
import { useTransport } from '@/context/TransportContext';
import { useAvailability, AvailabilityInfo } from '@/hooks/useAvailability';
import { checkCapacity, checkCapacityWithTransport, CapacityCheck } from '@/utils/capacityChecker';

interface VehicleCount {
  type: VehicleType;
  count: number;
}

interface TransportAssignmentProps {
  // Leveren
  assignedTransportLeveren?: string;
  assignedDriverLeveren?: string;
  onTransportLeverenChange: (value: string | undefined) => void;
  onDriverLeverenChange: (value: string | undefined) => void;
  // Ophalen
  assignedTransportOphalen?: string;
  assignedDriverOphalen?: string;
  onTransportOphalenChange: (value: string | undefined) => void;
  onDriverOphalenChange: (value: string | undefined) => void;
  // Times for display
  startTime: string;
  endTime: string;
  // Date and order for availability check
  date: string;
  orderId: string;
  // Vehicles for capacity check
  vehicles?: VehicleCount[];
  // Read-only mode
  readOnly?: boolean;
}

function CapacityIndicator({ check }: { check: CapacityCheck }) {
  if (!check) return null;
  
  const progressColor = check.isValid 
    ? check.utilizationPercent > 80 
      ? 'bg-orange-500' 
      : 'bg-green-500'
    : 'bg-red-500';
  
  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Capaciteit</span>
        <span className={`font-medium ${
          check.isValid 
            ? check.utilizationPercent > 80 
              ? 'text-orange-600' 
              : 'text-green-600'
            : 'text-red-600'
        }`}>
          {check.utilizationPercent}%
        </span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all ${progressColor}`}
          style={{ width: `${Math.min(check.utilizationPercent, 100)}%` }}
        />
      </div>
      {!check.isValid && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {check.message}
        </p>
      )}
    </div>
  );
}

function AvailabilityBadge({ info, compact = false }: { info: AvailabilityInfo; compact?: boolean }) {
  if (info.isAvailable !== false || !info.assignedTo?.length) {
    if (compact) return null;
    return (
      <Badge variant="outline" className="text-green-600 border-green-300 text-[10px]">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Beschikbaar
      </Badge>
    );
  }

  const assignments = info.assignedTo;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="outline" className="text-orange-600 border-orange-300 text-[10px]">
            <AlertCircle className="h-3 w-3 mr-1" />
            {assignments.length}x bezet
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-xs space-y-1">
            <p className="font-semibold">Al toegewezen aan:</p>
            {assignments.map((a, i) => (
              <p key={i}>
                {a.orderNumber} - {a.segment === 'leveren' ? 'Afleveren' : 'Ophalen'} ({a.time})
              </p>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function TransportAssignment({
  assignedTransportLeveren,
  assignedDriverLeveren,
  onTransportLeverenChange,
  onDriverLeverenChange,
  assignedTransportOphalen,
  assignedDriverOphalen,
  onTransportOphalenChange,
  onDriverOphalenChange,
  startTime,
  endTime,
  date,
  orderId,
  vehicles = [],
  readOnly = false,
}: TransportAssignmentProps) {
  const { bakwagens, aanhangers, combis, allTransportMaterials, drivers } = useTransport();
  const { isTransportAvailable, isDriverAvailable } = useAvailability(date, orderId);

  const allTransport = [...allTransportMaterials, ...combis];

  // Capacity checks - now using database data
  const leverenCapacity = assignedTransportLeveren && vehicles?.length 
    ? checkCapacity(assignedTransportLeveren, vehicles, allTransport) 
    : null;
  const ophalenCapacity = assignedTransportOphalen && vehicles?.length 
    ? checkCapacity(assignedTransportOphalen, vehicles, allTransport) 
    : null;

  const getTransportName = (id?: string) => {
    if (!id) return null;
    return allTransport.find(t => t.id === id)?.name || id;
  };

  const getDriverName = (id?: string) => {
    if (!id) return null;
    return drivers.find(d => d.id === id)?.name || id;
  };

  const isLeverenComplete = assignedTransportLeveren && assignedDriverLeveren;
  const isOphalenComplete = assignedTransportOphalen && assignedDriverOphalen;

  // Check if a transport option fits the required vehicles
  const getCapacityForTransport = (transportId: string) => {
    if (!vehicles?.length) return null;
    return checkCapacity(transportId, vehicles, allTransport);
  };

  if (readOnly) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Transport Toewijzing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Leveren */}
          <div className="p-4 rounded-lg bg-green-50 border border-green-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-800">Afleveren</span>
                <span className="text-sm text-green-600">({startTime})</span>
              </div>
              {isLeverenComplete ? (
                <Badge className="bg-green-500">Toegewezen</Badge>
              ) : (
                <Badge variant="outline" className="border-orange-300 text-orange-600">Niet toegewezen</Badge>
              )}
            </div>
            {isLeverenComplete ? (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Transport:</span>
                  <span className="ml-2 font-medium">{getTransportName(assignedTransportLeveren)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Chauffeur:</span>
                  <span className="ml-2 font-medium">{getDriverName(assignedDriverLeveren)}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Nog geen transport of chauffeur toegewezen</p>
            )}
          </div>

          {/* Ophalen */}
          <div className="p-4 rounded-lg bg-red-50 border border-red-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-red-600" />
                <span className="font-medium text-red-800">Ophalen</span>
                <span className="text-sm text-red-600">({endTime})</span>
              </div>
              {isOphalenComplete ? (
                <Badge className="bg-green-500">Toegewezen</Badge>
              ) : (
                <Badge variant="outline" className="border-orange-300 text-orange-600">Niet toegewezen</Badge>
              )}
            </div>
            {isOphalenComplete ? (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Transport:</span>
                  <span className="ml-2 font-medium">{getTransportName(assignedTransportOphalen)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Chauffeur:</span>
                  <span className="ml-2 font-medium">{getDriverName(assignedDriverOphalen)}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Nog geen transport of chauffeur toegewezen</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderTransportOption = (id: string, name: string) => {
    const availability = isTransportAvailable(id);
    const isBusy = availability.isAvailable === false;
    const capacity = getCapacityForTransport(id);
    const noFit = capacity && !capacity.isValid;
    
    return (
      <SelectItem 
        key={id} 
        value={id} 
        className={noFit ? 'text-red-600' : isBusy ? 'text-orange-600' : ''}
      >
        <div className="flex items-center justify-between w-full gap-2">
          <span>{name}</span>
          <div className="flex items-center gap-1">
            {noFit && (
              <span className="text-[10px] text-red-500 flex items-center gap-0.5">
                <AlertTriangle className="h-2.5 w-2.5" />
                Te klein
              </span>
            )}
            {!noFit && isBusy && (
              <span className="text-[10px] text-orange-500">
                ({availability.assignedTo?.length}x bezet)
              </span>
            )}
            {!noFit && !isBusy && capacity && (
              <span className="text-[10px] text-green-500">
                {capacity.utilizationPercent}%
              </span>
            )}
          </div>
        </div>
      </SelectItem>
    );
  };

  const renderDriverOption = (driver: { id: string; name: string; phone: string; available: boolean }) => {
    const availability = isDriverAvailable(driver.id);
    const isBusy = availability.isAvailable === false;
    
    return (
      <SelectItem key={driver.id} value={driver.id} className={isBusy ? 'text-orange-600' : ''}>
        <div className="flex items-center gap-2">
          <User className="h-3 w-3" />
          <span>{driver.name}</span>
          {isBusy && (
            <span className="text-[10px] text-orange-500">
              ({availability.assignedTo?.length}x bezet)
            </span>
          )}
        </div>
      </SelectItem>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Transport Toewijzing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Capacity Warning Alert */}
        {((leverenCapacity && !leverenCapacity.isValid) || (ophalenCapacity && !ophalenCapacity.isValid)) && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="ml-2">
              <strong>Capaciteitswaarschuwing:</strong> Het geselecteerde transport heeft onvoldoende capaciteit voor alle voertuigen.
              {leverenCapacity && !leverenCapacity.isValid && (
                <div className="mt-1">• Afleveren: {leverenCapacity.message}</div>
              )}
              {ophalenCapacity && !ophalenCapacity.isValid && (
                <div className="mt-1">• Ophalen: {ophalenCapacity.message}</div>
              )}
            </AlertDescription>
          </Alert>
        )}
        {/* Leveren */}
        <div className="p-4 rounded-lg bg-green-50 border border-green-200">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-4 w-4 text-green-600" />
            <span className="font-medium text-green-800">Afleveren</span>
            <span className="text-sm text-green-600">({startTime})</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Transport</Label>
                {assignedTransportLeveren && (
                  <AvailabilityBadge info={isTransportAvailable(assignedTransportLeveren)} compact />
                )}
              </div>
              <Select 
                value={assignedTransportLeveren || 'none'} 
                onValueChange={(v) => onTransportLeverenChange(v === 'none' ? undefined : v)}
              >
                <SelectTrigger className={leverenCapacity && !leverenCapacity.isValid ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Selecteer transport..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geen</SelectItem>
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Bakwagens</div>
                  {bakwagens.map(b => renderTransportOption(b.id, b.name))}
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Combi's</div>
                  {combis.map(c => renderTransportOption(c.id, c.name))}
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Aanhangers</div>
                  {aanhangers.map(a => renderTransportOption(a.id, a.name))}
                </SelectContent>
              </Select>
              {leverenCapacity && <CapacityIndicator check={leverenCapacity} />}
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Chauffeur</Label>
                {assignedDriverLeveren && (
                  <AvailabilityBadge info={isDriverAvailable(assignedDriverLeveren)} compact />
                )}
              </div>
              <Select 
                value={assignedDriverLeveren || 'none'} 
                onValueChange={(v) => onDriverLeverenChange(v === 'none' ? undefined : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer chauffeur..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geen</SelectItem>
                  {drivers.filter(d => d.available).map(d => renderDriverOption(d))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Ophalen */}
        <div className="p-4 rounded-lg bg-red-50 border border-red-200">
          <div className="flex items-center gap-2 mb-4">
            <RotateCcw className="h-4 w-4 text-red-600" />
            <span className="font-medium text-red-800">Ophalen</span>
            <span className="text-sm text-red-600">({endTime})</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Transport</Label>
                {assignedTransportOphalen && (
                  <AvailabilityBadge info={isTransportAvailable(assignedTransportOphalen)} compact />
                )}
              </div>
              <Select 
                value={assignedTransportOphalen || 'none'} 
                onValueChange={(v) => onTransportOphalenChange(v === 'none' ? undefined : v)}
              >
                <SelectTrigger className={ophalenCapacity && !ophalenCapacity.isValid ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Selecteer transport..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geen</SelectItem>
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Bakwagens</div>
                  {bakwagens.map(b => renderTransportOption(b.id, b.name))}
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Combi's</div>
                  {combis.map(c => renderTransportOption(c.id, c.name))}
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Aanhangers</div>
                  {aanhangers.map(a => renderTransportOption(a.id, a.name))}
                </SelectContent>
              </Select>
              {ophalenCapacity && <CapacityIndicator check={ophalenCapacity} />}
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Chauffeur</Label>
                {assignedDriverOphalen && (
                  <AvailabilityBadge info={isDriverAvailable(assignedDriverOphalen)} compact />
                )}
              </div>
              <Select 
                value={assignedDriverOphalen || 'none'} 
                onValueChange={(v) => onDriverOphalenChange(v === 'none' ? undefined : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer chauffeur..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geen</SelectItem>
                  {drivers.filter(d => d.available).map(d => renderDriverOption(d))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
