import { format } from 'date-fns';

interface IcsEventParams {
  orderNumber: string;
  customerName: string;
  companyName?: string;
  location: string;
  startDate: string; // yyyy-MM-dd
  startTime: string; // HH:mm
  endDate: string;   // yyyy-MM-dd
  endTime: string;   // HH:mm
  segment: 'leveren' | 'ophalen';
  notes?: string;
  driverName?: string;
}

/**
 * Format a date+time to iCal DTSTART/DTEND format (local time, no timezone)
 * e.g. 20250615T090000
 */
function toIcsDateTime(date: string, time: string): string {
  const [y, m, d] = date.split('-');
  const [h, min] = time.split(':');
  return `${y}${m}${d}T${h}${min}00`;
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Generate an .ics calendar file content for a single order segment
 */
export function generateIcsContent(params: IcsEventParams): string {
  const {
    orderNumber,
    customerName,
    companyName,
    location,
    startDate,
    startTime,
    endDate,
    endTime,
    segment,
    notes,
    driverName,
  } = params;

  const isLeveren = segment === 'leveren';
  const summary = `${isLeveren ? '🚚 Leveren' : '📦 Ophalen'} - ${orderNumber} - ${companyName || customerName}`;

  const dtStart = toIcsDateTime(isLeveren ? startDate : endDate, isLeveren ? startTime : endTime);
  // Assume ~2 hour window for the event
  const eventDate = isLeveren ? startDate : endDate;
  const eventTime = isLeveren ? startTime : endTime;
  const [h, m] = eventTime.split(':').map(Number);
  const endH = Math.min(h + 2, 23);
  const dtEnd = toIcsDateTime(eventDate, `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

  const descParts: string[] = [];
  descParts.push(`Order: ${orderNumber}`);
  descParts.push(`Klant: ${customerName}`);
  if (companyName) descParts.push(`Bedrijf: ${companyName}`);
  descParts.push(`Type: ${isLeveren ? 'Leveren' : 'Ophalen'}`);
  descParts.push(`Locatie: ${location}`);
  if (driverName) descParts.push(`Chauffeur: ${driverName}`);
  if (notes) descParts.push(`Notities: ${notes}`);

  const description = escapeIcsText(descParts.join('\n'));
  const uid = `${orderNumber}-${segment}-${eventDate}@readybike`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ReadyBike//Logistiek//NL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsDateTime(format(new Date(), 'yyyy-MM-dd'), format(new Date(), 'HH:mm'))}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${escapeIcsText(location)}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Herinnering: rit over 2 uur',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n');
}

/**
 * Download an .ics file for an order segment
 */
export function downloadIcsFile(params: IcsEventParams): void {
  const content = generateIcsContent(params);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${params.orderNumber}-${params.segment}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
