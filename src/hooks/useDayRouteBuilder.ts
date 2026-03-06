import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTransport } from '@/context/TransportContext';
import { vehicleTypes as vehicleTypesList } from '@/data/transportData';
import { estimateLoadUnloadTime, needsTrailer, LOCATIONS } from '@/utils/driverScheduleCalculator';
import { evaluateFixedSequence, type OptimizedStop, type RouteOrder } from '@/utils/routeOptimizer';

// ── Types ──────────────────────────────────────────────

export interface VehicleQuantity {
  type: string;
  count: number;
}

export interface RouteBuilderOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  companyName: string | null;
  startLocation: string;
  endLocation: string;
  vehicleTypes: VehicleQuantity[];
  vehicleSummary: string;
  totalVehicles: number;
  // Logistic dates
  deliveryDate: string | null;
  deliveryTime: string | null;
  pickupDate: string | null;
  pickupTime: string | null;
  // Booking dates
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  // Windows - voor vroege levering/ophaling
  deliveryWindowStart: string | null;
  deliveryWindowEnd: string | null;
  pickupWindowStart: string | null;
  pickupWindowEnd: string | null;
  // Status
  status: string;
  notes: string | null;
  numberOfPersons: number;
  // Active segments on this date
  activeSegments: ('leveren' | 'ophalen')[];
}

export interface RouteBuilderAssignment {
  id: string;
  orderId: string;
  segment: 'leveren' | 'ophalen';
  transportId: string;
  transportName: string;
  driverId: string | null;
  driverName: string | null;
  sequenceNumber: number;
  tripStatus: string;
  // Calculated vehicle count for this assignment
  vehicleCount: number;
}

export interface RouteBuilderStop {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  companyName: string | null;
  customerPhone: string;
  assignmentId: string | null;
  segment: 'leveren' | 'ophalen';
  stopType: string;
  locationAddress: string;
  estimatedArrival: string | null;
  estimatedDeparture: string | null;
  driveTimeFromPrevious: number | null;
  loadUnloadMinutes: number | null;
  vehicleSummary: string;
  vehicleTypes: VehicleQuantity[];
  totalVehicles: number;
  // Assigned vehicles for this specific stop (partial quantity)
  assignedVehicles: VehicleQuantity[] | null;
  assignedVehicleSummary: string;
  assignedTotalVehicles: number;
  transportName: string;
  notes: string | null;
  // Customer time info
  customerTime: string; // When customer expects delivery/pickup
  windowStart: string | null; // Earliest allowed
  windowEnd: string | null; // Latest allowed
  sequenceNumber: number;
}

export interface RouteBuilderDriver {
  id: string;
  name: string;
  phone: string;
  canDriveTrailer: boolean;
  isAvailable: boolean;
  routeId: string | null;
  routeStatus: string;
  transportMaterialId: string | null;
  transportMaterialName: string | null;
  stops: RouteBuilderStop[];
  totalDriveMinutes: number;
  totalLoadMinutes: number;
  estimatedStartTime: string | null;
  estimatedEndTime: string | null;
}

export interface UnassignedStop {
  orderId: string;
  orderNumber: string;
  customerName: string;
  companyName: string | null;
  segment: 'leveren' | 'ophalen';
  location: string;
  time: string;
  windowStart: string | null;
  windowEnd: string | null;
  vehicleSummary: string;
  vehicleTypes: VehicleQuantity[];
  totalVehicles: number;
  // Remaining vehicles not yet assigned to any driver stop
  remainingVehicles: VehicleQuantity[];
  remainingVehicleSummary: string;
  remainingTotalVehicles: number;
  assignmentId: string | null;
  transportId: string | null;
  transportName: string | null;
  notes: string | null;
  // Whether this is a partial (some vehicles already assigned to other stops)
  isPartial: boolean;
}

// ── Hook ───────────────────────────────────────────────

