import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { bakwagens, aanhangers, combis, vehicleTypes as vehicleTypesList } from '@/data/transportData';
import { calculateDriverScheduleSync, needsTrailer, estimateLoadUnloadTime } from '@/utils/driverScheduleCalculator';

export interface TripLoadStep {
  action: 'laden' | 'lossen';
  location: 'winkel' | 'loods' | 'blijft_staan';
  vehicleType: string;
  vehicleTypeName: string;
  vehicleIcon: string;
  vehicleCount: number;
  stayLoadedCount: number;
  transportName: string;
  helperNames: string[];
}

export interface DriverTrip {
  orderId: string;
  orderNumber: string;
  customerName: string;
  date: string; // ISO date
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  deliveryCity: string;
  pickupCity: string;
  vehicleTypes: { type: string; count: number }[];
  totalVehicles: number;
  segments: {
    segment: 'leveren' | 'ophalen';
    transportId: string;
    transportName: string;
    time: string; // start time for this segment
  }[];
  // Combined trip: both leveren and ophalen for same order
  isCombinedTrip: boolean;
  // Other drivers on same order+segment
  coDrivers: { driverId: string; driverName: string; segment: string }[];
  // Estimated work times
  workStartTime: string; // When driver starts at shop
  workEndTime: string;   // When driver is back at shop
  // Load/unload plan
  loadSteps: TripLoadStep[];
}

interface AssignmentRow {
  id: string;
  order_id: string;
  segment: string;
  transport_id: string;
  driver_id: string | null;
  sequence_number: number;
}

interface OrderRow {
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
  vehicle_types: { type: string; count: number }[] | null;
  status: string;
}

function getTransportName(transportId: string): string {
  const bak = bakwagens.find(b => b.id === transportId);
  if (bak) return bak.name;
  const combi = combis.find(c => c.id === transportId);
  if (combi) return combi.name;
  return transportId;
}

function extractCity(location: string): string {
  if (!location) return '';
  // Try to extract city from address like "Straat 1, 1234 AB Stad"
  const parts = location.split(',');
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1].trim();
    // Remove postal code pattern (4 digits + 2 letters)
    const cityMatch = lastPart.replace(/^\\d{4}\s?[A-Z]{2}\s?/, '').trim();
    return cityMatch || lastPart;
  }
  return location;
}

function getVehicleEmoji(type: string): string {
  const info = vehicleTypesList.find(v => v.id === type);
  return info?.icon || '🚲';
}

