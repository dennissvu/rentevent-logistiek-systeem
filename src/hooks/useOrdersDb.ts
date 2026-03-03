import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { OrderFormData } from '@/data/ordersData';
import { VehicleType } from '@/data/transportData';
import { useToast } from '@/hooks/use-toast';
interface DbOrder {
  id: string;
  order_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company_name: string | null;
  number_of_persons: number;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  start_location: string;
  end_location: string;
  notes: string | null;
  vehicle_types: { type: VehicleType; count: number }[] | null;
  assigned_transport_leveren: string | null;
  assigned_driver_leveren: string | null;
  assigned_transport_ophalen: string | null;
  assigned_driver_ophalen: string | null;
  driver_returns_to_shop: boolean | null;
  combined_unloading_leveren: boolean;
  combined_unloading_ophalen: boolean;
  reseller: string | null;
  status: 'offerte' | 'optie' | 'bevestigd';
  delivery_date: string | null;
  delivery_time: string | null;
  pickup_date: string | null;
  pickup_time: string | null;
  delivery_window_start: string | null;
  delivery_window_end: string | null;
  pickup_window_start: string | null;
  pickup_window_end: string | null;
  created_at: string;
  updated_at: string;
}

// Convert database format to app format
const dbToApp = (dbOrder: DbOrder): OrderFormData => ({
  id: dbOrder.id,
  orderNumber: dbOrder.order_number,
  firstName: dbOrder.first_name,
  lastName: dbOrder.last_name,
  email: dbOrder.email,
  phone: dbOrder.phone,
  companyName: dbOrder.company_name || undefined,
  numberOfPersons: dbOrder.number_of_persons,
  startDate: dbOrder.start_date,
  endDate: dbOrder.end_date,
  startTime: dbOrder.start_time.slice(0, 5),
  endTime: dbOrder.end_time.slice(0, 5),
  startLocation: dbOrder.start_location,
  endLocation: dbOrder.end_location,
  notes: dbOrder.notes || undefined,
  vehicleTypes: dbOrder.vehicle_types || undefined,
  assignedTransportLeveren: dbOrder.assigned_transport_leveren || undefined,
  assignedDriverLeveren: dbOrder.assigned_driver_leveren || undefined,
  assignedTransportOphalen: dbOrder.assigned_transport_ophalen || undefined,
  assignedDriverOphalen: dbOrder.assigned_driver_ophalen || undefined,
  driverReturnsToShop: dbOrder.driver_returns_to_shop,
  combinedUnloadingLeveren: dbOrder.combined_unloading_leveren,
  combinedUnloadingOphalen: dbOrder.combined_unloading_ophalen,
  reseller: dbOrder.reseller || undefined,
  status: dbOrder.status,
  deliveryDate: dbOrder.delivery_date,
  deliveryTime: dbOrder.delivery_time?.slice(0, 5) || null,
  pickupDate: dbOrder.pickup_date,
  pickupTime: dbOrder.pickup_time?.slice(0, 5) || null,
  deliveryWindowStart: dbOrder.delivery_window_start?.slice(0, 5) || null,
  deliveryWindowEnd: dbOrder.delivery_window_end?.slice(0, 5) || null,
  pickupWindowStart: dbOrder.pickup_window_start?.slice(0, 5) || null,
  pickupWindowEnd: dbOrder.pickup_window_end?.slice(0, 5) || null,
  createdAt: dbOrder.created_at,
  updatedAt: dbOrder.updated_at,
});

// Convert app format to database format
const appToDb = (order: OrderFormData): Omit<DbOrder, 'id' | 'created_at' | 'updated_at'> => ({
  order_number: order.orderNumber,
  first_name: order.firstName,
  last_name: order.lastName,
  email: order.email,
  phone: order.phone,
  company_name: order.companyName || null,
  number_of_persons: order.numberOfPersons,
  start_date: order.startDate,
  end_date: order.endDate,
  start_time: order.startTime,
  end_time: order.endTime,
  start_location: order.startLocation,
  end_location: order.endLocation,
  notes: order.notes || null,
  vehicle_types: order.vehicleTypes || null,
  assigned_transport_leveren: order.assignedTransportLeveren || null,
  assigned_driver_leveren: order.assignedDriverLeveren || null,
  assigned_transport_ophalen: order.assignedTransportOphalen || null,
  assigned_driver_ophalen: order.assignedDriverOphalen || null,
  driver_returns_to_shop: order.driverReturnsToShop ?? null,
  combined_unloading_leveren: order.combinedUnloadingLeveren ?? false,
  combined_unloading_ophalen: order.combinedUnloadingOphalen ?? false,
  reseller: order.reseller || null,
  status: order.status,
  delivery_date: order.deliveryDate || null,
  delivery_time: order.deliveryTime || null,
  pickup_date: order.pickupDate || null,
  pickup_time: order.pickupTime || null,
  delivery_window_start: order.deliveryWindowStart || null,
  delivery_window_end: order.deliveryWindowEnd || null,
  pickup_window_start: order.pickupWindowStart || null,
  pickup_window_end: order.pickupWindowEnd || null,
});

