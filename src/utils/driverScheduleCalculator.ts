import { supabase } from "@/integrations/supabase/client";
import { combis } from "@/data/transportData";

// Vaste locaties
export const LOCATIONS = {
  winkel: "Haven 45, 1131 EP Volendam",
  loods: "Aan de Purmer, Purmerend",
};

// Tijdsconstanten (in minuten)
export const TIME_CONSTANTS = {
  STARTUP_TIME_WINKEL: 15, // Opstarten bij winkel
  READY_BEFORE_START: 15, // Klaar staan voor starttijd
  TRAILER_COUPLING_TIME: 7, // Aanhanger aankoppelen
};

// Laad/lostijden per transporttype, vulgraad en segment (in minuten)
// Gebaseerd op praktijkervaring
export const LOAD_UNLOAD_TIMES = {
  leveren: {
    bakwagen: { half: 15, vol: 30 },
    aanhanger: { half: 20, vol: 30 },
  },
  ophalen: {
    bakwagen: { half: 25, vol: 40 },
    aanhanger: { half: 25, vol: 35 },
  },
};

// Bepaal vulgraad: half of vol (>50% = vol)
export function getFillLevel(loadPercentage: number): 'half' | 'vol' {
  return loadPercentage > 50 ? 'vol' : 'half';
}

// Bereken laad/lostijd op basis van transporttype, vulgraad en segment
export function calculateLoadUnloadTime(params: {
  segment: 'leveren' | 'ophalen';
  hasTrailer: boolean; // Combi = bakwagen + aanhanger
  bakwagenFillPercentage: number; // 0-100
  aanhangerFillPercentage?: number; // 0-100, alleen bij combi
}): number {
  const { segment, hasTrailer, bakwagenFillPercentage, aanhangerFillPercentage = 0 } = params;
  const times = LOAD_UNLOAD_TIMES[segment];
  
  // Bakwagen tijd
  const bakwagenFill = getFillLevel(bakwagenFillPercentage);
  let totalMinutes = times.bakwagen[bakwagenFill];
  
  // Aanhanger tijd (alleen bij combi)
  if (hasTrailer && aanhangerFillPercentage > 0) {
    const aanhangerFill = getFillLevel(aanhangerFillPercentage);
    totalMinutes += times.aanhanger[aanhangerFill];
  }
  
  return totalMinutes;
}

// Simpele versie: schat vulgraad op basis van voertuigaantal
// Aanname: bakwagen max ~20 voertuigen, aanhanger max ~15 voertuigen
export function estimateLoadUnloadTime(params: {
  segment: 'leveren' | 'ophalen';
  vehicleCount: number;
  hasTrailer: boolean;
}): number {
  const { segment, vehicleCount, hasTrailer } = params;
  
  const BAKWAGEN_CAPACITY = 20;
  const AANHANGER_CAPACITY = 15;
  
  if (hasTrailer) {
    // Combi: verdeel over bakwagen en aanhanger
    const bakwagenLoad = Math.min(vehicleCount, BAKWAGEN_CAPACITY);
    const aanhangerLoad = Math.max(0, vehicleCount - BAKWAGEN_CAPACITY);
    
    return calculateLoadUnloadTime({
      segment,
      hasTrailer: true,
      bakwagenFillPercentage: (bakwagenLoad / BAKWAGEN_CAPACITY) * 100,
      aanhangerFillPercentage: (aanhangerLoad / AANHANGER_CAPACITY) * 100,
    });
  } else {
    // Alleen bakwagen
    return calculateLoadUnloadTime({
      segment,
      hasTrailer: false,
      bakwagenFillPercentage: Math.min(100, (vehicleCount / BAKWAGEN_CAPACITY) * 100),
    });
  }
}

