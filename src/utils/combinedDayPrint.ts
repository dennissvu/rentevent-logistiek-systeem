/**
 * Combined day trip print: generates a single A4 document showing all stops
 * for a specific driver on a specific date in sequential order,
 * with drive times calculated between each stop via Google Maps.
 */
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import {
  vehicleTypes as vehicleTypesList,
  combis as combisList,
  bakwagens,
  aanhangers,
} from '@/data/transportData';
import {
  needsTrailer,
  estimateLoadUnloadTime,
  TIME_CONSTANTS,
  LOCATIONS,
  type DriveTimeResult,
} from '@/utils/driverScheduleCalculator';

// ── Types ────────────────────────────────────────────────

interface CombinedStop {
  time: string;
  endTime?: string;
  label: string;
  sublabel?: string;
  detail?: string;
  driveTimeMinutes?: number;
  driveDistanceKm?: number;
  isEstimate?: boolean;
  type: 'start' | 'loods' | 'customer-deliver' | 'customer-pickup' | 'action' | 'return';
  orderNumber?: string;
}

interface CombinedOrderInfo {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  companyName?: string;
  deliveryLocation: string;
  pickupLocation: string;
  customerStartTime: string;
  customerEndTime: string;
  vehiclesSummary: string;
  numberOfPersons: number;
  notes?: string;
  loadSteps: CombinedLoadStep[];
}

interface CombinedLoadStep {
  action: 'laden' | 'lossen';
  location: string;
  vehicleType: string;
  vehicleIcon: string;
  vehicleCount: number;
  transportName: string;
  helperNames: string[];
}

interface CombinedDayPrintData {
  driverName: string;
  date: string;
  totalWorkStart: string;
  totalWorkEnd: string;
  stops: CombinedStop[];
  orders: CombinedOrderInfo[];
  hasTrailer: boolean;
  transportNames: string[];
}

// ── Helpers ──────────────────────────────────────────────

const allTransport = [...bakwagens, ...aanhangers, ...combisList];

function transportName(id: string): string {
  return allTransport.find(t => t.id === id)?.name || id;
}

