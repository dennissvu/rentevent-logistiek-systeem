import { 
  TransportMaterial, 
  CombiTransport,
  VehicleType 
} from '@/data/transportData';

export interface VehicleCount {
  type: VehicleType;
  count: number;
}

export interface CapacityCheck {
  isValid: boolean;
  totalCapacity: Record<VehicleType, number>;
  required: Record<VehicleType, number>;
  overflow: Record<VehicleType, number>;
  utilizationPercent: number;
  message: string;
}

export function checkCapacityWithTransport(
  transport: TransportMaterial | CombiTransport, 
  vehicles: VehicleCount[]
): CapacityCheck {
  const capacity = transport.capacity;
  const required: Record<VehicleType, number> = {
    'e-choppers': 0,
    'e-fatbikes': 0,
    'fietsen': 0,
    'e-bikes': 0,
    'tweepers': 0,
  };
  const overflow: Record<VehicleType, number> = {
    'e-choppers': 0,
    'e-fatbikes': 0,
    'fietsen': 0,
    'e-bikes': 0,
    'tweepers': 0,
  };

  // Calculate required counts
  vehicles.forEach(v => {
    required[v.type] = v.count;
  });

  // Calculate mixed capacity utilization
  // Each vehicle type takes a fraction of space based on its capacity limit
  // Total utilization = sum of (count / capacity) for each type
  let totalUtilization = 0;
  const overflowMessages: string[] = [];
  
  const vehicleTypeNames: Record<VehicleType, string> = {
    'e-choppers': 'E-choppers',
    'e-fatbikes': 'E-fatbikes',
    'fietsen': 'Fietsen',
    'e-bikes': 'E-bikes',
    'tweepers': 'Tweepers',
  };

  (Object.keys(required) as VehicleType[]).forEach(type => {
    const req = required[type];
    const cap = capacity[type];
    
    if (req > 0 && cap > 0) {
      const utilization = req / cap;
      totalUtilization += utilization;
    }
  });

  // Check if total utilization exceeds 100%
  const isValid = totalUtilization <= 1.0;
  const utilizationPercent = Math.round(totalUtilization * 100);

  if (!isValid) {
    // Calculate which types contribute most to the overflow
    (Object.keys(required) as VehicleType[]).forEach(type => {
      const req = required[type];
      const cap = capacity[type];
      if (req > cap) {
        overflow[type] = req - cap;
        overflowMessages.push(`${overflow[type]} ${vehicleTypeNames[type]} te veel`);
      }
    });
  }

  let message = '';
  if (!isValid) {
    if (overflowMessages.length > 0) {
      message = `Capaciteit overschreden: ${overflowMessages.join(', ')}`;
    } else {
      message = `Gecombineerde lading past niet (${utilizationPercent}% van capaciteit)`;
    }
  } else if (utilizationPercent > 80) {
    message = `Bijna vol (${utilizationPercent}% benut)`;
  } else if (utilizationPercent > 0) {
    message = `${utilizationPercent}% benut`;
  } else {
    message = 'Voldoende capaciteit';
  }

  return {
    isValid,
    totalCapacity: capacity,
    required,
    overflow,
    utilizationPercent,
    message,
  };
}

// Legacy function for backwards compatibility - now requires allTransport array
export function checkCapacity(
  transportId: string, 
  vehicles: VehicleCount[],
  allTransport?: (TransportMaterial | CombiTransport)[]
): CapacityCheck {
  if (!allTransport) {
    // Return invalid result if no transport data provided
    return {
      isValid: false,
      totalCapacity: { 'e-choppers': 0, 'e-fatbikes': 0, 'fietsen': 0, 'e-bikes': 0, 'tweepers': 0 },
      required: { 'e-choppers': 0, 'e-fatbikes': 0, 'fietsen': 0, 'e-bikes': 0, 'tweepers': 0 },
      overflow: { 'e-choppers': 0, 'e-fatbikes': 0, 'fietsen': 0, 'e-bikes': 0, 'tweepers': 0 },
      utilizationPercent: 0,
      message: 'Transport data niet beschikbaar',
    };
  }

  const transport = allTransport.find(t => t.id === transportId);
  
  if (!transport) {
    return {
      isValid: false,
      totalCapacity: { 'e-choppers': 0, 'e-fatbikes': 0, 'fietsen': 0, 'e-bikes': 0, 'tweepers': 0 },
      required: { 'e-choppers': 0, 'e-fatbikes': 0, 'fietsen': 0, 'e-bikes': 0, 'tweepers': 0 },
      overflow: { 'e-choppers': 0, 'e-fatbikes': 0, 'fietsen': 0, 'e-bikes': 0, 'tweepers': 0 },
      utilizationPercent: 0,
      message: 'Transport niet gevonden',
    };
  }

  return checkCapacityWithTransport(transport, vehicles);
}

export function findSuitableTransport(
  vehicles: VehicleCount[],
  allTransport: (TransportMaterial | CombiTransport)[]
): {
  bakwagens: { id: string; name: string; fits: boolean; utilizationPercent: number }[];
  combis: { id: string; name: string; fits: boolean; utilizationPercent: number }[];
} {
  const bakwagens = allTransport.filter(t => 'type' in t && t.type === 'bakwagen') as TransportMaterial[];
  const combis = allTransport.filter(t => 'bakwagenId' in t) as CombiTransport[];
  
  const result = {
    bakwagens: bakwagens.map(b => {
      const check = checkCapacityWithTransport(b, vehicles);
      return {
        id: b.id,
        name: b.name,
        fits: check.isValid,
        utilizationPercent: check.utilizationPercent,
      };
    }),
    combis: combis.map(c => {
      const check = checkCapacityWithTransport(c, vehicles);
      return {
        id: c.id,
        name: c.name,
        fits: check.isValid,
        utilizationPercent: check.utilizationPercent,
      };
    }),
  };

  return result;
}