// Bereken gecombineerd uitladen: 2 chauffeurs helpen elkaar
// Logica: kortste taak eerst klaar, helper versnelt resterende werk 2x
export function calculateCombinedUnloadTime(params: {
  segment: 'leveren' | 'ophalen';
  driver1VehicleCount: number;
  driver1HasTrailer: boolean;
  driver2VehicleCount: number;
  driver2HasTrailer: boolean;
}): {
  driver1Time: number;
  driver2Time: number;
  combinedWallClockTime: number;
  timeSaved: number;
} {
  const { segment, driver1VehicleCount, driver1HasTrailer, driver2VehicleCount, driver2HasTrailer } = params;
  
  // Bereken individuele tijden
  const time1 = estimateLoadUnloadTime({ segment, vehicleCount: driver1VehicleCount, hasTrailer: driver1HasTrailer });
  const time2 = estimateLoadUnloadTime({ segment, vehicleCount: driver2VehicleCount, hasTrailer: driver2HasTrailer });
  
  // Bepaal wie korter/langer bezig is
  const shorterTime = Math.min(time1, time2);
  const longerTime = Math.max(time1, time2);
  
  // Na shorterTime is helper klaar, resterende werk van langere chauffeur gaat 2x zo snel
  const remainingWork = longerTime - shorterTime;
  const helpedTime = remainingWork / 2;
  
  // Totale wall clock tijd = korte taak + gehalveerde resterende tijd
  const combinedWallClockTime = shorterTime + helpedTime;
  
  // Hoeveel tijd bespaard t.o.v. langste individuele tijd
  const timeSaved = longerTime - combinedWallClockTime;
  
  return {
    driver1Time: time1,
    driver2Time: time2,
    combinedWallClockTime: Math.round(combinedWallClockTime),
    timeSaved: Math.round(timeSaved),
  };
}

export interface DriveTimeResult {
  durationMinutes: number;
  durationText: string;
  distanceKm: number;
  distanceText: string;
  trafficDurationMinutes?: number;
  trafficDurationText?: string;
  isEstimate: boolean;
}

