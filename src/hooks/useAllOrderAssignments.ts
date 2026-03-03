import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OrderAssignmentSummary {
  orderId: string;
  leveren: {
    transportIds: string[];
    driverIds: (string | null)[];
  };
  ophalen: {
    transportIds: string[];
    driverIds: (string | null)[];
  };
}

interface DbAssignment {
  id: string;
  order_id: string;
  segment: string;
  transport_id: string;
  driver_id: string | null;
  sequence_number: number;
}

export function useAllOrderAssignments(orderIds: string[]) {
  return useQuery({
    queryKey: ['all-order-assignments', orderIds],
    queryFn: async () => {
      if (orderIds.length === 0) return new Map<string, OrderAssignmentSummary>();

      const { data, error } = await supabase
        .from('order_transport_assignments')
        .select('*')
        .in('order_id', orderIds)
        .order('sequence_number');

      if (error) throw error;

      const assignments = data as DbAssignment[];
      const summaryMap = new Map<string, OrderAssignmentSummary>();

      // Initialize all orders
      for (const orderId of orderIds) {
        summaryMap.set(orderId, {
          orderId,
          leveren: { transportIds: [], driverIds: [] },
          ophalen: { transportIds: [], driverIds: [] },
        });
      }

      // Populate with actual assignments
      for (const assignment of assignments) {
        const summary = summaryMap.get(assignment.order_id);
        if (summary) {
          const segment = assignment.segment === 'leveren' ? 'leveren' : 'ophalen';
          summary[segment].transportIds.push(assignment.transport_id);
          summary[segment].driverIds.push(assignment.driver_id);
        }
      }

      return summaryMap;
    },
    enabled: orderIds.length > 0,
  });
}
