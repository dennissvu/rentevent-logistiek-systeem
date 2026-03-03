import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RouteSuggestion {
  driverId: string;
  driverName: string;
  routeDate: string;
  existingOrderIds: string[];
  existingOrderNumbers: string[];
  existingSegments: string[];
  transportIds: string[];
  reason: string; // Beschrijving waarom deze combinatie voorgesteld wordt
}

/**
 * Hook die suggesties genereert voor het combineren van een order met bestaande chauffeur-routes.
 * 
 * Logica:
 * - Check alle bevestigde chauffeur-toewijzingen op dezelfde datum(s) als de order
 * - Groepeer per chauffeur wat ze al rijden die dag
 * - Retourneer suggesties met context
 */
export function useRouteSuggestions(params: {
  orderStartDate?: string;
  orderEndDate?: string;
  excludeOrderId?: string; // Huidig order uitsluiten
}) {
  const { orderStartDate, orderEndDate, excludeOrderId } = params;

  return useQuery({
    queryKey: ['route-suggestions', orderStartDate, orderEndDate, excludeOrderId],
    queryFn: async (): Promise<RouteSuggestion[]> => {
      if (!orderStartDate) return [];

      // Relevante datums: start_date (leveren) en end_date (ophalen)
      const dates = [orderStartDate];
      if (orderEndDate && orderEndDate !== orderStartDate) {
        dates.push(orderEndDate);
      }

      // Haal alle assignments op voor orders op deze datums
      // We moeten orders ophalen die op deze datums leveren OF ophalen
      const { data: relevantOrders, error: ordersErr } = await supabase
        .from('orders')
        .select('id, order_number, start_date, end_date, start_location, end_location')
        .eq('status', 'bevestigd')
        .or(
          dates.map(d => `start_date.eq.${d},end_date.eq.${d}`).join(',')
        );

      if (ordersErr) throw ordersErr;
      if (!relevantOrders?.length) return [];

      const orderIds = relevantOrders
        .filter(o => o.id !== excludeOrderId)
        .map(o => o.id);

      if (orderIds.length === 0) return [];

      // Haal assignments op voor deze orders
      const { data: assignments, error: assignErr } = await supabase
        .from('order_transport_assignments')
        .select('*')
        .in('order_id', orderIds);

      if (assignErr) throw assignErr;
      if (!assignments?.length) return [];

      // Filter assignments die een driver_id hebben
      const assignedAssignments = assignments.filter(a => a.driver_id);
      if (assignedAssignments.length === 0) return [];

      // Haal driver namen op
      const driverIds = [...new Set(assignedAssignments.map(a => a.driver_id!))];
      const { data: drivers } = await supabase
        .from('drivers')
        .select('id, name')
        .in('id', driverIds);

      const driverMap = new Map((drivers || []).map(d => [d.id, d.name]));
      const orderMap = new Map(relevantOrders.map(o => [o.id, o]));

      // Groepeer per chauffeur per datum
      const driverDateMap = new Map<string, {
        driverId: string;
        date: string;
        orderIds: Set<string>;
        orderNumbers: string[];
        segments: Set<string>;
        transportIds: Set<string>;
      }>();

      for (const a of assignedAssignments) {
        const order = orderMap.get(a.order_id);
        if (!order) continue;

        // Bepaal welke datum relevant is voor dit segment
        const date = a.segment === 'leveren' ? order.start_date : order.end_date;
        if (!dates.includes(date)) continue;

        const key = `${a.driver_id}-${date}`;
        const existing = driverDateMap.get(key) || {
          driverId: a.driver_id!,
          date,
          orderIds: new Set<string>(),
          orderNumbers: [],
          segments: new Set<string>(),
          transportIds: new Set<string>(),
        };

        if (!existing.orderIds.has(a.order_id)) {
          existing.orderIds.add(a.order_id);
          existing.orderNumbers.push(order.order_number);
        }
        existing.segments.add(a.segment);
        existing.transportIds.add(a.transport_id);
        driverDateMap.set(key, existing);
      }

      // Maak suggesties
      const suggestions: RouteSuggestion[] = [];
      for (const [, group] of driverDateMap) {
        const driverName = driverMap.get(group.driverId) || 'Onbekend';
        const segmentList = [...group.segments];
        const segmentText = segmentList.includes('leveren') && segmentList.includes('ophalen')
          ? 'leveren en ophalen'
          : segmentList.includes('leveren')
            ? 'leveren'
            : 'ophalen';

        suggestions.push({
          driverId: group.driverId,
          driverName,
          routeDate: group.date,
          existingOrderIds: [...group.orderIds],
          existingOrderNumbers: group.orderNumbers,
          existingSegments: segmentList,
          transportIds: [...group.transportIds],
          reason: `${driverName} rijdt al ${group.orderNumbers.length} ${group.orderNumbers.length === 1 ? 'order' : 'orders'} (${segmentText}) op ${group.date}`,
        });
      }

      return suggestions.sort((a, b) => a.routeDate.localeCompare(b.routeDate));
    },
    enabled: !!orderStartDate,
  });
}

