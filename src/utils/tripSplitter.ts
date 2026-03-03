/**
 * Trip Splitter: berekent hoeveel ritten nodig zijn voor een order
 * en vergelijkt pendel-strategie (1 chauffeur, meerdere ritten) met
 * parallel-strategie (meerdere chauffeurs tegelijk).
 * 
 * Gebruikt het genormaliseerde capaciteitsmodel: elke voertuigtype
 * neemt een fractie van de ruimte in beslag (count/capacity).
 */

import { TransportMaterial, CombiTransport, VehicleType } from '@/data/transportData';
import { VehicleLoad } from '@/utils/capacityCalculator';
import { estimateLoadUnloadTime, TIME_CONSTANTS } from '@/utils/driverScheduleCalculator';

// ── Types ────────────────────────────────────────────────

export interface TripLoad {
  tripNumber: number;
  vehicleLoad: VehicleLoad[]; // wat er in deze rit geladen wordt
  utilizationPercent: number; // hoeveel % van de capaciteit gebruikt
}

export interface PendelStrategy {
  type: 'pendel';
  transportId: string;
  transportName: string;
  isCombi: boolean;
  trips: TripLoad[];
  totalTrips: number;
  /** Geschatte totale tijd voor 1 chauffeur (laden + rijden + lossen + terug) × N ritten */
  estimatedTotalMinutes: number;
  /** Geschatte rijtijd heen+terug per rit (placeholder, wordt later met Google Maps berekend) */
  estimatedRoundTripMinutes: number;
}

export interface ParallelStrategy {
  type: 'parallel';
  /** Elke entry = 1 chauffeur met eigen transport */
  lanes: {
    transportId: string;
    transportName: string;
    isCombi: boolean;
    trips: TripLoad[];
    totalTrips: number;
  }[];
  totalDriversNeeded: number;
  /** Geschatte totale muur-kloktijd (alle chauffeurs parallel) */
  estimatedTotalMinutes: number;
}

export interface TripSplitResult {
  /** Past alles in 1 rit? Dan hoeft er niet gesplitst te worden */
  fitsInOneTrip: boolean;
  /** Totaal aantal voertuigen */
  totalVehicleCount: number;
  /** Pendel-optie: 1 chauffeur, meerdere ritten */
  pendel: PendelStrategy | null;
  /** Parallel-optie: meerdere chauffeurs tegelijk */
  parallel: ParallelStrategy | null;
  /** Welke strategie wordt aanbevolen */
  recommended: 'pendel' | 'parallel' | 'single';
  /** Reden voor de aanbeveling */
  recommendationReason: string;
}

// ── Helpers ──────────────────────────────────────────────

/**
 * Bereken hoeveel ritten nodig zijn met een transport voor een bepaalde lading.
 * Gebruikt het genormaliseerde ruimte-model.
 */
function calculateTripsForTransport(
  transport: TransportMaterial | CombiTransport,
  load: VehicleLoad[],
): TripLoad[] {
  const trips: TripLoad[] = [];
  
  // Bereken totale genormaliseerde ruimte nodig
  let totalNormalizedSpace = 0;
  for (const item of load) {
    if (item.quantity <= 0) continue;
    const cap = transport.capacity[item.type];
    if (cap <= 0) continue; // dit type past niet op dit transport
    totalNormalizedSpace += item.quantity / cap;
  }
  
  if (totalNormalizedSpace <= 0) return [];
  
  const numTrips = Math.ceil(totalNormalizedSpace);
  
  // Verdeel de lading evenredig over de ritten
  const remaining: Record<VehicleType, number> = {
    'e-choppers': 0, 'e-fatbikes': 0, 'fietsen': 0, 'e-bikes': 0, 'tweepers': 0,
  };
  for (const item of load) {
    remaining[item.type] = item.quantity;
  }
  
  for (let trip = 0; trip < numTrips; trip++) {
    const tripLoad: VehicleLoad[] = [];
    let tripUtilization = 0;
    
    // Vul deze rit zo vol mogelijk
    for (const type of Object.keys(remaining) as VehicleType[]) {
      if (remaining[type] <= 0) continue;
      const cap = transport.capacity[type];
      if (cap <= 0) continue;
      
      // Hoeveel ruimte is er nog in deze rit?
      const availableSpace = 1.0 - tripUtilization;
      const maxForType = Math.floor(availableSpace * cap);
      const toLoad = Math.min(remaining[type], maxForType);
      
      if (toLoad > 0) {
        tripLoad.push({ type, quantity: toLoad });
        remaining[type] -= toLoad;
        tripUtilization += toLoad / cap;
      }
    }
    
    // Als er nog ruimte over is, probeer restanten
    for (const type of Object.keys(remaining) as VehicleType[]) {
      if (remaining[type] <= 0) continue;
      const cap = transport.capacity[type];
      if (cap <= 0) continue;
      
      const availableSpace = 1.0 - tripUtilization;
      const maxForType = Math.floor(availableSpace * cap);
      const toLoad = Math.min(remaining[type], maxForType);
      
      if (toLoad > 0) {
        const existing = tripLoad.find(l => l.type === type);
        if (existing) {
          existing.quantity += toLoad;
        } else {
          tripLoad.push({ type, quantity: toLoad });
        }
        remaining[type] -= toLoad;
        tripUtilization += toLoad / cap;
      }
    }
    
    if (tripLoad.length > 0) {
      trips.push({
        tripNumber: trip + 1,
        vehicleLoad: tripLoad,
        utilizationPercent: Math.round(tripUtilization * 100),
      });
    }
  }
  
  // Als er nog voertuigen over zijn (door afrondingsfouten), voeg toe aan laatste rit of maak nieuwe
  const leftover: VehicleLoad[] = [];
  for (const type of Object.keys(remaining) as VehicleType[]) {
    if (remaining[type] > 0) {
      leftover.push({ type, quantity: remaining[type] });
    }
  }
  
  if (leftover.length > 0) {
    // Maak een extra rit voor de restanten
    let extraUtil = 0;
    for (const item of leftover) {
      const cap = transport.capacity[item.type];
      if (cap > 0) extraUtil += item.quantity / cap;
    }
    trips.push({
      tripNumber: trips.length + 1,
      vehicleLoad: leftover,
      utilizationPercent: Math.round(extraUtil * 100),
    });
  }
  
  return trips;
}

