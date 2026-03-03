import { useMemo } from 'react';
import { useOrders } from '@/context/OrdersContext';
import { OrderFormData } from '@/data/ordersData';

export interface AvailabilityInfo {
  isAvailable: boolean;
  assignedTo?: {
    orderNumber: string;
    orderId: string;
    segment: 'leveren' | 'ophalen';
    time: string;
  }[];
}

export interface DateAvailability {
  transport: Record<string, AvailabilityInfo>;
  drivers: Record<string, AvailabilityInfo>;
}

export function useAvailability(date: string, excludeOrderId?: string) {
  const { orders } = useOrders();

  const availability = useMemo<DateAvailability>(() => {
    const transport: Record<string, AvailabilityInfo> = {};
    const drivers: Record<string, AvailabilityInfo> = {};

    // Filter orders for the same date, excluding the current order
    const ordersOnDate = orders.filter(
      (order) => order.startDate === date && order.id !== excludeOrderId
    );

    // Check each order's assignments
    ordersOnDate.forEach((order) => {
      // Leveren transport
      if (order.assignedTransportLeveren) {
        if (!transport[order.assignedTransportLeveren]) {
          transport[order.assignedTransportLeveren] = { isAvailable: false, assignedTo: [] };
        }
        transport[order.assignedTransportLeveren].assignedTo?.push({
          orderNumber: order.orderNumber,
          orderId: order.id,
          segment: 'leveren',
          time: order.startTime,
        });
      }

      // Ophalen transport
      if (order.assignedTransportOphalen) {
        if (!transport[order.assignedTransportOphalen]) {
          transport[order.assignedTransportOphalen] = { isAvailable: false, assignedTo: [] };
        }
        transport[order.assignedTransportOphalen].assignedTo?.push({
          orderNumber: order.orderNumber,
          orderId: order.id,
          segment: 'ophalen',
          time: order.endTime,
        });
      }

      // Leveren driver
      if (order.assignedDriverLeveren) {
        if (!drivers[order.assignedDriverLeveren]) {
          drivers[order.assignedDriverLeveren] = { isAvailable: false, assignedTo: [] };
        }
        drivers[order.assignedDriverLeveren].assignedTo?.push({
          orderNumber: order.orderNumber,
          orderId: order.id,
          segment: 'leveren',
          time: order.startTime,
        });
      }

      // Ophalen driver
      if (order.assignedDriverOphalen) {
        if (!drivers[order.assignedDriverOphalen]) {
          drivers[order.assignedDriverOphalen] = { isAvailable: false, assignedTo: [] };
        }
        drivers[order.assignedDriverOphalen].assignedTo?.push({
          orderNumber: order.orderNumber,
          orderId: order.id,
          segment: 'ophalen',
          time: order.endTime,
        });
      }
    });

    return { transport, drivers };
  }, [orders, date, excludeOrderId]);

  const isTransportAvailable = (transportId: string): AvailabilityInfo => {
    return availability.transport[transportId] || { isAvailable: true };
  };

  const isDriverAvailable = (driverId: string): AvailabilityInfo => {
    return availability.drivers[driverId] || { isAvailable: true };
  };

  return {
    availability,
    isTransportAvailable,
    isDriverAvailable,
  };
}
