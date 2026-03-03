/**
 * Generates a professional, printable trip document for drivers.
 * Includes customer info, booking details, locations, route timeline, and load/unload plan.
 */

export interface PrintRouteStep {
  time: string;
  endTime?: string;
  label: string;
  sublabel?: string;
  detail?: string;
  type: 'start' | 'stop' | 'action' | 'destination' | 'return';
}

export interface PrintLoadStep {
  action: 'laden' | 'lossen';
  location: string;
  vehicleType: string;
  vehicleIcon: string;
  vehicleCount: number;
  stayLoadedCount?: number;
  helperNames: string[];
  transportName: string;
}

export interface TripPrintData {
  // Header
  segment: 'leveren' | 'ophalen';
  assignmentNumber?: number;

  // Chauffeur & Transport
  driverName: string;
  transportName: string;
  startTime: string;
  endTime: string;
  hasTrailer: boolean;

  // Order info
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  companyName?: string;

  // Booking
  bookingDate: string;
  customerStartTime: string;
  customerEndTime: string;
  numberOfPersons: number;
  vehiclesSummary: string; // e.g. "25x E-choppers"

  // Locations
  deliveryLocation: string;
  pickupLocation: string;

  // Route
  routeSteps: PrintRouteStep[];

  // Summary
  driveTimeOutbound: string;
  driveTimeReturn: string;

  // Load/Unload plan
  loadSteps: PrintLoadStep[];

