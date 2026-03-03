import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { vehicleTypes as vehicleTypesList } from '@/data/transportData';
import { bakwagens, aanhangers, combis } from '@/data/transportData';
import { calculateDriverScheduleSync, needsTrailer, estimateLoadUnloadTime } from '@/utils/driverScheduleCalculator';

export interface ChauffeurTrip {
  assignmentId: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  segment: 'leveren' | 'ophalen';
  customerTime: string;
  workStart: string;
  workEnd: string;
  location: string;
  transportName: string;
  vehicleSummary: string;
  totalVehicles: number;
  tripStatus: string;
  coDrivers: string[];
  loadSteps: {
    action: string;
    location: string;
    vehicleCount: number;
    vehicleType: string;
    transportName: string;
  }[];
}

const allTransport = [...bakwagens, ...aanhangers, ...combis];

function getTransportName(id: string): string {
  const t = allTransport.find(t => t.id === id);
  return t?.name || id;
}

export function useChauffeurToday(driverId: string | null, date?: string) {
  const selectedDate = date || format(new Date(), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['chauffeur-today', driverId, selectedDate],
    queryFn: async (): Promise<ChauffeurTrip[]> => {
      if (!driverId) return [];

      // 1. Get all assignments for this driver
      const { data: allAssignments, error: ae } = await supabase
        .from('order_transport_assignments')
        .select('*')
        .eq('driver_id', driverId);
      if (ae) throw ae;
      if (!allAssignments || allAssignments.length === 0) return [];

      const orderIds = [...new Set(allAssignments.map(a => a.order_id))];

      // 2. Fetch orders
      const { data: orders, error: oe } = await supabase
        .from('orders')
        .select('*')
        .in('id', orderIds)
        .in('status', ['bevestigd', 'optie']);
      if (oe) throw oe;

      // Filter for today using logistic dates
      const todayOrders = (orders || []).filter(o => {
        const effectiveDeliveryDate = (o as any).delivery_date || o.start_date;
        const effectivePickupDate = (o as any).pickup_date || o.end_date;
        return effectiveDeliveryDate === selectedDate || effectivePickupDate === selectedDate;
      });

      if (todayOrders.length === 0) return [];

      const todayOrderIds = todayOrders.map(o => o.id);
      const todayAssignments = allAssignments.filter(a => todayOrderIds.includes(a.order_id));

      // 3. Fetch co-drivers
      const { data: allOrderAssignments } = await supabase
        .from('order_transport_assignments')
        .select('*')
        .in('order_id', todayOrderIds);

      // 4. Fetch driver names
      const driverIds = [...new Set((allOrderAssignments || []).map(a => a.driver_id).filter(Boolean))];
      const { data: driverData } = await supabase
        .from('drivers')
        .select('id, name')
        .in('id', driverIds as string[]);
      const driverMap = new Map((driverData || []).map(d => [d.id, d.name]));

      // 5. Fetch load/unload instructions
      const { data: instructions } = await (supabase as any)
        .from('order_load_unload_instructions')
        .select('*')
        .in('order_id', todayOrderIds)
        .order('sequence_number');

      // 6. Build trips
      const trips: ChauffeurTrip[] = [];

      for (const assignment of todayAssignments) {
        const order = todayOrders.find(o => o.id === assignment.order_id);
        if (!order) continue;

        const isLeveren = assignment.segment === 'leveren';
        const effectiveDeliveryDate = (order as any).delivery_date || order.start_date;
        const effectivePickupDate = (order as any).pickup_date || order.end_date;
        const isOnDate = isLeveren
          ? effectiveDeliveryDate === selectedDate
          : effectivePickupDate === selectedDate;
        if (!isOnDate) continue;

        const customerTime = isLeveren
          ? ((order as any).delivery_time || order.start_time)?.slice(0, 5)
          : ((order as any).pickup_time || order.end_time)?.slice(0, 5);
        const location = isLeveren ? order.start_location : order.end_location;

        const vTypes = (order.vehicle_types as { type: string; count: number }[] | null) || [];
        const totalVehicles = vTypes.reduce((sum, v) => sum + v.count, 0);
        const vehicleSummary = vTypes
          .map(v => {
            const vt = vehicleTypesList.find(vt => vt.id === v.type);
            return `${v.count}x ${vt?.name || v.type}`;
          })
          .join(', ');

        // Work times
        const hasTrailer = needsTrailer(assignment.transport_id);
        const syncCalc = calculateDriverScheduleSync({
          customerStartTime: customerTime,
          vehicleCount: totalVehicles,
          needsTrailer: hasTrailer,
          segment: isLeveren ? 'leveren' : 'ophalen',
        });
        const workStart = syncCalc.driverStartTime;

        // Work end estimate
        const DRIVE_MINUTES = 30;
        const loadTime = estimateLoadUnloadTime({
          segment: isLeveren ? 'leveren' : 'ophalen',
          vehicleCount: totalVehicles,
          hasTrailer,
        });
        const [h, m] = customerTime.split(':').map(Number);
        const endDate = new Date(2000, 0, 1, h, m);
        endDate.setMinutes(endDate.getMinutes() + loadTime + DRIVE_MINUTES + (hasTrailer ? 22 : 0));
        const workEnd = endDate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });

        // Co-drivers
        const coDrivers = (allOrderAssignments || [])
          .filter(a => a.order_id === assignment.order_id && a.segment === assignment.segment && a.driver_id !== driverId && a.driver_id)
          .map(a => driverMap.get(a.driver_id!) || 'Onbekend');

        // Load steps
        const myInstructions = (instructions || []).filter(
          (i: any) => i.order_id === assignment.order_id && i.assignment_id === assignment.id
        );
        const loadSteps = (myInstructions as any[]).map(i => ({
          action: i.action,
          location: i.location,
          vehicleCount: i.vehicle_count,
          vehicleType: vehicleTypesList.find(v => v.id === i.vehicle_type)?.name || i.vehicle_type,
          transportName: i.target_transport_id
            ? getTransportName(i.target_transport_id)
            : getTransportName(assignment.transport_id),
        }));

        trips.push({
          assignmentId: assignment.id,
          orderId: order.id,
          orderNumber: order.order_number,
          customerName: order.company_name || `${order.first_name} ${order.last_name}`,
          segment: assignment.segment as 'leveren' | 'ophalen',
          customerTime,
          workStart,
          workEnd,
          location,
          transportName: getTransportName(assignment.transport_id),
          vehicleSummary,
          totalVehicles,
          tripStatus: (assignment as any).trip_status || 'gepland',
          coDrivers: [...new Set(coDrivers)],
          loadSteps,
        });
      }

      // Sort by work start
      trips.sort((a, b) => a.workStart.localeCompare(b.workStart));
      return trips;
    },
    enabled: !!driverId,
    refetchInterval: 30000, // Auto-refresh every 30s
  });
}
