import { VehicleType } from './transportData';

export interface OrderFormData {
  id: string;
  orderNumber: string;
  
  // Klantgegevens
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName?: string;
  
  // Boeking details (klantperiode)
  numberOfPersons: number;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  startLocation: string;
  endLocation: string;
  
  // Logistieke planning (optioneel, fallback naar boekingsdata)
  deliveryDate?: string | null;
  deliveryTime?: string | null;
  pickupDate?: string | null;
  pickupTime?: string | null;
  
  // Klant-flexibiliteit: tijdvensters waarbinnen wij mogen leveren/ophalen
  deliveryWindowStart?: string | null;
  deliveryWindowEnd?: string | null;
  pickupWindowStart?: string | null;
  pickupWindowEnd?: string | null;
  
  // Extra
  notes?: string;
  
  // Voertuigen
  vehicleTypes?: { type: VehicleType; count: number }[];
  
  // Transport en chauffeur toewijzing
  assignedTransportLeveren?: string;
  assignedDriverLeveren?: string;
  assignedTransportOphalen?: string;
  assignedDriverOphalen?: string;
  
  // Wachttijd logica: null = auto, true = terugkeren, false = wachten bij klant
  driverReturnsToShop?: boolean | null;
  
  // Gecombineerd uitladen/inladen
  combinedUnloadingLeveren?: boolean;
  combinedUnloadingOphalen?: boolean;
  
  // Reseller
  reseller?: string;
  
  // Status
  status: 'offerte' | 'optie' | 'bevestigd';
  createdAt: string;
  updatedAt: string;
}

// Demo orders voor test doeleinden
export const demoOrdersData: OrderFormData[] = [
  {
    id: 'order-demo-1',
    orderNumber: 'RE-2026001',
    firstName: 'Jan',
    lastName: 'Heeres',
    email: 'jan@heeres.nl',
    phone: '06-12345678',
    companyName: 'Heeres Events',
    numberOfPersons: 20,
    startDate: '2026-01-17',
    endDate: '2026-01-17',
    startTime: '13:00',
    endTime: '17:00',
    startLocation: 'Loods',
    endLocation: 'Purmerplein 2, 1141 ZT Purmerend',
    notes: 'Graag 30 minuten voor starttijd aanwezig',
    vehicleTypes: [{ type: 'e-choppers', count: 20 }],
    status: 'bevestigd',
    createdAt: '2026-01-10T10:00:00Z',
    updatedAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'order-demo-2',
    orderNumber: 'RE-2026002',
    firstName: 'Lisa',
    lastName: 'de Vries',
    email: 'lisa@bedrijf.nl',
    phone: '06-98765432',
    companyName: 'Team Building BV',
    numberOfPersons: 15,
    startDate: '2026-01-20',
    endDate: '2026-01-20',
    startTime: '10:00',
    endTime: '14:00',
    startLocation: 'Amsterdam Centraal',
    endLocation: 'Amsterdam Centraal',
    notes: '',
    vehicleTypes: [{ type: 'e-fatbikes', count: 15 }],
    status: 'offerte',
    createdAt: '2026-01-12T14:30:00Z',
    updatedAt: '2026-01-12T14:30:00Z',
  },
];

export const generateOrderNumber = (): string => {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `RE-${year}${random}`;
};

export const getStatusColor = (status: OrderFormData['status']): string => {
  switch (status) {
    case 'offerte':
      return 'bg-amber-100 text-amber-800';
    case 'optie':
      return 'bg-purple-100 text-purple-800';
    case 'bevestigd':
      return 'bg-emerald-100 text-emerald-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const getStatusLabel = (status: OrderFormData['status']): string => {
  switch (status) {
    case 'offerte':
      return 'Offerte';
    case 'optie':
      return 'Optie';
    case 'bevestigd':
      return 'Bevestigd';
    default:
      return status;
  }
};

export const orderStatuses: { value: OrderFormData['status']; label: string }[] = [
  { value: 'offerte', label: 'Offerte' },
  { value: 'optie', label: 'Optie' },
  { value: 'bevestigd', label: 'Bevestigd' },
];
