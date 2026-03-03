import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Truck, 
  User, 
  Package, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  Copy
} from 'lucide-react';
import { VehicleType, TransportMaterial, CombiTransport } from '@/data/transportData';
import { useTransport } from '@/context/TransportContext';
import { useOrderAssignments, TransportAssignment } from '@/hooks/useOrderAssignments';
import { calculateMultiTransportNeeds, checkMultiTransportCapacity } from '@/utils/multiTransportCalculator';
import { VehicleCount } from '@/utils/capacityChecker';

interface MultiTransportAssignmentProps {
  orderId: string;
  vehicles: VehicleCount[];
  startTime: string;
  endTime: string;
  readOnly?: boolean;
}

function SegmentAssignments({
  segment,
  segmentLabel,
  segmentIcon: Icon,
  segmentColor,
  time,
  assignments,
  vehicles,
  allTransport,
  drivers,
  onAdd,
  onUpdate,
  onDelete,
  onApplyRecommendation,
  readOnly,
}: {
  segment: 'leveren' | 'ophalen';
  segmentLabel: string;
  segmentIcon: typeof Package;
  segmentColor: string;
  time: string;
  assignments: TransportAssignment[];
  vehicles: VehicleCount[];
  allTransport: (TransportMaterial | CombiTransport)[];
  drivers: { id: string; name: string; available: boolean; canDriveTrailer: boolean }[];
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<TransportAssignment>) => void;
  onDelete: (id: string) => void;
  onApplyRecommendation: () => void;
  readOnly?: boolean;
}) {
  const recommendation = useMemo(() => 
    calculateMultiTransportNeeds(vehicles, allTransport),
    [vehicles, allTransport]
  );

  const selectedTransports = assignments
    .map(a => allTransport.find(t => t.id === a.transportId))
    .filter(Boolean) as (TransportMaterial | CombiTransport)[];

  const capacityCheck = useMemo(() => 
    checkMultiTransportCapacity(vehicles, selectedTransports),
    [vehicles, selectedTransports]
  );

  const bgColor = segmentColor === 'green' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
  const textColor = segmentColor === 'green' ? 'text-green-600' : 'text-red-600';
  const headerColor = segmentColor === 'green' ? 'text-green-800' : 'text-red-800';

  // Check if transport requires trailer driver
  const requiresTrailerDriver = (transportId: string) => {
    const transport = allTransport.find(t => t.id === transportId);
    if (!transport) return false;
    // Combis and aanhangers require trailer license
    return 'bakwagenId' in transport || ('type' in transport && transport.type === 'aanhanger');
  };

  const getAvailableDrivers = (transportId: string) => {
    const needsTrailer = requiresTrailerDriver(transportId);
    return drivers.filter(d => d.available && (!needsTrailer || d.canDriveTrailer));
  };

  return (
    <div className={`p-4 rounded-lg border ${bgColor}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${textColor}`} />
          <span className={`font-medium ${headerColor}`}>{segmentLabel}</span>
          <span className={`text-sm ${textColor}`}>({time})</span>
        </div>
        <div className="flex items-center gap-2">
          {assignments.length > 0 && (
            <Badge 
              variant={capacityCheck.isValid ? "default" : "destructive"}
              className={capacityCheck.isValid ? "bg-green-500" : ""}
            >
              {capacityCheck.isValid ? (
                <><CheckCircle2 className="h-3 w-3 mr-1" />{capacityCheck.utilizationPercent}%</>
              ) : (
                <><AlertTriangle className="h-3 w-3 mr-1" />Te klein</>
              )}
            </Badge>
          )}
          {!readOnly && recommendation.minTransportsNeeded > 0 && (
            <Badge variant="outline" className="text-muted-foreground">
              Min. {recommendation.minTransportsNeeded} transport{recommendation.minTransportsNeeded > 1 ? 'en' : ''} nodig
            </Badge>
          )}
        </div>
      </div>

      {/* Recommendation banner */}
      {!readOnly && recommendation.minTransportsNeeded > 1 && assignments.length === 0 && (
        <Alert className="mb-4 bg-blue-50 border-blue-200">
          <Lightbulb className="h-4 w-4 text-blue-600" />
          <AlertDescription className="ml-2 flex items-center justify-between">
            <span className="text-blue-800">
              Aanbevolen: {recommendation.recommendedCombination.map(r => r.transport.name).join(' + ')}
            </span>
            <Button 
              size="sm" 
              variant="outline" 
              className="ml-2 border-blue-300 text-blue-700 hover:bg-blue-100"
              onClick={onApplyRecommendation}
            >
              Toepassen
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Capacity warning */}
      {assignments.length > 0 && !capacityCheck.isValid && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="ml-2">
            {capacityCheck.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Assignment rows */}
      <div className="space-y-3">
        {assignments.map((assignment, index) => {
          const transportOptions = allTransport;
          const driverOptions = getAvailableDrivers(assignment.transportId);
          
          return (
            <div key={assignment.id} className="flex items-center gap-3 bg-white/50 p-3 rounded-md">
              <span className="text-sm font-medium text-muted-foreground w-6">
                {index + 1}.
              </span>
              
              <div className="flex-1 grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Transport</Label>
                  <Select
                    value={assignment.transportId || 'none'}
                    onValueChange={(v) => onUpdate(assignment.id, { transportId: v === 'none' ? '' : v })}
                    disabled={readOnly}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Kies transport..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Geen</SelectItem>
                      {transportOptions.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          <div className="flex items-center gap-2">
                            <Truck className="h-3 w-3" />
                            {t.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">
                    Chauffeur
                    {requiresTrailerDriver(assignment.transportId) && (
                      <span className="text-orange-500 ml-1">(BE)</span>
                    )}
                  </Label>
                  <Select
                    value={assignment.driverId || 'none'}
                    onValueChange={(v) => onUpdate(assignment.id, { driverId: v === 'none' ? null : v })}
                    disabled={readOnly}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Kies chauffeur..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Geen</SelectItem>
                      {driverOptions.map(d => (
                        <SelectItem key={d.id} value={d.id}>
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3" />
                            {d.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!readOnly && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => onDelete(assignment.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        })}

        {assignments.length === 0 && (
          <p className="text-sm text-muted-foreground italic text-center py-2">
            Nog geen transport toegewezen
          </p>
        )}
      </div>

      {/* Add button */}
      {!readOnly && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          onClick={onAdd}
        >
          <Plus className="h-4 w-4 mr-2" />
          Transport toevoegen
        </Button>
      )}
    </div>
  );
}

export function MultiTransportAssignment({
  orderId,
  vehicles,
  startTime,
  endTime,
  readOnly = false,
}: MultiTransportAssignmentProps) {
  const { bakwagens, aanhangers, combis, allTransportMaterials, drivers } = useTransport();
  const { 
    leverenAssignments, 
    ophalenAssignments, 
    isLoading,
    addAssignment,
    updateAssignment,
    deleteAssignment,
  } = useOrderAssignments(orderId);

  const allTransport = [...allTransportMaterials, ...combis];

  const driverList = drivers.map(d => ({
    id: d.id,
    name: d.name,
    available: d.available,
    canDriveTrailer: d.canDriveTrailer,
  }));

  const handleAdd = async (segment: 'leveren' | 'ophalen') => {
    const existing = segment === 'leveren' ? leverenAssignments : ophalenAssignments;
    const nextSeq = existing.length > 0 
      ? Math.max(...existing.map(a => a.sequenceNumber)) + 1 
      : 1;

    await addAssignment({
      orderId,
      segment,
      transportId: '',
      driverId: null,
      sequenceNumber: nextSeq,
    });
  };

  const handleApplyRecommendation = async (segment: 'leveren' | 'ophalen') => {
    const recommendation = calculateMultiTransportNeeds(vehicles, allTransport);
    
    // Clear existing and add recommended
    const existing = segment === 'leveren' ? leverenAssignments : ophalenAssignments;
    for (const a of existing) {
      await deleteAssignment(a.id);
    }

    for (let i = 0; i < recommendation.recommendedCombination.length; i++) {
      await addAssignment({
        orderId,
        segment,
        transportId: recommendation.recommendedCombination[i].transport.id,
        driverId: null,
        sequenceNumber: i + 1,
      });
    }
  };

  const handleCopyToOphalen = async () => {
    // Clear ophalen assignments
    for (const a of ophalenAssignments) {
      await deleteAssignment(a.id);
    }

    // Copy leveren to ophalen
    for (let i = 0; i < leverenAssignments.length; i++) {
      await addAssignment({
        orderId,
        segment: 'ophalen',
        transportId: leverenAssignments[i].transportId,
        driverId: leverenAssignments[i].driverId,
        sequenceNumber: i + 1,
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Laden...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Transport Toewijzing
          {vehicles.length > 0 && (
            <Badge variant="outline" className="ml-2">
              {vehicles.map(v => `${v.count} ${v.type}`).join(', ')}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Leveren */}
        <SegmentAssignments
          segment="leveren"
          segmentLabel="Afleveren"
          segmentIcon={Package}
          segmentColor="green"
          time={startTime}
          assignments={leverenAssignments}
          vehicles={vehicles}
          allTransport={allTransport}
          drivers={driverList}
          onAdd={() => handleAdd('leveren')}
          onUpdate={updateAssignment}
          onDelete={deleteAssignment}
          onApplyRecommendation={() => handleApplyRecommendation('leveren')}
          readOnly={readOnly}
        />

        {/* Copy button */}
        {!readOnly && leverenAssignments.length > 0 && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyToOphalen}
              className="text-muted-foreground"
            >
              <Copy className="h-4 w-4 mr-2" />
              Kopieer naar ophalen
            </Button>
          </div>
        )}

        {/* Ophalen */}
        <SegmentAssignments
          segment="ophalen"
          segmentLabel="Ophalen"
          segmentIcon={RotateCcw}
          segmentColor="red"
          time={endTime}
          assignments={ophalenAssignments}
          vehicles={vehicles}
          allTransport={allTransport}
          drivers={driverList}
          onAdd={() => handleAdd('ophalen')}
          onUpdate={updateAssignment}
          onDelete={deleteAssignment}
          onApplyRecommendation={() => handleApplyRecommendation('ophalen')}
          readOnly={readOnly}
        />
      </CardContent>
    </Card>
  );
}
