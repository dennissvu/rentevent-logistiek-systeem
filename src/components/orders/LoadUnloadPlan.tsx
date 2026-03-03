import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Package, 
  Plus, 
  Trash2, 
  Warehouse, 
  Store,
  ArrowDown,
  ArrowUp,
  AlertCircle,
  CheckCircle2,
  Check,
  Pencil,
} from 'lucide-react';
import { vehicleTypes, VehicleType, CombiTransport, TransportMaterial } from '@/data/transportData';
import { TransportAssignment } from '@/hooks/useOrderAssignments';
import { useLoadUnloadInstructions, LoadUnloadInstruction } from '@/hooks/useLoadUnloadInstructions';
import { useTransport } from '@/context/TransportContext';
import { Driver } from '@/data/planningData';
import { LoadUnloadSummary } from '@/components/orders/LoadUnloadSummary';
import { RemainingVehicles } from '@/components/orders/RemainingVehicles';
import { InstructionRow } from '@/components/orders/InstructionRow';

// ─── Transport section ────────────────────────────────────────────────────────

interface TransportSectionProps {
  assignment: TransportAssignment;
  transportId: string;
  isSubTransport: boolean;
  subLabel?: string;
  action: 'laden' | 'lossen';
  instructions: LoadUnloadInstruction[];
  orderVehicleTypes: { type: VehicleType; count: number }[];
  orderId: string;
  allDrivers: Driver[];
  onAdd: (instruction: Omit<LoadUnloadInstruction, 'id'>) => void;
  onUpdate: (id: string, updates: Partial<LoadUnloadInstruction>) => void;
  onDelete: (id: string) => void;
}

