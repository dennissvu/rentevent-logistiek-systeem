/**
 * Route optimizer: determines the optimal stop sequence for a driver
 * with multiple orders on the same day, respecting time windows,
 * drive times, and load/unload durations.
 * 
 * Algorithm:
 * 1. Generate candidate sequences respecting constraints
 * 2. For each candidate, calculate the full timeline
 * 3. Score by feasibility (on-time arrivals) and total travel time
 * 4. Return the best sequence with detailed timing
 */

import {
  needsTrailer,
  estimateLoadUnloadTime,
  TIME_CONSTANTS,
  LOCATIONS,
  type DriveTimeResult,
} from '@/utils/driverScheduleCalculator';
import { supabase } from '@/integrations/supabase/client';

// ── Types ────────────────────────────────────────────────

export interface RouteOrder {
  orderId: string;
  orderNumber: string;
  customerName: string;
  deliveryAddress: string;
  pickupAddress: string;
  customerStartTime: string; // HH:MM - delivery time
  customerEndTime: string;   // HH:MM - pickup time
  startDate: string;
  endDate: string;
  vehicleCount: number;
  transportId: string;
  hasTrailer: boolean;
  assignmentId: string;
  segment: 'leveren' | 'ophalen';
  notes?: string;
  /** For multi-trip (pendel): which trip number is this (1-based) */
  tripNumber?: number;
  /** For multi-trip: total number of trips for this order+segment */
  totalTrips?: number;
}

export interface OptimizedStop {
  type: 'laden_winkel' | 'vertrek_winkel' | 'aankoppelen_loods' | 'leveren' | 'ophalen' | 'lossen_winkel' | 'afkoppelen_loods' | 'aankomst_winkel' | 'wachttijd';
  label: string;
  address: string;
  estimatedArrival: string; // HH:MM
  estimatedDeparture: string; // HH:MM
  durationMinutes: number;
  driveTimeFromPrevious: number;
  driveDistanceKm: number;
  isEstimate: boolean;
  orderId?: string;
  orderNumber?: string;
  assignmentId?: string | null; // for persistence to driver_day_route_stops
  customerDeadline?: string; // HH:MM - when driver must be ready
  isLate: boolean; // Would the driver be late?
  minutesLate: number;
  minutesEarly: number;
}

export interface OptimizedRoute {
  stops: OptimizedStop[];
  totalDriveMinutes: number;
  totalWorkMinutes: number;
  workStartTime: string;
  workEndTime: string;
  feasible: boolean; // Can the driver make all deadlines?
  warnings: string[];
  score: number; // Lower = better (total drive time + penalties)
  orderSequence: { orderId: string; orderNumber: string; segment: 'leveren' | 'ophalen' }[];
}