export function useDriverAssignments(driverId: string | null) {
  return useQuery({
    queryKey: ['driver-assignments', driverId],
    queryFn: async () => {
      if (!driverId) return [];

      // 1. Fetch all assignments for this driver
      const { data: myAssignments, error: assignError } = await supabase
        .from('order_transport_assignments')
        .select('*')
        .eq('driver_id', driverId)
        .order('sequence_number');

      if (assignError) throw assignError;
      if (!myAssignments || myAssignments.length === 0) return [];

      const assignments = myAssignments as AssignmentRow[];
      const orderIds = [...new Set(assignments.map(a => a.order_id))];

      // 2. Fetch order details & all assignments for these orders (for co-drivers)
      const [ordersResult, allAssignmentsResult, driversResult] = await Promise.all([
        supabase.from('orders').select('*').in('id', orderIds),
        supabase.from('order_transport_assignments').select('*').in('order_id', orderIds),
        supabase.from('drivers').select('id, name'),
      ]);

      if (ordersResult.error) throw ordersResult.error;
      if (allAssignmentsResult.error) throw allAssignmentsResult.error;

      const orders = ordersResult.data as unknown as OrderRow[];
      const allAssignments = allAssignmentsResult.data as AssignmentRow[];
      const drivers = driversResult.data || [];
      const driverMap = new Map(drivers.map(d => [d.id, d.name]));

      const ordersMap = new Map(orders.map(o => [o.id, o]));

      // Fetch load/unload instructions for all orders
      const { data: instructionsData } = await (supabase as any)
        .from('order_load_unload_instructions')
        .select('*')
        .in('order_id', orderIds)
        .order('sequence_number');

      const allInstructions = (instructionsData || []) as {
        id: string;
        order_id: string;
        assignment_id: string;
        action: string;
        vehicle_type: string;
        vehicle_count: number;
        location: string;
        helper_driver_ids: string[] | null;
        target_transport_id: string | null;
      }[];

      // 3. Group my assignments by order
      const orderGroups = new Map<string, AssignmentRow[]>();
      for (const a of assignments) {
        const existing = orderGroups.get(a.order_id) || [];
        existing.push(a);
        orderGroups.set(a.order_id, existing);
      }

      // 4. Build trips
      const trips: DriverTrip[] = [];

      for (const [orderId, myOrderAssignments] of orderGroups) {
        const order = ordersMap.get(orderId);
        if (!order || !['bevestigd', 'optie'].includes(order.status)) continue;

        // Use logistic dates/times if available
        const effectiveDeliveryDate = (order as any).delivery_date || order.start_date;
        const effectiveDeliveryTime = ((order as any).delivery_time || order.start_time).slice(0, 5);
        const effectivePickupDate = (order as any).pickup_date || order.end_date;
        const effectivePickupTime = ((order as any).pickup_time || order.end_time).slice(0, 5);

        const segments = myOrderAssignments.map(a => ({
          segment: a.segment as 'leveren' | 'ophalen',
          transportId: a.transport_id,
          transportName: getTransportName(a.transport_id),
          time: a.segment === 'leveren' ? effectiveDeliveryTime : effectivePickupTime,
        }));

        const hasLeveren = segments.some(s => s.segment === 'leveren');
        const hasOphalen = segments.some(s => s.segment === 'ophalen');
        
        // Check if leveren and ophalen are on different dates
        const isSplitDate = hasLeveren && hasOphalen && effectiveDeliveryDate !== effectivePickupDate;

        // Find co-drivers (other drivers on same order+segment)
        const coDrivers: DriverTrip['coDrivers'] = [];
        for (const a of allAssignments) {
          if (a.order_id === orderId && a.driver_id && a.driver_id !== driverId) {
            // Only include if I'm also on this segment
            if (myOrderAssignments.some(my => my.segment === a.segment)) {
              coDrivers.push({
                driverId: a.driver_id,
                driverName: driverMap.get(a.driver_id) || 'Onbekend',
                segment: a.segment,
              });
            }
          }
        }

        const vehicleTypesData = order.vehicle_types || [];
        const totalVehicles = vehicleTypesData.reduce((sum, vt) => sum + vt.count, 0);

        // Calculate estimated work start and end times
        // Work start: earliest segment's driver start time
        // Work end: latest segment's end time + return drive estimate
        const ESTIMATED_DRIVE_MINUTES = 30; // fallback
        
        let workStartTime = '';
        let workEndTime = '';
        
        if (hasLeveren) {
          const leverenTransportId = segments.find(s => s.segment === 'leveren')!.transportId;
          const hasTrailer = needsTrailer(leverenTransportId);
          const syncCalc = calculateDriverScheduleSync({
            customerStartTime: effectiveDeliveryTime,
            vehicleCount: totalVehicles,
            needsTrailer: hasTrailer,
            segment: 'leveren',
          });
          workStartTime = syncCalc.driverStartTime;
        }
        
        if (hasOphalen) {
          // Ophalen determines end of workday (arrival time + load time + return drive)
          const ophalenTransportId = segments.find(s => s.segment === 'ophalen')!.transportId;
          const hasTrailer = needsTrailer(ophalenTransportId);
          const loadTime = estimateLoadUnloadTime({ segment: 'ophalen', vehicleCount: totalVehicles, hasTrailer });
          const returnDrive = ESTIMATED_DRIVE_MINUTES + (hasTrailer ? 15 + 7 : 0); // + loods detour
          
          const [endH, endM] = effectivePickupTime.split(':').map(Number);
          const endDate = new Date(2000, 0, 1, endH, endM);
          endDate.setMinutes(endDate.getMinutes() + loadTime + returnDrive);
          workEndTime = endDate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
        }
        
        if (!hasLeveren && hasOphalen) {
          // Only ophalen: calculate driver start from ophalen sync
          const ophalenTransportId = segments.find(s => s.segment === 'ophalen')!.transportId;
          const hasTrailer = needsTrailer(ophalenTransportId);
          const syncCalc = calculateDriverScheduleSync({
            customerStartTime: effectivePickupTime,
            vehicleCount: totalVehicles,
            needsTrailer: hasTrailer,
            segment: 'ophalen',
          });
          workStartTime = syncCalc.driverStartTime;
        }
        
        if (hasLeveren && !hasOphalen) {
          // Only leveren: end = delivery complete + return drive
          const leverenTransportId = segments.find(s => s.segment === 'leveren')!.transportId;
          const hasTrailer = needsTrailer(leverenTransportId);
          const returnDrive = ESTIMATED_DRIVE_MINUTES + (hasTrailer ? 15 + 7 : 0);
          
          // readyForCustomer ≈ startTime, so return from there
          const [startH, startM] = effectiveDeliveryTime.split(':').map(Number);
          const returnDate = new Date(2000, 0, 1, startH, startM);
          returnDate.setMinutes(returnDate.getMinutes() + returnDrive);
          workEndTime = returnDate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
        }

        // Build load steps from instructions for this order
        const myAssignmentIds = new Set(myOrderAssignments.map(a => a.id));
        const orderInstructions = allInstructions.filter(inst => 
          inst.order_id === orderId && myAssignmentIds.has(inst.assignment_id)
        );
        
        const allTransport = [...bakwagens, ...aanhangers, ...combis];
        const loadSteps: TripLoadStep[] = orderInstructions.map(inst => {
          const vtInfo = vehicleTypesList.find(v => v.id === inst.vehicle_type);
          // Resolve specific sub-transport name
          let transportName = '';
          if (inst.target_transport_id) {
            const sub = allTransport.find(t => t.id === inst.target_transport_id);
            transportName = sub?.name || '';
          } else {
            const assignment = myOrderAssignments.find(a => a.id === inst.assignment_id);
            if (assignment) {
              transportName = getTransportName(assignment.transport_id);
            }
          }
          const helperNames = (inst.helper_driver_ids || [])
            .map((hid: string) => driverMap.get(hid) || '')
            .filter(Boolean);

          return {
            action: inst.action as 'laden' | 'lossen',
            location: inst.location as 'winkel' | 'loods' | 'blijft_staan',
            vehicleType: inst.vehicle_type,
            vehicleTypeName: vtInfo?.name || inst.vehicle_type,
            vehicleIcon: vtInfo?.icon || '🚲',
            vehicleCount: inst.vehicle_count,
            stayLoadedCount: inst.location === 'blijft_staan' ? inst.vehicle_count : 0,
            transportName,
            helperNames,
          };
        });

        if (isSplitDate) {
          // Create separate trip entries for each date
          if (hasLeveren) {
            trips.push({
              orderId,
              orderNumber: order.order_number,
              customerName: order.company_name || `${order.first_name} ${order.last_name}`,
              date: effectiveDeliveryDate,
              startTime: effectiveDeliveryTime,
              endTime: effectivePickupTime,
              deliveryCity: extractCity(order.start_location),
              pickupCity: extractCity(order.end_location),
              vehicleTypes: vehicleTypesData,
              totalVehicles,
              segments: segments.filter(s => s.segment === 'leveren'),
              isCombinedTrip: false,
              coDrivers: coDrivers.filter(c => c.segment === 'leveren'),
              workStartTime,
              workEndTime: hasOphalen ? '' : workEndTime, // only leveren end time
              loadSteps: loadSteps.filter(ls => ls.action === 'laden'),
            });
            // Recalculate workEnd for leveren-only
            const leverenTransportId = segments.find(s => s.segment === 'leveren')!.transportId;
            const hasTrailerL = needsTrailer(leverenTransportId);
            const returnDriveL = ESTIMATED_DRIVE_MINUTES + (hasTrailerL ? 15 + 7 : 0);
            const [startHL, startML] = effectiveDeliveryTime.split(':').map(Number);
            const returnDateL = new Date(2000, 0, 1, startHL, startML);
            returnDateL.setMinutes(returnDateL.getMinutes() + returnDriveL);
            trips[trips.length - 1].workEndTime = returnDateL.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
          }
          if (hasOphalen) {
            // Calculate ophalen work start
            const ophalenTransportId = segments.find(s => s.segment === 'ophalen')!.transportId;
            const hasTrailerO = needsTrailer(ophalenTransportId);
            const syncCalcO = calculateDriverScheduleSync({
              customerStartTime: effectivePickupTime,
              vehicleCount: totalVehicles,
              needsTrailer: hasTrailerO,
              segment: 'ophalen',
            });
            trips.push({
              orderId,
              orderNumber: order.order_number,
              customerName: order.company_name || `${order.first_name} ${order.last_name}`,
              date: effectivePickupDate,
              startTime: effectiveDeliveryTime,
              endTime: effectivePickupTime,
              deliveryCity: extractCity(order.start_location),
              pickupCity: extractCity(order.end_location),
              vehicleTypes: vehicleTypesData,
              totalVehicles,
              segments: segments.filter(s => s.segment === 'ophalen'),
              isCombinedTrip: false,
              coDrivers: coDrivers.filter(c => c.segment === 'ophalen'),
              workStartTime: syncCalcO.driverStartTime,
              workEndTime,
              loadSteps: loadSteps.filter(ls => ls.action === 'lossen'),
            });
          }
        } else {
          trips.push({
            orderId,
            orderNumber: order.order_number,
            customerName: order.company_name || `${order.first_name} ${order.last_name}`,
            date: hasLeveren ? effectiveDeliveryDate : effectivePickupDate,
            startTime: effectiveDeliveryTime,
            endTime: effectivePickupTime,
            deliveryCity: extractCity(order.start_location),
            pickupCity: extractCity(order.end_location),
            vehicleTypes: vehicleTypesData,
            totalVehicles,
            segments,
            isCombinedTrip: hasLeveren && hasOphalen,
            coDrivers,
            workStartTime,
            workEndTime,
            loadSteps,
          });
        }
      }

      // Sort by date, then by start time
      trips.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.startTime.localeCompare(b.startTime);
      });

      return trips;
    },
    enabled: !!driverId,
  });
}
