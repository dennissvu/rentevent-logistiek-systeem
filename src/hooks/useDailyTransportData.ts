import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTransport } from '@/context/TransportContext';
import { VehicleType } from '@/data/transportData';

export interface DailyTransportOrder {
  orderId: string;
  orderNumber: string;
  customerName: string;
  segments: ('leveren' | 'ophalen')[];
  vehicleLoad: { type: VehicleType; count: number }[];
  vehicleSummary: string;
  leverenTime: string | null;
  ophalenTime: string | null;
  assignedTransport: {
    segment: 'leveren' | 'ophalen';
    transportId: string;
    transportName: string;
    driverName: string | null;
  }[];
  hasTransport: boolean;
}

interface DbOrder {
  id: string;
  order_number: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  delivery_date: string | null;
  delivery_time: string | null;
  pickup_date: string | null;
  pickup_time: string | null;
  status: string;
  vehicle_types: unknown;
}

interface DbAssignment {
  id: string;
  order_id: string;
  segment: string;
  transport_id: string;
  driver_id: string | null;
  sequence_number: number;
}

export function useDailyTransportData(date: string) {
  const { allTransportMaterials, combis } = useTransport();
  const allTransport = [...allTransportMaterials, ...combis];

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

  // Fetch raw DB records for UUID-based name resolution
  const { data: dbTransport = [] } = useQuery({
    queryKey: ['transport-all-raw-for-daily'],
    queryFn: async () => {
      const [{ data: mats }, { data: combs }] = await Promise.all([
        supabase.from('transport_materials').select('id, name, code'),
        supabase.from('transport_combis').select('id, name, code'),
      ]);
      return [...(mats || []), ...(combs || [])] as { id: string; name: string; code: string }[];
    },
  });

  return useQuery({
    queryKey: ['daily-transport', date, allTransport.length, allDrivers.length, dbTransport.length],
    queryFn: async () => {
      // Fetch orders for the date
      const { data: allOrders, error: ordersErr } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['bevestigd', 'optie']);
      if (ordersErr) throw ordersErr;

      const orders = (allOrders as DbOrder[] || []).filter(o => {
        const deliveryDate = o.delivery_date || o.start_date;
        const pickupDate = o.pickup_date || o.end_date;
        return deliveryDate === date || pickupDate === date;
      });

      if (orders.length === 0) return [];

      const orderIds = orders.map(o => o.id);

      // Fetch assignments
      const { data: assignments, error: assignErr } = await supabase
        .from('order_transport_assignments')
        .select('*')
        .in('order_id', orderIds)
        .order('sequence_number');
      if (assignErr) throw assignErr;

      const assignmentsByOrder = new Map<string, DbAssignment[]>();
      for (const a of (assignments as DbAssignment[] || [])) {
        if (!assignmentsByOrder.has(a.order_id)) assignmentsByOrder.set(a.order_id, []);
        assignmentsByOrder.get(a.order_id)!.push(a);
      }

      const driverMap = new Map(allDrivers.map(d => [d.id, d.name]));
      
      // Build transport name map from both code-based and UUID-based lookups
      const transportNameMap = new Map<string, string>();
      for (const t of allTransport) transportNameMap.set(t.id, t.name);
      for (const t of dbTransport) {
        transportNameMap.set(t.id, t.name);
        transportNameMap.set(t.code, t.name);
      }

      const result: DailyTransportOrder[] = orders.map(order => {
        const segments: ('leveren' | 'ophalen')[] = [];
        const deliveryDate = order.delivery_date || order.start_date;
        const pickupDate = order.pickup_date || order.end_date;
        if (deliveryDate === date) segments.push('leveren');
        if (pickupDate === date) segments.push('ophalen');

        const rawVehicleTypes = order.vehicle_types as { type: string; count: number }[] | null;
        const vehicleLoad = Array.isArray(rawVehicleTypes)
          ? rawVehicleTypes.map(v => ({ type: v.type as VehicleType, count: v.count }))
          : [];

        const vehicleSummary = vehicleLoad
          .map(v => `${v.count}× ${v.type}`)
          .join(', ');

        const orderAssignments = assignmentsByOrder.get(order.id) || [];
        const assignedTransport = orderAssignments
          .filter(a => segments.includes(a.segment as 'leveren' | 'ophalen'))
          .map(a => ({
            segment: a.segment as 'leveren' | 'ophalen',
            transportId: a.transport_id,
            transportName: transportNameMap.get(a.transport_id) || a.transport_id,
            driverName: a.driver_id ? (driverMap.get(a.driver_id) || null) : null,
          }));

        const leverenTime = deliveryDate === date
          ? (order.delivery_time || order.start_time)?.slice(0, 5)
          : null;
        const ophalenTime = pickupDate === date
          ? (order.pickup_time || order.end_time)?.slice(0, 5)
          : null;

        return {
          orderId: order.id,
          orderNumber: order.order_number,
          customerName: order.company_name || `${order.first_name} ${order.last_name}`,
          segments,
          vehicleLoad,
          vehicleSummary,
          leverenTime,
          ophalenTime,
          assignedTransport,
          hasTransport: segments.every(seg => 
            assignedTransport.some(a => a.segment === seg)
          ),
        };
      });

      // Sort: unassigned first, then by time
      result.sort((a, b) => {
        if (a.hasTransport !== b.hasTransport) return a.hasTransport ? 1 : -1;
        const timeA = a.leverenTime || a.ophalenTime || '99:99';
        const timeB = b.leverenTime || b.ophalenTime || '99:99';
        return timeA.localeCompare(timeB);
      });

      return result;
    },
    enabled: allTransport.length > 0,
  });
}
