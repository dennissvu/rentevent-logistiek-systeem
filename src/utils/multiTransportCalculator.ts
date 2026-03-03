import { TransportMaterial, CombiTransport, VehicleType } from '@/data/transportData';
import { checkCapacityWithTransport, VehicleCount } from './capacityChecker';

export interface TransportRecommendation {
  transport: TransportMaterial | CombiTransport;
  utilizationPercent: number;
  vehiclesHandled: Record<VehicleType, number>;
}

export interface MultiTransportResult {
  minTransportsNeeded: number;
  recommendedCombination: TransportRecommendation[];
  totalCapacity: Record<VehicleType, number>;
  remainingVehicles: Record<VehicleType, number>;
  isFullyCovered: boolean;
}

/**
 * Calculates the minimum number of transports needed and recommends the best combination
 */
export function calculateMultiTransportNeeds(
  vehicles: VehicleCount[],
  availableTransports: (TransportMaterial | CombiTransport)[]
): MultiTransportResult {
  const required: Record<VehicleType, number> = {
    'e-choppers': 0,
    'e-fatbikes': 0,
    'fietsen': 0,
    'e-bikes': 0,
    'tweepers': 0,
  };

  vehicles.forEach(v => {
    required[v.type] = v.count;
  });

  // Sort transports by total capacity (largest first for greedy algorithm)
  const sortedTransports = [...availableTransports].sort((a, b) => {
    const capA = Object.values(a.capacity).reduce((sum, c) => sum + c, 0);
    const capB = Object.values(b.capacity).reduce((sum, c) => sum + c, 0);
    return capB - capA;
  });

  // Greedy algorithm: keep adding transports until all vehicles are covered
  const recommended: TransportRecommendation[] = [];
  const remaining = { ...required };
  let isFullyCovered = false;

  // Check if a single transport can handle everything
  for (const transport of sortedTransports) {
    const check = checkCapacityWithTransport(transport, vehicles);
    if (check.isValid) {
      recommended.push({
        transport,
        utilizationPercent: check.utilizationPercent,
        vehiclesHandled: { ...required },
      });
      isFullyCovered = true;
      Object.keys(remaining).forEach(k => remaining[k as VehicleType] = 0);
      break;
    }
  }

  // If no single transport works, use greedy algorithm
  if (!isFullyCovered) {
    const usedTransportIds = new Set<string>();
    
    while (!isFullyCovered && recommended.length < 10) { // Max 10 transports
      let bestTransport: TransportMaterial | CombiTransport | null = null;
      let bestScore = -1;
      let bestHandled: Record<VehicleType, number> = {
        'e-choppers': 0,
        'e-fatbikes': 0,
        'fietsen': 0,
        'e-bikes': 0,
        'tweepers': 0,
      };

      // Find the transport that covers the most remaining vehicles
      for (const transport of sortedTransports) {
        if (usedTransportIds.has(transport.id)) continue;

        const handled: Record<VehicleType, number> = {
          'e-choppers': 0,
          'e-fatbikes': 0,
          'fietsen': 0,
          'e-bikes': 0,
          'tweepers': 0,
        };

        let score = 0;
        (Object.keys(remaining) as VehicleType[]).forEach(type => {
          const canHandle = Math.min(remaining[type], transport.capacity[type]);
          handled[type] = canHandle;
          score += canHandle;
        });

        if (score > bestScore) {
          bestScore = score;
          bestTransport = transport;
          bestHandled = handled;
        }
      }

      if (!bestTransport || bestScore === 0) break;

      // Add this transport to recommendations
      usedTransportIds.add(bestTransport.id);
      
      // Calculate utilization for what it's handling
      let maxUtil = 0;
      (Object.keys(bestHandled) as VehicleType[]).forEach(type => {
        if (bestHandled[type] > 0 && bestTransport!.capacity[type] > 0) {
          const util = bestHandled[type] / bestTransport!.capacity[type];
          if (util > maxUtil) maxUtil = util;
        }
      });

      recommended.push({
        transport: bestTransport,
        utilizationPercent: Math.round(maxUtil * 100),
        vehiclesHandled: bestHandled,
      });

      // Update remaining
      (Object.keys(remaining) as VehicleType[]).forEach(type => {
        remaining[type] = Math.max(0, remaining[type] - bestHandled[type]);
      });

      // Check if we're done
      isFullyCovered = Object.values(remaining).every(v => v === 0);
    }
  }

  // Calculate total capacity of recommended transports
  const totalCapacity: Record<VehicleType, number> = {
    'e-choppers': 0,
    'e-fatbikes': 0,
    'fietsen': 0,
    'e-bikes': 0,
    'tweepers': 0,
  };

  recommended.forEach(rec => {
    (Object.keys(totalCapacity) as VehicleType[]).forEach(type => {
      totalCapacity[type] += rec.transport.capacity[type];
    });
  });

  return {
    minTransportsNeeded: recommended.length,
    recommendedCombination: recommended,
    totalCapacity,
    remainingVehicles: remaining,
    isFullyCovered,
  };
}

