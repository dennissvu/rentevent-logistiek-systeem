import { TransportMaterial, CombiTransport, VehicleType } from '@/data/transportData';

export interface VehicleLoad {
  type: VehicleType;
  quantity: number;
}

export interface CapacityResult {
  fits: boolean;
  usedCapacity: number; // percentage 0-100
  remainingSpace: { [key in VehicleType]: number }; // how many more of each type could fit
  breakdown: { type: VehicleType; quantity: number; spaceUsed: number }[];
}

/**
 * Berekent of een gemixte lading past in een transportmiddel.
 * 
 * De berekening werkt op basis van relatieve ruimte:
 * - Elk voertuigtype neemt een bepaalde fractie van de totale capaciteit in
 * - De fractie = 1 / max_capaciteit_voor_dat_type
 * - Totale bezetting = som van (aantal × fractie) per voertuigtype
 * - Als totaal ≤ 1.0 (100%), dan past de lading
 */
export function calculateMixedCapacity(
  transport: TransportMaterial | CombiTransport,
  load: VehicleLoad[]
): CapacityResult {
  const capacity = transport.capacity;
  
  // Bereken de ruimte-fractie per voertuigtype
  // 1 e-chopper neemt 1/15 = 6.67% van bakwagen MAN
  // 1 e-bike neemt 1/30 = 3.33% van bakwagen MAN
  const spaceFractions: { [key in VehicleType]: number } = {
    'e-choppers': 1 / capacity['e-choppers'],
    'e-fatbikes': 1 / capacity['e-fatbikes'],
    'fietsen': 1 / capacity['fietsen'],
    'e-bikes': 1 / capacity['e-bikes'],
    'tweepers': 1 / capacity['tweepers'],
  };

  // Bereken totale bezetting
  let totalUsed = 0;
  const breakdown: CapacityResult['breakdown'] = [];

  for (const item of load) {
    const spacePerUnit = spaceFractions[item.type];
    const spaceUsed = item.quantity * spacePerUnit;
    totalUsed += spaceUsed;
    
    breakdown.push({
      type: item.type,
      quantity: item.quantity,
      spaceUsed: spaceUsed * 100, // als percentage
    });
  }

  // Bereken hoeveel er nog bij kan van elk type
  const remainingFraction = Math.max(0, 1 - totalUsed);
  const remainingSpace: { [key in VehicleType]: number } = {
    'e-choppers': Math.floor(remainingFraction / spaceFractions['e-choppers']),
    'e-fatbikes': Math.floor(remainingFraction / spaceFractions['e-fatbikes']),
    'fietsen': Math.floor(remainingFraction / spaceFractions['fietsen']),
    'e-bikes': Math.floor(remainingFraction / spaceFractions['e-bikes']),
    'tweepers': Math.floor(remainingFraction / spaceFractions['tweepers']),
  };

  return {
    fits: totalUsed <= 1.0,
    usedCapacity: Math.round(totalUsed * 100),
    remainingSpace,
    breakdown,
  };
}

/**
 * Vindt de beste transport optie(s) voor een gegeven lading
 */
export function findBestTransport(
  allTransports: (TransportMaterial | CombiTransport)[],
  load: VehicleLoad[]
): { transport: TransportMaterial | CombiTransport; result: CapacityResult }[] {
  const results = allTransports
    .map(transport => ({
      transport,
      result: calculateMixedCapacity(transport, load),
    }))
    .filter(r => r.result.fits)
    .sort((a, b) => b.result.usedCapacity - a.result.usedCapacity); // Hoogste benutting eerst

  return results;
}

/**
 * Formatteert een voertuigtype naar Nederlandse naam
 */
export function formatVehicleType(type: VehicleType): string {
  const names: { [key in VehicleType]: string } = {
    'e-choppers': 'E-choppers',
    'e-fatbikes': 'E-fatbikes',
    'fietsen': 'Fietsen',
    'e-bikes': 'E-bikes',
    'tweepers': 'Tweepers',
  };
  return names[type];
}
