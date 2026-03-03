/**
 * Smart Day Planner: combineert transport-toewijzing, chauffeur-toewijzing
 * en route-optimalisatie in één geïntegreerde flow.
 * 
 * Flow:
 * 1. Haal alle orders op voor de geselecteerde datum
 * 2. Wijs transport toe aan orders zonder transport
 * 3. Wijs chauffeurs toe aan slots zonder chauffeur
 * 4. Bereken per chauffeur de optimale route met real-time rijtijden
 * 5. Retourneer een compleet dagplan met haalbaarheid en tijdlijn
 */

import { supabase } from '@/integrations/supabase/client';
import { TransportMaterial, CombiTransport, VehicleType } from '@/data/transportData';
import { calculateMixedCapacity, VehicleLoad } from '@/utils/capacityCalculator';
import { getDayOfWeek } from '@/hooks/useDriverSchedules';
import { optimizeRoute, RouteOrder, OptimizedRoute } from '@/utils/routeOptimizer';
import { calculateTripSplit, TripSplitResult, generateTripAssignments } from '@/utils/tripSplitter';

// ── Types ────────────────────────────────────────────────

export interface SmartPlanOrder {
  orderId: string;
  orderNumber: string;
  customerName: string;
  deliveryDate: string;
  pickupDate: string;
  deliveryTime: string;
  pickupTime: string;
  deliveryAddress: string;
  pickupAddress: string;
  vehicleLoad: VehicleLoad[];
  vehicleSummary: string;
  activeSegments: ('leveren' | 'ophalen')[];
  existingAssignments: {
    id: string;
    segment: string;
    transportId: string;
    driverId: string | null;
  }[];
  needsTransport: ('leveren' | 'ophalen')[];
  needsDriver: ('leveren' | 'ophalen')[];
}

export interface SmartPlanDriverRoute {
  driverId: string;
  driverName: string;
  canDriveTrailer: boolean;
  workStart: string;
  workEnd: string;
  orders: {
    orderId: string;
    orderNumber: string;
    customerName: string;
    segment: 'leveren' | 'ophalen';
    time: string;
    transportName: string;
    transportId: string;
    assignmentId: string;
  }[];
  route: OptimizedRoute | null;
  warnings: string[];
}

export interface TransportUtilization {
  transportId: string;
  transportName: string;
  isCombi: boolean;
  totalLoad: VehicleLoad[];
  utilizationPercent: number;
  remainingSpace: { [key in VehicleType]: number };
  orderNumbers: string[];
}

export interface SmartPlanResult {
  date: string;
  orders: SmartPlanOrder[];
  // Transport suggestions for orders without transport
  transportSuggestions: {
    orderId: string;
    orderNumber: string;
    segments: ('leveren' | 'ophalen')[];
    suggestedTransportId: string;
    suggestedTransportName: string;
    utilizationPercent: number;
    isCombi: boolean;
    vehicleLoad: VehicleLoad[];
    /** Multi-trip info: hoeveel ritten per segment */
    tripCount: number;
    /** Sequence number voor multi-trip assignments */
    sequenceNumber: number;
    /** Lading voor deze specifieke rit */
    tripLoad: VehicleLoad[];
  }[];
  // Trip split analysis per order (voor grote orders)
  tripSplitAnalysis: Map<string, TripSplitResult>;
  // Capacity utilization per transport
  transportUtilization: TransportUtilization[];
  // Per-driver route plans
  driverRoutes: SmartPlanDriverRoute[];
  // Orders that couldn't be fully planned
  unplannedWarnings: string[];
  // Summary
  totalOrders: number;
  totalDrivers: number;
  allFeasible: boolean;
}

// ── DB Types ─────────────────────────────────────────────

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
  start_location: string;
  end_location: string;
  delivery_date: string | null;
  delivery_time: string | null;
  pickup_date: string | null;
  pickup_time: string | null;
  status: string;
  vehicle_types: unknown;
  notes: string | null;
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

