import { VehicleType } from './transportData';

export interface Driver {
  id: string;
  name: string;
  phone: string;
  available: boolean;
  canDriveTrailer: boolean;
}

export interface DeliverySegment {
  id: string;
  type: 'leveren' | 'ophalen';
  vehicleTypes: { type: VehicleType; count: number }[];
  startTime: string;
  assignedTransport?: string;
  assignedDriver?: string;
  status: 'pending' | 'assigned' | 'in-progress' | 'completed';
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  address: string;
  date: string; // Primary date used for filtering (logistic delivery date)
  // Booking period (customer-facing)
  bookingStartDate: string;
  bookingEndDate: string;
  // Logistic dates (actual transport)
  logisticDeliveryDate: string;
  logisticPickupDate: string;
  segments: DeliverySegment[];
  status?: 'offerte' | 'optie' | 'bevestigd';
  // Klant-tijdvensters
  deliveryWindowStart?: string | null;
  deliveryWindowEnd?: string | null;
  pickupWindowStart?: string | null;
  pickupWindowEnd?: string | null;
}

// Legacy Delivery interface for compatibility
export interface Delivery {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  vehicleTypes: { type: VehicleType; count: number }[];
  startLocation: string;
  startTime: string;
  endLocation: string;
  endTime: string;
  date: string;
  assignedTransport?: string;
  assignedDriver?: string;
  status: 'pending' | 'assigned' | 'in-progress' | 'completed';
}

export const drivers: Driver[] = [
  { id: 'driver-1', name: 'Xander', phone: '06-12345678', available: true, canDriveTrailer: true },
  { id: 'driver-2', name: 'Tim', phone: '06-23456789', available: true, canDriveTrailer: true },
  { id: 'driver-3', name: 'Jan de Vries', phone: '06-34567890', available: true, canDriveTrailer: false },
];

// Test data - in de toekomst komt dit uit ReadyBike
export const demoOrders: Order[] = [
  // Testboeking 1: Purmerend - 17 januari
  {
    id: 'order-1',
    orderNumber: 'RE-2026001',
    customerName: 'Heeres',
    customerPhone: '',
    address: 'Purmerplein 2, 1141 ZT Purmerend',
    date: '2026-01-17',
    bookingStartDate: '2026-01-17',
    bookingEndDate: '2026-01-17',
    logisticDeliveryDate: '2026-01-17',
    logisticPickupDate: '2026-01-17',
    segments: [
      {
        id: 'del-1-leveren',
        type: 'leveren',
        vehicleTypes: [
          { type: 'e-choppers', count: 20 },
        ],
        startTime: '13:00',
        assignedTransport: 'combi-man-aanhanger-5',
        assignedDriver: 'driver-1',
        status: 'assigned',
      },
      {
        id: 'del-1-ophalen',
        type: 'ophalen',
        vehicleTypes: [
          { type: 'e-choppers', count: 20 },
        ],
        startTime: '15:00',
        assignedTransport: 'combi-ren-aanhanger-4',
        assignedDriver: 'driver-2',
        status: 'assigned',
      },
    ],
  },
];

// For backward compatibility - convert orders to flat deliveries
export const demoDeliveries: Delivery[] = demoOrders.flatMap(order =>
  order.segments.map(segment => ({
    id: segment.id,
    orderNumber: order.orderNumber,
    customerName: `${order.customerName} (${segment.type})`,
    customerPhone: order.customerPhone,
    vehicleTypes: segment.vehicleTypes,
    startLocation: segment.type === 'leveren' ? 'Loods' : order.address,
    startTime: segment.startTime,
    endLocation: segment.type === 'leveren' ? order.address : 'Loods',
    endTime: segment.startTime,
    date: order.date,
    assignedTransport: segment.assignedTransport,
    assignedDriver: segment.assignedDriver,
    status: segment.status,
  }))
);
