import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface TransportAssignment {
  id: string;
  orderId: string;
  segment: 'leveren' | 'ophalen';
  transportId: string;
  driverId: string | null;
  sequenceNumber: number;
}

interface DbAssignment {
  id: string;
  order_id: string;
  segment: string;
  transport_id: string;
  driver_id: string | null;
  sequence_number: number;
}

const dbToAssignment = (db: DbAssignment): TransportAssignment => ({
  id: db.id,
  orderId: db.order_id,
  segment: db.segment as 'leveren' | 'ophalen',
  transportId: db.transport_id,
  driverId: db.driver_id,
  sequenceNumber: db.sequence_number,
});

export function useOrderAssignments(orderId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['order-assignments', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_transport_assignments')
        .select('*')
        .eq('order_id', orderId)
        .order('segment')
        .order('sequence_number');

      if (error) throw error;
      return (data as DbAssignment[]).map(dbToAssignment);
    },
    enabled: !!orderId,
  });

  const leverenAssignments = assignments.filter(a => a.segment === 'leveren');
  const ophalenAssignments = assignments.filter(a => a.segment === 'ophalen');

  const addAssignmentMutation = useMutation({
    mutationFn: async (assignment: Omit<TransportAssignment, 'id'>) => {
      const { error } = await supabase
        .from('order_transport_assignments')
        .insert({
          order_id: assignment.orderId,
          segment: assignment.segment,
          transport_id: assignment.transportId,
          driver_id: assignment.driverId,
          sequence_number: assignment.sequenceNumber,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-assignments', orderId] });
    },
    onError: (error) => {
      console.error('Error adding assignment:', error);
      toast({ title: 'Fout bij toevoegen toewijzing', variant: 'destructive' });
    },
  });

  const updateAssignmentMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TransportAssignment> }) => {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.transportId !== undefined) dbUpdates.transport_id = updates.transportId;
      if (updates.driverId !== undefined) dbUpdates.driver_id = updates.driverId;

      const { error } = await supabase
        .from('order_transport_assignments')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-assignments', orderId] });
    },
    onError: (error) => {
      console.error('Error updating assignment:', error);
      toast({ title: 'Fout bij bijwerken toewijzing', variant: 'destructive' });
    },
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('order_transport_assignments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-assignments', orderId] });
    },
    onError: (error) => {
      console.error('Error deleting assignment:', error);
      toast({ title: 'Fout bij verwijderen toewijzing', variant: 'destructive' });
    },
  });

  const clearSegmentMutation = useMutation({
    mutationFn: async (segment: 'leveren' | 'ophalen') => {
      const { error } = await supabase
        .from('order_transport_assignments')
        .delete()
        .eq('order_id', orderId)
        .eq('segment', segment);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-assignments', orderId] });
    },
  });

  const copyToOphalenMutation = useMutation({
    mutationFn: async () => {
      // First clear existing ophalen assignments
      await supabase
        .from('order_transport_assignments')
        .delete()
        .eq('order_id', orderId)
        .eq('segment', 'ophalen');

      // Then copy leveren assignments to ophalen
      const leverenData = assignments.filter(a => a.segment === 'leveren');
      
      if (leverenData.length === 0) return;

      const newAssignments = leverenData.map((a, index) => ({
        order_id: orderId,
        segment: 'ophalen',
        transport_id: a.transportId,
        driver_id: a.driverId,
        sequence_number: index + 1,
      }));

      const { error } = await supabase
        .from('order_transport_assignments')
        .insert(newAssignments);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-assignments', orderId] });
      toast({ title: 'Toewijzingen gekopieerd naar ophalen' });
    },
    onError: (error) => {
      console.error('Error copying assignments:', error);
      toast({ title: 'Fout bij kopiëren toewijzingen', variant: 'destructive' });
    },
  });

  return {
    assignments,
    leverenAssignments,
    ophalenAssignments,
    isLoading,
    addAssignment: (assignment: Omit<TransportAssignment, 'id'>) => 
      addAssignmentMutation.mutateAsync(assignment),
    updateAssignment: (id: string, updates: Partial<TransportAssignment>) =>
      updateAssignmentMutation.mutateAsync({ id, updates }),
    deleteAssignment: (id: string) => deleteAssignmentMutation.mutateAsync(id),
    clearSegment: (segment: 'leveren' | 'ophalen') => clearSegmentMutation.mutateAsync(segment),
    copyToOphalen: () => copyToOphalenMutation.mutateAsync(),
    isCopying: copyToOphalenMutation.isPending,
  };
}