// ── Main function ────────────────────────────────────────

export async function calculateSmartDayPlan(
  date: string,
  allTransport: (TransportMaterial | CombiTransport)[],
  onProgress?: (step: string) => void,
): Promise<SmartPlanResult> {
  const warnings: string[] = [];

  // ── 1. Fetch orders for this date ──
  onProgress?.('Orders ophalen...');
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

  if (orders.length === 0) {
    return {
      date,
      orders: [],
      transportSuggestions: [],
      tripSplitAnalysis: new Map(),
      transportUtilization: [],
      driverRoutes: [],
      unplannedWarnings: [],
      totalOrders: 0,
      totalDrivers: 0,
      allFeasible: true,
    };
  }

  const orderIds = orders.map(o => o.id);
  const orderMap = new Map(orders.map(o => [o.id, o]));

  // ── 2. Fetch existing assignments ──
  onProgress?.('Toewijzingen laden...');
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

  // ── 3. Build order info ──
  const bakwagens = allTransport.filter(t => 'type' in t && t.type === 'bakwagen') as TransportMaterial[];
  const combis = allTransport.filter(t => 'bakwagenId' in t) as CombiTransport[];
  const transportMap = new Map(allTransport.map(t => [t.id, t]));

  const smartOrders: SmartPlanOrder[] = orders.map(o => {
    const deliveryDate = o.delivery_date || o.start_date;
    const pickupDate = o.pickup_date || o.end_date;
    const deliveryTime = (o.delivery_time || o.start_time)?.slice(0, 5) || '09:00';
    const pickupTime = (o.pickup_time || o.end_time)?.slice(0, 5) || '17:00';

    const activeSegments: ('leveren' | 'ophalen')[] = [];
    if (deliveryDate === date) activeSegments.push('leveren');
    if (pickupDate === date) activeSegments.push('ophalen');

    const existingAssignments = (assignmentsByOrder.get(o.id) || [])
      .filter(a => activeSegments.includes(a.segment as 'leveren' | 'ophalen'))
      .map(a => ({
        id: a.id,
        segment: a.segment,
        transportId: a.transport_id,
        driverId: a.driver_id,
      }));

    const rawVehicleTypes = o.vehicle_types as { type: string; count: number }[] | null;
    const vehicleTypes = Array.isArray(rawVehicleTypes) ? rawVehicleTypes : [];
    const vehicleLoad: VehicleLoad[] = vehicleTypes.map(v => ({
      type: v.type as VehicleType,
      quantity: v.count,
    }));
    const vehicleSummary = vehicleTypes.map(v => `${v.count}× ${v.type}`).join(', ');

    const needsTransport = activeSegments.filter(seg =>
      !existingAssignments.some(a => a.segment === seg)
    );
    const needsDriver = activeSegments.filter(seg => {
      const a = existingAssignments.find(a => a.segment === seg);
      return !a || !a.driverId;
    });

    return {
      orderId: o.id,
      orderNumber: o.order_number,
      customerName: o.company_name || `${o.first_name} ${o.last_name}`,
      deliveryDate,
      pickupDate,
      deliveryTime,
      pickupTime,
      deliveryAddress: o.start_location,
      pickupAddress: o.end_location,
      vehicleLoad,
      vehicleSummary,
      activeSegments,
      existingAssignments,
      needsTransport,
      needsDriver,
    };
  });

  // ── 4. Generate transport suggestions (with multi-trip support) ──
  onProgress?.('Transport berekenen...');
  const transportInUse = new Set<string>();
  for (const o of smartOrders) {
    for (const a of o.existingAssignments) {
      transportInUse.add(a.transportId);
    }
  }

  const suggestedTransportIds = new Set<string>();
  const transportSuggestions: SmartPlanResult['transportSuggestions'] = [];
  const tripSplitAnalysis = new Map<string, TripSplitResult>();

  // Also track simulated assignments for driver planning
  const simulatedAssignments = new Map<string, { segment: string; transportId: string; assignmentId: string; vehicleCount: number }[]>();

  for (const order of smartOrders) {
    if (order.needsTransport.length === 0) continue;
    if (order.vehicleLoad.length === 0) {
      warnings.push(`${order.orderNumber}: geen voertuigtypen opgegeven`);
      continue;
    }

    // Check if this order needs multi-trip splitting
    const splitResult = calculateTripSplit(order.vehicleLoad, allTransport);
    tripSplitAnalysis.set(order.orderId, splitResult);

    if (splitResult.fitsInOneTrip) {
      // ── Single trip: original logic ──
      let bestTransport: (TransportMaterial | CombiTransport) | null = null;
      let bestUtil = 0;
      let isReuse = false;

      for (const tid of transportInUse) {
        if (suggestedTransportIds.has(tid)) continue;
        const t = transportMap.get(tid);
        if (!t) continue;
        const result = calculateMixedCapacity(t, order.vehicleLoad);
        if (result.fits && result.usedCapacity > bestUtil) {
          bestTransport = t;
          bestUtil = result.usedCapacity;
          isReuse = true;
        }
      }

      if (!bestTransport) {
        for (const b of bakwagens) {
          if (suggestedTransportIds.has(b.id)) continue;
          const result = calculateMixedCapacity(b, order.vehicleLoad);
          if (result.fits && result.usedCapacity > bestUtil) {
            bestTransport = b;
            bestUtil = result.usedCapacity;
          }
        }
      }

      if (!bestTransport) {
        for (const c of combis) {
          if (suggestedTransportIds.has(c.id)) continue;
          const result = calculateMixedCapacity(c, order.vehicleLoad);
          if (result.fits && result.usedCapacity > bestUtil) {
            bestTransport = c;
            bestUtil = result.usedCapacity;
          }
        }
      }

      if (bestTransport) {
        if (!isReuse) suggestedTransportIds.add(bestTransport.id);
        transportSuggestions.push({
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          segments: order.needsTransport,
          suggestedTransportId: bestTransport.id,
          suggestedTransportName: bestTransport.name,
          utilizationPercent: bestUtil,
          isCombi: 'bakwagenId' in bestTransport,
          vehicleLoad: order.vehicleLoad,
          tripCount: 1,
          sequenceNumber: 1,
          tripLoad: order.vehicleLoad,
        });

        const simulated = order.needsTransport.map(seg => ({
          segment: seg,
          transportId: bestTransport!.id,
          assignmentId: `sim-${order.orderId}-${seg}`,
          vehicleCount: order.vehicleLoad.reduce((sum, v) => sum + v.quantity, 0),
        }));
        simulatedAssignments.set(order.orderId, simulated);
      } else {
        warnings.push(`${order.orderNumber}: geen passend transport gevonden`);
      }
    } else {
      // ── Multi-trip: use recommended strategy from trip splitter ──
      const strategy = splitResult.recommended === 'parallel' && splitResult.parallel
        ? splitResult.parallel
        : splitResult.pendel;

      if (!strategy) {
        warnings.push(`${order.orderNumber}: geen multi-trip strategie gevonden`);
        continue;
      }

      const tripAssignments = generateTripAssignments(order.orderId, order.needsTransport[0], strategy);
      const totalTrips = tripAssignments.length;

      for (const ta of tripAssignments) {
        const transport = transportMap.get(ta.transportId);
        if (!transport) continue;

        suggestedTransportIds.add(ta.transportId);
        if ('bakwagenId' in transport) {
          suggestedTransportIds.add((transport as CombiTransport).bakwagenId);
          suggestedTransportIds.add((transport as CombiTransport).aanhangerId);
        }

        const tripVehicleCount = ta.tripLoad.reduce((sum, v) => sum + v.quantity, 0);
        const capResult = calculateMixedCapacity(transport, ta.tripLoad);

        transportSuggestions.push({
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          segments: order.needsTransport,
          suggestedTransportId: ta.transportId,
          suggestedTransportName: transport.name,
          utilizationPercent: capResult.usedCapacity,
          isCombi: 'bakwagenId' in transport,
          vehicleLoad: order.vehicleLoad,
          tripCount: totalTrips,
          sequenceNumber: ta.sequenceNumber,
          tripLoad: ta.tripLoad,
        });
      }

      // Track simulated assignments for driver planning
      const simulated = tripAssignments.flatMap(ta =>
        order.needsTransport.map(seg => ({
          segment: seg,
          transportId: ta.transportId,
          assignmentId: `sim-${order.orderId}-${seg}-trip${ta.sequenceNumber}`,
          vehicleCount: ta.tripLoad.reduce((sum, v) => sum + v.quantity, 0),
        })),
      );
      simulatedAssignments.set(order.orderId, simulated);

      warnings.push(
        `${order.orderNumber}: ${splitResult.recommended === 'parallel' ? 'parallel' : 'pendel'} — ${splitResult.recommendationReason}`,
      );
    }
  }

  // ── 5. Driver assignment ──
  onProgress?.('Chauffeurs berekenen...');
  const { data: drivers, error: driverErr } = await supabase
    .from('drivers')
    .select('*')
    .eq('is_active', true)
    .eq('is_available', true);
  if (driverErr) throw driverErr;

  const dayOfWeek = getDayOfWeek(date);
  const { data: schedules } = await supabase
    .from('driver_weekly_schedules')
    .select('*')
    .eq('day_of_week', dayOfWeek);
  const { data: exceptions } = await supabase
    .from('driver_schedule_exceptions')
    .select('*')
    .eq('exception_date', date);

  const scheduleMap = new Map((schedules || []).map((s: any) => [s.driver_id, s]));
  const exceptionMap = new Map((exceptions || []).map((e: any) => [e.driver_id, e]));

  // Build available drivers
  interface DriverInfo {
    id: string;
    name: string;
    canDriveTrailer: boolean;
    workStart: string;
    workEnd: string;
    assignedSlots: { orderId: string; segment: string; time: string; transportId: string; assignmentId: string }[];
  }

  const availableDrivers: DriverInfo[] = [];
  for (const driver of (drivers as DbDriver[] || [])) {
    const exception = exceptionMap.get(driver.id);
    const schedule = scheduleMap.get(driver.id);

    let isAvailable = true;
    let workStart = '07:00';
    let workEnd = '16:00';

    if (exception) {
      isAvailable = (exception as any).is_available;
      workStart = (exception as any).start_time?.slice(0, 5) || workStart;
      workEnd = (exception as any).end_time?.slice(0, 5) || workEnd;
    } else if (schedule) {
      isAvailable = (schedule as any).is_working;
      workStart = (schedule as any).start_time_1?.slice(0, 5) || workStart;
      workEnd = (schedule as any).end_time_1?.slice(0, 5) || workEnd;
    }

    if (!isAvailable) continue;

    availableDrivers.push({
      id: driver.id,
      name: driver.name,
      canDriveTrailer: driver.can_drive_trailer,
      workStart,
      workEnd,
      assignedSlots: [],
    });
  }

  // Collect all slots that need a driver (existing + simulated)
  interface DriverSlot {
    orderId: string;
    orderNumber: string;
    customerName: string;
    segment: 'leveren' | 'ophalen';
    time: string;
    transportId: string;
    assignmentId: string;
    requiresTrailer: boolean;
    deliveryAddress: string;
    pickupAddress: string;
    vehicleCount: number;
    hasTrailer: boolean;
    customerStartTime: string;
    customerEndTime: string;
    startDate: string;
    endDate: string;
  }

  const slotsNeedingDriver: DriverSlot[] = [];

  for (const order of smartOrders) {
    const simulated = simulatedAssignments.get(order.orderId) || [];

    for (const seg of order.activeSegments) {
      // Check existing assignments (may be multiple for multi-trip)
      const existingAssignmentsForSeg = order.existingAssignments.filter(a => a.segment === seg);
      const simulatedForSeg = simulated.filter(s => s.segment === seg);

      // Process existing assignments with drivers
      for (const existingA of existingAssignmentsForSeg) {
        if (existingA.driverId) {
          const driver = availableDrivers.find(d => d.id === existingA.driverId);
          if (driver) {
            driver.assignedSlots.push({
              orderId: order.orderId,
              segment: seg,
              time: seg === 'leveren' ? order.deliveryTime : order.pickupTime,
              transportId: existingA.transportId,
              assignmentId: existingA.id,
            });
          }
        }
      }

      // Collect all unassigned slots (existing without driver + simulated)
      const unassignedExisting = existingAssignmentsForSeg.filter(a => !a.driverId);
      const allUnassigned = [
        ...unassignedExisting.map(a => ({
          transportId: a.transportId,
          assignmentId: a.id,
          vehicleCount: 'vehicleCount' in a ? (a as any).vehicleCount : order.vehicleLoad.reduce((sum, v) => sum + v.quantity, 0),
        })),
        ...simulatedForSeg.map(s => ({
          transportId: s.transportId,
          assignmentId: s.assignmentId,
          vehicleCount: s.vehicleCount,
        })),
      ];

      for (const assignment of allUnassigned) {
        const transportId = assignment.transportId;
        const requiresTrailer = transportId.startsWith('combi-') || !!(transportMap.get(transportId) && 'bakwagenId' in transportMap.get(transportId)!);

        slotsNeedingDriver.push({
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          segment: seg,
          time: seg === 'leveren' ? order.deliveryTime : order.pickupTime,
          transportId,
          assignmentId: assignment.assignmentId,
          requiresTrailer,
          deliveryAddress: order.deliveryAddress,
          pickupAddress: order.pickupAddress,
          vehicleCount: assignment.vehicleCount,
          hasTrailer: requiresTrailer,
          customerStartTime: order.deliveryTime,
          customerEndTime: order.pickupTime,
          startDate: order.deliveryDate,
          endDate: order.pickupDate,
        });
      }
    }
  }

  // Sort: multi-segment orders first, then by time
  const slotsByOrder = new Map<string, DriverSlot[]>();
  for (const slot of slotsNeedingDriver) {
    if (!slotsByOrder.has(slot.orderId)) slotsByOrder.set(slot.orderId, []);
    slotsByOrder.get(slot.orderId)!.push(slot);
  }

  const orderGroups = Array.from(slotsByOrder.entries()).sort((a, b) => {
    if (a[1].length !== b[1].length) return b[1].length - a[1].length;
    const aTime = a[1].reduce((min, s) => s.time < min ? s.time : min, '99:99');
    const bTime = b[1].reduce((min, s) => s.time < min ? s.time : min, '99:99');
    return aTime.localeCompare(bTime);
  });

  // Assign drivers
  const driverAssignedOrderMap = new Map<string, string>(); // orderId → driverId

  for (const [orderId, slots] of orderGroups) {
    slots.sort((a, b) => {
      if (a.segment === 'leveren' && b.segment === 'ophalen') return -1;
      if (a.segment === 'ophalen' && b.segment === 'leveren') return 1;
      return a.time.localeCompare(b.time);
    });

    for (const slot of slots) {
      const pairedDriverId = driverAssignedOrderMap.get(orderId);

      const candidates = availableDrivers.filter(d => {
        if (slot.requiresTrailer && !d.canDriveTrailer) return false;
        // Simple time conflict check
        const existingTimes = d.assignedSlots.map(s => s.time);
        if (existingTimes.includes(slot.time)) return false;
        return true;
      });

      // Prefer: paired driver > fewest assignments
      candidates.sort((a, b) => {
        const aP = a.id === pairedDriverId ? 1 : 0;
        const bP = b.id === pairedDriverId ? 1 : 0;
        if (aP !== bP) return bP - aP;
        return a.assignedSlots.length - b.assignedSlots.length;
      });

      const best = candidates[0];
      if (best) {
        best.assignedSlots.push({
          orderId: slot.orderId,
          segment: slot.segment,
          time: slot.time,
          transportId: slot.transportId,
          assignmentId: slot.assignmentId,
        });
        if (!driverAssignedOrderMap.has(orderId)) {
          driverAssignedOrderMap.set(orderId, best.id);
        }
      } else {
        warnings.push(`${slot.orderNumber} (${slot.segment}): geen beschikbare chauffeur${slot.requiresTrailer ? ' met AH-bevoegdheid' : ''}`);
      }
    }
  }

  // ── 6. Route optimization per driver ──
  onProgress?.('Routes optimaliseren (rijtijden ophalen)...');
  const driversWithOrders = availableDrivers.filter(d => d.assignedSlots.length > 0);

  const driverRoutes: SmartPlanDriverRoute[] = [];

  for (const driver of driversWithOrders) {
    // Build RouteOrder for the optimizer
    const routeOrders: RouteOrder[] = driver.assignedSlots.map(slot => {
      const order = smartOrders.find(o => o.orderId === slot.orderId)!;
      return {
        orderId: slot.orderId,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        deliveryAddress: order.deliveryAddress,
        pickupAddress: order.pickupAddress,
        customerStartTime: order.deliveryTime,
        customerEndTime: order.pickupTime,
        startDate: order.deliveryDate,
        endDate: order.pickupDate,
        vehicleCount: order.vehicleLoad.reduce((sum, v) => sum + v.quantity, 0),
        transportId: slot.transportId,
        hasTrailer: slot.transportId.startsWith('combi-') || !!(transportMap.get(slot.transportId) && 'bakwagenId' in transportMap.get(slot.transportId)!),
        assignmentId: slot.assignmentId,
        segment: slot.segment as 'leveren' | 'ophalen',
        notes: undefined,
      };
    });

    let route: OptimizedRoute | null = null;
    const driverWarnings: string[] = [];

    try {
      onProgress?.(`Route berekenen voor ${driver.name}...`);
      route = await optimizeRoute(routeOrders, date);

      if (!route.feasible) {
        driverWarnings.push('⚠️ Niet alle klanten kunnen op tijd bereikt worden');
      }
      if (route.warnings.length > 0) {
        driverWarnings.push(...route.warnings);
      }
    } catch (err) {
      console.error(`Route optimization failed for ${driver.name}:`, err);
      driverWarnings.push('Route-berekening mislukt');
    }

    const transportNameMap = new Map(allTransport.map(t => [t.id, t.name]));

    driverRoutes.push({
      driverId: driver.id,
      driverName: driver.name,
      canDriveTrailer: driver.canDriveTrailer,
      workStart: driver.workStart,
      workEnd: driver.workEnd,
      orders: driver.assignedSlots.map(s => {
        const order = smartOrders.find(o => o.orderId === s.orderId)!;
        return {
          orderId: s.orderId,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          segment: s.segment as 'leveren' | 'ophalen',
          time: s.time,
          transportName: transportNameMap.get(s.transportId) || s.transportId,
          transportId: s.transportId,
          assignmentId: s.assignmentId,
        };
      }),
      route,
      warnings: driverWarnings,
    });
  }

  const allFeasible = driverRoutes.every(dr => dr.route?.feasible !== false);

  // ── 7. Calculate transport utilization ──
  onProgress?.('Capaciteit berekenen...');
  const transportLoadMap = new Map<string, { load: VehicleLoad[]; orderNumbers: string[] }>();

  // Collect loads from all assignments (existing + suggested)
  for (const order of smartOrders) {
    for (const a of order.existingAssignments) {
      if (!transportLoadMap.has(a.transportId)) {
        transportLoadMap.set(a.transportId, { load: [], orderNumbers: [] });
      }
      const entry = transportLoadMap.get(a.transportId)!;
      // Merge vehicle loads
      for (const vl of order.vehicleLoad) {
        const existing = entry.load.find(l => l.type === vl.type);
        if (existing) existing.quantity += vl.quantity;
        else entry.load.push({ ...vl });
      }
      if (!entry.orderNumbers.includes(order.orderNumber)) {
        entry.orderNumbers.push(order.orderNumber);
      }
    }
  }
  for (const ts of transportSuggestions) {
    if (!transportLoadMap.has(ts.suggestedTransportId)) {
      transportLoadMap.set(ts.suggestedTransportId, { load: [], orderNumbers: [] });
    }
    const entry = transportLoadMap.get(ts.suggestedTransportId)!;
    for (const vl of ts.vehicleLoad) {
      const existing = entry.load.find(l => l.type === vl.type);
      if (existing) existing.quantity += vl.quantity;
      else entry.load.push({ ...vl });
    }
    if (!entry.orderNumbers.includes(ts.orderNumber)) {
      entry.orderNumbers.push(ts.orderNumber);
    }
  }

  const transportUtilization: TransportUtilization[] = [];
  for (const [tid, { load, orderNumbers }] of transportLoadMap) {
    const t = transportMap.get(tid);
    if (!t) continue;
    const result = calculateMixedCapacity(t, load);
    transportUtilization.push({
      transportId: tid,
      transportName: t.name,
      isCombi: 'bakwagenId' in t,
      totalLoad: load,
      utilizationPercent: result.usedCapacity,
      remainingSpace: result.remainingSpace,
      orderNumbers,
    });
  }

  // Sort by utilization descending
  transportUtilization.sort((a, b) => b.utilizationPercent - a.utilizationPercent);

  return {
    date,
    orders: smartOrders,
    transportSuggestions,
    tripSplitAnalysis,
    transportUtilization,
    driverRoutes,
    unplannedWarnings: warnings,
    totalOrders: orders.length,
    totalDrivers: driverRoutes.length,
    allFeasible,
  };
}