function adjustTime(timeStr: string, delta: number): string {
  const [h, m] = timeStr.split(':').map(Number);
  const t = ((h * 60 + m + delta) % 1440 + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function fetchDriveTime(
  origin: string,
  destination: string,
  departureTime?: Date,
): Promise<DriveTimeResult> {
  try {
    const { data, error } = await supabase.functions.invoke('calculate-drive-time', {
      body: { origin, destination, departureTime: departureTime?.toISOString() },
    });
    if (error) throw error;
    return data as DriveTimeResult;
  } catch {
    return {
      durationMinutes: 30,
      durationText: '~30 min',
      distanceKm: 25,
      distanceText: '~25 km',
      isEstimate: true,
    };
  }
}

function resolveAddress(location: string): string {
  if (location === 'winkel') return LOCATIONS.winkel;
  if (location === 'loods') return LOCATIONS.loods;
  return location;
}

// ── Data fetching + route building ───────────────────────

interface RawAssignment {
  id: string;
  order_id: string;
  segment: string;
  transport_id: string;
  driver_id: string | null;
  sequence_number: number;
}

interface RawOrder {
  id: string;
  order_number: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  phone: string;
  email: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  start_location: string;
  end_location: string;
  number_of_persons: number;
  vehicle_types: { type: string; count: number }[] | null;
  notes: string | null;
  delivery_date: string | null;
  delivery_time: string | null;
  pickup_date: string | null;
  pickup_time: string | null;
}

interface RawInstruction {
  id: string;
  order_id: string;
  assignment_id: string;
  action: string;
  vehicle_type: string;
  vehicle_count: number;
  location: string;
  sequence_number: number;
  helper_count: number;
  helper_driver_ids: string[] | null;
  target_transport_id: string | null;
  notes: string | null;
  stay_loaded_count: number;
}

/**
 * Fetch and print a combined day trip document for a specific driver on a specific date.
 */
export async function fetchAndPrintCombinedDayTrip(
  driverId: string,
  date: string,
): Promise<void> {
  // 1. Find all assignments for this driver on this date
  // We need to find orders on this date where the driver has assignments
  const { data: ordersOnDate, error: ordersErr } = await supabase
    .from('orders')
    .select('*')
    .in('status', ['bevestigd', 'optie'])
    .or(`start_date.eq.${date},end_date.eq.${date},delivery_date.eq.${date},pickup_date.eq.${date}`);

  if (ordersErr) throw ordersErr;
  if (!ordersOnDate?.length) return;

  const orderIds = ordersOnDate.map(o => o.id);

  // 2. Fetch assignments, instructions, drivers in parallel
  const [assignRes, instrRes, driverRes] = await Promise.all([
    supabase
      .from('order_transport_assignments')
      .select('*')
      .in('order_id', orderIds)
      .eq('driver_id', driverId)
      .order('sequence_number'),
    (supabase as any)
      .from('order_load_unload_instructions')
      .select('*')
      .in('order_id', orderIds)
      .order('sequence_number'),
    supabase.from('drivers').select('id, name'),
  ]);

  const driverAssignments = (assignRes.data || []) as RawAssignment[];
  const allInstructions = (instrRes.data || []) as RawInstruction[];
  const drivers = (driverRes.data || []) as { id: string; name: string }[];

  if (driverAssignments.length === 0) return;

  const driverName = drivers.find(d => d.id === driverId)?.name || 'Onbekend';
  const driverMap = new Map(drivers.map(d => [d.id, d.name]));

  // Filter orders to those with assignments for this driver
  const relevantOrderIds = [...new Set(driverAssignments.map(a => a.order_id))];
  const orders = (ordersOnDate as unknown as RawOrder[]).filter(o => relevantOrderIds.includes(o.id));

  // 3. Build route segments per order (leveren/ophalen)
  interface RouteSegment {
    order: RawOrder;
    assignment: RawAssignment;
    segment: 'leveren' | 'ophalen';
    customerTime: string; // HH:MM
    customerAddress: string;
    vehicleCount: number;
    hasTrailer: boolean;
    transportId: string;
    instructions: RawInstruction[];
  }

  const segments: RouteSegment[] = [];

  for (const assignment of driverAssignments) {
    const order = orders.find(o => o.id === assignment.order_id);
    if (!order) continue;

    const segment = assignment.segment as 'leveren' | 'ophalen';
    const isLeveren = segment === 'leveren';

    // Only include if this is on the correct date (use logistic dates with fallback)
    const effectiveDeliveryDate = order.delivery_date || order.start_date;
    const effectivePickupDate = order.pickup_date || order.end_date;
    if (isLeveren && effectiveDeliveryDate !== date) continue;
    if (!isLeveren && effectivePickupDate !== date) continue;

    // Use logistic times with fallback to booking times
    const effectiveDeliveryTime = (order.delivery_time || order.start_time).slice(0, 5);
    const effectivePickupTime = (order.pickup_time || order.end_time).slice(0, 5);

    const vehicleTypesData = (order.vehicle_types as { type: string; count: number }[] || []);
    const totalVehicles = vehicleTypesData.reduce((s, v) => s + v.count, 0);

    // Count assignments for this order+segment to divide vehicles
    const segAssignmentCount = driverAssignments.filter(
      a => a.order_id === order.id && a.segment === segment,
    ).length;
    const vehicleCount = Math.ceil(totalVehicles / Math.max(segAssignmentCount, 1));

    const assignmentInstructions = allInstructions.filter(
      i => i.assignment_id === assignment.id,
    );

    segments.push({
      order,
      assignment,
      segment,
      customerTime: isLeveren ? effectiveDeliveryTime : effectivePickupTime,
      customerAddress: isLeveren ? order.start_location : order.end_location,
      vehicleCount,
      hasTrailer: needsTrailer(assignment.transport_id),
      transportId: assignment.transport_id,
      instructions: assignmentInstructions,
    });
  }

  // Sort: leveren by start_time ASC, ophalen by end_time ASC
  segments.sort((a, b) => {
    // Leveren comes before ophalen
    if (a.segment !== b.segment) return a.segment === 'leveren' ? -1 : 1;
    return timeToMinutes(a.customerTime) - timeToMinutes(b.customerTime);
  });

  const anyTrailer = segments.some(s => s.hasTrailer);
  const leverenSegments = segments.filter(s => s.segment === 'leveren');
  const ophalenSegments = segments.filter(s => s.segment === 'ophalen');

  // 4. Build sequential stops with drive time calculations
  const stops: CombinedStop[] = [];
  const driveTimePromises: { from: string; to: string; departureTime: Date }[] = [];

  // We need to calculate the route step by step and compute drive times
  // Route pattern:
  // Winkel (load) → [Loods if trailer] → Customer A (deliver) → Customer B (deliver)
  // → ... → Customer B (pickup) → Customer A (pickup) → [Loods if trailer] → Winkel (unload)

  // Collect all location pairs we need drive times for
  interface LocationPair {
    from: string;
    to: string;
    label: string;
  }

  const locationPairs: LocationPair[] = [];

  // Build outbound route
  let currentLocation = 'winkel';

  if (anyTrailer) {
    locationPairs.push({ from: 'winkel', to: 'loods', label: 'Winkel → Loods' });
    currentLocation = 'loods';
  }

  for (const seg of leverenSegments) {
    locationPairs.push({
      from: currentLocation,
      to: seg.customerAddress,
      label: `→ ${seg.order.order_number}`,
    });
    currentLocation = seg.customerAddress;
  }

  // Check if there's a gap where driver returns to shop
  // For simplicity, ophalen segments continue from last leveren location
  for (const seg of ophalenSegments) {
    locationPairs.push({
      from: currentLocation,
      to: seg.customerAddress,
      label: `→ ${seg.order.order_number} ophalen`,
    });
    currentLocation = seg.customerAddress;
  }

  // Return to shop (via loods if trailer)
  if (anyTrailer) {
    locationPairs.push({ from: currentLocation, to: 'winkel', label: '→ Winkel (lossen)' });
    locationPairs.push({ from: 'winkel', to: 'loods', label: '→ Loods (afkoppelen)' });
    locationPairs.push({ from: 'loods', to: 'winkel', label: '→ Winkel' });
  } else {
    locationPairs.push({ from: currentLocation, to: 'winkel', label: '→ Winkel' });
  }

  // 5. Fetch all drive times in parallel
  const baseDate = new Date(date + 'T08:00:00');
  const driveTimeResults = await Promise.all(
    locationPairs.map(pair =>
      fetchDriveTime(resolveAddress(pair.from), resolveAddress(pair.to), baseDate),
    ),
  );

  // 6. Build the timeline
  // Start: calculate earliest needed time working backwards from first customer

  const firstLeveren = leverenSegments[0];
  if (!firstLeveren && ophalenSegments.length === 0) return;

  // Calculate load time at shop
  const shopLoadMinutes = leverenSegments.reduce((sum, seg) => {
    return sum + estimateLoadUnloadTime({
      segment: 'leveren',
      vehicleCount: seg.vehicleCount,
      hasTrailer: seg.hasTrailer,
    });
  }, 0);

  // Work backwards from first customer time to find start
  let driveTimeIdx = 0;
  let totalOutboundDriveMinutes = 0;

  // Winkel → Loods (if trailer)
  if (anyTrailer) {
    totalOutboundDriveMinutes += driveTimeResults[driveTimeIdx].trafficDurationMinutes || driveTimeResults[driveTimeIdx].durationMinutes;
    totalOutboundDriveMinutes += TIME_CONSTANTS.TRAILER_COUPLING_TIME;
    driveTimeIdx++;
  }

  // Loods/Winkel → First customer
  if (leverenSegments.length > 0) {
    totalOutboundDriveMinutes += driveTimeResults[driveTimeIdx].trafficDurationMinutes || driveTimeResults[driveTimeIdx].durationMinutes;
  }

  // First customer arrive time = customerTime - readyBefore - unloadTime
  const firstCustomerTime = firstLeveren?.customerTime || ophalenSegments[0]?.customerTime || '09:00';
  const firstUnloadTime = firstLeveren
    ? estimateLoadUnloadTime({ segment: 'leveren', vehicleCount: firstLeveren.vehicleCount, hasTrailer: firstLeveren.hasTrailer })
    : 0;
  const readyBefore = firstLeveren ? TIME_CONSTANTS.READY_BEFORE_START : 0;

  const firstArriveMinutes = timeToMinutes(firstCustomerTime) - readyBefore - firstUnloadTime;
  const winkelDepartMinutes = firstArriveMinutes - totalOutboundDriveMinutes;
  const winkelStartMinutes = winkelDepartMinutes - TIME_CONSTANTS.STARTUP_TIME_WINKEL - shopLoadMinutes;

  let currentTime = winkelStartMinutes;
  driveTimeIdx = 0;

  // --- Build stops ---

  // Shop load
  if (shopLoadMinutes > 0) {
    stops.push({
      time: minutesToTime(currentTime),
      endTime: minutesToTime(currentTime + shopLoadMinutes),
      label: 'Laden bij Winkel',
      sublabel: 'Volendam',
      detail: `${shopLoadMinutes} min laden`,
      type: 'action',
    });
    currentTime += shopLoadMinutes;
  }

  // Shop start
  stops.push({
    time: minutesToTime(currentTime),
    label: 'Vertrek Winkel',
    sublabel: 'Volendam',
    detail: `${TIME_CONSTANTS.STARTUP_TIME_WINKEL} min opstarten`,
    type: 'start',
  });
  currentTime += TIME_CONSTANTS.STARTUP_TIME_WINKEL;

  // Loods (if trailer)
  if (anyTrailer) {
    const dt = driveTimeResults[driveTimeIdx];
    const driveMin = dt.trafficDurationMinutes || dt.durationMinutes;
    currentTime += driveMin;

    stops.push({
      time: minutesToTime(currentTime),
      endTime: minutesToTime(currentTime + TIME_CONSTANTS.TRAILER_COUPLING_TIME),
      label: 'Loods Purmerend',
      detail: `${TIME_CONSTANTS.TRAILER_COUPLING_TIME} min aanhanger koppelen`,
      driveTimeMinutes: driveMin,
      driveDistanceKm: dt.distanceKm,
      isEstimate: dt.isEstimate,
      type: 'loods',
    });
    currentTime += TIME_CONSTANTS.TRAILER_COUPLING_TIME;
    driveTimeIdx++;
  }

  // Deliver stops
  for (let i = 0; i < leverenSegments.length; i++) {
    const seg = leverenSegments[i];
    const dt = driveTimeResults[driveTimeIdx];
    const driveMin = dt.trafficDurationMinutes || dt.durationMinutes;
    currentTime += driveMin;

    const unloadMin = estimateLoadUnloadTime({
      segment: 'leveren',
      vehicleCount: seg.vehicleCount,
      hasTrailer: seg.hasTrailer,
    });

    stops.push({
      time: minutesToTime(currentTime),
      endTime: minutesToTime(currentTime + unloadMin),
      label: `Leveren – ${seg.order.order_number}`,
      sublabel: seg.customerAddress,
      detail: `${unloadMin} min uitladen · Klant ${seg.customerTime}`,
      driveTimeMinutes: driveMin,
      driveDistanceKm: dt.distanceKm,
      isEstimate: dt.isEstimate,
      type: 'customer-deliver',
      orderNumber: seg.order.order_number,
    });
    currentTime += unloadMin;
    driveTimeIdx++;
  }

  // Pickup stops
  for (let i = 0; i < ophalenSegments.length; i++) {
    const seg = ophalenSegments[i];
    const dt = driveTimeResults[driveTimeIdx];
    const driveMin = dt.trafficDurationMinutes || dt.durationMinutes;

    // Wait until customer pickup time if needed
    const pickupTimeMin = timeToMinutes(seg.customerTime);
    if (currentTime + driveMin < pickupTimeMin) {
      // Driver arrives early, wait
      currentTime = pickupTimeMin - driveMin;
    }

    currentTime += driveMin;

    const loadMin = estimateLoadUnloadTime({
      segment: 'ophalen',
      vehicleCount: seg.vehicleCount,
      hasTrailer: seg.hasTrailer,
    });

    stops.push({
      time: minutesToTime(currentTime),
      endTime: minutesToTime(currentTime + loadMin),
      label: `Ophalen – ${seg.order.order_number}`,
      sublabel: seg.customerAddress,
      detail: `${loadMin} min inladen · Klant ${seg.customerTime}`,
      driveTimeMinutes: driveMin,
      driveDistanceKm: dt.distanceKm,
      isEstimate: dt.isEstimate,
      type: 'customer-pickup',
      orderNumber: seg.order.order_number,
    });
    currentTime += loadMin;
    driveTimeIdx++;
  }

  // Return trip
  if (anyTrailer && ophalenSegments.length > 0) {
    // Ophalen + trailer: Customer → Winkel (lossen) → Loods (afkoppelen) → Winkel
    const dtToWinkel = driveTimeResults[driveTimeIdx];
    const driveToWinkel = dtToWinkel.trafficDurationMinutes || dtToWinkel.durationMinutes;
    currentTime += driveToWinkel;
    driveTimeIdx++;

    const shopUnloadMinutes = ophalenSegments.reduce((sum, seg) => {
      return sum + estimateLoadUnloadTime({
        segment: 'ophalen',
        vehicleCount: seg.vehicleCount,
        hasTrailer: seg.hasTrailer,
      });
    }, 0);

    stops.push({
      time: minutesToTime(currentTime),
      endTime: minutesToTime(currentTime + shopUnloadMinutes),
      label: 'Lossen bij Winkel',
      sublabel: 'Volendam',
      detail: `${shopUnloadMinutes} min lossen`,
      driveTimeMinutes: driveToWinkel,
      driveDistanceKm: dtToWinkel.distanceKm,
      isEstimate: dtToWinkel.isEstimate,
      type: 'action',
    });
    currentTime += shopUnloadMinutes;

    const dtToLoods = driveTimeResults[driveTimeIdx];
    const driveToLoods = dtToLoods.trafficDurationMinutes || dtToLoods.durationMinutes;
    currentTime += driveToLoods;
    driveTimeIdx++;

    stops.push({
      time: minutesToTime(currentTime),
      endTime: minutesToTime(currentTime + TIME_CONSTANTS.TRAILER_COUPLING_TIME),
      label: 'Loods Purmerend',
      detail: `${TIME_CONSTANTS.TRAILER_COUPLING_TIME} min afkoppelen`,
      driveTimeMinutes: driveToLoods,
      driveDistanceKm: dtToLoods.distanceKm,
      isEstimate: dtToLoods.isEstimate,
      type: 'loods',
    });
    currentTime += TIME_CONSTANTS.TRAILER_COUPLING_TIME;

    const dtToWinkelFinal = driveTimeResults[driveTimeIdx];
    const driveToWinkelFinal = dtToWinkelFinal.trafficDurationMinutes || dtToWinkelFinal.durationMinutes;
    currentTime += driveToWinkelFinal;

    stops.push({
      time: minutesToTime(currentTime),
      label: 'Aankomst Winkel',
      sublabel: 'Volendam',
      driveTimeMinutes: driveToWinkelFinal,
      driveDistanceKm: dtToWinkelFinal.distanceKm,
      isEstimate: dtToWinkelFinal.isEstimate,
      type: 'return',
    });
  } else if (anyTrailer) {
    // Only leveren with trailer: Customer → Loods (afkoppelen) → Winkel
    const dtToWinkel = driveTimeResults[driveTimeIdx];
    const driveToWinkel = dtToWinkel.trafficDurationMinutes || dtToWinkel.durationMinutes;
    currentTime += driveToWinkel;

    stops.push({
      time: minutesToTime(currentTime),
      label: 'Aankomst Winkel',
      sublabel: 'Volendam',
      driveTimeMinutes: driveToWinkel,
      driveDistanceKm: dtToWinkel.distanceKm,
      isEstimate: dtToWinkel.isEstimate,
      type: 'return',
    });
  } else {
    // No trailer: Customer → Winkel direct
    const dtReturn = driveTimeResults[driveTimeIdx];
    const driveReturn = dtReturn.trafficDurationMinutes || dtReturn.durationMinutes;
    currentTime += driveReturn;

    // Shop unload if ophalen
    const shopUnloadMinutes = ophalenSegments.reduce((sum, seg) => {
      return sum + estimateLoadUnloadTime({
        segment: 'ophalen',
        vehicleCount: seg.vehicleCount,
        hasTrailer: false,
      });
    }, 0);

    if (shopUnloadMinutes > 0) {
      stops.push({
        time: minutesToTime(currentTime),
        endTime: minutesToTime(currentTime + shopUnloadMinutes),
        label: 'Lossen bij Winkel',
        sublabel: 'Volendam',
        detail: `${shopUnloadMinutes} min lossen`,
        driveTimeMinutes: driveReturn,
        driveDistanceKm: dtReturn.distanceKm,
        isEstimate: dtReturn.isEstimate,
        type: 'action',
      });
      currentTime += shopUnloadMinutes;
    } else {
      stops.push({
        time: minutesToTime(currentTime),
        label: 'Aankomst Winkel',
        sublabel: 'Volendam',
        driveTimeMinutes: driveReturn,
        driveDistanceKm: dtReturn.distanceKm,
        isEstimate: dtReturn.isEstimate,
        type: 'return',
      });
    }
  }

  // 7. Build order info
  const orderInfos: CombinedOrderInfo[] = orders.map(order => {
    const vehicleTypesData = (order.vehicle_types as { type: string; count: number }[] || []);
    const vehiclesSummary = vehicleTypesData
      .map(v => {
        const info = vehicleTypesList.find(vt => vt.id === v.type);
        return `${v.count}x ${info?.name || v.type}`;
      })
      .join(', ');

    const orderAssignmentIds = driverAssignments
      .filter(a => a.order_id === order.id)
      .map(a => a.id);

    const orderInstructions = allInstructions.filter(
      i => orderAssignmentIds.includes(i.assignment_id),
    );

    const loadSteps: CombinedLoadStep[] = orderInstructions.map(inst => {
      const vtInfo = vehicleTypesList.find(v => v.id === inst.vehicle_type);
      const helperIds = Array.isArray(inst.helper_driver_ids) ? inst.helper_driver_ids : [];
      const helperNames = helperIds.map(id => driverMap.get(id)).filter(Boolean) as string[];
      let instrTransport = '';
      if (inst.target_transport_id) {
        const sub = allTransport.find(t => t.id === inst.target_transport_id);
        if (sub) instrTransport = sub.name;
      } else {
        const assignment = driverAssignments.find(a => a.id === inst.assignment_id);
        if (assignment) instrTransport = transportName(assignment.transport_id);
      }
      return {
        action: inst.action as 'laden' | 'lossen',
        location: inst.location === 'winkel' ? 'Winkel' : inst.location === 'loods' ? 'Loods' : 'Blijft staan',
        vehicleType: vtInfo?.name || inst.vehicle_type,
        vehicleIcon: vtInfo?.icon || '🚲',
        vehicleCount: inst.vehicle_count,
        transportName: instrTransport,
        helperNames,
      };
    });

    return {
      orderNumber: order.order_number,
      customerName: `${order.first_name} ${order.last_name}`.trim(),
      customerPhone: order.phone,
      companyName: order.company_name || undefined,
      deliveryLocation: order.start_location,
      pickupLocation: order.end_location,
      customerStartTime: order.start_time?.slice(0, 5) || '-',
      customerEndTime: order.end_time?.slice(0, 5) || '-',
      vehiclesSummary: vehiclesSummary || `${order.number_of_persons} voertuigen`,
      numberOfPersons: order.number_of_persons,
      notes: order.notes || undefined,
      loadSteps,
    };
  });

  const formattedDate = format(new Date(date + 'T00:00:00'), 'EEEE d MMMM yyyy', { locale: nl });
  const totalWorkStart = stops[0]?.time || '--:--';
  const totalWorkEnd = stops[stops.length - 1]?.time || '--:--';

  const uniqueTransports = [...new Set(driverAssignments.map(a => transportName(a.transport_id)))];

  const printData: CombinedDayPrintData = {
    driverName,
    date: formattedDate,
    totalWorkStart,
    totalWorkEnd,
    stops,
    orders: orderInfos,
    hasTrailer: anyTrailer,
    transportNames: uniqueTransports,
  };

  openCombinedDayPrintDocument(printData);
}

function minutesToTime(min: number): string {
  const totalMin = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(Math.round(totalMin % 60)).padStart(2, '0')}`;
}

// ── HTML Document Generator ─────────────────────────────

function openCombinedDayPrintDocument(data: CombinedDayPrintData): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  // Route timeline
  const routeHtml = data.stops.map((stop, i) => {
    const dotColor =
      stop.type === 'start' ? '#3b82f6'
      : stop.type === 'customer-deliver' ? '#10b981'
      : stop.type === 'customer-pickup' ? '#dc2626'
      : stop.type === 'loods' ? '#8b5cf6'
      : stop.type === 'action' ? '#f59e0b'
      : '#3b82f6';

    const driveTag = stop.driveTimeMinutes
      ? `<span class="drive-tag${stop.isEstimate ? ' estimate' : ''}">🚗 ${stop.driveTimeMinutes} min${stop.driveDistanceKm ? ` · ${Math.round(stop.driveDistanceKm)} km` : ''}</span>`
      : '';

    const timeDisplay = stop.endTime
      ? `<span class="time">${escapeHtml(stop.time)}</span><span class="time-range"> → ${escapeHtml(stop.endTime)}</span>`
      : `<span class="time">${escapeHtml(stop.time)}</span>`;

    const orderBadge = stop.orderNumber
      ? `<span class="order-badge">${escapeHtml(stop.orderNumber)}</span>`
      : '';

    return `
      ${driveTag ? `<div class="drive-row">${driveTag}</div>` : ''}
      <div class="route-step">
        <div class="route-dot" style="background:${dotColor}"></div>
        ${i < data.stops.length - 1 ? '<div class="route-line"></div>' : ''}
        <div class="route-content">
          <div class="route-label">${orderBadge}${escapeHtml(stop.label)}</div>
          ${stop.sublabel ? `<div class="route-sublabel">${escapeHtml(stop.sublabel)}</div>` : ''}
          ${stop.detail ? `<div class="route-detail">${escapeHtml(stop.detail)}</div>` : ''}
        </div>
        <div class="route-time">${timeDisplay}</div>
      </div>`;
  }).join('');

  // Order cards
  const ordersHtml = data.orders.map(order => {
    const ladenSteps = order.loadSteps.filter(s => s.action === 'laden');
    const lossenSteps = order.loadSteps.filter(s => s.action === 'lossen');

    const loadRows = (steps: CombinedLoadStep[]) => steps.map(s => {
      const isBlijftStaan = s.location.toLowerCase() === 'blijft staan';
      return `<tr${isBlijftStaan ? ' class="stay-loaded"' : ''}>
        <td>${isBlijftStaan ? '🅿️ Blijft staan' : escapeHtml(s.location)}</td>
        <td>${s.vehicleIcon} ${escapeHtml(s.vehicleType)}</td>
        <td class="count">${s.vehicleCount}x</td>
        <td>${escapeHtml(s.transportName)}</td>
        <td>${isBlijftStaan ? '—' : (s.helperNames.length > 0 ? s.helperNames.map(n => `<span class="helper">${escapeHtml(n)}</span>`).join(' ') : '—')}</td>
      </tr>`;
    }).join('');

    return `
    <div class="order-card">
      <div class="order-card-header">
        <div>
          <span class="order-num">${escapeHtml(order.orderNumber)}</span>
          <span class="order-customer">${escapeHtml(order.customerName)}</span>
          ${order.companyName ? `<span class="order-company">${escapeHtml(order.companyName)}</span>` : ''}
        </div>
        <div class="order-meta">
          <span>📞 ${escapeHtml(order.customerPhone)}</span>
          <span>👥 ${order.numberOfPersons} pers.</span>
          <span>${escapeHtml(order.vehiclesSummary)}</span>
        </div>
      </div>
      <div class="order-locations">
        <div class="loc deliver"><span class="loc-type">📍 Leveren</span> ${escapeHtml(order.deliveryLocation)} · ${escapeHtml(order.customerStartTime)}</div>
        <div class="loc pickup"><span class="loc-type">📍 Ophalen</span> ${escapeHtml(order.pickupLocation)} · ${escapeHtml(order.customerEndTime)}</div>
      </div>
      ${order.notes ? `<div class="order-note">⚠️ ${escapeHtml(order.notes)}</div>` : ''}
      ${(ladenSteps.length > 0 || lossenSteps.length > 0) ? `
      <table class="load-table">
        <thead><tr><th>Locatie</th><th>Voertuig</th><th>#</th><th>Transport</th><th>Helpers</th></tr></thead>
        <tbody>
          ${ladenSteps.length > 0 ? `<tr class="section-row"><td colspan="5">▲ Laden</td></tr>${loadRows(ladenSteps)}` : ''}
          ${lossenSteps.length > 0 ? `<tr class="section-row"><td colspan="5">▼ Lossen</td></tr>${loadRows(lossenSteps)}` : ''}
        </tbody>
      </table>` : ''}
    </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<title>Dagrit ${escapeHtml(data.driverName)} – ${escapeHtml(data.date)}</title>
<style>
  @page { margin: 12mm 12mm; size: A4; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    color: #1a1a2e;
    font-size: 11px;
    line-height: 1.45;
  }

  /* Header */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid #1e40af;
    padding-bottom: 10px;
    margin-bottom: 14px;
  }
  .header-title { font-size: 18px; font-weight: 800; color: #1e40af; }
  .header-sub { font-size: 11px; color: #475569; margin-top: 2px; }
  .header-right { text-align: right; }
  .header-driver { font-size: 15px; font-weight: 700; }
  .header-transport { font-size: 10px; color: #475569; margin-top: 2px; }
  .header-times {
    display: flex; gap: 8px; margin-top: 6px; align-items: center;
  }
  .time-box {
    background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px;
    padding: 3px 8px; font-weight: 800; font-size: 16px; color: #1e40af;
  }
  .time-arrow { color: #94a3b8; font-size: 14px; }

  /* Route timeline */
  .section-title {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.8px; color: #475569; margin: 12px 0 8px;
    padding-bottom: 3px; border-bottom: 2px solid #e2e8f0;
  }
  .route-step {
    position: relative; display: flex; align-items: flex-start;
    padding: 4px 0 4px 22px; min-height: 26px;
  }
  .route-dot {
    position: absolute; left: 3px; top: 8px;
    width: 9px; height: 9px; border-radius: 50%;
  }
  .route-line {
    position: absolute; left: 6.5px; top: 19px; bottom: -4px;
    width: 2px; background: #e2e8f0;
  }
  .route-content { flex: 1; }
  .route-label { font-weight: 600; font-size: 11px; }
  .route-sublabel { font-size: 9px; color: #475569; }
  .route-detail { font-size: 9px; color: #b45309; font-weight: 500; }
  .route-time { text-align: right; min-width: 70px; font-weight: 700; font-size: 11px; }
  .time-range { font-size: 9px; color: #475569; display: block; }

  .drive-row {
    padding: 1px 0 1px 22px;
  }
  .drive-tag {
    display: inline-block; font-size: 9px; color: #64748b;
    background: #f1f5f9; border-radius: 3px; padding: 1px 6px;
  }
  .drive-tag.estimate { font-style: italic; }

  .order-badge {
    display: inline-block; background: #e2e8f0; color: #334155;
    padding: 0 5px; border-radius: 3px; font-size: 9px;
    font-weight: 700; margin-right: 4px; vertical-align: middle;
  }

  /* Order cards */
  .orders-section { margin-top: 14px; }
  .order-card {
    border: 1px solid #e2e8f0; border-radius: 6px;
    padding: 8px 10px; margin-bottom: 8px;
    break-inside: avoid;
  }
  .order-card-header {
    display: flex; justify-content: space-between;
    align-items: baseline; margin-bottom: 6px;
  }
  .order-num { font-weight: 800; color: #1e40af; font-size: 12px; margin-right: 6px; }
  .order-customer { font-weight: 600; font-size: 11px; }
  .order-company { font-size: 10px; color: #475569; margin-left: 4px; }
  .order-meta { font-size: 9px; color: #475569; display: flex; gap: 8px; }
  .order-locations { display: flex; gap: 12px; margin-bottom: 4px; }
  .loc { font-size: 10px; flex: 1; }
  .loc-type { font-weight: 600; font-size: 9px; }
  .loc.deliver { color: #059669; }
  .loc.pickup { color: #dc2626; }
  .order-note {
    background: #fef3c7; border: 1px solid #f59e0b; border-radius: 3px;
    padding: 3px 8px; font-size: 10px; font-weight: 500; color: #78350f;
    margin-bottom: 4px;
  }

  /* Load table */
  .load-table {
    width: 100%; border-collapse: collapse; font-size: 10px;
  }
  .load-table th {
    text-align: left; font-size: 8px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.5px;
    color: #64748b; padding: 2px 6px 2px 0; border-bottom: 1px solid #e2e8f0;
  }
  .load-table td {
    padding: 3px 6px 3px 0; border-bottom: 1px solid #f1f5f9;
  }
  .load-table .count { font-weight: 700; }
  .load-table .section-row td {
    font-weight: 700; font-size: 9px; color: #475569;
    padding-top: 4px; border-bottom: none;
  }
  .load-table .stay-loaded td { color: #2563eb; }
  .helper {
    display: inline-block; background: #e2e8f0; color: #334155;
    padding: 0 4px; border-radius: 2px; font-size: 9px; margin: 0 1px;
  }

  .footer {
    margin-top: 12px; padding-top: 6px; border-top: 1px solid #e2e8f0;
    font-size: 8px; color: #94a3b8; text-align: center;
  }
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <div>
    <div class="header-title">Dagritplanning</div>
    <div class="header-sub">${escapeHtml(data.date)} · ${data.orders.length} order${data.orders.length > 1 ? 's' : ''}</div>
  </div>
  <div class="header-right">
    <div class="header-driver">${escapeHtml(data.driverName)}</div>
    <div class="header-transport">${escapeHtml(data.transportNames.join(' / '))}${data.hasTrailer ? ' · Met aanhanger' : ''}</div>
    <div class="header-times">
      <span class="time-box">${escapeHtml(data.totalWorkStart)}</span>
      <span class="time-arrow">→</span>
      <span class="time-box">${escapeHtml(data.totalWorkEnd)}</span>
    </div>
  </div>
</div>

<!-- Route Timeline -->
<div class="section-title">Route & Tijdlijn</div>
${routeHtml}

<!-- Order Details -->
<div class="orders-section">
  <div class="section-title">Orders</div>
  ${ordersHtml}
</div>

<div class="footer">
  Gegenereerd op ${new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · Rijtijden zijn schattingen op basis van verkeersinformatie
</div>

</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => { printWindow.print(); }, 350);
}
