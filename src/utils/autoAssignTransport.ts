import { supabase } from '@/integrations/supabase/client';
import { TransportMaterial, CombiTransport, VehicleType } from '@/data/transportData';
import { calculateMixedCapacity, VehicleLoad } from '@/utils/capacityCalculator';

export interface TransportSuggestion {
  orderId: string;
  orderNumber: string;
  customerName: string;
  segments: ('leveren' | 'ophalen')[];
  vehicleLoad: VehicleLoad[];
  suggestedTransportId: string;
  suggestedTransportName: string;
  isReuse: boolean;
  reuseReason?: string;
  utilizationPercent: number;
  isCombi: boolean;
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

/**
 * Calculate transport suggestions for orders that don't have transport assigned yet.
 * 
 * Logic:
 * 1. Find orders on the date without transport assignments
 * 2. Check what transport is already in use on the date
 * 3. For each unassigned order:
 *    a. Try reusing an already-in-use transport (sequential trips)
 *    b. If not, find smallest fitting bakwagen
 *    c. If no bakwagen fits, try combis
 */
export async function calculateTransportSuggestions(
  date: string,
  allTransport: (TransportMaterial | CombiTransport)[]
): Promise<TransportSuggestion[]> {
  // 1. Fetch orders for the date
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

  // 2. Fetch existing assignments
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

  // 3. Find orders without transport for the segments active on this date
  const unassignedOrders = orders.filter(o => {
    const orderAssignments = assignmentsByOrder.get(o.id) || [];
    const deliveryDate = o.delivery_date || o.start_date;
    const pickupDate = o.pickup_date || o.end_date;
    
    // Check which segments are active on this date
    const activeSegments: string[] = [];
    if (deliveryDate === date) activeSegments.push('leveren');
    if (pickupDate === date) activeSegments.push('ophalen');
    
    // Check if ALL active segments have transport assigned
    return activeSegments.some(seg => 
      !orderAssignments.some(a => a.segment === seg)
    );
  });

  // 4. Collect transport already in use on this date
  const transportInUse = new Set<string>();
  for (const [, orderAssigns] of assignmentsByOrder) {
    for (const a of orderAssigns) {
      transportInUse.add(a.transport_id);
    }
  }

  // 5. Separate transport types
  const bakwagens = allTransport.filter(t => 'type' in t && t.type === 'bakwagen') as TransportMaterial[];
  const combis = allTransport.filter(t => 'bakwagenId' in t) as CombiTransport[];

  // Track what we've already suggested to avoid double-booking
  const suggestedTransportIds = new Set<string>();

  // 6. Generate suggestions
  const suggestions: TransportSuggestion[] = [];

  for (const order of unassignedOrders) {
    const rawVehicleTypes = order.vehicle_types as { type: string; count: number }[] | null;
    const vehicleTypes = Array.isArray(rawVehicleTypes) ? rawVehicleTypes : [];
    if (vehicleTypes.length === 0) continue;

    const load: VehicleLoad[] = vehicleTypes.map(v => ({
      type: v.type as VehicleType,
      quantity: v.count,
    }));

    const orderAssignments = assignmentsByOrder.get(order.id) || [];
    
    const allSegments: ('leveren' | 'ophalen')[] = [];
    const deliveryDate = order.delivery_date || order.start_date;
    const pickupDate = order.pickup_date || order.end_date;
    if (deliveryDate === date) allSegments.push('leveren');
    if (pickupDate === date) allSegments.push('ophalen');
    
    // Only include segments that don't have transport yet
    const segments = allSegments.filter(seg => 
      !orderAssignments.some(a => a.segment === seg)
    );

    const customerName = order.company_name || `${order.first_name} ${order.last_name}`;

    // Strategy 1: Try to reuse transport already in use on this date
    let found = false;

    for (const transportId of transportInUse) {
      if (suggestedTransportIds.has(transportId)) continue;
      const transport = allTransport.find(t => t.id === transportId);
      if (!transport) continue;

      const result = calculateMixedCapacity(transport, load);
      if (result.fits) {
        suggestions.push({
          orderId: order.id,
          orderNumber: order.order_number,
          customerName,
          segments,
          vehicleLoad: load,
          suggestedTransportId: transportId,
          suggestedTransportName: transport.name,
          isReuse: true,
          reuseReason: `Zelfde transport als andere rit(ten) vandaag`,
          utilizationPercent: result.usedCapacity,
          isCombi: 'bakwagenId' in transport,
        });
        found = true;
        break;
      }
    }

    if (found) continue;

    // Strategy 2: Find smallest fitting bakwagen (not already suggested)
    const fittingBakwagens = bakwagens
      .filter(b => !suggestedTransportIds.has(b.id))
      .map(b => ({
        transport: b,
        result: calculateMixedCapacity(b, load),
      }))
      .filter(r => r.result.fits)
      .sort((a, b) => b.result.usedCapacity - a.result.usedCapacity); // Highest utilization = smallest that fits

    if (fittingBakwagens.length > 0) {
      const best = fittingBakwagens[0];
      suggestions.push({
        orderId: order.id,
        orderNumber: order.order_number,
        customerName,
        segments,
        vehicleLoad: load,
        suggestedTransportId: best.transport.id,
        suggestedTransportName: best.transport.name,
        isReuse: false,
        utilizationPercent: best.result.usedCapacity,
        isCombi: false,
      });
      suggestedTransportIds.add(best.transport.id);
      continue;
    }

    // Strategy 3: Try combis
    const fittingCombis = combis
      .filter(c => !suggestedTransportIds.has(c.id))
      .map(c => ({
        transport: c,
        result: calculateMixedCapacity(c, load),
      }))
      .filter(r => r.result.fits)
      .sort((a, b) => b.result.usedCapacity - a.result.usedCapacity);

    if (fittingCombis.length > 0) {
      const best = fittingCombis[0];
      suggestions.push({
        orderId: order.id,
        orderNumber: order.order_number,
        customerName,
        segments,
        vehicleLoad: load,
        suggestedTransportId: best.transport.id,
        suggestedTransportName: best.transport.name,
        isReuse: false,
        utilizationPercent: best.result.usedCapacity,
        isCombi: true,
      });
      suggestedTransportIds.add(best.transport.id);
      continue;
    }

    // No fitting transport found — still add to list with empty suggestion
    suggestions.push({
      orderId: order.id,
      orderNumber: order.order_number,
      customerName,
      segments,
      vehicleLoad: load,
      suggestedTransportId: '',
      suggestedTransportName: '',
      isReuse: false,
      utilizationPercent: 0,
      isCombi: false,
    });
  }

  return suggestions;
}

/**
 * Apply transport assignments for multiple orders at once.
 * Creates assignment records for both leveren and ophalen segments.
 */
export async function applyTransportAssignments(
  assignments: { orderId: string; transportId: string; segments: ('leveren' | 'ophalen')[] }[]
): Promise<void> {
  const records = assignments.flatMap(({ orderId, transportId, segments }) =>
    segments.map((segment, i) => ({
      order_id: orderId,
      segment,
      transport_id: transportId,
      sequence_number: 1,
    }))
  );

  if (records.length === 0) return;

  const { error } = await supabase
    .from('order_transport_assignments')
    .insert(records);

  if (error) throw error;
}