export interface DriverSchedule {
  // Planning voor leveren
  delivery: {
    startAtWinkel: string; // Vertrek vanuit winkel
    arriveAtLoods?: string; // Aankomst bij loods (indien nodig)
    departFromLoods?: string; // Vertrek na aankoppelen
    arriveAtCustomer: string; // Aankomst bij klant
    unloadComplete: string; // Klaar met uitladen
    readyForCustomer: string; // 15 min voor klant starttijd
  };
  // Retourrit planning
  returnTrip?: {
    departFromCustomer: string;
    arriveAtWinkelForUnload?: string; // Ophalen+aanhanger: eerste stop bij winkel om te lossen
    arriveAtLoods?: string; // Aankomst bij loods (aanhanger afkoppelen)
    departFromLoods?: string; // Vertrek na afkoppelen
    arriveAtWinkel: string;
    totalReturnMinutes: number;
  };
  // Rijtijden
  driveTimes: {
    winkelToLoods?: DriveTimeResult;
    loodsToCustomer?: DriveTimeResult;
    winkelToCustomer?: DriveTimeResult;
    customerToLoods?: DriveTimeResult;
    loodsToWinkel?: DriveTimeResult;
    customerToWinkel?: DriveTimeResult;
  };
  // Totale tijden
  totals: {
    totalDriveMinutes: number;
    totalPrepMinutes: number;
    unloadMinutes: number;
    driverStartTime: string; // Wanneer chauffeur moet beginnen
    driverEndTime?: string; // Wanneer chauffeur klaar is (na retour)
  };
  // Of we een aanhanger nodig hebben
  needsTrailer: boolean;
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

// Check of transport een combi (met aanhanger) is
export function needsTrailer(transportId: string): boolean {
  return combis.some(c => c.id === transportId);
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

// Bereken chauffeur planning
export async function calculateDriverSchedule(params: {
  customerStartTime: string; // HH:MM
  customerAddress: string;
  vehicleCount: number;
  transportId?: string;
  date: Date;
  segment?: 'leveren' | 'ophalen'; // Type rit
}): Promise<DriverSchedule> {
  const { customerStartTime, customerAddress, vehicleCount, transportId, date, segment = 'leveren' } = params;
  const isPickup = segment === 'ophalen';
  
  const hasTrailer = transportId ? needsTrailer(transportId) : false;
  const loadUnloadMinutes = estimateLoadUnloadTime({
    segment,
    vehicleCount,
    hasTrailer,
  });
  
  // Bij ophalen: geen voorbereidingstijd nodig, chauffeur komt op afgesproken tijd
  const readyBeforeStart = isPickup ? 0 : TIME_CONSTANTS.READY_BEFORE_START;
  const startupTimeWinkel = isPickup ? 0 : TIME_CONSTANTS.STARTUP_TIME_WINKEL;
  
  // Parse klant starttijd
  const customerStart = parseTimeToDate(customerStartTime, date);
  
  let arriveAtCustomer: Date;
  let readyForCustomer: Date;
  let loadUnloadComplete: Date;
  
  if (isPickup) {
    // Bij ophalen: chauffeur komt aan op afgesproken tijd, laadt daarna in
    arriveAtCustomer = new Date(customerStart);
    readyForCustomer = new Date(customerStart);
    loadUnloadComplete = new Date(customerStart);
    loadUnloadComplete.setMinutes(loadUnloadComplete.getMinutes() + loadUnloadMinutes);
  } else {
    // Bij leveren: 15 min voor starttijd klaar staan, dus eerder aankomen
    readyForCustomer = new Date(customerStart);
    readyForCustomer.setMinutes(readyForCustomer.getMinutes() - readyBeforeStart);
    
    // Uitladen klaar = readyForCustomer
    loadUnloadComplete = new Date(readyForCustomer);
    
    // Aankomst = uitladen klaar - uitlaadtijd
    arriveAtCustomer = new Date(loadUnloadComplete);
    arriveAtCustomer.setMinutes(arriveAtCustomer.getMinutes() - loadUnloadMinutes);
  }
  
  let schedule: DriverSchedule;
  let driveTimes: DriverSchedule['driveTimes'] = {};
  let isEstimate = false;

  if (hasTrailer) {
    // Route: Winkel -> Loods -> Klant
    
    // Haal rijtijd Loods -> Klant op (met departure time)
    const loodsToCustomerTime = await fetchDriveTime(
      'loods',
      customerAddress,
      arriveAtCustomer // departure time voor traffic
    );
    driveTimes.loodsToCustomer = loodsToCustomerTime;
    isEstimate = isEstimate || loodsToCustomerTime.isEstimate;
    
    // Vertrek van loods
    const driveTimeLoods = loodsToCustomerTime.trafficDurationMinutes || loodsToCustomerTime.durationMinutes;
    const departFromLoods = new Date(arriveAtCustomer);
    departFromLoods.setMinutes(departFromLoods.getMinutes() - driveTimeLoods);
    
    // Aankomst bij loods (koppelen duurt 7 min)
    const arriveAtLoods = new Date(departFromLoods);
    arriveAtLoods.setMinutes(arriveAtLoods.getMinutes() - TIME_CONSTANTS.TRAILER_COUPLING_TIME);
    
    // Haal rijtijd Winkel -> Loods op
    const winkelToLoodsTime = await fetchDriveTime(
      'winkel',
      'loods',
      arriveAtLoods
    );
    driveTimes.winkelToLoods = winkelToLoodsTime;
    isEstimate = isEstimate || winkelToLoodsTime.isEstimate;
    
    const driveTimeWinkel = winkelToLoodsTime.trafficDurationMinutes || winkelToLoodsTime.durationMinutes;
    
    // Vertrek van winkel
    const departFromWinkel = new Date(arriveAtLoods);
    departFromWinkel.setMinutes(departFromWinkel.getMinutes() - driveTimeWinkel);
    
    // Chauffeur start (bij leveren: 15 min eerder voor opstarten, bij ophalen: direct)
    const driverStartTime = new Date(departFromWinkel);
    driverStartTime.setMinutes(driverStartTime.getMinutes() - startupTimeWinkel);
    
    // Retourrit berekenen - route hangt af van segment
    if (isPickup) {
      // Ophalen: Klant -> Winkel (lossen) -> Loods (lege aanhanger afkoppelen) -> Winkel
      const customerToWinkelReturnTime = await fetchDriveTime(
        customerAddress,
        'winkel',
        loadUnloadComplete
      );
      driveTimes.customerToWinkel = customerToWinkelReturnTime;
      isEstimate = isEstimate || customerToWinkelReturnTime.isEstimate;
      
      const driveTimeCustomerToWinkel = customerToWinkelReturnTime.trafficDurationMinutes || customerToWinkelReturnTime.durationMinutes;
      
      const winkelToLoodsReturnTime = await fetchDriveTime(
        'winkel',
        'loods',
        new Date(loadUnloadComplete.getTime() + driveTimeCustomerToWinkel * 60000)
      );
      if (!driveTimes.winkelToLoods) driveTimes.winkelToLoods = winkelToLoodsReturnTime;
      isEstimate = isEstimate || winkelToLoodsReturnTime.isEstimate;
      
      const driveTimeWinkelToLoodsReturn = winkelToLoodsReturnTime.trafficDurationMinutes || winkelToLoodsReturnTime.durationMinutes;
      
      const loodsToWinkelTime = await fetchDriveTime(
        'loods',
        'winkel',
        new Date(loadUnloadComplete.getTime() + (driveTimeCustomerToWinkel + driveTimeWinkelToLoodsReturn + TIME_CONSTANTS.TRAILER_COUPLING_TIME) * 60000)
      );
      driveTimes.loodsToWinkel = loodsToWinkelTime;
      isEstimate = isEstimate || loodsToWinkelTime.isEstimate;
      
      const driveTimeLoodsToWinkel = loodsToWinkelTime.trafficDurationMinutes || loodsToWinkelTime.durationMinutes;
      
      // Retourrit tijden (zonder shopUnloadMinutes - die wordt extern toegevoegd)
      const departFromCustomerReturn = new Date(loadUnloadComplete);
      const arriveAtWinkelForUnload = new Date(departFromCustomerReturn);
      arriveAtWinkelForUnload.setMinutes(arriveAtWinkelForUnload.getMinutes() + driveTimeCustomerToWinkel);
      // Loods en terugrit: tijden zonder losvertraging (DriverScheduleCard past dit aan)
      const arriveAtLoodsReturn = new Date(arriveAtWinkelForUnload);
      arriveAtLoodsReturn.setMinutes(arriveAtLoodsReturn.getMinutes() + driveTimeWinkelToLoodsReturn);
      const departFromLoodsReturn = new Date(arriveAtLoodsReturn);
      departFromLoodsReturn.setMinutes(departFromLoodsReturn.getMinutes() + TIME_CONSTANTS.TRAILER_COUPLING_TIME);
      const arriveAtWinkelReturn = new Date(departFromLoodsReturn);
      arriveAtWinkelReturn.setMinutes(arriveAtWinkelReturn.getMinutes() + driveTimeLoodsToWinkel);
      
      const totalReturnMinutes = driveTimeCustomerToWinkel + driveTimeWinkelToLoodsReturn + TIME_CONSTANTS.TRAILER_COUPLING_TIME + driveTimeLoodsToWinkel;

      schedule = {
        delivery: {
          startAtWinkel: formatTime(departFromWinkel),
          arriveAtLoods: formatTime(arriveAtLoods),
          departFromLoods: formatTime(departFromLoods),
          arriveAtCustomer: formatTime(arriveAtCustomer),
          unloadComplete: formatTime(loadUnloadComplete),
          readyForCustomer: formatTime(readyForCustomer),
        },
        returnTrip: {
          departFromCustomer: formatTime(departFromCustomerReturn),
          arriveAtWinkelForUnload: formatTime(arriveAtWinkelForUnload),
          arriveAtLoods: formatTime(arriveAtLoodsReturn),
          departFromLoods: formatTime(departFromLoodsReturn),
          arriveAtWinkel: formatTime(arriveAtWinkelReturn),
          totalReturnMinutes,
        },
        driveTimes,
        totals: {
          totalDriveMinutes: driveTimeWinkel + driveTimeLoods,
          totalPrepMinutes: startupTimeWinkel + TIME_CONSTANTS.TRAILER_COUPLING_TIME,
          unloadMinutes: loadUnloadMinutes,
          driverStartTime: formatTime(driverStartTime),
          driverEndTime: formatTime(arriveAtWinkelReturn),
        },
        needsTrailer: true,
        isEstimate,
      };
    } else {
      // Leveren: Klant -> Loods (afkoppelen, aanhanger is leeg) -> Winkel
      const customerToLoodsTime = await fetchDriveTime(
        customerAddress,
        'loods',
        loadUnloadComplete
      );
      driveTimes.customerToLoods = customerToLoodsTime;
      isEstimate = isEstimate || customerToLoodsTime.isEstimate;
      
      const driveTimeCustomerToLoods = customerToLoodsTime.trafficDurationMinutes || customerToLoodsTime.durationMinutes;
      
      const loodsToWinkelTime = await fetchDriveTime(
        'loods',
        'winkel',
        new Date(loadUnloadComplete.getTime() + driveTimeCustomerToLoods * 60000 + TIME_CONSTANTS.TRAILER_COUPLING_TIME * 60000)
      );
      driveTimes.loodsToWinkel = loodsToWinkelTime;
      isEstimate = isEstimate || loodsToWinkelTime.isEstimate;
      
      const driveTimeLoodsToWinkel = loodsToWinkelTime.trafficDurationMinutes || loodsToWinkelTime.durationMinutes;
      
      const departFromCustomerReturn = new Date(loadUnloadComplete);
      const arriveAtLoodsReturn = new Date(departFromCustomerReturn);
      arriveAtLoodsReturn.setMinutes(arriveAtLoodsReturn.getMinutes() + driveTimeCustomerToLoods);
      const departFromLoodsReturn = new Date(arriveAtLoodsReturn);
      departFromLoodsReturn.setMinutes(departFromLoodsReturn.getMinutes() + TIME_CONSTANTS.TRAILER_COUPLING_TIME);
      const arriveAtWinkelReturn = new Date(departFromLoodsReturn);
      arriveAtWinkelReturn.setMinutes(arriveAtWinkelReturn.getMinutes() + driveTimeLoodsToWinkel);
      
      const totalReturnMinutes = driveTimeCustomerToLoods + TIME_CONSTANTS.TRAILER_COUPLING_TIME + driveTimeLoodsToWinkel;

      schedule = {
        delivery: {
          startAtWinkel: formatTime(departFromWinkel),
          arriveAtLoods: formatTime(arriveAtLoods),
          departFromLoods: formatTime(departFromLoods),
          arriveAtCustomer: formatTime(arriveAtCustomer),
          unloadComplete: formatTime(loadUnloadComplete),
          readyForCustomer: formatTime(readyForCustomer),
        },
        returnTrip: {
          departFromCustomer: formatTime(departFromCustomerReturn),
          arriveAtLoods: formatTime(arriveAtLoodsReturn),
          departFromLoods: formatTime(departFromLoodsReturn),
          arriveAtWinkel: formatTime(arriveAtWinkelReturn),
          totalReturnMinutes,
        },
        driveTimes,
        totals: {
          totalDriveMinutes: driveTimeWinkel + driveTimeLoods,
          totalPrepMinutes: startupTimeWinkel + TIME_CONSTANTS.TRAILER_COUPLING_TIME,
          unloadMinutes: loadUnloadMinutes,
          driverStartTime: formatTime(driverStartTime),
          driverEndTime: formatTime(arriveAtWinkelReturn),
        },
        needsTrailer: true,
        isEstimate,
      };
    }
  } else {
    // Route: Winkel -> Klant direct
    
    const winkelToCustomerTime = await fetchDriveTime(
      'winkel',
      customerAddress,
      arriveAtCustomer
    );
    driveTimes.winkelToCustomer = winkelToCustomerTime;
    isEstimate = isEstimate || winkelToCustomerTime.isEstimate;
    
    const driveTime = winkelToCustomerTime.trafficDurationMinutes || winkelToCustomerTime.durationMinutes;
    
    // Vertrek van winkel
    const departFromWinkel = new Date(arriveAtCustomer);
    departFromWinkel.setMinutes(departFromWinkel.getMinutes() - driveTime);
    
    // Chauffeur start (bij leveren: 15 min eerder voor opstarten, bij ophalen: direct)
    const driverStartTime = new Date(departFromWinkel);
    driverStartTime.setMinutes(driverStartTime.getMinutes() - startupTimeWinkel);
    
    // Berekenen retourrit: Klant -> Winkel (direct, geen aanhanger)
    const customerToWinkelTime = await fetchDriveTime(
      customerAddress,
      'winkel',
      loadUnloadComplete
    );
    driveTimes.customerToWinkel = customerToWinkelTime;
    isEstimate = isEstimate || customerToWinkelTime.isEstimate;
    
    const driveTimeReturn = customerToWinkelTime.trafficDurationMinutes || customerToWinkelTime.durationMinutes;
    
    const departFromCustomerReturn = new Date(loadUnloadComplete);
    const arriveAtWinkelReturn = new Date(departFromCustomerReturn);
    arriveAtWinkelReturn.setMinutes(arriveAtWinkelReturn.getMinutes() + driveTimeReturn);

    schedule = {
      delivery: {
        startAtWinkel: formatTime(departFromWinkel),
        arriveAtCustomer: formatTime(arriveAtCustomer),
        unloadComplete: formatTime(loadUnloadComplete),
        readyForCustomer: formatTime(readyForCustomer),
      },
      returnTrip: {
        departFromCustomer: formatTime(departFromCustomerReturn),
        arriveAtWinkel: formatTime(arriveAtWinkelReturn),
        totalReturnMinutes: driveTimeReturn,
      },
      driveTimes,
      totals: {
        totalDriveMinutes: driveTime,
        totalPrepMinutes: startupTimeWinkel,
        unloadMinutes: loadUnloadMinutes,
        driverStartTime: formatTime(driverStartTime),
        driverEndTime: formatTime(arriveAtWinkelReturn),
      },
      needsTrailer: false,
      isEstimate,
    };
  }
  
  return schedule;
}

// Synchrone fallback berekening (voor snelle weergave zonder API)
export function calculateDriverScheduleSync(params: {
  customerStartTime: string;
  vehicleCount: number;
  needsTrailer: boolean;
  estimatedDriveMinutes?: number;
  segment?: 'leveren' | 'ophalen';
}): {
  driverStartTime: string;
  totalMinutesBefore: number;
} {
  const { customerStartTime, vehicleCount, needsTrailer: hasTrailer, estimatedDriveMinutes = 30, segment = 'leveren' } = params;
  const isPickup = segment === 'ophalen';
  
  const loadUnloadMinutes = estimateLoadUnloadTime({
    segment,
    vehicleCount,
    hasTrailer,
  });
  
  // Bij ophalen: geen voorbereidingstijd en geen opstarttijd
  // Bij ophalen gaat de laadtijd pas in NA aankomst, dus telt niet mee voor vertrektijd
  const readyBeforeStart = isPickup ? 0 : TIME_CONSTANTS.READY_BEFORE_START;
  const startupTimeWinkel = isPickup ? 0 : TIME_CONSTANTS.STARTUP_TIME_WINKEL;
  const loadTimeBeforeArrival = isPickup ? 0 : loadUnloadMinutes; // Bij ophalen: 0, bij leveren: uitlaadtijd
  
  // Parse tijd
  const [hours, minutes] = customerStartTime.split(':').map(Number);
  const customerStart = new Date();
  customerStart.setHours(hours, minutes, 0, 0);
  
  let totalMinutesBefore = 
    readyBeforeStart + // 15 min klaar voor start (alleen bij leveren)
    loadTimeBeforeArrival + // uitladen voor aankomst (alleen bij leveren)
    estimatedDriveMinutes + // rijtijd naar klant
    startupTimeWinkel; // opstarten (alleen bij leveren)
  
  if (needsTrailer) {
    // Extra tijd voor loods + aanhanger
    totalMinutesBefore += 
      15 + // rijtijd winkel -> loods
      TIME_CONSTANTS.TRAILER_COUPLING_TIME; // aankoppelen
  }
  
  const driverStart = new Date(customerStart);
  driverStart.setMinutes(driverStart.getMinutes() - totalMinutesBefore);
  
  return {
    driverStartTime: formatTime(driverStart),
    totalMinutesBefore,
  };
}
