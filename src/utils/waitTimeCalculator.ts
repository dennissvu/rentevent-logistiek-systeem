import { supabase } from "@/integrations/supabase/client";
import { LOCATIONS } from "./driverScheduleCalculator";

// Minimale winkeltijd om terug te keren (in minuten)
export const MIN_SHOP_TIME_MINUTES = 120; // 2 uur

export interface WaitTimeAnalysis {
  // Tijden
  deliveryCompleteTime: string; // Wanneer levering klaar is
  pickupStartTime: string; // Wanneer ophalen begint
  totalWaitMinutes: number; // Totale wachttijd bij klant
  
  // Retour naar winkel analyse
  driveToShopMinutes: number; // Rijtijd klant → winkel
  driveBackMinutes: number; // Rijtijd winkel → klant
  totalRoundTripMinutes: number; // Totale retourtijd
  usableShopTimeMinutes: number; // Netto tijd in winkel
  
  // Beslissing
  shouldReturnToShop: boolean; // Automatische aanbeveling
  returnReason: string; // Uitleg van de beslissing
  
  // Retour route (indien van toepassing)
  returnRoute?: {
    departFromCustomer: string;
    arriveAtShop: string;
    departFromShop: string;
    arriveBackAtCustomer: string;
  };
  
  isEstimate: boolean;
}

interface DriveTimeResult {
  durationMinutes: number;
  durationText: string;
  distanceKm: number;
  distanceText: string;
  trafficDurationMinutes?: number;
  trafficDurationText?: string;
  isEstimate: boolean;
}

// API call naar edge function voor rijtijd
async function fetchDriveTime(
  origin: string,
  destination: string,
  departureTime?: Date
): Promise<DriveTimeResult> {
  try {
    const { data, error } = await supabase.functions.invoke('calculate-drive-time', {
      body: {
        origin,
        destination,
        departureTime: departureTime?.toISOString(),
      },
    });

    if (error) throw error;
    return data as DriveTimeResult;
  } catch (err) {
    console.error('Error fetching drive time:', err);
    // Fallback schatting
    return {
      durationMinutes: 30,
      durationText: '~30 min',
      distanceKm: 25,
      distanceText: '~25 km',
      isEstimate: true,
    };
  }
}

// Format tijd als HH:MM
function formatTime(date: Date): string {
  return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
}

// Parse tijd string naar Date
function parseTimeToDate(timeStr: string, baseDate: Date): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date(baseDate);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/**
 * Analyseer of de chauffeur terug moet naar de winkel tijdens wachttijd
 */
