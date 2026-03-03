import { createContext, useContext, ReactNode } from 'react';
import { OrderFormData } from '@/data/ordersData';
import { Order, DeliverySegment } from '@/data/planningData';
import { useOrdersDb } from '@/hooks/useOrdersDb';

interface OrdersContextType {
  orders: OrderFormData[];
  isLoading: boolean;
  addOrder: (order: OrderFormData) => void;
  updateOrder: (id: string, updates: Partial<OrderFormData>) => void;
  deleteOrder: (id: string) => void;
  getPlanningOrders: () => Order[];
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const { orders, isLoading, addOrder, updateOrder, deleteOrder } = useOrdersDb();

  // Convert optie and bevestigde orders to planning format
  const getPlanningOrders = (): Order[] => {
    return orders
      .filter((order) => order.status === 'optie' || order.status === 'bevestigd')
      .map((order) => {
        // Use logistic dates if set, otherwise fall back to booking dates
        const effectiveDeliveryDate = order.deliveryDate || order.startDate;
        const effectiveDeliveryTime = order.deliveryTime || order.startTime;
        const effectivePickupDate = order.pickupDate || order.endDate;
        const effectivePickupTime = order.pickupTime || order.endTime;

        // Create leveren segment
        const leverenSegment: DeliverySegment = {
          id: `${order.id}-leveren`,
          type: 'leveren',
          vehicleTypes: order.vehicleTypes || [],
          startTime: effectiveDeliveryTime,
          assignedTransport: order.assignedTransportLeveren,
          assignedDriver: order.assignedDriverLeveren,
          status: order.assignedTransportLeveren && order.assignedDriverLeveren ? 'assigned' : 'pending',
        };

        // Create ophalen segment
        const ophalenSegment: DeliverySegment = {
          id: `${order.id}-ophalen`,
          type: 'ophalen',
          vehicleTypes: order.vehicleTypes || [],
          startTime: effectivePickupTime,
          assignedTransport: order.assignedTransportOphalen,
          assignedDriver: order.assignedDriverOphalen,
          status: order.assignedTransportOphalen && order.assignedDriverOphalen ? 'assigned' : 'pending',
        };

        const planningOrder: Order = {
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.companyName || `${order.firstName} ${order.lastName}`,
          customerPhone: order.phone,
          address: order.endLocation !== 'Loods' ? order.endLocation : order.startLocation,
          date: effectiveDeliveryDate,
          bookingStartDate: order.startDate,
          bookingEndDate: order.endDate,
          logisticDeliveryDate: effectiveDeliveryDate,
          logisticPickupDate: effectivePickupDate,
          segments: [leverenSegment, ophalenSegment],
          status: order.status,
          deliveryWindowStart: order.deliveryWindowStart,
          deliveryWindowEnd: order.deliveryWindowEnd,
          pickupWindowStart: order.pickupWindowStart,
          pickupWindowEnd: order.pickupWindowEnd,
        };

        return planningOrder;
      });
  };

  return (
    <OrdersContext.Provider
      value={{
        orders,
        isLoading,
        addOrder,
        updateOrder,
        deleteOrder,
        getPlanningOrders,
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  const context = useContext(OrdersContext);
  if (context === undefined) {
    throw new Error('useOrders must be used within an OrdersProvider');
  }
  return context;
}