/**
 * Check if selected transports have enough combined capacity
 */
export function checkMultiTransportCapacity(
  vehicles: VehicleCount[],
  selectedTransports: (TransportMaterial | CombiTransport)[]
): {
  isValid: boolean;
  utilizationPercent: number;
  message: string;
  perTransport: { id: string; name: string; utilizationPercent: number }[];
} {
  if (selectedTransports.length === 0) {
    return {
      isValid: false,
      utilizationPercent: 0,
      message: 'Geen transport geselecteerd',
      perTransport: [],
    };
  }

  // Calculate total capacity
  const totalCapacity: Record<VehicleType, number> = {
    'e-choppers': 0,
    'e-fatbikes': 0,
    'fietsen': 0,
    'e-bikes': 0,
    'tweepers': 0,
  };

  selectedTransports.forEach(t => {
    (Object.keys(totalCapacity) as VehicleType[]).forEach(type => {
      totalCapacity[type] += t.capacity[type];
    });
  });

  // Calculate required
  const required: Record<VehicleType, number> = {
    'e-choppers': 0,
    'e-fatbikes': 0,
    'fietsen': 0,
    'e-bikes': 0,
    'tweepers': 0,
  };

  vehicles.forEach(v => {
    required[v.type] = v.count;
  });

  // Calculate utilization
  let totalUtilization = 0;
  const overflowTypes: string[] = [];
  const vehicleTypeNames: Record<VehicleType, string> = {
    'e-choppers': 'E-choppers',
    'e-fatbikes': 'E-fatbikes',
    'fietsen': 'Fietsen',
    'e-bikes': 'E-bikes',
    'tweepers': 'Tweepers',
  };

  (Object.keys(required) as VehicleType[]).forEach(type => {
    const req = required[type];
    const cap = totalCapacity[type];
    
    if (req > 0 && cap > 0) {
      const util = req / cap;
      totalUtilization += util;
      
      if (req > cap) {
        overflowTypes.push(`${req - cap} ${vehicleTypeNames[type]} te veel`);
      }
    } else if (req > 0 && cap === 0) {
      overflowTypes.push(`Geen capaciteit voor ${vehicleTypeNames[type]}`);
    }
  });

  const isValid = overflowTypes.length === 0 && totalUtilization <= 1.0;
  const utilizationPercent = Math.round(totalUtilization * 100);

  let message = '';
  if (!isValid) {
    if (overflowTypes.length > 0) {
      message = overflowTypes.join(', ');
    } else {
      message = `Gecombineerde capaciteit onvoldoende (${utilizationPercent}%)`;
    }
  } else if (utilizationPercent > 80) {
    message = `Bijna vol (${utilizationPercent}% benut)`;
  } else {
    message = `${utilizationPercent}% benut`;
  }

  // Calculate per-transport utilization (simplified)
  const perTransport = selectedTransports.map(t => {
    const check = checkCapacityWithTransport(t, vehicles.map(v => ({
      type: v.type,
      count: Math.ceil(v.count / selectedTransports.length), // Divide evenly as estimate
    })));
    return {
      id: t.id,
      name: t.name,
      utilizationPercent: check.utilizationPercent,
    };
  });

  return {
    isValid,
    utilizationPercent,
    message,
    perTransport,
  };
}
