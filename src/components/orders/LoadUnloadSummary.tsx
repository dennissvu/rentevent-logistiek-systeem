import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Warehouse, Store, ArrowUp, ArrowDown, ParkingCircle } from 'lucide-react';
import { vehicleTypes, CombiTransport, TransportMaterial } from '@/data/transportData';
import { TransportAssignment } from '@/hooks/useOrderAssignments';
import { LoadUnloadInstruction } from '@/hooks/useLoadUnloadInstructions';
import { Driver } from '@/data/planningData';

interface LoadUnloadSummaryProps {
  instructions: LoadUnloadInstruction[];
  allDrivers: Driver[];
  allTransport: (TransportMaterial | CombiTransport)[];
  leverenAssignments: TransportAssignment[];
  ophalenAssignments: TransportAssignment[];
}

interface SummaryRow {
  action: 'laden' | 'lossen';
  segment: 'leveren' | 'ophalen';
  location: 'winkel' | 'loods' | 'blijft_staan';
  vehicleType: string;
  vehicleCount: number;
  helperNames: string[];
  transportName: string;
}

export function LoadUnloadSummary({
  instructions,
  allDrivers,
  allTransport,
  leverenAssignments,
  ophalenAssignments,
}: LoadUnloadSummaryProps) {
  const leverenAssignmentIds = new Set(leverenAssignments.map(a => a.id));
  const ophalenAssignmentIds = new Set(ophalenAssignments.map(a => a.id));

  const rows = useMemo<SummaryRow[]>(() => {
    return instructions
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
      .map(inst => {
        const isLeveren = leverenAssignmentIds.has(inst.assignmentId);
        const segment: 'leveren' | 'ophalen' = isLeveren ? 'leveren' : 'ophalen';

        // Find transport name – prefer specific sub-transport (bakwagen/aanhanger) over combi name
        const assignment = [...leverenAssignments, ...ophalenAssignments].find(a => a.id === inst.assignmentId);
        let transportName = '';
        if (inst.targetTransportId) {
          // Instruction targets a specific sub-transport within a combi
          const subTransport = allTransport.find(t => t.id === inst.targetTransportId);
          transportName = subTransport?.name || '';
        } else if (assignment) {
          const transport = allTransport.find(t => t.id === assignment.transportId);
          transportName = transport?.name || '';
        }

        // Resolve helper names
        const helperNames = (inst.helperDriverIds || [])
          .map(id => allDrivers.find(d => d.id === id)?.name)
          .filter(Boolean) as string[];

        return {
          action: inst.action,
          segment,
          location: inst.location as 'winkel' | 'loods' | 'blijft_staan',
          vehicleType: inst.vehicleType,
          vehicleCount: inst.vehicleCount,
          helperNames,
          transportName,
        };
      });
  }, [instructions, leverenAssignmentIds, allDrivers, allTransport, leverenAssignments, ophalenAssignments]);

  const leverenLaden = rows.filter(r => r.segment === 'leveren' && r.action === 'laden');
  const ophalenLossen = rows.filter(r => r.segment === 'ophalen' && r.action === 'lossen');

  if (rows.length === 0) return null;

  return (
    <div className="space-y-3 p-3 rounded-lg bg-muted/30 border">
      <h4 className="text-sm font-semibold">Samenvatting</h4>
      
      {leverenLaden.length > 0 && (
        <SummarySection
          label="Laden (leveren)"
          icon={<ArrowUp className="h-3.5 w-3.5 text-primary" />}
          rows={leverenLaden}
        />
      )}

      {ophalenLossen.length > 0 && (
        <SummarySection
          label="Lossen (ophalen)"
          icon={<ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />}
          rows={ophalenLossen}
        />
      )}
    </div>
  );
}

function SummarySection({ label, icon, rows }: { label: string; icon: React.ReactNode; rows: SummaryRow[] }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground">Locatie</th>
              <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground">Voertuig</th>
              <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground">Aantal</th>
              <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground">Transport</th>
              <th className="text-left py-1.5 font-medium text-muted-foreground">Medewerkers</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const vtInfo = vehicleTypes.find(v => v.id === row.vehicleType);
              const isBlijftStaan = row.location === 'blijft_staan';
              return (
                <tr key={i} className={`border-b border-border/30 last:border-0 ${isBlijftStaan ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}>
                  <td className="py-1.5 pr-3">
                    <div className="flex items-center gap-1">
                      {isBlijftStaan ? (
                        <ParkingCircle className="h-3 w-3 text-blue-500" />
                      ) : row.location === 'winkel' ? (
                        <Store className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <Warehouse className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className={`capitalize ${isBlijftStaan ? 'text-blue-600 dark:text-blue-400 font-medium' : ''}`}>
                        {isBlijftStaan ? 'Blijft staan' : row.location}
                      </span>
                    </div>
                  </td>
                  <td className="py-1.5 pr-3">
                    <span>{vtInfo?.icon} {vtInfo?.name}</span>
                  </td>
                  <td className="py-1.5 pr-3 font-medium">
                    {row.vehicleCount}x
                  </td>
                  <td className="py-1.5 pr-3 text-muted-foreground">
                    {row.transportName}
                  </td>
                  <td className="py-1.5">
                    {isBlijftStaan ? (
                      <span className="text-muted-foreground italic">—</span>
                    ) : row.helperNames.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {row.helperNames.map((name, j) => (
                          <Badge key={j} variant="secondary" className="text-[10px] px-1.5 py-0">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
