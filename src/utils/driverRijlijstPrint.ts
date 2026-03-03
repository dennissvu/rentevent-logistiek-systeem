/**
 * Driver Rijlijst (Route Sheet) - Printable per-driver day schedule
 * Shows complete day overview with all stops, drive times, load/unload times, and customer times.
 */

import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { vehicleTypes as vehicleTypesList } from '@/data/transportData';
import { combis, bakwagens, aanhangers } from '@/data/transportData';
import {
  estimateLoadUnloadTime,
  needsTrailer,
  LOCATIONS,
  TIME_CONSTANTS,
} from '@/utils/driverScheduleCalculator';

const allTransport = [...bakwagens, ...aanhangers, ...combis];

function transportName(id: string): string {
  return allTransport.find(t => t.id === id)?.name || id;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getVehicleSummary(vTypes: { type: string; count: number }[]): string {
  return vTypes
    .map(v => {
      const vt = vehicleTypesList.find(vt => vt.id === v.type);
      return `${v.count}x ${vt?.name || v.type}`;
    })
    .join(', ');
}

// ── Types ──────────────────────────────────────────────

interface RijlijstStop {
  sequenceNumber: number;
  stopType: string;
  segment: 'leveren' | 'ophalen';
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  companyName: string | null;
  locationAddress: string;
  estimatedArrival: string;
  estimatedDeparture: string;
  driveTimeFromPrevious: number;
  loadUnloadMinutes: number;
  customerTime: string;
  windowStart: string | null;
  windowEnd: string | null;
  vehicleSummary: string;
  totalVehicles: number;
  transportName: string;
  notes: string | null;
  numberOfPersons: number;
}

interface RijlijstData {
  driverName: string;
  driverPhone: string;
  canDriveTrailer: boolean;
  routeDate: string;
  routeDateFormatted: string;
  routeStatus: string;
  stops: RijlijstStop[];
  totalDriveMinutes: number;
  totalLoadMinutes: number;
  totalStops: number;
  estimatedStartTime: string;
  estimatedEndTime: string;
  routeNotes: string | null;
}

// ── Fetch and build rijlijst data ──────────────────────

export async function fetchDriverRijlijst(
  driverId: string,
  date: string,
): Promise<RijlijstData | null> {
  // 1. Fetch driver
  const { data: driver } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', driverId)
    .single();

  if (!driver) return null;

  // 2. Fetch route for this driver on this date
  const { data: route } = await supabase
    .from('driver_day_routes')
    .select('*')
    .eq('driver_id', driverId)
    .eq('route_date', date)
    .single();

  if (!route) return null;

  // 3. Fetch stops
  const { data: stops } = await supabase
    .from('driver_day_route_stops')
    .select('*')
    .eq('route_id', route.id)
    .order('sequence_number');

  if (!stops?.length) return null;

  // 4. Fetch related orders
  const orderIds = [...new Set(stops.map((s: any) => s.order_id))];
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .in('id', orderIds);

  const orderMap = new Map((orders || []).map((o: any) => [o.id, o]));

  // 5. Fetch assignments
  const assignmentIds = stops.map((s: any) => s.assignment_id).filter(Boolean);
  let assignmentMap = new Map<string, any>();
  if (assignmentIds.length > 0) {
    const { data: assignments } = await supabase
      .from('order_transport_assignments')
      .select('*')
      .in('id', assignmentIds);
    assignmentMap = new Map((assignments || []).map((a: any) => [a.id, a]));
  }

  // 6. Build rijlijst stops
  const rijlijstStops: RijlijstStop[] = stops.map((s: any) => {
    const order = orderMap.get(s.order_id);
    const assignment = s.assignment_id ? assignmentMap.get(s.assignment_id) : null;
    const isLeveren = s.stop_type === 'leveren' || s.stop_type === 'laden_winkel';
    const seg: 'leveren' | 'ophalen' = isLeveren ? 'leveren' : 'ophalen';
    const vTypes = order?.vehicle_types as { type: string; count: number }[] || [];

    return {
      sequenceNumber: s.sequence_number,
      stopType: s.stop_type,
      segment: seg,
      orderNumber: order?.order_number || '?',
      customerName: order ? (order.company_name || `${order.first_name} ${order.last_name}`.trim()) : 'Onbekend',
      customerPhone: order?.phone || '',
      companyName: order?.company_name || null,
      locationAddress: s.location_address || (order
        ? (seg === 'leveren' ? order.start_location : order.end_location)
        : ''),
      estimatedArrival: s.estimated_arrival || '--:--',
      estimatedDeparture: s.estimated_departure || '--:--',
      driveTimeFromPrevious: s.drive_time_from_previous || 0,
      loadUnloadMinutes: s.load_unload_minutes || 0,
      customerTime: order
        ? (seg === 'leveren'
            ? (order.delivery_time || order.start_time)?.slice(0, 5) || ''
            : (order.pickup_time || order.end_time)?.slice(0, 5) || '')
        : '',
      windowStart: order
        ? (seg === 'leveren' ? order.delivery_window_start : order.pickup_window_start)
        : null,
      windowEnd: order
        ? (seg === 'leveren' ? order.delivery_window_end : order.pickup_window_end)
        : null,
      vehicleSummary: getVehicleSummary(vTypes),
      totalVehicles: vTypes.reduce((sum: number, v: any) => sum + v.count, 0),
      transportName: assignment ? transportName(assignment.transport_id) : '',
      notes: s.notes || order?.notes || null,
      numberOfPersons: order?.number_of_persons || 0,
    };
  });

  const totalDrive = rijlijstStops.reduce((s, st) => s + st.driveTimeFromPrevious, 0);
  const totalLoad = rijlijstStops.reduce((s, st) => s + st.loadUnloadMinutes, 0);
  const arrivals = rijlijstStops.map(s => s.estimatedArrival).filter(t => t !== '--:--').sort();
  const departures = rijlijstStops.map(s => s.estimatedDeparture).filter(t => t !== '--:--').sort();

  return {
    driverName: driver.name,
    driverPhone: driver.phone || '',
    canDriveTrailer: driver.can_drive_trailer,
    routeDate: date,
    routeDateFormatted: format(new Date(date + 'T00:00:00'), 'EEEE d MMMM yyyy', { locale: nl }),
    routeStatus: route.status,
    stops: rijlijstStops,
    totalDriveMinutes: totalDrive,
    totalLoadMinutes: totalLoad,
    totalStops: rijlijstStops.filter(s => s.stopType === 'leveren' || s.stopType === 'ophalen').length,
    estimatedStartTime: arrivals[0] || '--:--',
    estimatedEndTime: departures[departures.length - 1] || arrivals[arrivals.length - 1] || '--:--',
    routeNotes: route.notes,
  };
}

// ── Generate printable HTML ────────────────────────────

const stopTypeLabels: Record<string, string> = {
  laden_winkel: 'Laden bij winkel',
  aankoppelen_loods: 'Aanhanger koppelen',
  leveren: 'Leveren bij klant',
  ophalen: 'Ophalen bij klant',
  lossen_winkel: 'Lossen bij winkel',
  afkoppelen_loods: 'Aanhanger afkoppelen',
};

const stopTypeIcons: Record<string, string> = {
  laden_winkel: '📦',
  aankoppelen_loods: '🔗',
  leveren: '📍',
  ophalen: '📍',
  lossen_winkel: '📦',
  afkoppelen_loods: '🔗',
};

const dotColors: Record<string, string> = {
  laden_winkel: '#3b82f6',
  aankoppelen_loods: '#6b7280',
  leveren: '#10b981',
  ophalen: '#ef4444',
  lossen_winkel: '#3b82f6',
  afkoppelen_loods: '#6b7280',
};

export function openDriverRijlijst(data: RijlijstData): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const stopsHtml = data.stops.map((stop, idx) => {
    const isCustomer = stop.stopType === 'leveren' || stop.stopType === 'ophalen';
    const isLeveren = stop.segment === 'leveren';
    const dotColor = dotColors[stop.stopType] || '#6b7280';
    const isLast = idx === data.stops.length - 1;

    // Drive time connector
    const driveConnector = idx > 0 && stop.driveTimeFromPrevious > 0 ? `
      <div class="drive-connector">
        <div class="drive-line"></div>
        <div class="drive-badge">🚗 ${stop.driveTimeFromPrevious} min rijden</div>
      </div>
    ` : idx > 0 ? `<div class="drive-connector"><div class="drive-line short"></div></div>` : '';

    // Customer info block (only for leveren/ophalen)
    const customerBlock = isCustomer ? `
      <div class="stop-customer">
        <div class="customer-row">
          <span class="customer-label">Klant</span>
          <span class="customer-value">${escapeHtml(stop.customerName)}</span>
        </div>
        <div class="customer-row">
          <span class="customer-label">Telefoon</span>
          <span class="customer-value">${escapeHtml(stop.customerPhone)}</span>
        </div>
        ${stop.companyName ? `
        <div class="customer-row">
          <span class="customer-label">Bedrijf</span>
          <span class="customer-value">${escapeHtml(stop.companyName)}</span>
        </div>` : ''}
        <div class="customer-row">
          <span class="customer-label">Personen</span>
          <span class="customer-value">${stop.numberOfPersons}</span>
        </div>
      </div>
    ` : '';

    // Vehicle info (only for leveren/ophalen)
    const vehicleBlock = isCustomer ? `
      <div class="stop-vehicles">
        <span class="vehicle-label">Voertuigen:</span>
        <span class="vehicle-value">${escapeHtml(stop.vehicleSummary)}</span>
        ${stop.transportName ? `<span class="transport-badge">${escapeHtml(stop.transportName)}</span>` : ''}
      </div>
    ` : '';

    // Time window
    const windowBlock = isCustomer && stop.windowStart ? `
      <div class="window-info">
        ✅ Mag eerder: vanaf ${escapeHtml(stop.windowStart.slice(0, 5))}${stop.windowEnd ? ` tot ${escapeHtml(stop.windowEnd.slice(0, 5))}` : ''}
      </div>
    ` : '';

    // Notes
    const notesBlock = stop.notes ? `
      <div class="stop-notes">
        ⚠️ ${escapeHtml(stop.notes)}
      </div>
    ` : '';

    return `
      ${driveConnector}
      <div class="stop-card ${isCustomer ? (isLeveren ? 'stop-leveren' : 'stop-ophalen') : 'stop-utility'}">
        <div class="stop-header">
          <div class="stop-number" style="background:${dotColor}">${idx + 1}</div>
          <div class="stop-title">
            <div class="stop-type">${stopTypeIcons[stop.stopType] || '📍'} ${escapeHtml(stopTypeLabels[stop.stopType] || stop.stopType)}</div>
            ${isCustomer ? `<div class="stop-order">Order ${escapeHtml(stop.orderNumber)}</div>` : ''}
          </div>
          <div class="stop-times">
            <div class="time-arrival">${escapeHtml(stop.estimatedArrival)}</div>
            ${stop.estimatedDeparture !== '--:--' ? `<div class="time-departure">→ ${escapeHtml(stop.estimatedDeparture)}</div>` : ''}
            ${stop.loadUnloadMinutes > 0 ? `<div class="time-duration">${stop.loadUnloadMinutes} min</div>` : ''}
          </div>
        </div>

        ${isCustomer ? `
        <div class="stop-body">
          <div class="stop-location">📍 ${escapeHtml(stop.locationAddress)}</div>
          <div class="stop-timing-row">
            <div class="timing-item">
              <span class="timing-label">Klant verwacht</span>
              <span class="timing-value timing-customer">${escapeHtml(stop.customerTime)}</span>
            </div>
            ${isLeveren ? `
            <div class="timing-item">
              <span class="timing-label">15 min eerder klaar</span>
              <span class="timing-value">${(() => {
                const [h, m] = stop.customerTime.split(':').map(Number);
                const t = ((h * 60 + m - 15) % 1440 + 1440) % 1440;
                return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
              })()}</span>
            </div>` : ''}
          </div>
          ${windowBlock}
          ${vehicleBlock}
          ${customerBlock}
        </div>` : `
        <div class="stop-body utility">
          <div class="stop-location">${escapeHtml(stop.locationAddress || (stop.stopType.includes('winkel') ? LOCATIONS.winkel : LOCATIONS.loods))}</div>
        </div>`}

        ${notesBlock}
      </div>
    `;
  }).join('');

  // Summary stats
  const totalMinutes = data.totalDriveMinutes + data.totalLoadMinutes;
  const totalHours = Math.floor(totalMinutes / 60);
  const totalMins = totalMinutes % 60;

  const html = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<title>Rijlijst ${escapeHtml(data.driverName)} - ${escapeHtml(data.routeDateFormatted)}</title>
<style>
  @page { margin: 14mm 12mm; size: A4; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    color: #1a1a2e;
    font-size: 11px;
    line-height: 1.5;
  }

  /* ── Header ── */
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid #1a1a2e;
    padding-bottom: 14px;
    margin-bottom: 16px;
  }
  .header-left { }
  .header-title {
    font-size: 22px;
    font-weight: 800;
    color: #1a1a2e;
  }
  .header-date {
    font-size: 13px;
    color: #475569;
    margin-top: 2px;
  }
  .header-right { text-align: right; }
  .driver-name {
    font-size: 18px;
    font-weight: 700;
  }
  .driver-phone {
    font-size: 11px;
    color: #475569;
    margin-top: 2px;
  }
  .driver-trailer {
    display: inline-block;
    background: #e2e8f0;
    color: #334155;
    padding: 1px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    margin-top: 4px;
  }
  .header-time {
    font-size: 28px;
    font-weight: 800;
    color: #1a1a2e;
    margin-top: 4px;
  }
  .header-time-label {
    font-size: 9px;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* ── Summary bar ── */
  .summary-bar {
    display: flex;
    gap: 16px;
    padding: 10px 14px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    margin-bottom: 18px;
    font-size: 11px;
  }
  .summary-item { }
  .summary-label {
    font-size: 9px;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .summary-value {
    font-size: 14px;
    font-weight: 700;
  }
  .summary-end {
    margin-left: auto;
    text-align: right;
  }

  /* ── Stops ── */
  .stops-container { }

  .stop-card {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 2px;
    page-break-inside: avoid;
  }
  .stop-leveren { border-left: 4px solid #10b981; }
  .stop-ophalen { border-left: 4px solid #ef4444; }
  .stop-utility { border-left: 4px solid #6b7280; }

  .stop-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: #f8fafc;
    border-bottom: 1px solid #f1f5f9;
  }
  .stop-number {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .stop-title { flex: 1; }
  .stop-type {
    font-size: 12px;
    font-weight: 700;
  }
  .stop-order {
    font-size: 10px;
    color: #475569;
  }
  .stop-times { text-align: right; }
  .time-arrival {
    font-size: 16px;
    font-weight: 800;
  }
  .time-departure {
    font-size: 10px;
    color: #475569;
  }
  .time-duration {
    font-size: 9px;
    color: #64748b;
    background: #e2e8f0;
    display: inline-block;
    padding: 0 4px;
    border-radius: 3px;
    margin-top: 2px;
  }

  .stop-body {
    padding: 8px 12px 10px;
  }
  .stop-body.utility {
    padding: 6px 12px;
    font-size: 11px;
    color: #475569;
  }
  .stop-location {
    font-size: 11px;
    font-weight: 600;
    margin-bottom: 6px;
  }

  .stop-timing-row {
    display: flex;
    gap: 20px;
    margin-bottom: 6px;
    padding: 4px 8px;
    background: #f1f5f9;
    border-radius: 4px;
  }
  .timing-item {
    display: flex;
    flex-direction: column;
  }
  .timing-label {
    font-size: 9px;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .timing-value {
    font-size: 13px;
    font-weight: 700;
  }
  .timing-customer {
    color: #059669;
  }

  .window-info {
    font-size: 10px;
    color: #059669;
    font-weight: 500;
    margin-bottom: 6px;
    padding: 3px 8px;
    background: #ecfdf5;
    border-radius: 4px;
  }

  .stop-vehicles {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    margin-bottom: 6px;
  }
  .vehicle-label {
    color: #64748b;
    font-size: 10px;
  }
  .vehicle-value { font-weight: 600; }
  .transport-badge {
    display: inline-block;
    background: #e2e8f0;
    color: #334155;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 9px;
    font-weight: 500;
  }

  .stop-customer {
    border-top: 1px solid #f1f5f9;
    padding-top: 6px;
    margin-top: 4px;
  }
  .customer-row {
    display: flex;
    justify-content: space-between;
    padding: 1px 0;
    font-size: 10px;
  }
  .customer-label { color: #64748b; }
  .customer-value { font-weight: 600; }

  .stop-notes {
    padding: 6px 10px;
    background: #fef3c7;
    border-top: 1px solid #f59e0b;
    font-size: 10px;
    font-weight: 600;
    color: #78350f;
  }

  /* ── Drive connector ── */
  .drive-connector {
    display: flex;
    align-items: center;
    padding: 2px 0 2px 20px;
    gap: 8px;
  }
  .drive-line {
    width: 2px;
    height: 14px;
    background: #cbd5e1;
    border-radius: 1px;
  }
  .drive-line.short { height: 6px; }
  .drive-badge {
    font-size: 10px;
    color: #475569;
    font-weight: 500;
    padding: 1px 8px;
    background: #f1f5f9;
    border-radius: 10px;
    white-space: nowrap;
  }

  /* ── Signature block ── */
  .signature-block {
    margin-top: 24px;
    padding-top: 16px;
    border-top: 2px solid #e2e8f0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
  .signature-box {
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 12px;
  }
  .signature-label {
    font-size: 10px;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 30px;
  }
  .signature-line {
    border-top: 1px solid #1a1a2e;
    padding-top: 4px;
    font-size: 9px;
    color: #64748b;
  }

  /* ── Footer ── */
  .footer {
    margin-top: 16px;
    padding-top: 8px;
    border-top: 1px solid #e2e8f0;
    font-size: 9px;
    color: #64748b;
    text-align: center;
  }

  /* ── Route notes ── */
  .route-notes {
    padding: 8px 12px;
    background: #fef3c7;
    border: 2px solid #f59e0b;
    border-radius: 6px;
    margin-bottom: 16px;
  }
  .route-notes-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    color: #92400e;
    margin-bottom: 2px;
  }
  .route-notes-text {
    font-size: 11px;
    font-weight: 600;
    color: #78350f;
    white-space: pre-line;
  }
</style>
</head>
<body>

<!-- Header -->
<div class="page-header">
  <div class="header-left">
    <div class="header-title">Rijlijst</div>
    <div class="header-date">${escapeHtml(data.routeDateFormatted)}</div>
  </div>
  <div class="header-right">
    <div class="driver-name">${escapeHtml(data.driverName)}</div>
    ${data.driverPhone ? `<div class="driver-phone">📞 ${escapeHtml(data.driverPhone)}</div>` : ''}
    ${data.canDriveTrailer ? `<div class="driver-trailer">🚛 Mag aanhanger rijden</div>` : ''}
    <div class="header-time-label">Starttijd</div>
    <div class="header-time">${escapeHtml(data.estimatedStartTime)}</div>
  </div>
</div>

${data.routeNotes ? `
<div class="route-notes">
  <div class="route-notes-title">⚠️ Opmerkingen route</div>
  <div class="route-notes-text">${escapeHtml(data.routeNotes)}</div>
</div>` : ''}

<!-- Summary -->
<div class="summary-bar">
  <div class="summary-item">
    <div class="summary-label">Stops</div>
    <div class="summary-value">${data.totalStops}</div>
  </div>
  <div class="summary-item">
    <div class="summary-label">Rijtijd totaal</div>
    <div class="summary-value">${data.totalDriveMinutes} min</div>
  </div>
  <div class="summary-item">
    <div class="summary-label">Laad/lostijd</div>
    <div class="summary-value">${data.totalLoadMinutes} min</div>
  </div>
  <div class="summary-item">
    <div class="summary-label">Totale werktijd</div>
    <div class="summary-value">${totalHours > 0 ? `${totalHours}u ${totalMins}m` : `${totalMins}m`}</div>
  </div>
  <div class="summary-end">
    <div class="summary-label">Geschat klaar</div>
    <div class="summary-value" style="font-size:18px">${escapeHtml(data.estimatedEndTime)}</div>
  </div>
</div>

<!-- Stops -->
<div class="stops-container">
  ${stopsHtml}
</div>

<!-- Signature block -->
<div class="signature-block">
  <div class="signature-box">
    <div class="signature-label">Opmerkingen chauffeur</div>
    <div class="signature-line">Notities / bijzonderheden</div>
  </div>
  <div class="signature-box">
    <div class="signature-label">Handtekening</div>
    <div class="signature-line">${escapeHtml(data.driverName)} · ${escapeHtml(data.routeDateFormatted)}</div>
  </div>
</div>

<div class="footer">
  Gegenereerd op ${new Date().toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })} · Rijtijden zijn schattingen · Rent & Event Logistiek
</div>

</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => { printWindow.print(); }, 350);
}

// ── Print all drivers for a date ───────────────────────

export async function printAllDriverRijlijsten(date: string): Promise<void> {
  // Get all routes for this date
  const { data: routes } = await supabase
    .from('driver_day_routes')
    .select('driver_id')
    .eq('route_date', date);

  if (!routes?.length) return;

  // Build rijlijsten for all drivers
  const rijlijsten = await Promise.all(
    routes.map((r: any) => fetchDriverRijlijst(r.driver_id, date))
  );

  const validRijlijsten = rijlijsten.filter(Boolean) as RijlijstData[];
  if (validRijlijsten.length === 0) return;

  // Open a combined print window
  if (validRijlijsten.length === 1) {
    openDriverRijlijst(validRijlijsten[0]);
    return;
  }

  // Multi-driver print: combine with page breaks
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const pages = validRijlijsten.map((data, pageIdx) => {
    const isLast = pageIdx === validRijlijsten.length - 1;
    const totalMinutes = data.totalDriveMinutes + data.totalLoadMinutes;
    const totalHours = Math.floor(totalMinutes / 60);
    const totalMins = totalMinutes % 60;

    const stopsHtml = data.stops.map((stop, idx) => {
      const isCustomer = stop.stopType === 'leveren' || stop.stopType === 'ophalen';
      const isLeveren = stop.segment === 'leveren';
      const dotColor = dotColors[stop.stopType] || '#6b7280';

      const driveConnector = idx > 0 && stop.driveTimeFromPrevious > 0 ? `
        <div class="drive-connector">
          <div class="drive-line"></div>
          <div class="drive-badge">🚗 ${stop.driveTimeFromPrevious} min rijden</div>
        </div>
      ` : idx > 0 ? `<div class="drive-connector"><div class="drive-line short"></div></div>` : '';

      return `
        ${driveConnector}
        <div class="stop-card ${isCustomer ? (isLeveren ? 'stop-leveren' : 'stop-ophalen') : 'stop-utility'}">
          <div class="stop-header">
            <div class="stop-number" style="background:${dotColor}">${idx + 1}</div>
            <div class="stop-title">
              <div class="stop-type">${stopTypeIcons[stop.stopType] || '📍'} ${escapeHtml(stopTypeLabels[stop.stopType] || stop.stopType)}</div>
              ${isCustomer ? `<div class="stop-order">Order ${escapeHtml(stop.orderNumber)}</div>` : ''}
            </div>
            <div class="stop-times">
              <div class="time-arrival">${escapeHtml(stop.estimatedArrival)}</div>
              ${stop.loadUnloadMinutes > 0 ? `<div class="time-duration">${stop.loadUnloadMinutes} min</div>` : ''}
            </div>
          </div>
          ${isCustomer ? `
          <div class="stop-body">
            <div class="stop-location">📍 ${escapeHtml(stop.locationAddress)}</div>
            <div class="stop-timing-row">
              <div class="timing-item">
                <span class="timing-label">Klant verwacht</span>
                <span class="timing-value timing-customer">${escapeHtml(stop.customerTime)}</span>
              </div>
            </div>
            <div class="stop-vehicles">
              <span class="vehicle-value">${escapeHtml(stop.vehicleSummary)}</span>
              ${stop.transportName ? `<span class="transport-badge">${escapeHtml(stop.transportName)}</span>` : ''}
            </div>
            <div class="stop-customer">
              <div class="customer-row"><span class="customer-label">Klant</span><span class="customer-value">${escapeHtml(stop.customerName)} · ${escapeHtml(stop.customerPhone)}</span></div>
            </div>
          </div>` : `
          <div class="stop-body utility">
            <div class="stop-location">${escapeHtml(stop.locationAddress || (stop.stopType.includes('winkel') ? LOCATIONS.winkel : LOCATIONS.loods))}</div>
          </div>`}
          ${stop.notes ? `<div class="stop-notes">⚠️ ${escapeHtml(stop.notes)}</div>` : ''}
        </div>
      `;
    }).join('');

    return `
    <div class="rijlijst-page" ${!isLast ? 'style="page-break-after:always"' : ''}>
      <div class="page-header">
        <div class="header-left">
          <div class="header-title">Rijlijst</div>
          <div class="header-date">${escapeHtml(data.routeDateFormatted)}</div>
        </div>
        <div class="header-right">
          <div class="driver-name">${escapeHtml(data.driverName)}</div>
          <div class="header-time-label">Starttijd</div>
          <div class="header-time">${escapeHtml(data.estimatedStartTime)}</div>
        </div>
      </div>
      <div class="summary-bar">
        <div class="summary-item"><div class="summary-label">Stops</div><div class="summary-value">${data.totalStops}</div></div>
        <div class="summary-item"><div class="summary-label">Rijtijd</div><div class="summary-value">${data.totalDriveMinutes} min</div></div>
        <div class="summary-item"><div class="summary-label">Laad/los</div><div class="summary-value">${data.totalLoadMinutes} min</div></div>
        <div class="summary-end"><div class="summary-label">Klaar</div><div class="summary-value" style="font-size:18px">${escapeHtml(data.estimatedEndTime)}</div></div>
      </div>
      <div class="stops-container">${stopsHtml}</div>
    </div>`;
  }).join('\n');

  // Reuse same styles
  printWindow.document.write(`<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<title>Rijlijsten ${escapeHtml(validRijlijsten[0]?.routeDateFormatted || '')}</title>
<style>
  @page { margin: 14mm 12mm; size: A4; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; color: #1a1a2e; font-size: 11px; line-height: 1.5; }
  .page-header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #1a1a2e; padding-bottom:14px; margin-bottom:16px; }
  .header-title { font-size:22px; font-weight:800; }
  .header-date { font-size:13px; color:#475569; margin-top:2px; }
  .header-right { text-align:right; }
  .driver-name { font-size:18px; font-weight:700; }
  .header-time { font-size:28px; font-weight:800; margin-top:4px; }
  .header-time-label { font-size:9px; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; }
  .summary-bar { display:flex; gap:16px; padding:10px 14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:18px; }
  .summary-item { }
  .summary-label { font-size:9px; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; }
  .summary-value { font-size:14px; font-weight:700; }
  .summary-end { margin-left:auto; text-align:right; }
  .stop-card { border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; margin-bottom:2px; page-break-inside:avoid; }
  .stop-leveren { border-left:4px solid #10b981; }
  .stop-ophalen { border-left:4px solid #ef4444; }
  .stop-utility { border-left:4px solid #6b7280; }
  .stop-header { display:flex; align-items:center; gap:10px; padding:8px 12px; background:#f8fafc; border-bottom:1px solid #f1f5f9; }
  .stop-number { width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-size:11px; font-weight:700; flex-shrink:0; }
  .stop-title { flex:1; }
  .stop-type { font-size:12px; font-weight:700; }
  .stop-order { font-size:10px; color:#475569; }
  .stop-times { text-align:right; }
  .time-arrival { font-size:16px; font-weight:800; }
  .time-departure { font-size:10px; color:#475569; }
  .time-duration { font-size:9px; color:#64748b; background:#e2e8f0; display:inline-block; padding:0 4px; border-radius:3px; margin-top:2px; }
  .stop-body { padding:8px 12px 10px; }
  .stop-body.utility { padding:6px 12px; font-size:11px; color:#475569; }
  .stop-location { font-size:11px; font-weight:600; margin-bottom:6px; }
  .stop-timing-row { display:flex; gap:20px; margin-bottom:6px; padding:4px 8px; background:#f1f5f9; border-radius:4px; }
  .timing-item { display:flex; flex-direction:column; }
  .timing-label { font-size:9px; color:#64748b; text-transform:uppercase; letter-spacing:0.3px; }
  .timing-value { font-size:13px; font-weight:700; }
  .timing-customer { color:#059669; }
  .stop-vehicles { display:flex; align-items:center; gap:6px; font-size:11px; margin-bottom:6px; }
  .vehicle-value { font-weight:600; }
  .transport-badge { display:inline-block; background:#e2e8f0; color:#334155; padding:1px 6px; border-radius:3px; font-size:9px; font-weight:500; }
  .stop-customer { border-top:1px solid #f1f5f9; padding-top:6px; margin-top:4px; }
  .customer-row { display:flex; justify-content:space-between; padding:1px 0; font-size:10px; }
  .customer-label { color:#64748b; }
  .customer-value { font-weight:600; }
  .stop-notes { padding:6px 10px; background:#fef3c7; border-top:1px solid #f59e0b; font-size:10px; font-weight:600; color:#78350f; }
  .drive-connector { display:flex; align-items:center; padding:2px 0 2px 20px; gap:8px; }
  .drive-line { width:2px; height:14px; background:#cbd5e1; border-radius:1px; }
  .drive-line.short { height:6px; }
  .drive-badge { font-size:10px; color:#475569; font-weight:500; padding:1px 8px; background:#f1f5f9; border-radius:10px; }
  .footer { margin-top:16px; padding-top:8px; border-top:1px solid #e2e8f0; font-size:9px; color:#64748b; text-align:center; }
</style>
</head>
<body>
${pages}
<div class="footer">
  Gegenereerd op ${new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · Rent & Event Logistiek
</div>
</body>
</html>`);

  printWindow.document.close();
  setTimeout(() => { printWindow.print(); }, 350);
}