export async function analyzeWaitTime(params: {
  deliveryCompleteTime: string; // HH:MM - wanneer levering klaar is (uitladen voltooid)
  pickupStartTime: string; // HH:MM - wanneer ophalen begint
  customerAddress: string;
  date: Date;
  forceReturn?: boolean | null; // null = auto, true = force return, false = force wait
}): Promise<WaitTimeAnalysis> {
  const { deliveryCompleteTime, pickupStartTime, customerAddress, date, forceReturn } = params;
  
  const deliveryComplete = parseTimeToDate(deliveryCompleteTime, date);
  const pickupStart = parseTimeToDate(pickupStartTime, date);
  
  // Totale beschikbare wachttijd
  const totalWaitMinutes = Math.round((pickupStart.getTime() - deliveryComplete.getTime()) / 60000);
  
  // Haal rijtijden op (parallel)
  const [customerToShop, shopToCustomer] = await Promise.all([
    fetchDriveTime(customerAddress, 'winkel', deliveryComplete),
    fetchDriveTime('winkel', customerAddress, pickupStart),
  ]);
  
  const driveToShopMinutes = customerToShop.trafficDurationMinutes || customerToShop.durationMinutes;
  const driveBackMinutes = shopToCustomer.trafficDurationMinutes || shopToCustomer.durationMinutes;
  const totalRoundTripMinutes = driveToShopMinutes + driveBackMinutes;
  
  // Netto bruikbare tijd in de winkel
  const usableShopTimeMinutes = totalWaitMinutes - totalRoundTripMinutes;
  
  // Beslissing: terugkeren als ≥ 2 uur nuttige winkeltijd
  let shouldReturnToShop: boolean;
  let returnReason: string;
  
  if (forceReturn === true) {
    shouldReturnToShop = true;
    returnReason = 'Handmatig ingesteld: chauffeur keert terug naar winkel';
  } else if (forceReturn === false) {
    shouldReturnToShop = false;
    returnReason = 'Handmatig ingesteld: chauffeur wacht bij klant';
  } else {
    // Automatische berekening
    shouldReturnToShop = usableShopTimeMinutes >= MIN_SHOP_TIME_MINUTES;
    if (shouldReturnToShop) {
      const hours = Math.floor(usableShopTimeMinutes / 60);
      const mins = usableShopTimeMinutes % 60;
      returnReason = `Chauffeur kan ${hours}u${mins > 0 ? mins + 'm' : ''} helpen in de winkel`;
    } else if (usableShopTimeMinutes > 0) {
      returnReason = `Winkeltijd (${usableShopTimeMinutes} min) < 2 uur, wachten bij klant`;
    } else {
      returnReason = 'Geen tijd voor retour naar winkel';
    }
  }
  
  const isEstimate = customerToShop.isEstimate || shopToCustomer.isEstimate;
  
  // Bereken retour route indien van toepassing
  let returnRoute: WaitTimeAnalysis['returnRoute'];
  if (shouldReturnToShop) {
    const departFromCustomer = new Date(deliveryComplete);
    
    const arriveAtShop = new Date(departFromCustomer);
    arriveAtShop.setMinutes(arriveAtShop.getMinutes() + driveToShopMinutes);
    
    // Chauffeur moet zo vertrekken dat ie op tijd bij klant is voor ophalen
    const arriveBackAtCustomer = new Date(pickupStart);
    const departFromShop = new Date(arriveBackAtCustomer);
    departFromShop.setMinutes(departFromShop.getMinutes() - driveBackMinutes);
    
    returnRoute = {
      departFromCustomer: formatTime(departFromCustomer),
      arriveAtShop: formatTime(arriveAtShop),
      departFromShop: formatTime(departFromShop),
      arriveBackAtCustomer: formatTime(arriveBackAtCustomer),
    };
  }
  
  return {
    deliveryCompleteTime,
    pickupStartTime,
    totalWaitMinutes,
    driveToShopMinutes,
    driveBackMinutes,
    totalRoundTripMinutes,
    usableShopTimeMinutes,
    shouldReturnToShop,
    returnReason,
    returnRoute,
    isEstimate,
  };
}

/**
 * Synchrone versie voor snelle weergave (schatting)
 */
export function analyzeWaitTimeSync(params: {
  deliveryCompleteTime: string;
  pickupStartTime: string;
  estimatedDriveMinutes?: number;
  forceReturn?: boolean | null;
}): {
  totalWaitMinutes: number;
  usableShopTimeMinutes: number;
  shouldReturnToShop: boolean;
} {
  const { deliveryCompleteTime, pickupStartTime, estimatedDriveMinutes = 30, forceReturn } = params;
  
  const [delHours, delMins] = deliveryCompleteTime.split(':').map(Number);
  const [pickHours, pickMins] = pickupStartTime.split(':').map(Number);
  
  const deliveryMinutes = delHours * 60 + delMins;
  const pickupMinutes = pickHours * 60 + pickMins;
  
  const totalWaitMinutes = pickupMinutes - deliveryMinutes;
  const totalRoundTripMinutes = estimatedDriveMinutes * 2;
  const usableShopTimeMinutes = totalWaitMinutes - totalRoundTripMinutes;
  
  let shouldReturnToShop: boolean;
  if (forceReturn === true) {
    shouldReturnToShop = true;
  } else if (forceReturn === false) {
    shouldReturnToShop = false;
  } else {
    shouldReturnToShop = usableShopTimeMinutes >= MIN_SHOP_TIME_MINUTES;
  }
  
  return {
    totalWaitMinutes,
    usableShopTimeMinutes,
    shouldReturnToShop,
  };
}