// ── Helpers ──────────────────────────────────────────────

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(min: number): string {
  const total = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(Math.round(total % 60)).padStart(2, '0')}`;
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

function resolveAddress(addr: string): string {
  if (addr === 'winkel') return LOCATIONS.winkel;
  if (addr === 'loods') return LOCATIONS.loods;
  return addr;
}

// ── Generate permutations ────────────────────────────────

function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) {
      result.push([arr[i], ...perm]);
    }
  }
  return result;
}

// ── Core optimization ────────────────────────────────────

function getMinutes(dt: DriveTimeResult): number {
  return dt.trafficDurationMinutes || dt.durationMinutes;
}

/**
 * Fetch a single drive time with the actual departure time for traffic accuracy.
 */
async function fetchLegDriveTime(
  from: string,
  to: string,
  date: string,
  departureMinutes: number,
): Promise<DriveTimeResult> {
  const hh = String(Math.floor(((departureMinutes % 1440) + 1440) % 1440 / 60)).padStart(2, '0');
  const mm = String(Math.round(((departureMinutes % 1440) + 1440) % 1440 % 60)).padStart(2, '0');
  const departureTime = new Date(`${date}T${hh}:${mm}:00`);
  return fetchDriveTime(resolveAddress(from), resolveAddress(to), departureTime);
}

// ── Core optimization ────────────────────────────────────

/**
 * Evaluate a specific sequence of orders and calculate the full timeline.
 * Each leg fetches real-time traffic data from Google Maps using the actual departure time.
 */
async function evaluateSequence(
  deliveryOrder: RouteOrder[],
  pickupOrder: RouteOrder[],
  date: string,
  anyTrailer: boolean,
): Promise<OptimizedRoute> {
  const stops: OptimizedStop[] = [];
  const warnings: string[] = [];
  let totalDriveMinutes = 0;
  let currentTime = 0;
  let feasible = true;
  const LATE_PENALTY = 100;

  const allDeliveries = deliveryOrder;
  const shopLoadMinutes = allDeliveries.reduce((sum, seg) =>
    sum + estimateLoadUnloadTime({
      segment: 'leveren',
      vehicleCount: seg.vehicleCount,
      hasTrailer: seg.hasTrailer,
    }), 0);

  // ── Step 1: Estimate start time (backwards from first deadline) ──
  // We need an approximate start to know departure times for Google Maps.
  // Use a rough 30min estimate per leg for the backwards calc, then build forward with real times.

  if (allDeliveries.length > 0) {
    const firstDelivery = allDeliveries[0];
    const firstDeadline = timeToMinutes(firstDelivery.customerStartTime);
    const firstUnload = estimateLoadUnloadTime({
      segment: 'leveren',
      vehicleCount: firstDelivery.vehicleCount,
      hasTrailer: firstDelivery.hasTrailer,
    });

    // Rough outbound drive estimate for backwards calc
    let roughOutbound = 30; // default estimate
    if (anyTrailer) roughOutbound = 45; // winkel→loods→customer rough

    const arriveFirst = firstDeadline - TIME_CONSTANTS.READY_BEFORE_START - firstUnload;
    const departShop = arriveFirst - roughOutbound;
    currentTime = departShop - TIME_CONSTANTS.STARTUP_TIME_WINKEL - shopLoadMinutes;
  } else if (pickupOrder.length > 0) {
    const firstPickup = pickupOrder[0];
    const firstPickupTime = timeToMinutes(firstPickup.customerEndTime);
    let roughOutbound = 30;
    if (anyTrailer) roughOutbound = 45;
    currentTime = firstPickupTime - roughOutbound;
  }

  // Now fetch the REAL outbound drive time with the estimated departure, then adjust start
  let realOutboundDrive = 0;
  const estimatedDepartureFromShop = currentTime + shopLoadMinutes + TIME_CONSTANTS.STARTUP_TIME_WINKEL;

  if (allDeliveries.length > 0) {
    const firstDelivery = allDeliveries[0];
    if (anyTrailer) {
      const dt1 = await fetchLegDriveTime('winkel', 'loods', date, estimatedDepartureFromShop);
      const dt2 = await fetchLegDriveTime('loods', firstDelivery.deliveryAddress, date,
        estimatedDepartureFromShop + getMinutes(dt1) + TIME_CONSTANTS.TRAILER_COUPLING_TIME);
      realOutboundDrive = getMinutes(dt1) + TIME_CONSTANTS.TRAILER_COUPLING_TIME + getMinutes(dt2);
    } else {
      const dt = await fetchLegDriveTime('winkel', firstDelivery.deliveryAddress, date, estimatedDepartureFromShop);
      realOutboundDrive = getMinutes(dt);
    }

    const firstDeadline = timeToMinutes(firstDelivery.customerStartTime);
    const firstUnload = estimateLoadUnloadTime({
      segment: 'leveren',
      vehicleCount: firstDelivery.vehicleCount,
      hasTrailer: firstDelivery.hasTrailer,
    });
    const arriveFirst = firstDeadline - TIME_CONSTANTS.READY_BEFORE_START - firstUnload;
    const departShop = arriveFirst - realOutboundDrive;
    currentTime = departShop - TIME_CONSTANTS.STARTUP_TIME_WINKEL - shopLoadMinutes;
  } else if (pickupOrder.length > 0) {
    const firstPickup = pickupOrder[0];
    if (anyTrailer) {
      const dt1 = await fetchLegDriveTime('winkel', 'loods', date, estimatedDepartureFromShop);
      const dt2 = await fetchLegDriveTime('loods', firstPickup.pickupAddress, date,
        estimatedDepartureFromShop + getMinutes(dt1) + TIME_CONSTANTS.TRAILER_COUPLING_TIME);
      realOutboundDrive = getMinutes(dt1) + TIME_CONSTANTS.TRAILER_COUPLING_TIME + getMinutes(dt2);
    } else {
      const dt = await fetchLegDriveTime('winkel', firstPickup.pickupAddress, date, estimatedDepartureFromShop);
      realOutboundDrive = getMinutes(dt);
    }
    const firstPickupTime = timeToMinutes(firstPickup.customerEndTime);
    currentTime = firstPickupTime - realOutboundDrive;
  }

  const workStartTime = currentTime;

  // ── Build forward timeline with real drive times ──

  // 1. Shop loading
  if (shopLoadMinutes > 0) {
    stops.push({
      type: 'laden_winkel',
      label: 'Laden bij Winkel',
      address: 'winkel',
      estimatedArrival: minutesToTime(currentTime),
      estimatedDeparture: minutesToTime(currentTime + shopLoadMinutes),
      durationMinutes: shopLoadMinutes,
      driveTimeFromPrevious: 0,
      driveDistanceKm: 0,
      isEstimate: false,
      isLate: false,
      minutesLate: 0,
      minutesEarly: 0,
    });
    currentTime += shopLoadMinutes;
  }

  // 2. Startup + departure
  stops.push({
    type: 'vertrek_winkel',
    label: 'Vertrek Winkel',
    address: 'winkel',
    estimatedArrival: minutesToTime(currentTime),
    estimatedDeparture: minutesToTime(currentTime + TIME_CONSTANTS.STARTUP_TIME_WINKEL),
    durationMinutes: TIME_CONSTANTS.STARTUP_TIME_WINKEL,
    driveTimeFromPrevious: 0,
    driveDistanceKm: 0,
    isEstimate: false,
    isLate: false,
    minutesLate: 0,
    minutesEarly: 0,
  });
  currentTime += TIME_CONSTANTS.STARTUP_TIME_WINKEL;

  let currentLocation = 'winkel';

  // 3. Loods (if trailer)
  if (anyTrailer) {
    const dt = await fetchLegDriveTime('winkel', 'loods', date, currentTime);
    const driveMin = getMinutes(dt);
    currentTime += driveMin;
    totalDriveMinutes += driveMin;

    stops.push({
      type: 'aankoppelen_loods',
      label: 'Loods – Aankoppelen',
      address: 'loods',
      estimatedArrival: minutesToTime(currentTime),
      estimatedDeparture: minutesToTime(currentTime + TIME_CONSTANTS.TRAILER_COUPLING_TIME),
      durationMinutes: TIME_CONSTANTS.TRAILER_COUPLING_TIME,
      driveTimeFromPrevious: driveMin,
      driveDistanceKm: dt.distanceKm,
      isEstimate: dt.isEstimate,
      isLate: false,
      minutesLate: 0,
      minutesEarly: 0,
    });
    currentTime += TIME_CONSTANTS.TRAILER_COUPLING_TIME;
    currentLocation = 'loods';
  }

  // 4. Delivery stops (with multi-trip reload support)
  for (let i = 0; i < deliveryOrder.length; i++) {
    const seg = deliveryOrder[i];
    const isPendelTrip = (seg.tripNumber || 1) > 1;
    const isLastPendelTrip = !deliveryOrder[i + 1] || 
      deliveryOrder[i + 1].orderId !== seg.orderId || 
      deliveryOrder[i + 1].segment !== seg.segment;

    // If this is a subsequent pendel trip, driver needs to return to shop and reload
    if (isPendelTrip) {
      // Drive back to shop from previous customer location
      const dtReturn = await fetchLegDriveTime(currentLocation, 'winkel', date, currentTime);
      const driveReturn = getMinutes(dtReturn);
      currentTime += driveReturn;
      totalDriveMinutes += driveReturn;

      // Reload at shop
      const reloadMinutes = estimateLoadUnloadTime({
        segment: 'leveren',
        vehicleCount: seg.vehicleCount,
        hasTrailer: seg.hasTrailer,
      });

      stops.push({
        type: 'laden_winkel',
        label: `Herladen bij Winkel (rit ${seg.tripNumber}/${seg.totalTrips})`,
        address: 'winkel',
        estimatedArrival: minutesToTime(currentTime),
        estimatedDeparture: minutesToTime(currentTime + reloadMinutes),
        durationMinutes: reloadMinutes,
        driveTimeFromPrevious: driveReturn,
        driveDistanceKm: dtReturn.distanceKm,
        isEstimate: dtReturn.isEstimate,
        isLate: false,
        minutesLate: 0,
        minutesEarly: 0,
      });
      currentTime += reloadMinutes;

      // If trailer, need to go via loods again
      if (anyTrailer) {
        const dtToLoods = await fetchLegDriveTime('winkel', 'loods', date, currentTime);
        const driveToLoods = getMinutes(dtToLoods);
        currentTime += driveToLoods;
        totalDriveMinutes += driveToLoods;

        stops.push({
          type: 'aankoppelen_loods',
          label: `Loods – Aankoppelen (rit ${seg.tripNumber})`,
          address: 'loods',
          estimatedArrival: minutesToTime(currentTime),
          estimatedDeparture: minutesToTime(currentTime + TIME_CONSTANTS.TRAILER_COUPLING_TIME),
          durationMinutes: TIME_CONSTANTS.TRAILER_COUPLING_TIME,
          driveTimeFromPrevious: driveToLoods,
          driveDistanceKm: dtToLoods.distanceKm,
          isEstimate: dtToLoods.isEstimate,
          isLate: false,
          minutesLate: 0,
          minutesEarly: 0,
        });
        currentTime += TIME_CONSTANTS.TRAILER_COUPLING_TIME;
        currentLocation = 'loods';
      } else {
        currentLocation = 'winkel';
      }
    }

    const dt = await fetchLegDriveTime(currentLocation, seg.deliveryAddress, date, currentTime);
    const driveMin = getMinutes(dt);
    currentTime += driveMin;
    totalDriveMinutes += driveMin;

    const unloadMin = estimateLoadUnloadTime({
      segment: 'leveren',
      vehicleCount: seg.vehicleCount,
      hasTrailer: seg.hasTrailer,
    });

    const deadline = timeToMinutes(seg.customerStartTime) - TIME_CONSTANTS.READY_BEFORE_START;
    const readyTime = currentTime + unloadMin;
    const isLate = readyTime > deadline;
    const minutesLate = isLate ? Math.round(readyTime - deadline) : 0;
    const minutesEarly = !isLate ? Math.round(deadline - readyTime) : 0;

    if (isLate) {
      feasible = false;
      warnings.push(`${seg.orderNumber}${seg.totalTrips && seg.totalTrips > 1 ? ` (rit ${seg.tripNumber})` : ''}: ${minutesLate} min te laat bij leveren`);
    }

    stops.push({
      type: 'leveren',
      label: `Leveren – ${seg.orderNumber}${seg.totalTrips && seg.totalTrips > 1 ? ` (rit ${seg.tripNumber}/${seg.totalTrips})` : ''}`,
      address: seg.deliveryAddress,
      estimatedArrival: minutesToTime(currentTime),
      estimatedDeparture: minutesToTime(currentTime + unloadMin),
      durationMinutes: unloadMin,
      driveTimeFromPrevious: driveMin,
      driveDistanceKm: dt.distanceKm,
      isEstimate: dt.isEstimate,
      orderId: seg.orderId,
      orderNumber: seg.orderNumber,
      assignmentId: seg.assignmentId,
      customerDeadline: seg.customerStartTime,
      isLate,
      minutesLate,
      minutesEarly,
    });

    currentTime += unloadMin;
    currentLocation = seg.deliveryAddress;
  }

  // 5. Pickup stops
  for (const seg of pickupOrder) {
    // Wait until pickup time if arriving early - fetch drive time with current departure
    const dt = await fetchLegDriveTime(currentLocation, seg.pickupAddress, date, currentTime);
    const driveMin = getMinutes(dt);

    const pickupTime = timeToMinutes(seg.customerEndTime);
    const arrivalTime = currentTime + driveMin;

    if (arrivalTime < pickupTime) {
      const waitMin = pickupTime - arrivalTime;
      if (waitMin > 5) {
        stops.push({
          type: 'wachttijd',
          label: 'Wachttijd',
          address: currentLocation,
          estimatedArrival: minutesToTime(currentTime),
          estimatedDeparture: minutesToTime(currentTime + waitMin),
          durationMinutes: waitMin,
          driveTimeFromPrevious: 0,
          driveDistanceKm: 0,
          isEstimate: false,
          isLate: false,
          minutesLate: 0,
          minutesEarly: 0,
        });
      }
      currentTime = pickupTime - driveMin;
    }

    currentTime += driveMin;
    totalDriveMinutes += driveMin;

    const loadMin = estimateLoadUnloadTime({
      segment: 'ophalen',
      vehicleCount: seg.vehicleCount,
      hasTrailer: seg.hasTrailer,
    });

    const isLate = currentTime > pickupTime + 5;
    const minutesLate = isLate ? Math.round(currentTime - pickupTime) : 0;

    if (isLate) {
      warnings.push(`${seg.orderNumber}: ${minutesLate} min te laat bij ophalen`);
    }

    stops.push({
      type: 'ophalen',
      label: `Ophalen – ${seg.orderNumber}`,
      address: seg.pickupAddress,
      estimatedArrival: minutesToTime(currentTime),
      estimatedDeparture: minutesToTime(currentTime + loadMin),
      durationMinutes: loadMin,
      driveTimeFromPrevious: driveMin,
      driveDistanceKm: dt.distanceKm,
      isEstimate: dt.isEstimate,
      orderId: seg.orderId,
      orderNumber: seg.orderNumber,
      assignmentId: seg.assignmentId,
      customerDeadline: seg.customerEndTime,
      isLate,
      minutesLate,
      minutesEarly: 0,
    });

    currentTime += loadMin;
    currentLocation = seg.pickupAddress;
  }

  // 6. Return trip
  if (anyTrailer && pickupOrder.length > 0) {
    const dtToWinkel = await fetchLegDriveTime(currentLocation, 'winkel', date, currentTime);
    const driveToWinkel = getMinutes(dtToWinkel);
    currentTime += driveToWinkel;
    totalDriveMinutes += driveToWinkel;

    const shopUnloadMinutes = pickupOrder.reduce((sum, seg) =>
      sum + estimateLoadUnloadTime({
        segment: 'ophalen',
        vehicleCount: seg.vehicleCount,
        hasTrailer: seg.hasTrailer,
      }), 0);

    stops.push({
      type: 'lossen_winkel',
      label: 'Lossen bij Winkel',
      address: 'winkel',
      estimatedArrival: minutesToTime(currentTime),
      estimatedDeparture: minutesToTime(currentTime + shopUnloadMinutes),
      durationMinutes: shopUnloadMinutes,
      driveTimeFromPrevious: driveToWinkel,
      driveDistanceKm: dtToWinkel.distanceKm,
      isEstimate: dtToWinkel.isEstimate,
      isLate: false,
      minutesLate: 0,
      minutesEarly: 0,
    });
    currentTime += shopUnloadMinutes;

    const dtToLoods = await fetchLegDriveTime('winkel', 'loods', date, currentTime);
    const driveToLoods = getMinutes(dtToLoods);
    currentTime += driveToLoods;
    totalDriveMinutes += driveToLoods;

    stops.push({
      type: 'afkoppelen_loods',
      label: 'Loods – Afkoppelen',
      address: 'loods',
      estimatedArrival: minutesToTime(currentTime),
      estimatedDeparture: minutesToTime(currentTime + TIME_CONSTANTS.TRAILER_COUPLING_TIME),
      durationMinutes: TIME_CONSTANTS.TRAILER_COUPLING_TIME,
      driveTimeFromPrevious: driveToLoods,
      driveDistanceKm: dtToLoods.distanceKm,
      isEstimate: dtToLoods.isEstimate,
      isLate: false,
      minutesLate: 0,
      minutesEarly: 0,
    });
    currentTime += TIME_CONSTANTS.TRAILER_COUPLING_TIME;

    const dtFinal = await fetchLegDriveTime('loods', 'winkel', date, currentTime);
    const driveFinal = getMinutes(dtFinal);
    currentTime += driveFinal;
    totalDriveMinutes += driveFinal;

    stops.push({
      type: 'aankomst_winkel',
      label: 'Aankomst Winkel',
      address: 'winkel',
      estimatedArrival: minutesToTime(currentTime),
      estimatedDeparture: minutesToTime(currentTime),
      durationMinutes: 0,
      driveTimeFromPrevious: driveFinal,
      driveDistanceKm: dtFinal.distanceKm,
      isEstimate: dtFinal.isEstimate,
      isLate: false,
      minutesLate: 0,
      minutesEarly: 0,
    });
  } else if (anyTrailer) {
    const dtToLoods = await fetchLegDriveTime(currentLocation, 'loods', date, currentTime);
    const driveToLoods = getMinutes(dtToLoods);
    currentTime += driveToLoods;
    totalDriveMinutes += driveToLoods;

    stops.push({
      type: 'afkoppelen_loods',
      label: 'Loods – Afkoppelen',
      address: 'loods',
      estimatedArrival: minutesToTime(currentTime),
      estimatedDeparture: minutesToTime(currentTime + TIME_CONSTANTS.TRAILER_COUPLING_TIME),
      durationMinutes: TIME_CONSTANTS.TRAILER_COUPLING_TIME,
      driveTimeFromPrevious: driveToLoods,
      driveDistanceKm: dtToLoods.distanceKm,
      isEstimate: dtToLoods.isEstimate,
      isLate: false,
      minutesLate: 0,
      minutesEarly: 0,
    });
    currentTime += TIME_CONSTANTS.TRAILER_COUPLING_TIME;

    const dtFinal = await fetchLegDriveTime('loods', 'winkel', date, currentTime);
    const driveFinal = getMinutes(dtFinal);
    currentTime += driveFinal;
    totalDriveMinutes += driveFinal;

    stops.push({
      type: 'aankomst_winkel',
      label: 'Aankomst Winkel',
      address: 'winkel',
      estimatedArrival: minutesToTime(currentTime),
      estimatedDeparture: minutesToTime(currentTime),
      durationMinutes: 0,
      driveTimeFromPrevious: driveFinal,
      driveDistanceKm: dtFinal.distanceKm,
      isEstimate: dtFinal.isEstimate,
      isLate: false,
      minutesLate: 0,
      minutesEarly: 0,
    });
  } else {
    const dtReturn = await fetchLegDriveTime(currentLocation, 'winkel', date, currentTime);
    const driveReturn = getMinutes(dtReturn);
    currentTime += driveReturn;
    totalDriveMinutes += driveReturn;

    const shopUnloadMinutes = pickupOrder.reduce((sum, seg) =>
      sum + estimateLoadUnloadTime({
        segment: 'ophalen',
        vehicleCount: seg.vehicleCount,
        hasTrailer: false,
      }), 0);

    if (shopUnloadMinutes > 0) {
      stops.push({
        type: 'lossen_winkel',
        label: 'Lossen bij Winkel',
        address: 'winkel',
        estimatedArrival: minutesToTime(currentTime),
        estimatedDeparture: minutesToTime(currentTime + shopUnloadMinutes),
        durationMinutes: shopUnloadMinutes,
        driveTimeFromPrevious: driveReturn,
        driveDistanceKm: dtReturn.distanceKm,
        isEstimate: dtReturn.isEstimate,
        isLate: false,
        minutesLate: 0,
        minutesEarly: 0,
      });
      currentTime += shopUnloadMinutes;
    } else {
      stops.push({
        type: 'aankomst_winkel',
        label: 'Aankomst Winkel',
        address: 'winkel',
        estimatedArrival: minutesToTime(currentTime),
        estimatedDeparture: minutesToTime(currentTime),
        durationMinutes: 0,
        driveTimeFromPrevious: driveReturn,
        driveDistanceKm: dtReturn.distanceKm,
        isEstimate: dtReturn.isEstimate,
        isLate: false,
        minutesLate: 0,
        minutesEarly: 0,
      });
    }
  }

  const workEndTime = currentTime;
  const totalWorkMinutes = workEndTime - workStartTime;

  const totalLatePenalty = stops.reduce((sum, s) => sum + s.minutesLate * LATE_PENALTY, 0);
  const score = totalDriveMinutes + totalLatePenalty;

  const orderSequence = [
    ...deliveryOrder.map(o => ({ orderId: o.orderId, orderNumber: o.orderNumber, segment: 'leveren' as const })),
    ...pickupOrder.map(o => ({ orderId: o.orderId, orderNumber: o.orderNumber, segment: 'ophalen' as const })),
  ];

  return {
    stops,
    totalDriveMinutes,
    totalWorkMinutes: Math.round(totalWorkMinutes),
    workStartTime: minutesToTime(workStartTime),
    workEndTime: minutesToTime(workEndTime),
    feasible,
    warnings,
    score,
    orderSequence,
  };
}

/**
 * Find the optimal route sequence for a set of orders.
 * Tries permutations of delivery and pickup orders separately.
 * For <= 4 orders per type, evaluates all permutations.
 * For > 4, uses a greedy heuristic (nearest neighbor / earliest deadline).
 */
export async function optimizeRoute(
  orders: RouteOrder[],
  date: string,
): Promise<OptimizedRoute> {
  const deliveries = orders.filter(o => o.segment === 'leveren');
  const pickups = orders.filter(o => o.segment === 'ophalen');
  const anyTrailer = orders.some(o => o.hasTrailer);

  // Generate candidate sequences
  let deliveryPerms: RouteOrder[][];
  if (deliveries.length <= 4) {
    deliveryPerms = permutations(deliveries);
  } else {
    deliveryPerms = [
      [...deliveries].sort((a, b) =>
        timeToMinutes(a.customerStartTime) - timeToMinutes(b.customerStartTime),
      ),
    ];
  }

  let pickupPerms: RouteOrder[][];
  if (pickups.length <= 4) {
    pickupPerms = permutations(pickups);
  } else {
    pickupPerms = [
      [...pickups].sort((a, b) =>
        timeToMinutes(a.customerEndTime) - timeToMinutes(b.customerEndTime),
      ),
    ];
  }

  // Evaluate all combinations with real traffic data
  let bestRoute: OptimizedRoute | null = null;

  for (const dp of deliveryPerms) {
    for (const pp of pickupPerms) {
      const route = await evaluateSequence(dp, pp, date, anyTrailer);
      if (!bestRoute || route.score < bestRoute.score) {
        bestRoute = route;
      }
    }
  }

  return bestRoute!;
}

/**
 * Evaluate a fixed sequence of orders (no permutation).
 * Use for Route Builder: respect manual stop order.
 * Orders must be in desired sequence; deliveries and pickups are split by segment
 * (deliveries first in order, then pickups in order).
 */
export async function evaluateFixedSequence(
  orders: RouteOrder[],
  date: string,
): Promise<OptimizedRoute> {
  const deliveryOrder = orders.filter(o => o.segment === 'leveren');
  const pickupOrder = orders.filter(o => o.segment === 'ophalen');
  const anyTrailer = orders.some(o => o.hasTrailer);
  return evaluateSequence(deliveryOrder, pickupOrder, date, anyTrailer);
}
