import { useState } from 'react';
import { Loader2, FileText, Pencil, Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DailyOrderBlock as DailyOrderBlockData } from '@/hooks/useDailyPlanningData';
import { useTransport } from '@/context/TransportContext';
import { useInlineAssignment } from '@/hooks/useInlineAssignment';
import { cn } from '@/lib/utils';

interface DailyOrderBlockProps {
  order: DailyOrderBlockData;
  date: string;
  onClick: () => void;
  onPrintTrips: (e: React.MouseEvent) => void;
  isPrinting: boolean;
}

export function OrderBlock({ order, date, onClick, onPrintTrips, isPrinting }: DailyOrderBlockProps) {
  const [editingSegment, setEditingSegment] = useState<'leveren' | 'ophalen' | null>(null);

  return (
    <div className="order-block" onClick={onClick} style={{ cursor: 'pointer' }}>
      {/* Order header */}
      <div className="order-header">
        <span className="order-number">{order.orderNumber}</span>
        <span className="customer-name">{order.customerName}</span>
        {order.vehicleSummary && (
          <span className="vehicle-summary">{order.vehicleSummary}</span>
        )}
        <button
          className="order-print-btn print:hidden"
          onClick={onPrintTrips}
          disabled={isPrinting}
          title="Ritplanningen printen voor deze order"
        >
          {isPrinting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Leveren */}
      {order.leveren && (
        <SegmentRow
          segment="leveren"
          time={order.leveren.time}
          driverNames={order.leveren.driverNames}
          transportNames={order.leveren.transportNames}
          assignments={order.leveren.assignments}
          orderId={order.orderId}
          date={date}
          isEditing={editingSegment === 'leveren'}
          onToggleEdit={(e) => {
            e.stopPropagation();
            setEditingSegment(editingSegment === 'leveren' ? null : 'leveren');
          }}
        />
      )}
      {order.deliveryLocation && (
        <div className="segment-row sub">
          <span className="segment-label"></span>
          <span className="location-text" style={{ gridColumn: '2 / -1' }}>{order.deliveryLocation}</span>
        </div>
      )}
      {order.leveren && order.leveren.transportNames.length > 0 && editingSegment !== 'leveren' && (
        <div className="segment-row sub">
          <span className="segment-label"></span>
          <span className="segment-transport" style={{ gridColumn: '2 / -1' }}>
            {order.leveren.transportNames.join(' / ')}
          </span>
        </div>
      )}

      {/* Ophalen */}
      {order.ophalen && (
        <>
          <div className="segment-spacer" />
          <SegmentRow
            segment="ophalen"
            time={order.ophalen.time}
            driverNames={order.ophalen.driverNames}
            transportNames={order.ophalen.transportNames}
            assignments={order.ophalen.assignments}
            orderId={order.orderId}
            date={date}
            isEditing={editingSegment === 'ophalen'}
            onToggleEdit={(e) => {
              e.stopPropagation();
              setEditingSegment(editingSegment === 'ophalen' ? null : 'ophalen');
            }}
          />
          {order.pickupLocation && (
            <div className="segment-row sub">
              <span className="segment-label"></span>
              <span className="location-text" style={{ gridColumn: '2 / -1' }}>{order.pickupLocation}</span>
            </div>
          )}
          {order.ophalen.transportNames.length > 0 && editingSegment !== 'ophalen' && (
            <div className="segment-row sub">
              <span className="segment-label"></span>
              <span className="segment-transport" style={{ gridColumn: '2 / -1' }}>
                {order.ophalen.transportNames.join(' / ')}
              </span>
            </div>
          )}
        </>
      )}

      {/* Load/Unload plan */}
      {order.loadUnloadPlan.length > 0 && (
        <div className="load-plan">
          {order.loadUnloadPlan.map((step, i) => (
            <div key={i} className={cn("load-row", step.location === 'Blijft staan' && 'stay-loaded')}>
              <span className="load-location">{step.location}</span>
              <span className="load-transport">{step.transportName.toLowerCase()}</span>
              <span className="load-vehicles">{step.vehicleCount} {step.vehicleType}</span>
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      {order.notes && (
        <div className="order-notes">
          ⚠️ {order.notes}
        </div>
      )}
    </div>
  );
}

// ─── Segment Row with inline edit ───────────────────────────
interface SegmentRowProps {
  segment: 'leveren' | 'ophalen';
  time: string;
  driverNames: string[];
  transportNames: string[];
  assignments: { assignmentId: string; transportId: string; driverId: string | null; sequenceNumber: number }[];
  orderId: string;
  date: string;
  isEditing: boolean;
  onToggleEdit: (e: React.MouseEvent) => void;
}

function SegmentRow({ segment, time, driverNames, transportNames, assignments, orderId, date, isEditing, onToggleEdit }: SegmentRowProps) {
  const isLeveren = segment === 'leveren';

  return (
    <>
      <div className="segment-row">
        <span className={`segment-label ${isLeveren ? 'leveren' : 'ophalen'}`}>
          {isLeveren ? 'Leveren' : 'Ophalen'}
        </span>
        <span className="segment-time">{time} uur</span>
        <span className="segment-drivers">
          {driverNames.length > 0 ? driverNames.join(' + ') : '—'}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 ml-auto print:hidden"
          onClick={onToggleEdit}
          title={isEditing ? 'Sluiten' : 'Wijzigen'}
        >
          {isEditing ? <Check className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
        </Button>
      </div>

      {isEditing && (
        <InlineAssignEditor
          segment={segment}
          assignments={assignments}
          orderId={orderId}
          date={date}
        />
      )}
    </>
  );
}

// ─── Inline Assignment Editor ───────────────────────────────
interface InlineAssignEditorProps {
  segment: 'leveren' | 'ophalen';
  assignments: { assignmentId: string; transportId: string; driverId: string | null; sequenceNumber: number }[];
  orderId: string;
  date: string;
}

function InlineAssignEditor({ segment, assignments, orderId, date }: InlineAssignEditorProps) {
  const { allTransportMaterials, combis, drivers } = useTransport();
  const allTransport = [...allTransportMaterials, ...combis];
  const activeDrivers = drivers.filter(d => d.available);
  const { upsertAssignment } = useInlineAssignment(date);

  const existing = assignments[0]; // Primary assignment for this segment

  const handleTransportChange = (transportId: string) => {
    upsertAssignment.mutate({
      orderId,
      segment,
      transportId,
      driverId: existing?.driverId || null,
      existingAssignmentId: existing?.assignmentId,
    });
  };

  const handleDriverChange = (driverId: string) => {
    const resolvedDriverId = driverId === '__none__' ? null : driverId;
    if (!existing && !resolvedDriverId) return; // No assignment and clearing driver — skip
    
    upsertAssignment.mutate({
      orderId,
      segment,
      transportId: existing?.transportId || '',
      driverId: resolvedDriverId,
      existingAssignmentId: existing?.assignmentId,
    });
  };

  return (
    <div
      className="inline-assign-editor print:hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="inline-assign-field">
        <span className="inline-assign-label">Transport</span>
        <Select
          value={existing?.transportId || ''}
          onValueChange={handleTransportChange}
        >
          <SelectTrigger className="h-7 text-xs flex-1">
            <SelectValue placeholder="Kies transport..." />
          </SelectTrigger>
          <SelectContent>
            {allTransport.map(t => (
              <SelectItem key={t.id} value={t.id} className="text-xs">
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="inline-assign-field">
        <span className="inline-assign-label">Chauffeur</span>
        <Select
          value={existing?.driverId || '__none__'}
          onValueChange={handleDriverChange}
        >
          <SelectTrigger className="h-7 text-xs flex-1">
            <SelectValue placeholder="Kies chauffeur..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__" className="text-xs text-muted-foreground">
              Geen chauffeur
            </SelectItem>
            {activeDrivers.map(d => (
              <SelectItem key={d.id} value={d.id} className="text-xs">
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
