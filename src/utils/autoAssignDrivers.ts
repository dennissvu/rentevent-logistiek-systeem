import { supabase } from '@/integrations/supabase/client';
import { getDayOfWeek } from '@/hooks/useDriverSchedules';

export interface UnassignedSlot {
  assignmentId: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  segment: 'leveren' | 'ophalen';
  time: string;
  transportId: string;
  transportName: string;
  requiresTrailer: boolean;
  currentDriverId?: string | null;
}

export interface AvailableDriver {
  id: string;
  name: string;
  canDriveTrailer: boolean;
  workStart: string | null;
  workEnd: string | null;
  assignedSlots: string[]; // times already assigned
}

export interface DriverSuggestion {
  slot: UnassignedSlot;
  suggestedDriverId: string | null;
  suggestedDriverName: string | null;
  alternativeDriverIds: string[];
  reason: string;
}

export interface OrderWithoutTransport {
  orderId: string;
  orderNumber: string;
  customerName: string;
  segments: ('leveren' | 'ophalen')[];
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
}

interface DbAssignment {
  id: string;
  order_id: string;
  segment: string;
  transport_id: string;
  driver_id: string | null;
  sequence_number: number;
}

interface DbDriver {
  id: string;
  name: string;
  can_drive_trailer: boolean;
  is_available: boolean;
}

interface DbWeeklySchedule {
  driver_id: string;
  day_of_week: number;
  is_working: boolean;
  start_time_1: string | null;
  end_time_1: string | null;
}

interface DbException {
  driver_id: string;
  exception_type: string;
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
}

