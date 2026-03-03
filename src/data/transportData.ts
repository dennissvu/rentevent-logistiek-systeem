// Voertuig types die verhuurd worden
export type VehicleType = 'e-choppers' | 'e-fatbikes' | 'fietsen' | 'e-bikes' | 'tweepers';

export interface VehicleTypeInfo {
  id: VehicleType;
  name: string;
  icon: string;
}

export const vehicleTypes: VehicleTypeInfo[] = [
  { id: 'e-choppers', name: 'E-choppers', icon: '🛵' },
  { id: 'e-fatbikes', name: 'E-fatbikes', icon: '🚲' },
  { id: 'fietsen', name: 'Fietsen', icon: '🚲' },
  { id: 'e-bikes', name: 'E-bikes', icon: '🚴' },
  { id: 'tweepers', name: 'Tweepers', icon: '👥' },
];

// Transport middel types
export type TransportType = 'bakwagen' | 'aanhanger';

export interface TransportMaterial {
  id: string;
  name: string;
  type: TransportType;
  capacity: {
    'e-choppers': number;
    'e-fatbikes': number;
    'fietsen': number;
    'e-bikes': number;
    'tweepers': number;
  };
}

export interface CombiTransport {
  id: string;
  name: string;
  bakwagenId: string;
  aanhangerId: string;
  capacity: {
    'e-choppers': number;
    'e-fatbikes': number;
    'fietsen': number;
    'e-bikes': number;
    'tweepers': number;
  };
}

// Bakwagens
export const bakwagens: TransportMaterial[] = [
  {
    id: 'bakwagen-man',
    name: 'Bak Man',
    type: 'bakwagen',
    capacity: {
      'e-choppers': 15,
      'e-fatbikes': 22,
      'fietsen': 30,
      'e-bikes': 30,
      'tweepers': 12,
    },
  },
  {
    id: 'bakwagen-ren',
    name: 'Bak Ren',
    type: 'bakwagen',
    capacity: {
      'e-choppers': 15,
      'e-fatbikes': 22,
      'fietsen': 30,
      'e-bikes': 30,
      'tweepers': 12,
    },
  },
  {
    id: 'bakwagen-vol',
    name: 'Bak Vol',
    type: 'bakwagen',
    capacity: {
      'e-choppers': 15,
      'e-fatbikes': 22,
      'fietsen': 30,
      'e-bikes': 30,
      'tweepers': 12,
    },
  },
];

// Aanhangers
export const aanhangers: TransportMaterial[] = [
  {
    id: 'aanhanger-4',
    name: 'AH 4',
    type: 'aanhanger',
    capacity: {
      'e-choppers': 13,
      'e-fatbikes': 18,
      'fietsen': 24,
      'e-bikes': 24,
      'tweepers': 9,
    },
  },
  {
    id: 'aanhanger-5',
    name: 'AH 5',
    type: 'aanhanger',
    capacity: {
      'e-choppers': 16,
      'e-fatbikes': 23,
      'fietsen': 32,
      'e-bikes': 32,
      'tweepers': 11,
    },
  },
  {
    id: 'aanhanger-6',
    name: 'AH 6',
    type: 'aanhanger',
    capacity: {
      'e-choppers': 25,
      'e-fatbikes': 35,
      'fietsen': 45,
      'e-bikes': 45,
      'tweepers': 17,
    },
  },
  {
    id: 'aanhanger-6d',
    name: 'AH 6D',
    type: 'aanhanger',
    capacity: {
      'e-choppers': 22,
      'e-fatbikes': 33,
      'fietsen': 45,
      'e-bikes': 45,
      'tweepers': 16,
    },
  },
];

