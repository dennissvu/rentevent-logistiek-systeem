import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { optimizeRoute, type RouteOrder, type OptimizedRoute } from '@/utils/routeOptimizer';
import { needsTrailer } from '@/utils/driverScheduleCalculator';
import type { DriverTrip } from '@/hooks/useDriverAssignments';

export type { OptimizedRoute, RouteOrder };

/**
 * Hook voor het berekenen van de optimale routevolgorde
 * voor een chauffeur op een specifieke datum.
 */
export function useRouteOptimization() {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [result, setResult] = useState<OptimizedRoute | null>(null);
  const [error, setError] = useState<string | null>(null);

  const optimize = useCallback(async (
    driverId: string,
    date: string,
    trips: DriverTrip[],
  ) => {
    setIsOptimizing(true);
    setError(null);
    setResult(null);

    try {
      // Convert trips to RouteOrder format
      // Each trip can have leveren and/or ophalen segments
      const orderIds = trips.map(t => t.orderId);

      // Fetch assignments for this driver + these orders
      const { data: assignments, error: assignErr } = await supabase
        .from('order_transport_assignments')
        .select('*')
        .eq('driver_id', driverId)
        .in('order_id', orderIds);

      if (assignErr) throw assignErr;

      // Fetch order details
      const { data: orders, error: ordersErr } = await supabase
        .from('orders')
        .select('*')
        .in('id', orderIds);

      if (ordersErr) throw ordersErr;

      if (!assignments?.length || !orders?.length) {
        setError('Geen toewijzingen gevonden');
        return;
      }

      const orderMap = new Map(orders.map(o => [o.id, o]));

      // Build RouteOrders
      const routeOrders: RouteOrder[] = [];

      for (const assignment of assignments) {
        const order = orderMap.get(assignment.order_id);
        if (!order) continue;

        const segment = assignment.segment as 'leveren' | 'ophalen';
        const isLeveren = segment === 'leveren';

        // Use logistic dates with fallback to booking dates
        const effectiveDeliveryDate = (order as any).delivery_date || order.start_date;
        const effectivePickupDate = (order as any).pickup_date || order.end_date;
        if (isLeveren && effectiveDeliveryDate !== date) continue;
        if (!isLeveren && effectivePickupDate !== date) continue;

        // Use logistic times with fallback to booking times
        const effectiveDeliveryTime = ((order as any).delivery_time || order.start_time)?.slice(0, 5) || '09:00';
        const effectivePickupTime = ((order as any).pickup_time || order.end_time)?.slice(0, 5) || '17:00';

        const vehicleTypesData = (order.vehicle_types as { type: string; count: number }[] | null) || [];
        const totalVehicles = vehicleTypesData.reduce((s, v) => s + v.count, 0);

        // Count assignments for this segment to divide vehicles
        const segCount = assignments.filter(
          a => a.order_id === order.id && a.segment === segment,
        ).length;
        const vehicleCount = Math.ceil(totalVehicles / Math.max(segCount, 1));

        routeOrders.push({
          orderId: order.id,
          orderNumber: order.order_number,
          customerName: `${order.first_name} ${order.last_name}`.trim(),
          deliveryAddress: order.start_location,
          pickupAddress: order.end_location,
          customerStartTime: effectiveDeliveryTime,
          customerEndTime: effectivePickupTime,
          startDate: order.start_date,
          endDate: order.end_date,
          vehicleCount,
          transportId: assignment.transport_id,
          hasTrailer: needsTrailer(assignment.transport_id),
          assignmentId: assignment.id,
          segment,
          notes: order.notes || undefined,
        });
      }

      if (routeOrders.length === 0) {
        setError('Geen routes gevonden voor deze datum');
        return;
      }

      const optimized = await optimizeRoute(routeOrders, date);
      setResult(optimized);
    } catch (err) {
      console.error('Route optimization error:', err);
      setError('Fout bij berekenen optimale route');
    } finally {
      setIsOptimizing(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    optimize,
    clear,
    isOptimizing,
    result,
    error,
  };
}