/**
 * Hook die alle ontkoppelde orders vindt die gecombineerd zouden kunnen worden
 * met bestaande chauffeur-routes.
 * 
 * Retourneert een lijst van orders die nog geen chauffeur hebben maar
 * op dezelfde dag als een bestaande route vallen.
 */
export function useUnassignedOrderSuggestions() {
  return useQuery({
    queryKey: ['unassigned-order-suggestions'],
    queryFn: async () => {
      // Haal alle bevestigde orders op die nog geen chauffeur hebben
      const { data: allOrders, error: ordersErr } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'bevestigd');

      if (ordersErr) throw ordersErr;
      if (!allOrders?.length) return [];

      const orderIds = allOrders.map(o => o.id);

      // Haal alle assignments op
      const { data: allAssignments, error: assignErr } = await supabase
        .from('order_transport_assignments')
        .select('*')
        .in('order_id', orderIds);

      if (assignErr) throw assignErr;

      // Bepaal welke orders een chauffeur hebben en welke niet
      const assignmentsByOrder = new Map<string, typeof allAssignments>();
      for (const a of (allAssignments || [])) {
        const existing = assignmentsByOrder.get(a.order_id) || [];
        existing.push(a);
        assignmentsByOrder.set(a.order_id, existing);
      }

      // Orders zonder chauffeur voor ten minste één segment
      const unassignedOrders = allOrders.filter(order => {
        const assignments = assignmentsByOrder.get(order.id) || [];
        return assignments.some(a => !a.driver_id) || assignments.length === 0;
      });

      // Orders MET chauffeur - per datum groeperen
      const driverDates = new Map<string, {
        driverIds: Set<string>;
        orderCount: number;
      }>();

      for (const a of (allAssignments || [])) {
        if (!a.driver_id) continue;
        const order = allOrders.find(o => o.id === a.order_id);
        if (!order) continue;

        const date = a.segment === 'leveren' ? order.start_date : order.end_date;
        const existing = driverDates.get(date) || { driverIds: new Set(), orderCount: 0 };
        existing.driverIds.add(a.driver_id);
        existing.orderCount++;
        driverDates.set(date, existing);
      }

      // Check welke ontkoppelde orders op dagen vallen waar al chauffeurs rijden
      const suggestions = unassignedOrders
        .filter(order => {
          return driverDates.has(order.start_date) || driverDates.has(order.end_date);
        })
        .map(order => ({
          orderId: order.id,
          orderNumber: order.order_number,
          customerName: order.company_name || `${order.first_name} ${order.last_name}`,
          startDate: order.start_date,
          endDate: order.end_date,
          matchingDates: [
            ...(driverDates.has(order.start_date) ? [order.start_date] : []),
            ...(driverDates.has(order.end_date) && order.end_date !== order.start_date ? [order.end_date] : []),
          ],
          activeDriverCount: Math.max(
            driverDates.get(order.start_date)?.driverIds.size || 0,
            driverDates.get(order.end_date)?.driverIds.size || 0,
          ),
        }));

      return suggestions;
    },
    staleTime: 30000, // 30 seconden cache
  });
}