// Combi's (Bakwagen + Aanhanger) - capaciteiten worden berekend door bakwagen + aanhanger
export const combis: CombiTransport[] = [
  // Man combi's
  {
    id: 'combi-man-aanhanger-4',
    name: 'Bak Man + AH 4',
    bakwagenId: 'bakwagen-man',
    aanhangerId: 'aanhanger-4',
    capacity: {
      'e-choppers': 28,  // 15 + 13
      'e-fatbikes': 40,  // 22 + 18
      'fietsen': 54,     // 30 + 24
      'e-bikes': 54,     // 30 + 24
      'tweepers': 21,    // 12 + 9
    },
  },
  {
    id: 'combi-man-aanhanger-5',
    name: 'Bak Man + AH 5',
    bakwagenId: 'bakwagen-man',
    aanhangerId: 'aanhanger-5',
    capacity: {
      'e-choppers': 31,  // 15 + 16
      'e-fatbikes': 45,  // 22 + 23
      'fietsen': 62,     // 30 + 32
      'e-bikes': 62,     // 30 + 32
      'tweepers': 23,    // 12 + 11
    },
  },
  {
    id: 'combi-man-aanhanger-6',
    name: 'Bak Man + AH 6',
    bakwagenId: 'bakwagen-man',
    aanhangerId: 'aanhanger-6',
    capacity: {
      'e-choppers': 40,  // 15 + 25
      'e-fatbikes': 57,  // 22 + 35
      'fietsen': 75,     // 30 + 45
      'e-bikes': 75,     // 30 + 45
      'tweepers': 29,    // 12 + 17
    },
  },
  {
    id: 'combi-man-aanhanger-6d',
    name: 'Bak Man + AH 6D',
    bakwagenId: 'bakwagen-man',
    aanhangerId: 'aanhanger-6d',
    capacity: {
      'e-choppers': 37,  // 15 + 22
      'e-fatbikes': 55,  // 22 + 33
      'fietsen': 75,     // 30 + 45
      'e-bikes': 75,     // 30 + 45
      'tweepers': 28,    // 12 + 16
    },
  },
  // Ren combi's
  {
    id: 'combi-ren-aanhanger-4',
    name: 'Bak Ren + AH 4',
    bakwagenId: 'bakwagen-ren',
    aanhangerId: 'aanhanger-4',
    capacity: {
      'e-choppers': 28,
      'e-fatbikes': 40,
      'fietsen': 54,
      'e-bikes': 54,
      'tweepers': 21,
    },
  },
  {
    id: 'combi-ren-aanhanger-5',
    name: 'Bak Ren + AH 5',
    bakwagenId: 'bakwagen-ren',
    aanhangerId: 'aanhanger-5',
    capacity: {
      'e-choppers': 31,
      'e-fatbikes': 45,
      'fietsen': 62,
      'e-bikes': 62,
      'tweepers': 23,
    },
  },
  {
    id: 'combi-ren-aanhanger-6',
    name: 'Bak Ren + AH 6',
    bakwagenId: 'bakwagen-ren',
    aanhangerId: 'aanhanger-6',
    capacity: {
      'e-choppers': 40,
      'e-fatbikes': 57,
      'fietsen': 75,
      'e-bikes': 75,
      'tweepers': 29,
    },
  },
  {
    id: 'combi-ren-aanhanger-6d',
    name: 'Bak Ren + AH 6D',
    bakwagenId: 'bakwagen-ren',
    aanhangerId: 'aanhanger-6d',
    capacity: {
      'e-choppers': 37,
      'e-fatbikes': 55,
      'fietsen': 75,
      'e-bikes': 75,
      'tweepers': 28,
    },
  },
  // Vol combi's
  {
    id: 'combi-vol-aanhanger-4',
    name: 'Bak Vol + AH 4',
    bakwagenId: 'bakwagen-vol',
    aanhangerId: 'aanhanger-4',
    capacity: {
      'e-choppers': 28,
      'e-fatbikes': 40,
      'fietsen': 54,
      'e-bikes': 54,
      'tweepers': 21,
    },
  },
  {
    id: 'combi-vol-aanhanger-5',
    name: 'Bak Vol + AH 5',
    bakwagenId: 'bakwagen-vol',
    aanhangerId: 'aanhanger-5',
    capacity: {
      'e-choppers': 31,
      'e-fatbikes': 45,
      'fietsen': 62,
      'e-bikes': 62,
      'tweepers': 23,
    },
  },
  {
    id: 'combi-vol-aanhanger-6',
    name: 'Bak Vol + AH 6',
    bakwagenId: 'bakwagen-vol',
    aanhangerId: 'aanhanger-6',
    capacity: {
      'e-choppers': 40,
      'e-fatbikes': 57,
      'fietsen': 75,
      'e-bikes': 75,
      'tweepers': 29,
    },
  },
  {
    id: 'combi-vol-aanhanger-6d',
    name: 'Bak Vol + AH 6D',
    bakwagenId: 'bakwagen-vol',
    aanhangerId: 'aanhanger-6d',
    capacity: {
      'e-choppers': 37,
      'e-fatbikes': 55,
      'fietsen': 75,
      'e-bikes': 75,
      'tweepers': 28,
    },
  },
];

// Alle transport materialen gecombineerd
export const allTransportMaterials: TransportMaterial[] = [...bakwagens, ...aanhangers];
