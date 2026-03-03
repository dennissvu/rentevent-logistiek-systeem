import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTransport } from '@/context/TransportContext';
import { vehicleTypes as vehicleTypesList, VehicleType } from '@/data/transportData';

export interface DailySegmentAssignment {
  assignmentId: string;
  transportId: string;
  driverId: string | null;
  sequenceNumber: number;
}

export interface DailyOrderBlock {
  orderId: string;
  orderNumber: string;
  customerName: string;
  companyName?: string;
  vehicleSummary: string;
  deliveryLocation: string;
  pickupLocation: string;
  notes?: string;
  leveren: {
    time: string;
    driverNames: string[];
    transportNames: string[];
    assignments: DailySegmentAssignment[];
  } | null;
  ophalen: {
    time: string;
    driverNames: string[];
    transportNames: string[];
    assignments: DailySegmentAssignment[];
  } | null;
  loadUnloadPlan: DailyLoadStep[];
}

export interface DailyLoadStep {
  action: 'laden' | 'lossen';
  location: string; // winkel, loods, blijft_staan
  transportName: string;
  vehicleCount: number;
  vehicleType: string;
  vehicleIcon: string;
}

export function useDailyPlanningData(date: string) {
  const { allTransportMaterials, combis, bakwagens, aanhangers } = useTransport();
  const allTransport = [...allTransportMaterials, ...combis];

  // Fetch ALL drivers (including inactive) for name resolution
  const { data: allDrivers = [] } = useQuery({
    queryKey: ['all-drivers-for-planning'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('id, name');
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  // Fetch raw transport DB records for UUID-based name resolution
  const { data: dbTransportMaterials = [] } = useQuery({
    queryKey: ['transport-materials-raw-for-planning'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transport_materials')
        .select('id, name, code');
      if (error) throw error;
      return data as { id: string; name: string; code: string }[];
    },
  });

  const { data: dbTransportCombis = [] } = useQuery({
    queryKey: ['transport-combis-raw-for-planning'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transport_combis')
        .select('id, name, code');
      if (error) throw error;
      return data as { id: string; name: string; code: string }[];
    },
  });

  const getTransportName = (id: string) => {
    // First try app-level (code-based) lookup
    const t = allTransport.find(t => t.id === id);
    if (t) return t.name;
    // Then try DB UUID lookup
    const dbMat = dbTransportMaterials.find(m => m.id === id);
    if (dbMat) return dbMat.name;
    const dbCombi = dbTransportCombis.find(c => c.id === id);
    if (dbCombi) return dbCombi.name;
    // Fallback: try matching by code
    const byCode = [...dbTransportMaterials, ...dbTransportCombis].find(m => m.code === id);
    if (byCode) return byCode.name;
    return id;
  };

  const getDriverName = (id: string) => {
    const d = allDrivers.find(d => d.id === id);
    return d?.name || id;
  };

  const getVehicleInfo = (typeId: string) => {
    const vt = vehicleTypesList.find(v => v.id === typeId);
    return { name: vt?.name || typeId, icon: vt?.icon || '🚲' };
  };

  return useQuery({
    queryKey: ['daily-planning', date, allTransport.length, allDrivers.length, dbTransportMaterials.length, dbTransportCombis.length],
    queryFn: async (): Promise<DailyOrderBlock[]> => {
      // 1. Fetch orders where logistic delivery or pickup falls on this date
      // We need to check: delivery_date (or start_date) = date OR pickup_date (or end_date) = date
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['bevestigd', 'optie']);

      if (ordersError) throw ordersError;
      
      // Filter orders where logistic dates match the selected date
      const filteredOrders = (orders || []).filter(o => {
        const effectiveDeliveryDate = (o as any).delivery_date || o.start_date;
        const effectivePickupDate = (o as any).pickup_date || o.end_date;
        return effectiveDeliveryDate === date || effectivePickupDate === date;
      });
      
      if (filteredOrders.length === 0) return [];

      const orderIds = filteredOrders.map(o => o.id);

      // 2. Fetch all assignments for these orders
      const { data: assignments, error: assignError } = await supabase
        .from('order_transport_assignments')
        .select('*')
        .in('order_id', orderIds)
        .order('sequence_number');

      if (assignError) throw assignError;

      // 3. Fetch all load/unload instructions
      const { data: instructions, error: instrError } = await (supabase as any)
        .from('order_load_unload_instructions')
        .select('*')
        .in('order_id', orderIds)
        .order('sequence_number');

      if (instrError) throw instrError;

      // 4. Build order blocks
      const blocks: DailyOrderBlock[] = filteredOrders.map(order => {
        const orderAssignments = (assignments || []).filter(a => a.order_id === order.id);
        const orderInstructions = (instructions || []).filter((i: any) => i.order_id === order.id);
        
        const vehicleTypesData = (order.vehicle_types as { type: VehicleType; count: number }[] | null) || [];
        const totalVehicles = vehicleTypesData.reduce((sum, v) => sum + v.count, 0);
        const vehicleSummary = vehicleTypesData
          .map(v => `${v.count} ${getVehicleInfo(v.type).name}`)
          .join(', ');

        // Leveren segment
        const leverenAssignments = orderAssignments.filter(a => a.segment === 'leveren');
        const ophalenAssignments = orderAssignments.filter(a => a.segment === 'ophalen');

        const buildSegmentInfo = (segAssignments: typeof leverenAssignments, time: string) => {
          if (segAssignments.length === 0 && !time) return null;
          const driverNames = segAssignments
            .filter(a => a.driver_id)
            .map(a => getDriverName(a.driver_id!));
          const transportNames = segAssignments.map(a => getTransportName(a.transport_id));
          // Deduplicate driver names
          const uniqueDrivers = [...new Set(driverNames)];
          const assignments: DailySegmentAssignment[] = segAssignments.map(a => ({
            assignmentId: a.id,
            transportId: a.transport_id,
            driverId: a.driver_id || null,
            sequenceNumber: a.sequence_number,
          }));
          return {
            time: time?.slice(0, 5) || '-',
            driverNames: uniqueDrivers,
            transportNames,
            assignments,
          };
        };

        // Use logistic times if available, otherwise booking times
        const effectiveDeliveryDate = (order as any).delivery_date || order.start_date;
        const effectivePickupDate = (order as any).pickup_date || order.end_date;
        const effectiveDeliveryTime = (order as any).delivery_time || order.start_time;
        const effectivePickupTime = (order as any).pickup_time || order.end_time;
        
        // Only show segment if it falls on the selected date
        const leveren = effectiveDeliveryDate === date ? buildSegmentInfo(leverenAssignments, effectiveDeliveryTime) : null;
        const ophalen = effectivePickupDate === date ? buildSegmentInfo(ophalenAssignments, effectivePickupTime) : null;

        // Load/unload plan - split combi instructions into bakwagen/aanhanger lines
        const lossenInstructions = orderInstructions.filter((i: any) => i.action === 'lossen');
        
        const getLocationLabel = (loc: string) => {
          if (loc === 'winkel') return 'Lossen winkel';
          if (loc === 'loods') return 'Lossen loods';
          if (loc === 'blijft_staan') return 'Blijft staan';
          return loc;
        };

        // Group by assignment to handle combi splits
        const byAssignment = new Map<string, any[]>();
        for (const instr of lossenInstructions) {
          const list = byAssignment.get(instr.assignment_id) || [];
          list.push(instr);
          byAssignment.set(instr.assignment_id, list);
        }

        const loadUnloadPlan: DailyLoadStep[] = [];

        for (const [assignmentId, instrs] of byAssignment) {
          const assignment = orderAssignments.find(a => a.id === assignmentId);
          if (!assignment) continue;

          const transportId = assignment.transport_id;
          const combi = combis.find(c => c.id === transportId);

          if (!combi) {
            // Not a combi — show as-is
            for (const instr of instrs) {
              const vi = getVehicleInfo(instr.vehicle_type);
              loadUnloadPlan.push({
                action: instr.action,
                location: getLocationLabel(instr.location),
                transportName: getTransportName(transportId),
                vehicleCount: instr.vehicle_count,
                vehicleType: vi.name,
                vehicleIcon: vi.icon,
              });
            }
            continue;
          }

          // Combi — split between bakwagen and aanhanger
          const bak = bakwagens.find(b => b.id === combi.bakwagenId);
          const ah = aanhangers.find(a => a.id === combi.aanhangerId);
          if (!bak || !ah) {
            // Fallback: show as-is with combi name
            for (const instr of instrs) {
              const vi = getVehicleInfo(instr.vehicle_type);
              loadUnloadPlan.push({
                action: instr.action,
                location: getLocationLabel(instr.location),
                transportName: getTransportName(transportId),
                vehicleCount: instr.vehicle_count,
                vehicleType: vi.name,
                vehicleIcon: vi.icon,
              });
            }
            continue;
          }

          // Calculate total per vehicle type to determine what's on bakwagen vs aanhanger
          const totalPerType = new Map<string, number>();
          for (const instr of instrs) {
            totalPerType.set(
              instr.vehicle_type,
              (totalPerType.get(instr.vehicle_type) || 0) + instr.vehicle_count
            );
          }

          // Bakwagen fills first, overflow to aanhanger
          const remainingOnBak = new Map<string, number>();
          for (const [type, total] of totalPerType) {
            const bakCap = bak.capacity[type as VehicleType] || 0;
            remainingOnBak.set(type, Math.min(total, bakCap));
          }

          // Process each instruction: pull from bakwagen first
          for (const instr of instrs) {
            const vi = getVehicleInfo(instr.vehicle_type);
            const locationLabel = getLocationLabel(instr.location);
            const type = instr.vehicle_type;
            const count = instr.vehicle_count;
            const bakRemain = remainingOnBak.get(type) || 0;

            const fromBak = Math.min(count, bakRemain);
            const fromAh = count - fromBak;
            remainingOnBak.set(type, bakRemain - fromBak);

            if (fromBak > 0) {
              loadUnloadPlan.push({
                action: instr.action,
                location: locationLabel,
                transportName: bak.name.toLowerCase(),
                vehicleCount: fromBak,
                vehicleType: vi.name,
                vehicleIcon: vi.icon,
              });
            }
            if (fromAh > 0) {
              loadUnloadPlan.push({
                action: instr.action,
                location: locationLabel,
                transportName: ah.name.toLowerCase(),
                vehicleCount: fromAh,
                vehicleType: vi.name,
                vehicleIcon: vi.icon,
              });
            }
          }
        }

        return {
          orderId: order.id,
          orderNumber: order.order_number,
          customerName: `${order.first_name} ${order.last_name}`.trim(),
          companyName: order.company_name || undefined,
          vehicleSummary: vehicleSummary || '',
          deliveryLocation: order.start_location,
          pickupLocation: order.end_location,
          notes: order.notes || undefined,
          leveren,
          ophalen,
          loadUnloadPlan,
        };
      });

      // Sort by leveren start time
      blocks.sort((a, b) => {
        const timeA = a.leveren?.time || '99:99';
        const timeB = b.leveren?.time || '99:99';
        return timeA.localeCompare(timeB);
      });

      return blocks;
    },
    enabled: !!date && allTransport.length > 0,
  });
}