  // Notes
  notes?: string;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function openTripPrintDocument(data: TripPrintData): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

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
          <thead>
            <tr>
              <th>Locatie</th>
              <th>Voertuig</th>
              <th>Aantal</th>
              <th>Transport</th>
              <th>Medewerkers</th>
            </tr>
          </thead>
          <tbody>
            ${steps.map(s => {
              const isBlijftStaan = s.location.toLowerCase() === 'blijft staan';
              return `
              <tr${isBlijftStaan ? ' style="background:#eff6ff"' : ''}>
                <td>${isBlijftStaan ? '<span style="color:#2563eb;font-weight:600">🅿️ Blijft staan</span>' : escapeHtml(s.location)}</td>
                <td>${s.vehicleIcon} ${escapeHtml(s.vehicleType)}</td>
                <td class="count">${s.vehicleCount}x</td>
                <td>${escapeHtml(s.transportName)}</td>
                <td>${isBlijftStaan ? '<span class="no-helper">—</span>' : (s.helperNames.length > 0
                  ? s.helperNames.map(n => `<span class="helper-badge">${escapeHtml(n)}</span>`).join(' ')
                  : '<span class="no-helper">—</span>')
                }</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  };

  const html = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  @page { margin: 16mm 14mm; size: A4; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    color: #1a1a2e;
    font-size: 12px;
    line-height: 1.5;
    padding: 0;
  }

  /* Header */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid ${segmentColor};
    padding-bottom: 12px;
    margin-bottom: 16px;
  }
  .header-title {
    font-size: 20px;
    font-weight: 700;
    color: ${segmentColor};
  }
  .header-sub {
    font-size: 12px;
     color: #475569;
    margin-top: 2px;
  }
  .header-driver {
    text-align: right;
  }
  .driver-name {
    font-size: 16px;
    font-weight: 700;
  }
  .driver-transport {
    font-size: 11px;
     color: #475569;
    margin-top: 2px;
  }
  .driver-time {
    font-size: 24px;
    font-weight: 800;
    color: ${segmentColor};
    margin-top: 4px;
  }

  /* Grid layout */
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-bottom: 16px;
  }
  .info-card {
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 10px 12px;
  }
  .info-card-title {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
     color: #64748b;
    margin-bottom: 6px;
    border-bottom: 1px solid #f1f5f9;
    padding-bottom: 4px;
  }
  .info-row {
    display: flex;
    justify-content: space-between;
    padding: 2px 0;
    font-size: 11px;
  }
  .info-label { color: #475569; }
  .info-value { font-weight: 600; text-align: right; max-width: 60%; }

  /* Location cards */
  .location-card {
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 10px 12px;
    border-left: 3px solid;
  }
  .location-card.deliver { border-left-color: #10b981; }
  .location-card.pickup { border-left-color: #3b82f6; }
  .location-type {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
     color: #64748b;
  }
  .location-address {
    font-size: 12px;
    font-weight: 600;
    margin-top: 2px;
  }
  .location-time {
    font-size: 11px;
     color: #475569;
    margin-top: 2px;
  }

  /* Route timeline */
  .section-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #475569;
    margin: 16px 0 10px;
    padding-bottom: 4px;
    border-bottom: 2px solid #e2e8f0;
  }
  .route-step {
    position: relative;
    display: flex;
    align-items: flex-start;
    padding: 6px 0 6px 24px;
    min-height: 32px;
  }
  .route-dot {
    position: absolute;
    left: 4px;
    top: 10px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .route-line {
    position: absolute;
    left: 8px;
    top: 22px;
    bottom: -6px;
    width: 2px;
    background: #e2e8f0;
  }
  .route-content { flex: 1; }
  .route-label { font-weight: 600; font-size: 12px; }
  .route-sublabel { font-size: 10px; color: #475569; }
  .route-detail { font-size: 10px; color: #f59e0b; font-weight: 500; }
  .route-time { 
    text-align: right; 
    min-width: 80px; 
    font-weight: 600; 
    font-size: 12px; 
  }
  .time-range { font-size: 10px; color: #475569; display: block; }

  /* Summary bar */
  .summary-bar {
    display: flex;
    gap: 20px;
    padding: 10px 14px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    margin: 14px 0;
    font-size: 11px;
  }
  .summary-item-label { color: #475569; font-size: 10px; }
  .summary-item-value { font-weight: 700; font-size: 13px; }
  .summary-end {
    margin-left: auto;
    text-align: right;
  }
  .summary-end .summary-item-value {
    color: ${segmentColor};
    font-size: 16px;
  }

  /* Load/unload table */
  .load-section { margin-top: 8px; }
  .load-header {
    font-size: 10px;
    font-weight: 600;
     color: #475569;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .load-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    margin-bottom: 10px;
  }
  .load-table th {
    text-align: left;
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
     color: #64748b;
    padding: 4px 8px 4px 0;
    border-bottom: 1px solid #e2e8f0;
  }
  .load-table td {
    padding: 5px 8px 5px 0;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: middle;
  }
  .load-table .count { font-weight: 700; }
  .helper-badge {
    display: inline-block;
    background: #e2e8f0;
    color: #334155;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 500;
    margin: 1px 2px;
  }
  .no-helper { color: #94a3b8; }

  /* Footer */
  .footer {
    margin-top: 16px;
    padding-top: 8px;
    border-top: 1px solid #e2e8f0;
    font-size: 9px;
     color: #64748b;
    text-align: center;
  }

  .return-divider {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #475569;
    padding: 8px 0 4px 24px;
    border-top: 1px dashed #cbd5e1;
    margin-top: 4px;
  }

  /* Notes banner */
  .notes-banner {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 14px;
    background: #fef3c7;
    border: 2px solid #f59e0b;
    border-radius: 6px;
    margin-bottom: 16px;
  }
  .notes-icon {
    font-size: 18px;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .notes-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #92400e;
    margin-bottom: 2px;
  }
  .notes-text {
    font-size: 12px;
    font-weight: 600;
    color: #78350f;
    white-space: pre-line;
  }
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <div>
    <div class="header-title">${escapeHtml(segmentLabel)}planning</div>
    <div class="header-sub">Order ${escapeHtml(data.orderNumber)} · ${escapeHtml(data.bookingDate)}</div>
  </div>
  <div class="header-driver">
    <div class="driver-name">${escapeHtml(data.driverName)}</div>
    <div class="driver-transport">${escapeHtml(data.transportName)}${data.hasTrailer ? ' · Met aanhanger' : ''}</div>
    <div class="driver-time">${escapeHtml(data.startTime)}</div>
  </div>
</div>

${data.notes ? `
<!-- Notes -->
<div class="notes-banner">
  <div class="notes-icon">⚠️</div>
  <div class="notes-content">
    <div class="notes-title">Opmerkingen</div>
    <div class="notes-text">${escapeHtml(data.notes)}</div>
  </div>
</div>
` : ''}

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

<!-- Locations -->
<div class="info-grid">
  ${isLeveren ? `
  <div class="location-card deliver">
    <div class="location-type">Afleverlocatie</div>
    <div class="location-address">${escapeHtml(data.deliveryLocation)}</div>
    <div class="location-time">Leveren om ${escapeHtml(data.customerStartTime)}</div>
  </div>
  ` : `
  <div class="location-card pickup">
    <div class="location-type">Ophaallocatie</div>
    <div class="location-address">${escapeHtml(data.pickupLocation)}</div>
    <div class="location-time">Ophalen om ${escapeHtml(data.customerEndTime)}</div>
  </div>
  `}
</div>

<!-- Route -->
<div class="section-title">Routeplanning</div>
${routeHtml}

<!-- Summary bar -->
<div class="summary-bar">
  <div>
    <div class="summary-item-label">Heenrit</div>
    <div class="summary-item-value">${escapeHtml(data.driveTimeOutbound)}</div>
  </div>
  <div>
    <div class="summary-item-label">Retourrit</div>
    <div class="summary-item-value">${escapeHtml(data.driveTimeReturn)}</div>
  </div>
  <div>
    <div class="summary-item-label">Transport</div>
    <div class="summary-item-value">${data.hasTrailer ? 'Met aanhanger' : 'Alleen bakwagen'}</div>
  </div>
  <div class="summary-end">
    <div class="summary-item-label">Chauffeur klaar</div>
    <div class="summary-item-value">${escapeHtml(data.endTime)}</div>
  </div>
</div>

<!-- Load/Unload plan -->
${(ladenSteps.length > 0 || lossenSteps.length > 0) ? `
  <div class="section-title">Laad- & Losplan</div>
  ${loadTableHtml(ladenSteps, isLeveren ? 'Laden voor vertrek' : 'Laden bij klant')}
  ${loadTableHtml(lossenSteps, isLeveren ? 'Lossen bij klant' : 'Lossen na terugkomst')}
` : ''}

<div class="footer">
  Gegenereerd op ${new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
</div>

</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => { printWindow.print(); }, 350);
}
