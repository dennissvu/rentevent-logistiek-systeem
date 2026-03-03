/**
 * Batch trip print: fetches all data for a day's orders and generates
 * printable trip documents (single or multi-page).
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
  calculateDriverSchedule,
  needsTrailer,
  estimateLoadUnloadTime,
  TIME_CONSTANTS,
  type DriverSchedule,
} from '@/utils/driverScheduleCalculator';
import {
  TripPrintData,
  PrintRouteStep,
  PrintLoadStep,
  openTripPrintDocument,
} from '@/utils/tripPrintDocument';

// ── helpers ──────────────────────────────────────────────

function adjustTime(timeStr: string, delta: number): string {
  const [h, m] = timeStr.split(':').map(Number);
  const t = ((h * 60 + m + delta) % 1440 + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

const allTransport = [...bakwagens, ...aanhangers, ...combisList];

function transportName(id: string): string {
  return allTransport.find(t => t.id === id)?.name || id;
}

// ── route step builder from real schedule ─────────────────

function buildRouteStepsFromSchedule(
  schedule: DriverSchedule,
  segment: 'leveren' | 'ophalen',
  customerAddress: string,
  vehicleCount: number,
  shopLoadMinutes: number,
  shopUnloadMinutes: number,
): PrintRouteStep[] {
  const isPickup = segment === 'ophalen';
  const hasTrailer = schedule.needsTrailer;
  const loadUnload = schedule.totals.unloadMinutes;
  const steps: PrintRouteStep[] = [];

  // Shop loading (before departure)
  if (shopLoadMinutes > 0) {
    const loadStart = adjustTime(schedule.delivery.startAtWinkel, -shopLoadMinutes);
    steps.push({ time: loadStart, label: 'Laden bij winkel', detail: `${shopLoadMinutes} min laden`, type: 'action' });
  }

  // Winkel start
  steps.push({
    time: schedule.delivery.startAtWinkel,
    label: 'Winkel Volendam',
    detail: !isPickup ? `${TIME_CONSTANTS.STARTUP_TIME_WINKEL} min opstarten` : undefined,
    type: 'start',
  });

  // Loods (outbound, only with trailer)
  if (hasTrailer && schedule.delivery.arriveAtLoods) {
    steps.push({
      time: schedule.delivery.arriveAtLoods,
      endTime: schedule.delivery.departFromLoods,
      label: 'Loods Purmerend',
      detail: `${TIME_CONSTANTS.TRAILER_COUPLING_TIME} min aanhanger koppelen`,
      type: 'stop',
    });
  }

  // Customer
  if (isPickup) {
    steps.push({ time: schedule.delivery.arriveAtCustomer, label: 'Aankomst bij klant', sublabel: customerAddress, type: 'destination' });
    steps.push({
      time: schedule.delivery.arriveAtCustomer,
      endTime: schedule.delivery.unloadComplete,
      label: 'Inladen voertuigen',
      detail: `${loadUnload} min laden (${vehicleCount} voertuigen)`,
      type: 'action',
    });
  } else {
    steps.push({
      time: schedule.delivery.arriveAtCustomer,
      label: 'Klant locatie',
      sublabel: customerAddress,
      detail: `${loadUnload} min uitladen (${vehicleCount} voertuigen)`,
      type: 'destination',
    });
    steps.push({
      time: schedule.delivery.readyForCustomer,
      label: 'Klaar voor klant',
      detail: `15 min voor starttijd`,
      type: 'destination',
    });
  }

  // Return trip
  if (schedule.returnTrip) {
    steps.push({ time: schedule.returnTrip.departFromCustomer, label: 'Vertrek van klant', sublabel: customerAddress, type: 'return' });

    if (isPickup && hasTrailer && schedule.returnTrip.arriveAtWinkelForUnload) {
      // Pickup+trailer: klant → winkel (lossen) → loods (afkoppelen) → winkel
      steps.push({ time: schedule.returnTrip.arriveAtWinkelForUnload, label: 'Aankomst Winkel', type: 'return' });
      if (shopUnloadMinutes > 0) {
        steps.push({
          time: schedule.returnTrip.arriveAtWinkelForUnload,
          endTime: adjustTime(schedule.returnTrip.arriveAtWinkelForUnload, shopUnloadMinutes),
          label: 'Lossen winkel',
          detail: `${shopUnloadMinutes} min lossen`,
          type: 'action',
        });
      }
      if (schedule.returnTrip.arriveAtLoods) {
        steps.push({
          time: schedule.returnTrip.arriveAtLoods,
          endTime: schedule.returnTrip.departFromLoods,
          label: 'Loods Purmerend',
          detail: `${TIME_CONSTANTS.TRAILER_COUPLING_TIME} min afkoppelen`,
          type: 'stop',
        });
      }
      steps.push({ time: schedule.returnTrip.arriveAtWinkel, label: 'Aankomst Winkel Volendam', type: 'return' });
    } else {
      // Standard: klant → loods → winkel OR klant → winkel
      if (hasTrailer && schedule.returnTrip.arriveAtLoods) {
        steps.push({
          time: schedule.returnTrip.arriveAtLoods,
          endTime: schedule.returnTrip.departFromLoods,
          label: 'Loods Purmerend',
          detail: `${TIME_CONSTANTS.TRAILER_COUPLING_TIME} min afkoppelen`,
          type: 'stop',
        });
      }
      steps.push({ time: schedule.returnTrip.arriveAtWinkel, label: 'Aankomst Winkel Volendam', type: 'return' });
      if (shopUnloadMinutes > 0) {
        steps.push({
          time: schedule.returnTrip.arriveAtWinkel,
          endTime: adjustTime(schedule.returnTrip.arriveAtWinkel, shopUnloadMinutes),
          label: 'Lossen winkel',
          detail: `${shopUnloadMinutes} min lossen`,
          type: 'action',
        });
      }
    }
  }

  return steps;
}

// ── Extract drive time display from schedule ─────────────

function getDriveTimeDisplay(schedule: DriverSchedule): { outbound: string; returnTrip: string } {
  const fmt = (min: number, est: boolean) => est ? `~${min} min (geschat)` : `${min} min`;

  // Outbound
  let outboundMin = 0;
  let outboundEst = false;
  if (schedule.driveTimes.winkelToCustomer) {
    const dt = schedule.driveTimes.winkelToCustomer;
    outboundMin = dt.trafficDurationMinutes || dt.durationMinutes;
    outboundEst = dt.isEstimate;
  } else {
    if (schedule.driveTimes.winkelToLoods) {
      const dt = schedule.driveTimes.winkelToLoods;
      outboundMin += dt.trafficDurationMinutes || dt.durationMinutes;
      outboundEst = outboundEst || dt.isEstimate;
    }
    if (schedule.driveTimes.loodsToCustomer) {
      const dt = schedule.driveTimes.loodsToCustomer;
      outboundMin += dt.trafficDurationMinutes || dt.durationMinutes;
      outboundEst = outboundEst || dt.isEstimate;
    }
  }

  // Return
  let returnMin = 0;
  let returnEst = false;
  if (schedule.driveTimes.customerToWinkel) {
    const dt = schedule.driveTimes.customerToWinkel;
    returnMin = dt.trafficDurationMinutes || dt.durationMinutes;
    returnEst = dt.isEstimate;
  }
  if (schedule.driveTimes.customerToLoods) {
    const dt = schedule.driveTimes.customerToLoods;
    returnMin += dt.trafficDurationMinutes || dt.durationMinutes;
    returnEst = returnEst || dt.isEstimate;
  }
  if (schedule.driveTimes.loodsToWinkel) {
    const dt = schedule.driveTimes.loodsToWinkel;
    returnMin += dt.trafficDurationMinutes || dt.durationMinutes;
    returnEst = returnEst || dt.isEstimate;
  }

  return {
    outbound: fmt(outboundMin, outboundEst),
    returnTrip: fmt(returnMin, returnEst),
  };
}

// ── Build TripPrintData for one assignment ───────────────

interface RawOrder {
  id: string;
  order_number: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  phone: string;
  email: string;
  start_date: string;
  start_time: string;
  end_time: string;
  start_location: string;
  end_location: string;
  number_of_persons: number;
  vehicle_types: any;
  notes: string | null;
}

interface RawAssignment {
  id: string;
  order_id: string;
  segment: string;
  transport_id: string;
  driver_id: string | null;
  sequence_number: number;
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
  helper_driver_ids: any;
  target_transport_id: string | null;
  notes: string | null;
  stay_loaded_count: number;
}

async function buildTripPrint(
  order: RawOrder,
  assignment: RawAssignment,
  assignmentIndex: number,
  segmentAssignmentCount: number,
  instructions: RawInstruction[],
  drivers: { id: string; name: string }[],
): Promise<TripPrintData> {
  const segment = assignment.segment as 'leveren' | 'ophalen';
  const isPickup = segment === 'ophalen';
  const hasTrailer = needsTrailer(assignment.transport_id);
  const tName = transportName(assignment.transport_id);
  const driver = drivers.find(d => d.id === assignment.driver_id);
  const driverName = driver?.name || 'Niet toegewezen';

  const vehicleTypesData = (order.vehicle_types as { type: string; count: number }[] || []);
  const totalVehicles = vehicleTypesData.reduce((s, v) => s + v.count, 0);
  const vehiclesSummary = vehicleTypesData
    .map(v => {
      const info = vehicleTypesList.find(vt => vt.id === v.type);
      return `${v.count}x ${info?.name || v.type}`;
    })
    .join(', ');

  const assignmentVehicleCount = Math.ceil(totalVehicles / Math.max(segmentAssignmentCount, 1));
  const customerTime = (isPickup ? order.end_time : order.start_time)?.slice(0, 5) || '00:00';
  const customerAddress = isPickup ? order.end_location : order.start_location;

  // Load steps for this assignment
  const assignmentInstructions = instructions.filter(i => i.assignment_id === assignment.id);
  const loadSteps: PrintLoadStep[] = assignmentInstructions.map(inst => {
    const vtInfo = vehicleTypesList.find(v => v.id === inst.vehicle_type);
    const helperIds = Array.isArray(inst.helper_driver_ids) ? inst.helper_driver_ids as string[] : [];
    const helperNames = helperIds.map(id => drivers.find(d => d.id === id)?.name).filter(Boolean) as string[];
    let instrTransport = tName;
    if (inst.target_transport_id) {
      const sub = allTransport.find(t => t.id === inst.target_transport_id);
      if (sub) instrTransport = sub.name;
    }
    return {
      action: inst.action as 'laden' | 'lossen',
      location: inst.location === 'winkel' ? 'Winkel' : inst.location === 'loods' ? 'Loods' : 'Blijft staan',
      vehicleType: vtInfo?.name || inst.vehicle_type,
      vehicleIcon: vtInfo?.icon || '🚲',
      vehicleCount: inst.vehicle_count,
      stayLoadedCount: inst.location === 'blijft_staan' ? inst.vehicle_count : 0,
      helperNames,
      transportName: instrTransport,
    };
  });

  // Shop load/unload times
  const ladenSteps = loadSteps.filter(s => s.action === 'laden');
  const lossenSteps = loadSteps.filter(s => s.action === 'lossen');
  const shopLoadMinutes = !isPickup && ladenSteps.length > 0
    ? estimateLoadUnloadTime({ segment: 'leveren', vehicleCount: assignmentVehicleCount, hasTrailer })
    : 0;
  const shopUnloadMinutes = isPickup && lossenSteps.length > 0
    ? estimateLoadUnloadTime({ segment: 'ophalen', vehicleCount: assignmentVehicleCount, hasTrailer })
    : 0;

  // Calculate real schedule with Google Maps drive times (traffic-aware)
  const schedule = await calculateDriverSchedule({
    customerStartTime: customerTime,
    customerAddress,
    vehicleCount: assignmentVehicleCount,
    transportId: assignment.transport_id,
    date: new Date(order.start_date + 'T00:00:00'),
    segment,
  });

  const startTime = shopLoadMinutes > 0
    ? adjustTime(schedule.totals.driverStartTime, -shopLoadMinutes)
    : schedule.totals.driverStartTime;

  // End time from schedule (add shop unload if applicable)
  const endTime = schedule.totals.driverEndTime
    ? (shopUnloadMinutes > 0 ? adjustTime(schedule.totals.driverEndTime, shopUnloadMinutes) : schedule.totals.driverEndTime)
    : startTime;

  // Build route steps from real schedule
  const routeSteps = buildRouteStepsFromSchedule(
    schedule, segment, customerAddress, assignmentVehicleCount, shopLoadMinutes, shopUnloadMinutes,
  );

  // Extract real drive times for display
  const driveDisplay = getDriveTimeDisplay(schedule);

  const bookingDate = format(new Date(order.start_date + 'T00:00:00'), 'EEEE d MMMM yyyy', { locale: nl });

  return {
    segment,
    assignmentNumber: segmentAssignmentCount > 1 ? assignmentIndex + 1 : undefined,
    driverName,
    transportName: tName,
    startTime,
    endTime,
    hasTrailer,
    orderNumber: order.order_number,
    customerName: `${order.first_name} ${order.last_name}`.trim(),
    customerPhone: order.phone,
    customerEmail: order.email,
    companyName: order.company_name || undefined,
    bookingDate,
    customerStartTime: order.start_time?.slice(0, 5) || '-',
    customerEndTime: order.end_time?.slice(0, 5) || '-',
    numberOfPersons: order.number_of_persons,
    vehiclesSummary: vehiclesSummary || `${order.number_of_persons} voertuigen`,
    deliveryLocation: order.start_location,
    pickupLocation: order.end_location,
    routeSteps,
    driveTimeOutbound: driveDisplay.outbound,
    driveTimeReturn: driveDisplay.returnTrip,
    loadSteps,
    notes: order.notes || undefined,
  };
}

// ── Public API ───────────────────────────────────────────

export async function fetchAndPrintTrips(
  date: string,
  options: { orderId?: string } = {},
): Promise<void> {
  // 1. Fetch orders
  let orderQuery = supabase
    .from('orders')
    .select('*')
    .eq('start_date', date)
    .in('status', ['bevestigd', 'optie']);

  if (options.orderId) {
    orderQuery = orderQuery.eq('id', options.orderId);
  }

  const { data: orders, error: ordersErr } = await orderQuery;
  if (ordersErr) throw ordersErr;
  if (!orders?.length) return;

  const orderIds = orders.map(o => o.id);

  // 2. Parallel: assignments, instructions, drivers
  const [assignRes, instrRes, driverRes] = await Promise.all([
    supabase
      .from('order_transport_assignments')
      .select('*')
      .in('order_id', orderIds)
      .order('sequence_number'),
    (supabase as any)
      .from('order_load_unload_instructions')
      .select('*')
      .in('order_id', orderIds)
      .order('sequence_number'),
    supabase.from('drivers').select('id, name'),
  ]);

  const assignments = (assignRes.data || []) as RawAssignment[];
  const instructions = (instrRes.data || []) as RawInstruction[];
  const drivers = (driverRes.data || []) as { id: string; name: string }[];

  // 3. Build TripPrintData per assignment (parallel for speed)
  const tripPromises: Promise<TripPrintData>[] = [];

  for (const order of orders) {
    const orderAssignments = assignments.filter(a => a.order_id === order.id);
    const orderInstructions = instructions.filter(i => i.order_id === order.id);

    for (const segment of ['leveren', 'ophalen'] as const) {
      const segAssignments = orderAssignments.filter(a => a.segment === segment);
      segAssignments.forEach((assignment, idx) => {
        tripPromises.push(
          buildTripPrint(
            order as RawOrder,
            assignment,
            idx,
            segAssignments.length,
            orderInstructions,
            drivers,
          ),
        );
      });
    }
  }

  // Await all schedule calculations in parallel
  const trips = await Promise.all(tripPromises);

  // 4. Sort by start time
  trips.sort((a, b) => a.startTime.localeCompare(b.startTime));

  // 5. Print
  if (trips.length === 0) return;
  if (trips.length === 1) {
    openTripPrintDocument(trips[0]);
  } else {
    openMultiTripPrintDocument(trips);
  }
}

// ── Multi-page print document ────────────────────────────

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function openMultiTripPrintDocument(trips: TripPrintData[]): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const tripPages = trips.map((data, pageIdx) => {
    const isLeveren = data.segment === 'leveren';
    const segmentLabel = isLeveren ? 'Leveren' : 'Ophalen';
    const segmentColor = isLeveren ? '#059669' : '#dc2626';
    const title = `${segmentLabel}${data.assignmentNumber ? ` #${data.assignmentNumber}` : ''} – ${escapeHtml(data.driverName)}`;

    const routeHtml = data.routeSteps.map((step, i) => {
      const dotColor = step.type === 'start' ? '#3b82f6'
        : step.type === 'destination' ? '#10b981'
        : step.type === 'action' ? '#f59e0b'
        : step.type === 'return' ? '#3b82f6'
        : '#6b7280';
      const timeDisplay = step.endTime
        ? `<span class="time">${escapeHtml(step.time)}</span><span class="time-range"> → ${escapeHtml(step.endTime)}</span>`
        : `<span class="time">${escapeHtml(step.time)}</span>`;
      return `
        <div class="route-step">
          <div class="route-dot" style="background:${dotColor}"></div>
          ${i < data.routeSteps.length - 1 ? '<div class="route-line"></div>' : ''}
          <div class="route-content">
            <div class="route-label">${escapeHtml(step.label)}</div>
            ${step.sublabel ? `<div class="route-sublabel">${escapeHtml(step.sublabel)}</div>` : ''}
            ${step.detail ? `<div class="route-detail">${escapeHtml(step.detail)}</div>` : ''}
          </div>
          <div class="route-time">${timeDisplay}</div>
        </div>`;
    }).join('');

    const ladenSteps = data.loadSteps.filter(s => s.action === 'laden');
    const lossenSteps = data.loadSteps.filter(s => s.action === 'lossen');

    const loadTableHtml = (steps: PrintLoadStep[], label: string) => {
      if (steps.length === 0) return '';
      return `
        <div class="load-section">
          <div class="load-header">${escapeHtml(label)}</div>
          <table class="load-table">
            <thead><tr><th>Locatie</th><th>Voertuig</th><th>Aantal</th><th>Transport</th><th>Medewerkers</th></tr></thead>
            <tbody>
              ${steps.map(s => {
                const bs = s.location.toLowerCase() === 'blijft staan';
                return `
                <tr${bs ? ' style="background:#eff6ff"' : ''}>
                  <td>${bs ? '<span style="color:#2563eb;font-weight:600">🅿️ Blijft staan</span>' : escapeHtml(s.location)}</td>
                  <td>${s.vehicleIcon} ${escapeHtml(s.vehicleType)}</td>
                  <td class="count">${s.vehicleCount}x</td>
                  <td>${escapeHtml(s.transportName)}</td>
                  <td>${bs ? '<span class="no-helper">—</span>' : (s.helperNames.length > 0
                    ? s.helperNames.map(n => `<span class="helper-badge">${escapeHtml(n)}</span>`).join(' ')
                    : '<span class="no-helper">—</span>')}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
    };

    const isLastPage = pageIdx === trips.length - 1;

    return `
    <div class="trip-page" style="border-bottom-color:${segmentColor}${!isLastPage ? ';page-break-after:always' : ''}">
      <!-- Header -->
      <div class="header" style="border-bottom-color:${segmentColor}">
        <div>
          <div class="header-title" style="color:${segmentColor}">${escapeHtml(segmentLabel)}planning</div>
          <div class="header-sub">Order ${escapeHtml(data.orderNumber)} · ${escapeHtml(data.bookingDate)}</div>
        </div>
        <div class="header-driver">
          <div class="driver-name">${escapeHtml(data.driverName)}</div>
          <div class="driver-transport">${escapeHtml(data.transportName)}${data.hasTrailer ? ' · Met aanhanger' : ''}</div>
          <div class="driver-time" style="color:${segmentColor}">${escapeHtml(data.startTime)}</div>
        </div>
      </div>

      ${data.notes ? `
      <div class="notes-banner">
        <div class="notes-icon">⚠️</div>
        <div class="notes-content">
          <div class="notes-title">Opmerkingen</div>
          <div class="notes-text">${escapeHtml(data.notes)}</div>
        </div>
      </div>` : ''}

      <!-- Info grid -->
      <div class="info-grid">
        <div class="info-card">
          <div class="info-card-title">Klantgegevens</div>
          <div class="info-row"><span class="info-label">Naam</span><span class="info-value">${escapeHtml(data.customerName)}</span></div>
          <div class="info-row"><span class="info-label">Telefoon</span><span class="info-value">${escapeHtml(data.customerPhone)}</span></div>
          ${data.companyName ? `<div class="info-row"><span class="info-label">Bedrijf</span><span class="info-value">${escapeHtml(data.companyName)}</span></div>` : ''}
        </div>
        <div class="info-card">
          <div class="info-card-title">Boeking</div>
          <div class="info-row"><span class="info-label">Tijd klant</span><span class="info-value">${escapeHtml(data.customerStartTime)} – ${escapeHtml(data.customerEndTime)}</span></div>
          <div class="info-row"><span class="info-label">Personen</span><span class="info-value">${data.numberOfPersons}</span></div>
          <div class="info-row"><span class="info-label">Voertuigen</span><span class="info-value">${escapeHtml(data.vehiclesSummary)}</span></div>
        </div>
      </div>

      <!-- Location -->
      <div class="info-grid">
        ${isLeveren ? `
        <div class="location-card deliver">
          <div class="location-type">Afleverlocatie</div>
          <div class="location-address">${escapeHtml(data.deliveryLocation)}</div>
          <div class="location-time">Leveren om ${escapeHtml(data.customerStartTime)}</div>
        </div>` : `
        <div class="location-card pickup">
          <div class="location-type">Ophaallocatie</div>
          <div class="location-address">${escapeHtml(data.pickupLocation)}</div>
          <div class="location-time">Ophalen om ${escapeHtml(data.customerEndTime)}</div>
        </div>`}
      </div>

      <!-- Route -->
      <div class="section-title">Routeplanning (geschat)</div>
      ${routeHtml}

      <!-- Summary -->
      <div class="summary-bar">
        <div><div class="summary-item-label">Heenrit</div><div class="summary-item-value">${escapeHtml(data.driveTimeOutbound)}</div></div>
        <div><div class="summary-item-label">Retourrit</div><div class="summary-item-value">${escapeHtml(data.driveTimeReturn)}</div></div>
        <div><div class="summary-item-label">Transport</div><div class="summary-item-value">${data.hasTrailer ? 'Met aanhanger' : 'Alleen bakwagen'}</div></div>
        <div class="summary-end">
          <div class="summary-item-label">Chauffeur klaar</div>
          <div class="summary-item-value" style="color:${segmentColor}">${escapeHtml(data.endTime)}</div>
        </div>
      </div>

      <!-- Load/Unload plan -->
      ${(ladenSteps.length > 0 || lossenSteps.length > 0) ? `
        <div class="section-title">Laad- & Losplan</div>
        ${loadTableHtml(ladenSteps, isLeveren ? 'Laden voor vertrek' : 'Laden bij klant')}
        ${loadTableHtml(lossenSteps, isLeveren ? 'Lossen bij klant' : 'Lossen na terugkomst')}
      ` : ''}
    </div>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<title>Ritplanningen ${trips[0]?.bookingDate || ''}</title>
<style>
  @page { margin: 16mm 14mm; size: A4; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    color: #1a1a2e;
    font-size: 12px;
    line-height: 1.5;
  }
  .trip-page { padding-bottom: 16px; }

  .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid; padding-bottom:12px; margin-bottom:16px; }
  .header-title { font-size:20px; font-weight:700; }
  .header-sub { font-size:12px; color:#475569; margin-top:2px; }
  .header-driver { text-align:right; }
  .driver-name { font-size:16px; font-weight:700; }
  .driver-transport { font-size:11px; color:#475569; margin-top:2px; }
  .driver-time { font-size:24px; font-weight:800; margin-top:4px; }

  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:16px; }
  .info-card { border:1px solid #e2e8f0; border-radius:6px; padding:10px 12px; }
  .info-card-title { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.8px; color:#64748b; margin-bottom:6px; border-bottom:1px solid #f1f5f9; padding-bottom:4px; }
  .info-row { display:flex; justify-content:space-between; padding:2px 0; font-size:11px; }
  .info-label { color:#475569; }
  .info-value { font-weight:600; text-align:right; max-width:60%; }

  .location-card { border:1px solid #e2e8f0; border-radius:6px; padding:10px 12px; border-left:3px solid; }
  .location-card.deliver { border-left-color:#10b981; }
  .location-card.pickup { border-left-color:#3b82f6; }
  .location-type { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.8px; color:#64748b; }
  .location-address { font-size:12px; font-weight:600; margin-top:2px; }
  .location-time { font-size:11px; color:#475569; margin-top:2px; }

  .section-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.8px; color:#475569; margin:16px 0 10px; padding-bottom:4px; border-bottom:2px solid #e2e8f0; }

  .route-step { position:relative; display:flex; align-items:flex-start; padding:6px 0 6px 24px; min-height:32px; }
  .route-dot { position:absolute; left:4px; top:10px; width:10px; height:10px; border-radius:50%; }
  .route-line { position:absolute; left:8px; top:22px; bottom:-6px; width:2px; background:#e2e8f0; }
  .route-content { flex:1; }
  .route-label { font-weight:600; font-size:12px; }
  .route-sublabel { font-size:10px; color:#475569; }
  .route-detail { font-size:10px; color:#f59e0b; font-weight:500; }
  .route-time { text-align:right; min-width:80px; font-weight:600; font-size:12px; }
  .time-range { font-size:10px; color:#475569; display:block; }

  .summary-bar { display:flex; gap:20px; padding:10px 14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; margin:14px 0; font-size:11px; }
  .summary-item-label { color:#475569; font-size:10px; }
  .summary-item-value { font-weight:700; font-size:13px; }
  .summary-end { margin-left:auto; text-align:right; }
  .summary-end .summary-item-value { font-size:16px; }

  .load-section { margin-top:8px; }
  .load-header { font-size:10px; font-weight:600; color:#475569; margin-bottom:4px; text-transform:uppercase; letter-spacing:.5px; }
  .load-table { width:100%; border-collapse:collapse; font-size:11px; margin-bottom:10px; }
  .load-table th { text-align:left; font-size:9px; font-weight:600; text-transform:uppercase; letter-spacing:.5px; color:#64748b; padding:4px 8px 4px 0; border-bottom:1px solid #e2e8f0; }
  .load-table td { padding:5px 8px 5px 0; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
  .load-table .count { font-weight:700; }
  .helper-badge { display:inline-block; background:#e2e8f0; color:#334155; padding:1px 6px; border-radius:3px; font-size:10px; font-weight:500; margin:1px 2px; }
  .no-helper { color:#94a3b8; }

  .notes-banner { display:flex; align-items:flex-start; gap:10px; padding:10px 14px; background:#fef3c7; border:2px solid #f59e0b; border-radius:6px; margin-bottom:16px; }
  .notes-icon { font-size:18px; flex-shrink:0; margin-top:1px; }
  .notes-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#92400e; margin-bottom:2px; }
  .notes-text { font-size:12px; font-weight:600; color:#78350f; white-space:pre-line; }

  .footer { margin-top:16px; padding-top:8px; border-top:1px solid #e2e8f0; font-size:9px; color:#64748b; text-align:center; }
</style>
</head>
<body>
${tripPages}
<div class="footer">
  Gegenereerd op ${new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · Rijtijden zijn schattingen
</div>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => { printWindow.print(); }, 350);
}