export async function calculateAutoAssignments(
  date: string,
  transportNames: Map<string, string>,
  reassignAll: boolean = false
): Promise<{ suggestions: DriverSuggestion[]; availableDrivers: AvailableDriver[]; ordersWithoutTransport: OrderWithoutTransport[] }> {
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

  if (orders.length === 0) return { suggestions: [], availableDrivers: [], ordersWithoutTransport: [] };

  const orderIds = orders.map(o => o.id);
  const orderMap = new Map(orders.map(o => [o.id, o]));

  // 2. Fetch all assignments for these orders
  const { data: assignments, error: assignErr } = await supabase
    .from('order_transport_assignments')
    .select('*')
    .in('order_id', orderIds)
    .order('sequence_number');
  if (assignErr) throw assignErr;

  // 3. Detect orders without any transport assignments
  const assignmentsByOrder = new Map<string, DbAssignment[]>();
  for (const a of (assignments as DbAssignment[] || [])) {
    if (!assignmentsByOrder.has(a.order_id)) assignmentsByOrder.set(a.order_id, []);
    assignmentsByOrder.get(a.order_id)!.push(a);
  }

  const ordersWithoutTransport: OrderWithoutTransport[] = [];
  for (const order of orders) {
    const orderAssignments = assignmentsByOrder.get(order.id) || [];
    if (orderAssignments.length === 0) {
      const segments: ('leveren' | 'ophalen')[] = [];
      const deliveryDate = order.delivery_date || order.start_date;
      const pickupDate = order.pickup_date || order.end_date;
      if (deliveryDate === date) segments.push('leveren');
      if (pickupDate === date) segments.push('ophalen');
      ordersWithoutTransport.push({
        orderId: order.id,
        orderNumber: order.order_number,
        customerName: order.company_name || `${order.first_name} ${order.last_name}`,
        segments,
      });
    }
  }

  // 4. Find unassigned slots (have transport but no driver)
  const unassigned: UnassignedSlot[] = [];
  const alreadyAssigned: { driverId: string; time: string }[] = [];

  for (const a of (assignments as DbAssignment[] || [])) {
    const order = orderMap.get(a.order_id);
    if (!order) continue;

    const isLeveren = a.segment === 'leveren';
    const time = isLeveren
      ? (order.delivery_time || order.start_time)?.slice(0, 5)
      : (order.pickup_time || order.end_time)?.slice(0, 5);
    
    const segmentDate = isLeveren
      ? (order.delivery_date || order.start_date)
      : (order.pickup_date || order.end_date);
    if (segmentDate !== date) continue;

    const requiresTrailer = a.transport_id.startsWith('combi-');

    if (!a.driver_id || reassignAll) {
      unassigned.push({
        assignmentId: a.id,
        orderId: order.id,
        orderNumber: order.order_number,
        customerName: order.company_name || `${order.first_name} ${order.last_name}`,
        segment: a.segment as 'leveren' | 'ophalen',
        time,
        transportId: a.transport_id,
        transportName: transportNames.get(a.transport_id) || a.transport_id,
        requiresTrailer,
        currentDriverId: a.driver_id,
      });
    } else {
      alreadyAssigned.push({ driverId: a.driver_id, time });
    }
  }

  if (unassigned.length === 0) return { suggestions: [], availableDrivers: [], ordersWithoutTransport };

  // 4. Fetch drivers
  const { data: drivers, error: driverErr } = await supabase
    .from('drivers')
    .select('*')
    .eq('is_active', true)
    .eq('is_available', true);
  if (driverErr) throw driverErr;

  // 5. Fetch weekly schedules for the day of week
  const dayOfWeek = getDayOfWeek(date);
  const { data: schedules } = await supabase
    .from('driver_weekly_schedules')
    .select('*')
    .eq('day_of_week', dayOfWeek);

  // 6. Fetch exceptions for this date
  const { data: exceptions } = await supabase
    .from('driver_schedule_exceptions')
    .select('*')
    .eq('exception_date', date);

  const scheduleMap = new Map((schedules as DbWeeklySchedule[] || []).map(s => [s.driver_id, s]));
  const exceptionMap = new Map((exceptions as DbException[] || []).map(e => [e.driver_id, e]));

  // 7. Build available drivers list
  const availableDrivers: AvailableDriver[] = [];

  for (const driver of (drivers as DbDriver[] || [])) {
    const exception = exceptionMap.get(driver.id);
    const schedule = scheduleMap.get(driver.id);

    let isAvailable = true;
    let workStart: string | null = '07:00';
    let workEnd: string | null = '16:00';

    // Check exception first (overrides weekly schedule)
    if (exception) {
      isAvailable = exception.is_available;
      workStart = exception.start_time?.slice(0, 5) || null;
      workEnd = exception.end_time?.slice(0, 5) || null;
    } else if (schedule) {
      isAvailable = schedule.is_working;
      workStart = schedule.start_time_1?.slice(0, 5) || '07:00';
      workEnd = schedule.end_time_1?.slice(0, 5) || '16:00';
    }

    if (!isAvailable) continue;

    const assignedTimes = alreadyAssigned
      .filter(a => a.driverId === driver.id)
      .map(a => a.time);

    availableDrivers.push({
      id: driver.id,
      name: driver.name,
      canDriveTrailer: driver.can_drive_trailer,
      workStart,
      workEnd,
      assignedSlots: assignedTimes,
    });
  }

  // 8. Group unassigned slots by order to enable smart pairing
  const slotsByOrder = new Map<string, UnassignedSlot[]>();
  for (const slot of unassigned) {
    if (!slotsByOrder.has(slot.orderId)) slotsByOrder.set(slot.orderId, []);
    slotsByOrder.get(slot.orderId)!.push(slot);
  }

  // 9. Sort orders: multi-segment orders first (so we can pair them), then by earliest time
  const orderGroups = Array.from(slotsByOrder.entries()).sort((a, b) => {
    // Prioritize orders with multiple segments (leveren + ophalen)
    if (a[1].length !== b[1].length) return b[1].length - a[1].length;
    // Then by earliest time
    const aTime = a[1].reduce((min, s) => s.time < min ? s.time : min, '99:99');
    const bTime = b[1].reduce((min, s) => s.time < min ? s.time : min, '99:99');
    return aTime.localeCompare(bTime);
  });

  // 10. Generate suggestions with order-grouping priority
  const assignedInThisRun = new Map<string, string[]>(); // driverId -> times[]
  const assignedDriverPerOrder = new Map<string, string>(); // orderId -> driverId (for pairing)
  const suggestions: DriverSuggestion[] = [];

  for (const [orderId, slots] of orderGroups) {
    // Sort slots within order: leveren first so we pick a driver, then ophalen reuses them
    slots.sort((a, b) => {
      if (a.segment === 'leveren' && b.segment === 'ophalen') return -1;
      if (a.segment === 'ophalen' && b.segment === 'leveren') return 1;
      return a.time.localeCompare(b.time);
    });

    for (const slot of slots) {
      const candidates = availableDrivers.filter(driver => {
        // Check trailer capability
        if (slot.requiresTrailer && !driver.canDriveTrailer) return false;

        // Check if driver is within work hours
        if (driver.workStart && slot.time < driver.workStart) return false;
        if (driver.workEnd && slot.time > driver.workEnd) return false;

        // Check existing assignments (from DB + this run)
        const existingTimes = [...driver.assignedSlots, ...(assignedInThisRun.get(driver.id) || [])];
        
        // Simple conflict check: same exact time = conflict
        if (existingTimes.includes(slot.time)) return false;

        return true;
      });

      // Smart sorting: prefer the driver already assigned to the other segment of this order
      const pairedDriverId = assignedDriverPerOrder.get(orderId);

      candidates.sort((a, b) => {
        // 1. Strongly prefer driver already assigned to same order (cost saving!)
        const aIsPaired = a.id === pairedDriverId ? 1 : 0;
        const bIsPaired = b.id === pairedDriverId ? 1 : 0;
        if (aIsPaired !== bIsPaired) return bIsPaired - aIsPaired;

        // 2. Then prefer drivers with fewer total assignments (load balancing)
        const aLoad = a.assignedSlots.length + (assignedInThisRun.get(a.id)?.length || 0);
        const bLoad = b.assignedSlots.length + (assignedInThisRun.get(b.id)?.length || 0);
        return aLoad - bLoad;
      });

      const best = candidates[0] || null;

      if (best) {
        // Track this assignment
        if (!assignedInThisRun.has(best.id)) {
          assignedInThisRun.set(best.id, []);
        }
        assignedInThisRun.get(best.id)!.push(slot.time);

        // Track driver per order for pairing
        if (!assignedDriverPerOrder.has(orderId)) {
          assignedDriverPerOrder.set(orderId, best.id);
        }
      }

      let reason = '';
      if (!best) {
        if (slot.requiresTrailer) {
          reason = 'Geen beschikbare chauffeur met AH-bevoegdheid';
        } else {
          reason = 'Geen beschikbare chauffeur gevonden';
        }
      } else if (best.id === pairedDriverId) {
        reason = 'Zelfde chauffeur voor leveren & ophalen (kostenbesparing)';
      } else {
        const load = best.assignedSlots.length + (assignedInThisRun.get(best.id)?.length || 0);
        reason = load <= 1 ? 'Minste toewijzingen' : `${load} toewijzingen totaal`;
      }

      suggestions.push({
        slot,
        suggestedDriverId: best?.id || null,
        suggestedDriverName: best?.name || null,
        alternativeDriverIds: candidates.slice(1).map(c => c.id),
        reason,
      });
    }
  }

  return { suggestions, availableDrivers, ordersWithoutTransport };
}

export async function applyDriverAssignments(
  assignments: { assignmentId: string; driverId: string }[]
): Promise<void> {
  for (const { assignmentId, driverId } of assignments) {
    const { error } = await supabase
      .from('order_transport_assignments')
      .update({ driver_id: driverId })
      .eq('id', assignmentId);
    if (error) throw error;
  }
}