/**
 * Schat de totale tijd voor een pendel-strategie (zonder Google Maps rijtijden).
 * Gebruikt geschatte rijtijd van 30 min per richting als placeholder.
 */
function estimatePendelTime(
  trips: TripLoad[],
  hasTrailer: boolean,
  estimatedOneWayMinutes: number = 30,
): { totalMinutes: number; roundTripMinutes: number } {
  let totalMinutes = 0;
  const roundTripMinutes = estimatedOneWayMinutes * 2;
  
  for (let i = 0; i < trips.length; i++) {
    const trip = trips[i];
    const vehicleCount = trip.vehicleLoad.reduce((sum, v) => sum + v.quantity, 0);
    
    // Laden bij winkel
    totalMinutes += estimateLoadUnloadTime({
      segment: 'leveren',
      vehicleCount,
      hasTrailer,
    });
    
    // Heenrit + loods indien aanhanger
    if (hasTrailer) {
      totalMinutes += TIME_CONSTANTS.TRAILER_COUPLING_TIME; // aankoppelen
    }
    totalMinutes += estimatedOneWayMinutes; // heenrit
    
    // Lossen bij klant
    totalMinutes += estimateLoadUnloadTime({
      segment: 'leveren',
      vehicleCount,
      hasTrailer,
    });
    
    // Terugrit (behalve bij de laatste rit)
    if (i < trips.length - 1) {
      totalMinutes += estimatedOneWayMinutes; // terugrit
      if (hasTrailer) {
        totalMinutes += TIME_CONSTANTS.TRAILER_COUPLING_TIME; // afkoppelen + aankoppelen
      }
    }
  }
  
  // Opstarten + afsluiten
  totalMinutes += TIME_CONSTANTS.STARTUP_TIME_WINKEL;
  
  return { totalMinutes, roundTripMinutes };
}

// ── Main function ────────────────────────────────────────

/**
 * Bereken hoe een grote order gesplitst moet worden over ritten.
 * Vergelijkt pendel (1 chauffeur, meerdere ritten) met parallel (meerdere chauffeurs).
 */