export function useOrdersDb() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all orders
  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data as unknown as DbOrder[]).map(dbToApp);
    },
  });

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          // Invalidate and refetch orders when any change occurs
          queryClient.invalidateQueries({ queryKey: ['orders'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Add order
  const addOrderMutation = useMutation({
    mutationFn: async (order: OrderFormData) => {
      const dbData = appToDb(order);
      const { data, error } = await supabase
        .from('orders')
        .insert(dbData)
        .select()
        .single();
      
      if (error) throw error;
      return dbToApp(data as unknown as DbOrder);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({
        title: 'Order aangemaakt',
        description: 'De order is succesvol opgeslagen.',
      });
    },
    onError: (error) => {
      console.error('Error adding order:', error);
      toast({
        title: 'Fout bij aanmaken',
        description: 'Er ging iets mis bij het opslaan van de order.',
        variant: 'destructive',
      });
    },
  });

  // Update order
  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<OrderFormData> }) => {
      const dbUpdates: Record<string, unknown> = {};
      
      if (updates.orderNumber !== undefined) dbUpdates.order_number = updates.orderNumber;
      if (updates.firstName !== undefined) dbUpdates.first_name = updates.firstName;
      if (updates.lastName !== undefined) dbUpdates.last_name = updates.lastName;
      if (updates.email !== undefined) dbUpdates.email = updates.email;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
      if (updates.companyName !== undefined) dbUpdates.company_name = updates.companyName || null;
      if (updates.numberOfPersons !== undefined) dbUpdates.number_of_persons = updates.numberOfPersons;
      if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
      if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate;
      if (updates.startTime !== undefined) dbUpdates.start_time = updates.startTime;
      if (updates.endTime !== undefined) dbUpdates.end_time = updates.endTime;
      if (updates.startLocation !== undefined) dbUpdates.start_location = updates.startLocation;
      if (updates.endLocation !== undefined) dbUpdates.end_location = updates.endLocation;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes || null;
      if (updates.vehicleTypes !== undefined) dbUpdates.vehicle_types = updates.vehicleTypes || null;
      if (updates.assignedTransportLeveren !== undefined) dbUpdates.assigned_transport_leveren = updates.assignedTransportLeveren || null;
      if (updates.assignedDriverLeveren !== undefined) dbUpdates.assigned_driver_leveren = updates.assignedDriverLeveren || null;
      if (updates.assignedTransportOphalen !== undefined) dbUpdates.assigned_transport_ophalen = updates.assignedTransportOphalen || null;
      if (updates.assignedDriverOphalen !== undefined) dbUpdates.assigned_driver_ophalen = updates.assignedDriverOphalen || null;
      if (updates.driverReturnsToShop !== undefined) dbUpdates.driver_returns_to_shop = updates.driverReturnsToShop;
      if (updates.combinedUnloadingLeveren !== undefined) dbUpdates.combined_unloading_leveren = updates.combinedUnloadingLeveren;
      if (updates.combinedUnloadingOphalen !== undefined) dbUpdates.combined_unloading_ophalen = updates.combinedUnloadingOphalen;
      if (updates.reseller !== undefined) dbUpdates.reseller = updates.reseller || null;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.deliveryDate !== undefined) dbUpdates.delivery_date = updates.deliveryDate || null;
      if (updates.deliveryTime !== undefined) dbUpdates.delivery_time = updates.deliveryTime || null;
      if (updates.pickupDate !== undefined) dbUpdates.pickup_date = updates.pickupDate || null;
      if (updates.pickupTime !== undefined) dbUpdates.pickup_time = updates.pickupTime || null;
      if (updates.deliveryWindowStart !== undefined) dbUpdates.delivery_window_start = updates.deliveryWindowStart || null;
      if (updates.deliveryWindowEnd !== undefined) dbUpdates.delivery_window_end = updates.deliveryWindowEnd || null;
      if (updates.pickupWindowStart !== undefined) dbUpdates.pickup_window_start = updates.pickupWindowStart || null;
      if (updates.pickupWindowEnd !== undefined) dbUpdates.pickup_window_end = updates.pickupWindowEnd || null;

      const { data, error } = await supabase
        .from('orders')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return dbToApp(data as unknown as DbOrder);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error) => {
      console.error('Error updating order:', error);
      toast({
        title: 'Fout bij bijwerken',
        description: 'Er ging iets mis bij het bijwerken van de order.',
        variant: 'destructive',
      });
    },
  });

  // Delete order
  const deleteOrderMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({
        title: 'Order verwijderd',
        description: 'De order is succesvol verwijderd.',
      });
    },
    onError: (error) => {
      console.error('Error deleting order:', error);
      toast({
        title: 'Fout bij verwijderen',
        description: 'Er ging iets mis bij het verwijderen van de order.',
        variant: 'destructive',
      });
    },
  });

  return {
    orders,
    isLoading,
    error,
    addOrder: (order: OrderFormData) => addOrderMutation.mutate(order),
    updateOrder: (id: string, updates: Partial<OrderFormData>) => 
      updateOrderMutation.mutate({ id, updates }),
    deleteOrder: (id: string) => deleteOrderMutation.mutate(id),
  };
}
