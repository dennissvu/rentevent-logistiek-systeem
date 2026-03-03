import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTransport } from '@/context/TransportContext';
import { vehicleTypes as vehicleTypesList } from '@/data/transportData';

export interface DriverDayAssignment {
  driverId: string;
  driverName: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  segment: 'leveren' | 'ophalen';
  time: string;
  location: string;
  transportName: string;
  vehicleSummary: string;
  tripStatus: string;
}

export interface DriverDaySummary {
  driverId: string;
  driverName: string;
  canDriveTrailer: boolean;
  assignments: DriverDayAssignment[];
  totalOrders: number;
  workStart: string;
  workEnd: string;
  isFree: boolean;
}

export function useDriverDayOverview(date: string) {
  const { allTransportMaterials, combis } = useTransport();
  const allTransport = [...allTransportMaterials, ...combis];

  return useQuery({
    queryKey: ['driver-day-overview', date, allTransport.length],
    queryFn: async (): Promise<DriverDaySummary[]> => {
      // 1. Fetch all active drivers
      const { data: drivers, error: driverError } = await supabase
        .from('drivers')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (driverError) throw driverError;

      // 2. Fetch all orders (we need to check logistic dates)
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

      if (filteredOrders.length === 0) {
        return (drivers || []).map(d => ({
          driverId: d.id,
          driverName: d.name,
          canDriveTrailer: d.can_drive_trailer,
          assignments: [],
          totalOrders: 0,
          workStart: '',
          workEnd: '',
          isFree: true,
        }));
      }

      const orderIds = filteredOrders.map(o => o.id);

      // 3. Fetch assignments
      const { data: assignments, error: assignError } = await supabase
        .from('order_transport_assignments')
        .select('*')
        .in('order_id', orderIds)
        .order('sequence_number');
      if (assignError) throw assignError;

      const orderMap = new Map(filteredOrders.map(o => [o.id, o]));

      const getTransportName = (id: string) => {
        const t = allTransport.find(t => t.id === id);
        return t?.name || id;
      };

      // 4. Build per-driver summaries
      // First, determine which segments are active per order on this date
      const activeSegmentsByOrder = new Map<string, Set<string>>();
      for (const order of filteredOrders) {
        const segs = new Set<string>();
        const effectiveDeliveryDate = (order as any).delivery_date || order.start_date;
        const effectivePickupDate = (order as any).pickup_date || order.end_date;
        if (effectiveDeliveryDate === date) segs.add('leveren');
        if (effectivePickupDate === date) segs.add('ophalen');
        activeSegmentsByOrder.set(order.id, segs);
      }

      const summaries: DriverDaySummary[] = (drivers || []).map(driver => {
        // Only include assignments for segments active on this date
        const driverAssignments = (assignments || []).filter(a => {
          if (a.driver_id !== driver.id) return false;
          const activeSegs = activeSegmentsByOrder.get(a.order_id);
          return activeSegs?.has(a.segment) ?? false;
        });

        const mapped: DriverDayAssignment[] = driverAssignments.map(a => {
          const order = orderMap.get(a.order_id);
          if (!order) return null;

          const isLeveren = a.segment === 'leveren';
          // Use logistic times if available
          const time = isLeveren 
            ? ((order as any).delivery_time || order.start_time)?.slice(0, 5)
            : ((order as any).pickup_time || order.end_time)?.slice(0, 5);
          const location = isLeveren ? order.start_location : order.end_location;
          const vTypes = (order.vehicle_types as { type: string; count: number }[] | null) || [];
          const vehicleSummary = vTypes
            .map(v => {
              const vt = vehicleTypesList.find(vt => vt.id === v.type);
              return `${v.count}x ${vt?.name || v.type}`;
            })
            .join(', ');

          return {
            driverId: driver.id,
            driverName: driver.name,
            orderId: order.id,
            orderNumber: order.order_number,
            customerName: order.company_name || `${order.first_name} ${order.last_name}`,
            segment: a.segment as 'leveren' | 'ophalen',
            time,
            location,
            transportName: getTransportName(a.transport_id),
            vehicleSummary,
            tripStatus: (a as any).trip_status || 'gepland',
          };
        }).filter(Boolean) as DriverDayAssignment[];

        // Sort by time
        mapped.sort((a, b) => a.time.localeCompare(b.time));

        const uniqueOrders = new Set(mapped.map(a => a.orderId));
        const times = mapped.map(a => a.time).filter(Boolean).sort();

        return {
          driverId: driver.id,
          driverName: driver.name,
          canDriveTrailer: driver.can_drive_trailer,
          assignments: mapped,
          totalOrders: uniqueOrders.size,
          workStart: times[0] || '',
          workEnd: times[times.length - 1] || '',
          isFree: mapped.length === 0,
        };
      });

      // Sort: busy drivers first, then free
      summaries.sort((a, b) => {
        if (a.isFree !== b.isFree) return a.isFree ? 1 : -1;
        return a.workStart.localeCompare(b.workStart);
      });

      return summaries;
    },
    enabled: !!date && allTransport.length > 0,
  });
}