export function useDayRouteBuilder(date: string) {
  const queryClient = useQueryClient();
  const { allTransportMaterials, combis } = useTransport();
  const allTransport = [...allTransportMaterials, ...combis];

  const getTransportName = (id: string) =>
    allTransport.find(t => t.id === id)?.name || id;

  const getVehicleSummary = (vTypes: VehicleQuantity[]) =>
    vTypes
      .filter(v => v.count > 0)
      .map(v => {
        const vt = vehicleTypesList.find(vt => vt.id === v.type);
        return `${v.count}x ${vt?.name || v.type}`;
      })
      .join(', ');

  // ── Main query ───────────────────────────────────────
  const query = useQuery({
    queryKey: ['day-route-builder', date, allTransport.length],
    queryFn: async () => {
      // 1. Fetch all relevant data in parallel
      const [ordersRes, driversRes, routesRes] = await Promise.all([
        supabase
          .from('orders')
          .select('*')
          .in('status', ['bevestigd', 'optie']),
        supabase
          .from('drivers')
          .select('*')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('driver_day_routes')
          .select('*')
          .eq('route_date', date),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (driversRes.error) throw driversRes.error;
      if (routesRes.error) throw routesRes.error;

      const allOrders = ordersRes.data || [];
      const drivers = driversRes.data || [];
      const routes = routesRes.data || [];

      // 2. Filter orders active on this date
      const dateOrders = allOrders.filter(o => {
        const deliveryDate = (o as any).delivery_date || o.start_date;
        const pickupDate = (o as any).pickup_date || o.end_date;
        return deliveryDate === date || pickupDate === date;
      });

      if (dateOrders.length === 0 && routes.length === 0) {
        return {
          orders: [] as RouteBuilderOrder[],
          drivers: buildDriverList(drivers, routes, [], [], []),
          unassigned: [] as UnassignedStop[],
        };
      }

      // 3. Fetch route stops first (they may reference orders outside selected date)
      const stopsRes = routes.length > 0
        ? await supabase
            .from('driver_day_route_stops')
            .select('*')
            .in('route_id', routes.map(r => r.id))
            .order('sequence_number')
        : { data: [], error: null };
      if (stopsRes.error) throw stopsRes.error;
      const routeStops = (stopsRes.data || []) as any[];

      // Include orders referenced by existing route stops, even if not active on selected date.
      // This supports early deliveries / late pickups without breaking the planner.
      const referencedOrderIds = new Set(
        routeStops
          .map((s: any) => s.order_id)
          .filter((id: string | null): id is string => !!id)
      );
      const dateOrderIds = new Set(dateOrders.map(o => o.id));
      const extraReferencedOrders = allOrders.filter(
        o => referencedOrderIds.has(o.id) && !dateOrderIds.has(o.id)
      );
      const ordersForDayAndRoutes = [...dateOrders, ...extraReferencedOrders];

      const assignmentOrderIds = Array.from(
        new Set(ordersForDayAndRoutes.map(o => o.id))
      );
      const assignRes = assignmentOrderIds.length > 0
        ? await supabase
            .from('order_transport_assignments')
            .select('*')
            .in('order_id', assignmentOrderIds)
            .order('sequence_number')
        : { data: [], error: null };
      if (assignRes.error) throw assignRes.error;
      const assignments = (assignRes.data || []) as any[];

      // 4. Build orders
      const orders: RouteBuilderOrder[] = ordersForDayAndRoutes.map(o => {
        const deliveryDate = (o as any).delivery_date || o.start_date;
        const pickupDate = (o as any).pickup_date || o.end_date;
        const activeSegments: ('leveren' | 'ophalen')[] = [];
        if (deliveryDate === date) activeSegments.push('leveren');
        if (pickupDate === date) activeSegments.push('ophalen');

        const vTypes = (o.vehicle_types as VehicleQuantity[] || []);

        return {
          id: o.id,
          orderNumber: o.order_number,
          customerName: o.company_name || `${o.first_name} ${o.last_name}`.trim(),
          customerPhone: o.phone,
          companyName: o.company_name,
          startLocation: o.start_location,
          endLocation: o.end_location,
          vehicleTypes: vTypes,
          vehicleSummary: getVehicleSummary(vTypes),
          totalVehicles: vTypes.reduce((s, v) => s + v.count, 0),
          deliveryDate: (o as any).delivery_date,
          deliveryTime: (o as any).delivery_time,
          pickupDate: (o as any).pickup_date,
          pickupTime: (o as any).pickup_time,
          startDate: o.start_date,
          endDate: o.end_date,
          startTime: o.start_time,
          endTime: o.end_time,
          deliveryWindowStart: (o as any).delivery_window_start,
          deliveryWindowEnd: (o as any).delivery_window_end,
          pickupWindowStart: (o as any).pickup_window_start,
          pickupWindowEnd: (o as any).pickup_window_end,
          status: o.status,
          notes: o.notes,
          numberOfPersons: o.number_of_persons,
          activeSegments,
        };
      });

      const orderMap = new Map(orders.map(o => [o.id, o]));

      // 5. Calculate assigned vehicles per order+segment from route stops
      const assignedPerOrderSegment = new Map<string, VehicleQuantity[]>();
      for (const stop of routeStops) {
        const key = `${stop.order_id}-${stop.stop_type === 'leveren' || stop.stop_type === 'laden_winkel' ? 'leveren' : 'ophalen'}`;
        const assigned = (stop.assigned_vehicles as VehicleQuantity[] | null) || [];
        if (assigned.length > 0) {
          const existing = assignedPerOrderSegment.get(key) || [];
          // Merge quantities
          for (const av of assigned) {
            const found = existing.find(e => e.type === av.type);
            if (found) {
              found.count += av.count;
            } else {
              existing.push({ ...av });
            }
          }
          assignedPerOrderSegment.set(key, existing);
        }
      }

      // 6. Build unassigned list with remaining quantities
      const unassigned: UnassignedStop[] = [];
      const assignedStopKeys = new Set(
        routeStops.map((s: any) => `${s.order_id}-${s.assignment_id || ''}-${s.stop_type}`)
      );

      for (const order of orders) {
        for (const seg of order.activeSegments) {
          const segKey = `${order.id}-${seg}`;
          const totalAssignedForSeg = assignedPerOrderSegment.get(segKey) || [];

          // Calculate remaining
          const remaining: VehicleQuantity[] = order.vehicleTypes.map(vt => {
            const assigned = totalAssignedForSeg.find(a => a.type === vt.type);
            return {
              type: vt.type,
              count: Math.max(0, vt.count - (assigned?.count || 0)),
            };
          }).filter(v => v.count > 0);

          const remainingTotal = remaining.reduce((s, v) => s + v.count, 0);

          // Check if any stops exist without assigned_vehicles (legacy stops)
          const stopsForThisSeg = routeStops.filter(
            (s: any) => s.order_id === order.id &&
              (s.stop_type === seg || (seg === 'leveren' && s.stop_type === 'laden_winkel') ||
               (seg === 'ophalen' && s.stop_type === 'lossen_winkel'))
          );
          const hasAnyStops = stopsForThisSeg.length > 0;
          const allStopsHaveVehicles = stopsForThisSeg.every(
            (s: any) => s.assigned_vehicles && (s.assigned_vehicles as any[]).length > 0
          );

          // If no stops at all for this segment, or there are remaining vehicles
          if (!hasAnyStops) {
            // Fully unassigned
            unassigned.push({
              orderId: order.id,
              orderNumber: order.orderNumber,
              customerName: order.customerName,
              companyName: order.companyName,
              segment: seg,
              location: seg === 'leveren' ? order.startLocation : order.endLocation,
              time: seg === 'leveren'
                ? ((order.deliveryTime || order.startTime)?.slice(0, 5) || '')
                : ((order.pickupTime || order.endTime)?.slice(0, 5) || ''),
              windowStart: seg === 'leveren' ? order.deliveryWindowStart : order.pickupWindowStart,
              windowEnd: seg === 'leveren' ? order.deliveryWindowEnd : order.pickupWindowEnd,
              vehicleSummary: order.vehicleSummary,
              vehicleTypes: order.vehicleTypes,
              totalVehicles: order.totalVehicles,
              remainingVehicles: order.vehicleTypes,
              remainingVehicleSummary: order.vehicleSummary,
              remainingTotalVehicles: order.totalVehicles,
              assignmentId: null,
              transportId: null,
              transportName: null,
              notes: order.notes,
              isPartial: false,
            });
          } else if (remainingTotal > 0 && allStopsHaveVehicles) {
            // Partially assigned - show remaining
            unassigned.push({
              orderId: order.id,
              orderNumber: order.orderNumber,
              customerName: order.customerName,
              companyName: order.companyName,
              segment: seg,
              location: seg === 'leveren' ? order.startLocation : order.endLocation,
              time: seg === 'leveren'
                ? ((order.deliveryTime || order.startTime)?.slice(0, 5) || '')
                : ((order.pickupTime || order.endTime)?.slice(0, 5) || ''),
              windowStart: seg === 'leveren' ? order.deliveryWindowStart : order.pickupWindowStart,
              windowEnd: seg === 'leveren' ? order.deliveryWindowEnd : order.pickupWindowEnd,
              vehicleSummary: order.vehicleSummary,
              vehicleTypes: order.vehicleTypes,
              totalVehicles: order.totalVehicles,
              remainingVehicles: remaining,
              remainingVehicleSummary: getVehicleSummary(remaining),
              remainingTotalVehicles: remainingTotal,
              assignmentId: null,
              transportId: null,
              transportName: null,
              notes: order.notes,
              isPartial: true,
            });
          }
          // If all vehicles are assigned (remainingTotal === 0), don't show in unassigned
        }
      }

      // Sort unassigned by time
      unassigned.sort((a, b) => a.time.localeCompare(b.time));

      // 7. Build driver list with routes
      const driverList = buildDriverList(drivers, routes, routeStops, assignments, orders);

      return { orders, drivers: driverList, unassigned };
    },
    enabled: !!date && allTransport.length > 0,
  });

  function buildDriverList(
    drivers: any[],
    routes: any[],
    routeStops: any[],
    assignments: any[],
    orders: RouteBuilderOrder[],
  ): RouteBuilderDriver[] {
    const routeMap = new Map(routes.map((r: any) => [r.driver_id, r]));
    const orderMap = new Map(orders.map(o => [o.id, o]));
    const assignmentMap = new Map(assignments.map((a: any) => [a.id, a]));

    return drivers.map(driver => {
      const route = routeMap.get(driver.id);
      const driverStops = routeStops
        .filter((s: any) => s.route_id === route?.id)
        .sort((a: any, b: any) => a.sequence_number - b.sequence_number);

      const stops: RouteBuilderStop[] = driverStops.map((s: any) => {
        const order = s.order_id ? orderMap.get(s.order_id) : undefined;
        const assignment = s.assignment_id ? assignmentMap.get(s.assignment_id) : null;
        const leverenTypes = ['laden_winkel', 'vertrek_winkel', 'aankoppelen_loods', 'leveren'];
        const isLeveren = leverenTypes.includes(s.stop_type);
        const seg: 'leveren' | 'ophalen' = isLeveren ? 'leveren' : 'ophalen';

        const assignedVehicles = (s.assigned_vehicles as VehicleQuantity[] | null) || null;
        const assignedTotal = assignedVehicles
          ? assignedVehicles.reduce((sum, v) => sum + v.count, 0)
          : 0;
        const assignedSummary = assignedVehicles
          ? getVehicleSummary(assignedVehicles)
          : '';

        return {
          id: s.id,
          orderId: s.order_id ?? '',
          orderNumber: order?.orderNumber || '?',
          customerName: order?.customerName || 'Onbekend',
          companyName: order?.companyName || null,
          customerPhone: order?.customerPhone || '',
          assignmentId: s.assignment_id,
          segment: seg,
          stopType: s.stop_type,
          locationAddress: s.location_address || (order ? (seg === 'leveren' ? order.startLocation : order.endLocation) : ''),
          estimatedArrival: s.estimated_arrival,
          estimatedDeparture: s.estimated_departure,
          driveTimeFromPrevious: s.drive_time_from_previous,
          loadUnloadMinutes: s.load_unload_minutes,
          vehicleSummary: order?.vehicleSummary || '',
          vehicleTypes: order?.vehicleTypes || [],
          totalVehicles: order?.totalVehicles || 0,
          assignedVehicles,
          assignedVehicleSummary: assignedSummary,
          assignedTotalVehicles: assignedTotal,
          transportName: assignment ? getTransportName(assignment.transport_id) : '',
          notes: s.notes,
          customerTime: order
            ? (seg === 'leveren'
                ? ((order.deliveryTime || order.startTime)?.slice(0, 5) || '')
                : ((order.pickupTime || order.endTime)?.slice(0, 5) || ''))
            : '',
          windowStart: order
            ? (seg === 'leveren' ? order.deliveryWindowStart : order.pickupWindowStart)
            : null,
          windowEnd: order
            ? (seg === 'leveren' ? order.deliveryWindowEnd : order.pickupWindowEnd)
            : null,
          sequenceNumber: s.sequence_number,
        };
      });

      const totalDrive = stops.reduce((s, st) => s + (st.driveTimeFromPrevious || 0), 0);
      const totalLoad = stops.reduce((s, st) => s + (st.loadUnloadMinutes || 0), 0);
      const arrivals = stops.map(s => s.estimatedArrival).filter(Boolean).sort();
      const departures = stops.map(s => s.estimatedDeparture).filter(Boolean).sort();

      return {
        id: driver.id,
        name: driver.name,
        phone: driver.phone || '',
        canDriveTrailer: driver.can_drive_trailer,
        isAvailable: driver.is_available !== false,
        routeId: route?.id || null,
        routeStatus: route?.status || 'concept',
        transportMaterialId: route?.transport_material_id || null,
        transportMaterialName: route?.transport_material_id
          ? getTransportName(route.transport_material_id)
          : null,
        stops,
        totalDriveMinutes: totalDrive,
        totalLoadMinutes: totalLoad,
        estimatedStartTime: arrivals[0] || null,
        estimatedEndTime: departures[departures.length - 1] || arrivals[arrivals.length - 1] || null,
      };
    });
  }

  // ── Mutations ────────────────────────────────────────

  const addStopToDriverMutation = useMutation({
    mutationFn: async (params: {
      driverId: string;
      orderId: string;
      assignmentId: string | null;
      segment: 'leveren' | 'ophalen';
      stopType: string;
      locationAddress: string;
      assignedVehicles?: VehicleQuantity[];
      estimatedArrival?: string;
      estimatedDeparture?: string;
      driveTimeFromPrevious?: number;
      loadUnloadMinutes?: number;
      notes?: string;
    }) => {
      // Ensure route exists
      const { data: route } = await supabase
        .from('driver_day_routes')
        .upsert(
          { driver_id: params.driverId, route_date: date, status: 'concept' },
          { onConflict: 'driver_id,route_date' }
        )
        .select()
        .single();

      if (!route) throw new Error('Failed to create/get route');

      // Get current max sequence
      const { data: existing } = await supabase
        .from('driver_day_route_stops')
        .select('sequence_number')
        .eq('route_id', route.id)
        .order('sequence_number', { ascending: false })
        .limit(1);

      const nextSeq = ((existing?.[0]?.sequence_number as number) || 0) + 1;

      const { error } = await supabase.from('driver_day_route_stops').insert({
        route_id: route.id,
        order_id: params.orderId,
        assignment_id: params.assignmentId,
        sequence_number: nextSeq,
        stop_type: params.stopType,
        location_address: params.locationAddress,
        assigned_vehicles: params.assignedVehicles || null,
        estimated_arrival: params.estimatedArrival || null,
        estimated_departure: params.estimatedDeparture || null,
        drive_time_from_previous: params.driveTimeFromPrevious || null,
        load_unload_minutes: params.loadUnloadMinutes || null,
        notes: params.notes || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['day-route-builder'] });
    },
  });

  const removeStopMutation = useMutation({
    mutationFn: async (stopId: string) => {
      const { error } = await supabase
        .from('driver_day_route_stops')
        .delete()
        .eq('id', stopId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['day-route-builder'] });
    },
  });

  const reorderStopsMutation = useMutation({
    mutationFn: async (params: { routeId: string; stopIds: string[] }) => {
      // Update sequence numbers
      const updates = params.stopIds.map((id, idx) =>
        supabase
          .from('driver_day_route_stops')
          .update({ sequence_number: idx + 1 })
          .eq('id', id)
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['day-route-builder'] });
    },
  });

  const updateStopTimingMutation = useMutation({
    mutationFn: async (params: {
      stopId: string;
      estimatedArrival?: string;
      estimatedDeparture?: string;
      driveTimeFromPrevious?: number;
      loadUnloadMinutes?: number;
      notes?: string | null;
      locationAddress?: string | null;
    }) => {
      const { stopId, ...updates } = params;
      const dbUpdates: Record<string, any> = {};
      if (updates.estimatedArrival !== undefined)
        dbUpdates.estimated_arrival = updates.estimatedArrival;
      if (updates.estimatedDeparture !== undefined)
        dbUpdates.estimated_departure = updates.estimatedDeparture;
      if (updates.driveTimeFromPrevious !== undefined)
        dbUpdates.drive_time_from_previous = updates.driveTimeFromPrevious;
      if (updates.loadUnloadMinutes !== undefined)
        dbUpdates.load_unload_minutes = updates.loadUnloadMinutes;
      if (updates.notes !== undefined)
        dbUpdates.notes = updates.notes;
      if (updates.locationAddress !== undefined)
        dbUpdates.location_address = updates.locationAddress;

      const { error } = await supabase
        .from('driver_day_route_stops')
        .update(dbUpdates)
        .eq('id', stopId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['day-route-builder'] });
    },
  });

  const refreshDriveTimeMutation = useMutation({
    mutationFn: async (params: {
      stopId: string;
      fromAddress: string;
      toAddress: string;
      departureTime: string; // HH:MM
    }) => {
      const { stopId, fromAddress, toAddress, departureTime } = params;
      const departureIso = `${date}T${departureTime}:00`;
      const { data, error: fnError } = await supabase.functions.invoke('calculate-drive-time', {
        body: {
          origin: fromAddress,
          destination: toAddress,
          departureTime: departureIso,
        },
      });
      if (fnError) throw fnError;
      const minutes = (data?.trafficDurationMinutes ?? data?.durationMinutes) ?? 0;
      const { error: updateError } = await supabase
        .from('driver_day_route_stops')
        .update({ drive_time_from_previous: minutes })
        .eq('id', stopId);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['day-route-builder'] });
    },
  });

  const addCustomStopBetweenMutation = useMutation({
    mutationFn: async (params: {
      routeId: string;
      afterSequenceNumber: number; // 1-based: insert after this
      locationAddress: string;
      estimatedArrival: string;
      estimatedDeparture: string;
      notes?: string | null;
    }) => {
      const { routeId, afterSequenceNumber, locationAddress, estimatedArrival, estimatedDeparture, notes } = params;
      const newSeq = afterSequenceNumber + 1;
      const { data: existing } = await supabase
        .from('driver_day_route_stops')
        .select('id, sequence_number')
        .eq('route_id', routeId)
        .gte('sequence_number', newSeq)
        .order('sequence_number', { ascending: false });
      for (const row of existing || []) {
        await supabase
          .from('driver_day_route_stops')
          .update({ sequence_number: (row as { id: string; sequence_number: number }).sequence_number + 1 })
          .eq('id', (row as { id: string }).id);
      }
      const { error: insertErr } = await supabase.from('driver_day_route_stops').insert({
        route_id: routeId,
        order_id: null,
        assignment_id: null,
        sequence_number: newSeq,
        stop_type: 'tussenstop',
        location_address: locationAddress.trim(),
        estimated_arrival: estimatedArrival,
        estimated_departure: estimatedDeparture,
        drive_time_from_previous: null,
        load_unload_minutes: null,
        notes: notes ?? null,
      });
      if (insertErr) throw insertErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['day-route-builder'] });
    },
  });

  const updateStopVehiclesMutation = useMutation({
    mutationFn: async (params: {
      stopId: string;
      assignedVehicles: VehicleQuantity[];
    }) => {
      const { error } = await supabase
        .from('driver_day_route_stops')
        .update({ assigned_vehicles: params.assignedVehicles })
        .eq('id', params.stopId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['day-route-builder'] });
    },
  });

  const updateRouteStatusMutation = useMutation({
    mutationFn: async (params: { routeId: string; status: string }) => {
      const { error } = await supabase
        .from('driver_day_routes')
        .update({ status: params.status })
        .eq('id', params.routeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['day-route-builder'] });
    },
  });

  const assignTransportMaterialMutation = useMutation({
    mutationFn: async (params: {
      driverId: string;
      transportMaterialId: string | null;
    }) => {
      // Ensure route exists
      const { data: route } = await supabase
        .from('driver_day_routes')
        .upsert(
          { driver_id: params.driverId, route_date: date, status: 'concept' },
          { onConflict: 'driver_id,route_date' }
        )
        .select()
        .single();

      if (!route) throw new Error('Failed to create/get route');

      const { error } = await supabase
        .from('driver_day_routes')
        .update({ transport_material_id: params.transportMaterialId })
        .eq('id', route.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['day-route-builder'] });
    },
  });

  const createRijplanningMutation = useMutation({
    mutationFn: async (): Promise<{ updated: number; errors: string[] }> => {
      const data = queryClient.getQueryData<{
        drivers: RouteBuilderDriver[];
        orders: RouteBuilderOrder[];
      }>(['day-route-builder', date, allTransport.length]);
      if (!data?.drivers?.length) return { updated: 0, errors: [] };

      const orderMap = new Map(data.orders.map(o => [o.id, o]));
      const errors: string[] = [];
      let updated = 0;

      for (const driver of data.drivers) {
        const customerStops = driver.stops
          .filter(s => s.stopType === 'leveren' || s.stopType === 'ophalen')
          .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
        if (customerStops.length === 0) continue;
        if (!driver.routeId) {
          errors.push(`${driver.name}: geen route (voeg eerst stops toe)`);
          continue;
        }

        const routeOrders: RouteOrder[] = customerStops.map(stop => {
          const order = orderMap.get(stop.orderId);
          if (!order) {
            throw new Error(`Order ${stop.orderId} niet gevonden`);
          }
          const transportId = driver.transportMaterialId || '';
          return {
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            deliveryAddress: order.startLocation,
            pickupAddress: order.endLocation,
            customerStartTime: (order.deliveryTime || order.startTime)?.slice(0, 5) || '09:00',
            customerEndTime: (order.pickupTime || order.endTime)?.slice(0, 5) || '17:00',
            startDate: order.startDate,
            endDate: order.endDate,
            vehicleCount: stop.assignedTotalVehicles || stop.totalVehicles || 0,
            transportId,
            hasTrailer: needsTrailer(transportId),
            assignmentId: stop.assignmentId || '',
            segment: stop.segment,
          };
        });

        try {
          const result = await evaluateFixedSequence(routeOrders, date);
          const originalStopsByOrderAndSegment = new Map(
            customerStops.map(s => [`${s.orderId}-${s.segment}`, s])
          );

          type StopRow = {
            route_id: string;
            order_id: string | null;
            assignment_id: string | null;
            sequence_number: number;
            stop_type: string;
            location_address: string | null;
            estimated_arrival: string | null;
            estimated_departure: string | null;
            drive_time_from_previous: number | null;
            load_unload_minutes: number | null;
            assigned_vehicles: VehicleQuantity[] | null;
            notes?: string | null;
          };

          const newStopRows: StopRow[] = result.stops.map((s: OptimizedStop) => {
            const rawOrderId = s.orderId ?? null;
            const rawAssignmentId = s.assignmentId ?? null;
            const orderId = rawOrderId && rawOrderId !== '' ? rawOrderId : null;
            const assignmentId = rawAssignmentId && rawAssignmentId !== '' ? rawAssignmentId : null;
            let assignedVehicles: VehicleQuantity[] | null = null;
            if (s.type === 'leveren' || s.type === 'ophalen') {
              const orig = originalStopsByOrderAndSegment.get(`${orderId}-${s.type === 'leveren' ? 'leveren' : 'ophalen'}`);
              if (orig?.assignedVehicles?.length) assignedVehicles = orig.assignedVehicles;
            }
            const address = s.address === 'winkel' ? LOCATIONS.winkel : s.address === 'loods' ? LOCATIONS.loods : s.address;
            return {
              route_id: driver.routeId!,
              order_id: orderId,
              assignment_id: assignmentId,
              sequence_number: 0,
              stop_type: s.type,
              location_address: address,
              estimated_arrival: s.estimatedArrival || null,
              estimated_departure: s.estimatedDeparture || null,
              drive_time_from_previous: s.driveTimeFromPrevious ?? null,
              load_unload_minutes: s.durationMinutes ?? null,
              assigned_vehicles: assignedVehicles,
            };
          });

          const customStops = driver.stops.filter(s => s.stopType === 'tussenstop');
          const customStopRows: StopRow[] = customStops.map(t => ({
            route_id: driver.routeId!,
            order_id: null,
            assignment_id: null,
            sequence_number: 0,
            stop_type: t.stopType,
            location_address: t.locationAddress || null,
            estimated_arrival: t.estimatedArrival || null,
            estimated_departure: t.estimatedDeparture || null,
            drive_time_from_previous: null,
            load_unload_minutes: null,
            assigned_vehicles: null,
            notes: t.notes ?? null,
          }));

          const combined: StopRow[] = [...newStopRows, ...customStopRows];
          const sortKey = (r: StopRow) => r.estimated_arrival ?? '23:59';
          combined.sort((a, b) => String(sortKey(a)).localeCompare(String(sortKey(b))));
          combined.forEach((r, idx) => {
            r.sequence_number = idx + 1;
          });

          const { error: deleteErr } = await supabase
            .from('driver_day_route_stops')
            .delete()
            .eq('route_id', driver.routeId);
          if (deleteErr) {
            errors.push(`${driver.name}: ${deleteErr.message}`);
            continue;
          }

          const { error: insertErr } = await supabase
            .from('driver_day_route_stops')
            .insert(combined);
          if (insertErr) {
            errors.push(`${driver.name}: ${insertErr.message}`);
            continue;
          }
          updated += 1;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${driver.name}: ${msg}`);
        }
      }

      return { updated, errors };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['day-route-builder'] });
    },
  });

  return {
    orders: query.data?.orders || [],
    drivers: query.data?.drivers || [],
    unassigned: query.data?.unassigned || [],
    isLoading: query.isLoading,
    error: query.error,
    addStopToDriver: addStopToDriverMutation.mutateAsync,
    removeStop: removeStopMutation.mutateAsync,
    reorderStops: reorderStopsMutation.mutateAsync,
    updateStopTiming: updateStopTimingMutation.mutateAsync,
    updateStopVehicles: updateStopVehiclesMutation.mutateAsync,
    updateRouteStatus: updateRouteStatusMutation.mutateAsync,
    assignTransportMaterial: assignTransportMaterialMutation.mutateAsync,
    isAdding: addStopToDriverMutation.isPending,
    createRijplanningForDate: createRijplanningMutation.mutateAsync,
    isCreatingRijplanning: createRijplanningMutation.isPending,
    updateStopNotes: updateStopTimingMutation.mutateAsync,
    refreshDriveTimeForStop: refreshDriveTimeMutation.mutateAsync,
    addCustomStopBetween: addCustomStopBetweenMutation.mutateAsync,
    isRefreshingDriveTime: refreshDriveTimeMutation.isPending,
    isAddingCustomStop: addCustomStopBetweenMutation.isPending,
  };
}