/**
 * Apply the smart plan: create transport assignments + update driver assignments
 */
export async function applySmartPlan(
  plan: SmartPlanResult,
): Promise<void> {
  // 1. Create transport assignments (with multi-trip sequence numbers)
  const transportRecords = plan.transportSuggestions.flatMap(ts =>
    ts.segments.map(seg => ({
      order_id: ts.orderId,
      segment: seg,
      transport_id: ts.suggestedTransportId,
      sequence_number: ts.sequenceNumber,
    }))
  );

  if (transportRecords.length > 0) {
    const { error } = await supabase
      .from('order_transport_assignments')
      .insert(transportRecords);
    if (error) throw error;
  }

  // 2. Fetch newly created assignment IDs for driver assignment
  if (transportRecords.length > 0) {
    const newOrderIds = [...new Set(transportRecords.map(r => r.order_id))];
    const { data: newAssignments } = await supabase
      .from('order_transport_assignments')
      .select('*')
      .in('order_id', newOrderIds);

    // Update driver routes with real assignment IDs
    for (const dr of plan.driverRoutes) {
      for (const order of dr.orders) {
        if (order.assignmentId.startsWith('sim-')) {
          const realAssignment = (newAssignments || []).find(
            (a: any) => a.order_id === order.orderId && a.segment === order.segment
          );
          if (realAssignment) {
            order.assignmentId = (realAssignment as any).id;
          }
        }
      }
    }
  }

  // 3. Apply driver assignments
  const driverUpdates = plan.driverRoutes.flatMap(dr =>
    dr.orders
      .filter(o => !o.assignmentId.startsWith('sim-'))
      .map(o => ({
        assignmentId: o.assignmentId,
        driverId: dr.driverId,
      }))
  );

  for (const { assignmentId, driverId } of driverUpdates) {
    const { error } = await supabase
      .from('order_transport_assignments')
      .update({ driver_id: driverId })
      .eq('id', assignmentId);
    if (error) throw error;
  }
}