export function calculateTripSplit(
  load: VehicleLoad[],
  availableTransports: (TransportMaterial | CombiTransport)[],
  options?: {
    /** Geschatte rijtijd in minuten (één richting), standaard 30 */
    estimatedDriveMinutes?: number;
    /** Maximaal aantal pendel-ritten voordat parallel wordt aanbevolen */
    maxPendelTrips?: number;
    /** Maximaal beschikbare chauffeurs voor parallel */
    maxParallelDrivers?: number;
  },
): TripSplitResult {
  const {
    estimatedDriveMinutes = 30,
    maxPendelTrips = 4,
    maxParallelDrivers = 3,
  } = options || {};
  
  const totalVehicleCount = load.reduce((sum, v) => sum + v.quantity, 0);
  
  if (totalVehicleCount === 0) {
    return {
      fitsInOneTrip: true,
      totalVehicleCount: 0,
      pendel: null,
      parallel: null,
      recommended: 'single',
      recommendationReason: 'Geen voertuigen',
    };
  }
  
  // ── Vind het beste transport (grootste dat past OF grootste beschikbaar) ──
  const bakwagens = availableTransports.filter(t => 'type' in t && t.type === 'bakwagen') as TransportMaterial[];
  const combis = availableTransports.filter(t => 'bakwagenId' in t) as CombiTransport[];
  
  // Sorteer op capaciteit (grootste eerst)
  const sortedOptions = [...combis, ...bakwagens].sort((a, b) => {
    const capA = Object.values(a.capacity).reduce((sum, c) => sum + c, 0);
    const capB = Object.values(b.capacity).reduce((sum, c) => sum + c, 0);
    return capB - capA;
  });
  
  // Check of het in 1 rit past
  for (const transport of sortedOptions) {
    const trips = calculateTripsForTransport(transport, load);
    if (trips.length === 1) {
      return {
        fitsInOneTrip: true,
        totalVehicleCount,
        pendel: null,
        parallel: null,
        recommended: 'single',
        recommendationReason: `Past in 1 rit met ${transport.name}`,
      };
    }
  }
  
  // ── Pendel-strategie: vind transport met minste ritten ──
  let bestPendel: PendelStrategy | null = null;
  
  for (const transport of sortedOptions) {
    const trips = calculateTripsForTransport(transport, load);
    if (trips.length === 0) continue;
    
    const isCombi = 'bakwagenId' in transport;
    const { totalMinutes, roundTripMinutes } = estimatePendelTime(
      trips, isCombi, estimatedDriveMinutes,
    );
    
    if (!bestPendel || trips.length < bestPendel.totalTrips ||
        (trips.length === bestPendel.totalTrips && totalMinutes < bestPendel.estimatedTotalMinutes)) {
      bestPendel = {
        type: 'pendel',
        transportId: transport.id,
        transportName: transport.name,
        isCombi,
        trips,
        totalTrips: trips.length,
        estimatedTotalMinutes: totalMinutes,
        estimatedRoundTripMinutes: roundTripMinutes,
      };
    }
  }
  
  // ── Parallel-strategie: verdeel over meerdere chauffeurs ──
  let bestParallel: ParallelStrategy | null = null;
  
  // Probeer te verdelen over beschikbare transports
  const remainingLoad: Record<VehicleType, number> = {
    'e-choppers': 0, 'e-fatbikes': 0, 'fietsen': 0, 'e-bikes': 0, 'tweepers': 0,
  };
  for (const item of load) {
    remainingLoad[item.type] = item.quantity;
  }
  
  const lanes: ParallelStrategy['lanes'] = [];
  const usedTransportIds = new Set<string>();
  
  // Greedy: pak het grootste transport, vul het, herhaal
  for (let i = 0; i < maxParallelDrivers && Object.values(remainingLoad).some(v => v > 0); i++) {
    const availableForLane = sortedOptions.filter(t => !usedTransportIds.has(t.id));
    if (availableForLane.length === 0) break;
    
    // Als dit een combi is, markeer ook de bakwagen en aanhanger als gebruikt
    let bestLane: { transport: typeof sortedOptions[0]; trips: TripLoad[] } | null = null;
    
    for (const transport of availableForLane) {
      // Check of bakwagen/aanhanger niet al in gebruik is
      if ('bakwagenId' in transport) {
        if (usedTransportIds.has((transport as CombiTransport).bakwagenId) ||
            usedTransportIds.has((transport as CombiTransport).aanhangerId)) {
          continue;
        }
      }
      
      const currentLoad: VehicleLoad[] = [];
      for (const type of Object.keys(remainingLoad) as VehicleType[]) {
        if (remainingLoad[type] > 0) {
          currentLoad.push({ type, quantity: remainingLoad[type] });
        }
      }
      
      const trips = calculateTripsForTransport(transport, currentLoad);
      if (trips.length > 0) {
        if (!bestLane || trips.length < bestLane.trips.length) {
          bestLane = { transport, trips };
        }
      }
    }
    
    if (!bestLane) break;
    
    const transport = bestLane.transport;
    const isCombi = 'bakwagenId' in transport;
    
    // Neem alleen de eerste rit-lading voor deze lane (rest voor volgende lanes)
    // Bij parallel willen we de lading verdelen, niet herhalen
    const laneLoad = bestLane.trips[0].vehicleLoad;
    
    // Update remaining
    for (const item of laneLoad) {
      remainingLoad[item.type] -= item.quantity;
    }
    
    // Herbereken trips met alleen de lading voor deze lane
    const laneTrips = calculateTripsForTransport(transport, laneLoad);
    
    usedTransportIds.add(transport.id);
    if (isCombi) {
      usedTransportIds.add((transport as CombiTransport).bakwagenId);
      usedTransportIds.add((transport as CombiTransport).aanhangerId);
    }
    
    lanes.push({
      transportId: transport.id,
      transportName: transport.name,
      isCombi,
      trips: laneTrips,
      totalTrips: laneTrips.length,
    });
  }
  
  // Check of er nog lading over is → extra pendel-ritten per lane
  const leftoverLoad: VehicleLoad[] = [];
  for (const type of Object.keys(remainingLoad) as VehicleType[]) {
    if (remainingLoad[type] > 0) {
      leftoverLoad.push({ type, quantity: remainingLoad[type] });
    }
  }
  
  if (leftoverLoad.length > 0 && lanes.length > 0) {
    // Verdeel restanten over bestaande lanes
    const lastLane = lanes[lanes.length - 1];
    const lastTransport = sortedOptions.find(t => t.id === lastLane.transportId);
    if (lastTransport) {
      const extraTrips = calculateTripsForTransport(lastTransport, leftoverLoad);
      const offset = lastLane.trips.length;
      for (const trip of extraTrips) {
        trip.tripNumber += offset;
      }
      lastLane.trips.push(...extraTrips);
      lastLane.totalTrips = lastLane.trips.length;
    }
  }
  
  if (lanes.length > 1) {
    // Schat parallel tijd: langste lane bepaalt de totale tijd
    const longestLaneTime = Math.max(...lanes.map(lane => {
      const vehicleCount = lane.trips.reduce(
        (sum, t) => sum + t.vehicleLoad.reduce((s, v) => s + v.quantity, 0), 0,
      );
      return estimatePendelTime(lane.trips, lane.isCombi, estimatedDriveMinutes).totalMinutes;
    }));
    
    bestParallel = {
      type: 'parallel',
      lanes,
      totalDriversNeeded: lanes.length,
      estimatedTotalMinutes: longestLaneTime,
    };
  }
  
  // ── Aanbeveling ──
  let recommended: 'pendel' | 'parallel' | 'single' = 'pendel';
  let recommendationReason = '';
  
  if (bestPendel && bestParallel) {
    // Vergelijk strategieën
    if (bestPendel.totalTrips > maxPendelTrips) {
      recommended = 'parallel';
      recommendationReason = `Pendelen vereist ${bestPendel.totalTrips} ritten (max ${maxPendelTrips}) — parallel is efficiënter`;
    } else if (bestParallel.estimatedTotalMinutes < bestPendel.estimatedTotalMinutes * 0.6) {
      recommended = 'parallel';
      recommendationReason = `Parallel bespaart ~${Math.round(bestPendel.estimatedTotalMinutes - bestParallel.estimatedTotalMinutes)} min`;
    } else {
      recommended = 'pendel';
      recommendationReason = `${bestPendel.totalTrips} pendel-ritten met ${bestPendel.transportName} — ${bestPendel.totalTrips <= 2 ? 'efficiënt' : 'haalbaar'}`;
    }
  } else if (bestPendel) {
    recommended = 'pendel';
    recommendationReason = `${bestPendel.totalTrips} ritten met ${bestPendel.transportName}`;
  } else if (bestParallel) {
    recommended = 'parallel';
    recommendationReason = `${bestParallel.totalDriversNeeded} chauffeurs parallel`;
  }
  
  return {
    fitsInOneTrip: false,
    totalVehicleCount,
    pendel: bestPendel,
    parallel: bestParallel,
    recommended,
    recommendationReason,
  };
}

/**
 * Genereer assignment records voor een gekozen trip-split strategie.
 * Retourneert de records die in order_transport_assignments gezet moeten worden.
 */
export function generateTripAssignments(
  orderId: string,
  segment: 'leveren' | 'ophalen',
  strategy: PendelStrategy | ParallelStrategy,
): {
  orderId: string;
  segment: string;
  transportId: string;
  sequenceNumber: number;
  tripLoad: VehicleLoad[];
}[] {
  if (strategy.type === 'pendel') {
    return strategy.trips.map((trip, idx) => ({
      orderId,
      segment,
      transportId: strategy.transportId,
      sequenceNumber: idx + 1,
      tripLoad: trip.vehicleLoad,
    }));
  } else {
    // Parallel: elke lane krijgt een assignment, meerdere ritten per lane = hogere sequence
    const assignments: ReturnType<typeof generateTripAssignments> = [];
    let seqCounter = 1;
    
    for (const lane of strategy.lanes) {
      for (const trip of lane.trips) {
        assignments.push({
          orderId,
          segment,
          transportId: lane.transportId,
          sequenceNumber: seqCounter++,
          tripLoad: trip.vehicleLoad,
        });
      }
    }
    
    return assignments;
  }
}
