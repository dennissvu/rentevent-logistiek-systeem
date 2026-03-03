import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UpsertAssignmentParams {
  orderId: string;
  segment: 'leveren' | 'ophalen';
  transportId: string;
  driverId: string | null;
  existingAssignmentId?: string;
}

export function useInlineAssignment(date: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['daily-planning', date] });
    queryClient.invalidateQueries({ queryKey: ['daily-transport', date] });
    queryClient.invalidateQueries({ queryKey: ['driver-day-overview', date] });
  };

  const upsertAssignment = useMutation({
    mutationFn: async (params: UpsertAssignmentParams) => {
      if (params.existingAssignmentId) {
        // Update existing assignment
        const updates: Record<string, unknown> = {};
        if (params.transportId) updates.transport_id = params.transportId;
        if (params.driverId !== undefined) updates.driver_id = params.driverId;

        const { error } = await supabase
          .from('order_transport_assignments')
          .update(updates)
          .eq('id', params.existingAssignmentId);
        if (error) throw error;
      } else {
        // Create new assignment
        const { error } = await supabase
          .from('order_transport_assignments')
          .insert({
            order_id: params.orderId,
            segment: params.segment,
            transport_id: params.transportId,
            driver_id: params.driverId,
            sequence_number: 1,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidateAll();
    },
    onError: (err) => {
      console.error('Assignment error:', err);
      toast({ title: 'Fout bij toewijzen', variant: 'destructive' });
    },
  });

  return { upsertAssignment };
}