function TransportSection({
  assignment,
  transportId,
  isSubTransport,
  subLabel,
  action,
  instructions,
  orderVehicleTypes,
  orderId,
  allDrivers,
  onAdd,
  onUpdate,
  onDelete,
}: TransportSectionProps) {
  const filteredInstructions = instructions
    .filter(i => (isSubTransport ? i.targetTransportId === transportId : true))
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  const handleAdd = () => {
    const defaultVehicleType = orderVehicleTypes[0]?.type || 'e-choppers';
    const nextSeq = filteredInstructions.length > 0
      ? Math.max(...filteredInstructions.map(i => i.sequenceNumber)) + 1
      : 1;

    onAdd({
      orderId,
      assignmentId: assignment.id,
      action,
      vehicleType: defaultVehicleType,
      vehicleCount: 1,
      location: 'winkel',
      sequenceNumber: nextSeq,
      helperCount: 0,
      helperDriverIds: [],
      customDurationMinutes: null,
      targetTransportId: isSubTransport ? transportId : null,
      notes: null,
      stayLoadedCount: 0,
    });
  };

  return (
    <div className="space-y-2">
      {isSubTransport && subLabel && (
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 ml-1">
          {subLabel}
        </p>
      )}

      {filteredInstructions.length > 0 ? (
        <div className="space-y-1.5">
          {filteredInstructions.map((instruction, index) => (
            <InstructionRow
              key={instruction.id}
              instruction={instruction}
              availableVehicleTypes={orderVehicleTypes}
              allDrivers={allDrivers}
              onUpdate={onUpdate}
              onDelete={onDelete}
              index={index}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic ml-1">Geen stappen</p>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs text-muted-foreground hover:text-foreground"
        onClick={handleAdd}
      >
        <Plus className="h-3 w-3 mr-1" />
        Stap toevoegen
      </Button>
    </div>
  );
}

// ─── Assignment plan ──────────────────────────────────────────────────────────

interface AssignmentPlanProps {
  assignment: TransportAssignment;
  action: 'laden' | 'lossen';
  actionLabel: string;
  instructions: LoadUnloadInstruction[];
  orderVehicleTypes: { type: VehicleType; count: number }[];
  orderId: string;
  allTransport: (TransportMaterial | CombiTransport)[];
  allDrivers: Driver[];
  onAdd: (instruction: Omit<LoadUnloadInstruction, 'id'>) => void;
  onUpdate: (id: string, updates: Partial<LoadUnloadInstruction>) => void;
  onDelete: (id: string) => void;
}

function AssignmentPlan({
  assignment,
  action,
  actionLabel,
  instructions,
  orderVehicleTypes,
  orderId,
  allTransport,
  allDrivers,
  onAdd,
  onUpdate,
  onDelete,
}: AssignmentPlanProps) {
  const transport = allTransport.find(t => t.id === assignment.transportId);
  const transportName = transport?.name || 'Onbekend';
  const isCombi = transport && 'bakwagenId' in transport;
  const combi = isCombi ? (transport as CombiTransport) : null;

  const assignmentInstructions = instructions.filter(i => i.assignmentId === assignment.id && i.action === action);

  const bakwagenName = combi ? allTransport.find(t => t.id === combi.bakwagenId)?.name : null;
  const aanhangerName = combi ? allTransport.find(t => t.id === combi.aanhangerId)?.name : null;

  return (
    <div className="space-y-3 p-3 rounded-lg bg-muted/30 border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{transportName}</span>
          <Badge variant="outline" className="text-xs">
            {actionLabel}
          </Badge>
        </div>
        <Badge variant="secondary" className="text-xs">
          {assignmentInstructions.length} stap{assignmentInstructions.length !== 1 ? 'pen' : ''}
        </Badge>
      </div>

      {isCombi && combi ? (
        <div className="space-y-4 ml-2 border-l-2 border-border pl-3">
          <TransportSection
            assignment={assignment}
            transportId={combi.bakwagenId}
            isSubTransport={true}
            subLabel={`🚛 ${bakwagenName || 'Bakwagen'}`}
            action={action}
            instructions={assignmentInstructions}
            orderVehicleTypes={orderVehicleTypes}
            orderId={orderId}
            allDrivers={allDrivers}
            onAdd={onAdd}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
          <TransportSection
            assignment={assignment}
            transportId={combi.aanhangerId}
            isSubTransport={true}
            subLabel={`🚜 ${aanhangerName || 'Aanhanger'}`}
            action={action}
            instructions={assignmentInstructions}
            orderVehicleTypes={orderVehicleTypes}
            orderId={orderId}
            allDrivers={allDrivers}
            onAdd={onAdd}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        </div>
      ) : (
        <TransportSection
          assignment={assignment}
          transportId={assignment.transportId}
          isSubTransport={false}
          action={action}
          instructions={assignmentInstructions}
          orderVehicleTypes={orderVehicleTypes}
          orderId={orderId}
          allDrivers={allDrivers}
          onAdd={onAdd}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface LoadUnloadPlanProps {
  orderId: string;
  leverenAssignments: TransportAssignment[];
  ophalenAssignments: TransportAssignment[];
  orderVehicleTypes: { type: VehicleType; count: number }[];
  onConfirm?: () => void;
}

export function LoadUnloadPlan({
  orderId,
  leverenAssignments,
  ophalenAssignments,
  orderVehicleTypes,
  onConfirm,
}: LoadUnloadPlanProps) {
  const { allTransportMaterials, combis, drivers } = useTransport();
  const allTransport = [...allTransportMaterials, ...combis];
  const { instructions, isLoading, addInstruction, updateInstruction, deleteInstruction } = useLoadUnloadInstructions(orderId);
  const [isEditing, setIsEditing] = useState(false);
  // Auto-confirm if instructions already exist in DB (persisted confirmation)
  const isConfirmed = !isEditing && (!isLoading && instructions.length > 0);

  // Collect all transport capacities for display
  const getCapacitiesForAssignments = (assignments: TransportAssignment[]) => {
    const caps: { label: string; capacity: Record<string, number> }[] = [];
    for (const a of assignments) {
      const transport = allTransport.find(t => t.id === a.transportId);
      if (!transport) continue;
      const isCombi = 'bakwagenId' in transport;
      if (isCombi) {
        const combi = transport as CombiTransport;
        const bak = allTransportMaterials.find(t => t.id === combi.bakwagenId);
        const anh = allTransportMaterials.find(t => t.id === combi.aanhangerId);
        if (bak) caps.push({ label: bak.name, capacity: bak.capacity });
        if (anh) caps.push({ label: anh.name, capacity: anh.capacity });
      } else if ('capacity' in transport) {
        caps.push({ label: transport.name, capacity: (transport as TransportMaterial).capacity });
      }
    }
    return caps;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground text-sm">
          Laden...
        </CardContent>
      </Card>
    );
  }

  const hasAnyAssignments = leverenAssignments.length > 0 || ophalenAssignments.length > 0;

  if (!hasAnyAssignments) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Laad- & Losplan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">
            Wijs eerst transport toe voordat je een laad-/losplan kunt maken.
          </p>
        </CardContent>
      </Card>
    );
  }

  const leverenAssignmentIds = leverenAssignments.map(a => a.id);
  const ophalenAssignmentIds = ophalenAssignments.map(a => a.id);

  const hasInstructions = instructions.length > 0;

  const handleConfirm = () => {
    setIsEditing(false);
    onConfirm?.();
  };

  // Bevestigde weergave: alleen samenvatting + wijzigen knop
  if (isConfirmed && hasInstructions) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              Laad- & Losplan
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Bevestigd
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-4 w-4 mr-1" />
                Wijzigen
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <LoadUnloadSummary
            instructions={instructions}
            allDrivers={drivers}
            allTransport={allTransport}
            leverenAssignments={leverenAssignments}
            ophalenAssignments={ophalenAssignments}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Laad- & Losplan
          </CardTitle>
          {isConfirmed && (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Bevestigd
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Leveren: Laden voor vertrek */}
        {leverenAssignments.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ArrowUp className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm">Laden voor vertrek (leveren)</h4>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              Wat moet er bij de winkel/loods in het transport geladen worden?
            </p>

            {/* Remaining vehicles tracker */}
            <RemainingVehicles
              orderVehicleTypes={orderVehicleTypes}
              instructions={instructions}
              action="laden"
              assignmentIds={leverenAssignmentIds}
              transportCapacities={getCapacitiesForAssignments(leverenAssignments)}
            />

            {leverenAssignments.map(assignment => (
              <AssignmentPlan
                key={`leveren-laden-${assignment.id}`}
                assignment={assignment}
                action="laden"
                actionLabel="Laden"
                instructions={instructions}
                orderVehicleTypes={orderVehicleTypes}
                orderId={orderId}
                allTransport={allTransport}
                allDrivers={drivers}
                onAdd={addInstruction}
                onUpdate={updateInstruction}
                onDelete={deleteInstruction}
              />
            ))}
          </div>
        )}

        {/* Divider between leveren and ophalen */}
        {leverenAssignments.length > 0 && ophalenAssignments.length > 0 && (
          <div className="border-t pt-2" />
        )}

        {/* Ophalen: Lossen na terugkomst */}
        {ophalenAssignments.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ArrowDown className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">Lossen na terugkomst (ophalen)</h4>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              Waar moeten de opgehaalde voertuigen uitgeladen worden?
            </p>

            {/* Remaining vehicles tracker for unloading */}
            <RemainingVehicles
              orderVehicleTypes={orderVehicleTypes}
              instructions={instructions}
              action="lossen"
              assignmentIds={ophalenAssignmentIds}
              transportCapacities={getCapacitiesForAssignments(ophalenAssignments)}
            />

            {ophalenAssignments.map(assignment => (
              <AssignmentPlan
                key={`ophalen-lossen-${assignment.id}`}
                assignment={assignment}
                action="lossen"
                actionLabel="Lossen"
                instructions={instructions}
                orderVehicleTypes={orderVehicleTypes}
                orderId={orderId}
                allTransport={allTransport}
                allDrivers={drivers}
                onAdd={addInstruction}
                onUpdate={updateInstruction}
                onDelete={deleteInstruction}
              />
            ))}
          </div>
        )}

        {/* Samenvatting */}
        {hasInstructions && (
          <LoadUnloadSummary
            instructions={instructions}
            allDrivers={drivers}
            allTransport={allTransport}
            leverenAssignments={leverenAssignments}
            ophalenAssignments={ophalenAssignments}
          />
        )}

        {/* Bevestigingsknop */}
        {hasInstructions && (
          <div className="pt-2 border-t">
            <Button
              onClick={handleConfirm}
              className="w-full"
              variant={isConfirmed ? 'outline' : 'default'}
            >
              <Check className="h-4 w-4 mr-2" />
              {isConfirmed ? 'Laad-/losplan opnieuw bevestigen' : 'Laad-/losplan bevestigen'}
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Na bevestiging worden de werktijden van chauffeurs herberekend
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
