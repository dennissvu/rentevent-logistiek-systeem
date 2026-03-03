import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface LoadUnloadInstruction {
  id: string;
  orderId: string;
  assignmentId: string;
  action: 'laden' | 'lossen';
  vehicleType: string;
  vehicleCount: number;
  location: 'winkel' | 'loods' | 'blijft_staan';
  sequenceNumber: number;
  helperCount: number;
  helperDriverIds: string[];
  customDurationMinutes: number | null;
  targetTransportId: string | null;
  notes: string | null;
  stayLoadedCount: number;
}

interface DbInstruction {
  id: string;
  order_id: string;
  assignment_id: string;
  action: string;
  vehicle_type: string;
  vehicle_count: number;
  location: string;
  sequence_number: number;
  helper_count: number;
  helper_driver_ids: unknown;
  custom_duration_minutes: number | null;
  target_transport_id: string | null;
  notes: string | null;
  stay_loaded_count: number;
}

const dbToInstruction = (db: DbInstruction): LoadUnloadInstruction => ({
  id: db.id,
  orderId: db.order_id,
  assignmentId: db.assignment_id,
  action: db.action as 'laden' | 'lossen',
  vehicleType: db.vehicle_type,
  vehicleCount: db.vehicle_count,
  location: db.location as 'winkel' | 'loods' | 'blijft_staan',
  sequenceNumber: db.sequence_number,
  helperCount: db.helper_count,
  helperDriverIds: Array.isArray(db.helper_driver_ids) ? (db.helper_driver_ids as string[]) : [],
  customDurationMinutes: db.custom_duration_minutes,
  targetTransportId: db.target_transport_id,
  notes: db.notes,
  stayLoadedCount: db.stay_loaded_count || 0,
});

export function useLoadUnloadInstructions(orderId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const queryKey = ['load-unload-instructions', orderId];

  const { data: instructions = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('order_load_unload_instructions')
        .select('*')
        .eq('order_id', orderId)
        .order('sequence_number');

      if (error) throw error;
      return (data as DbInstruction[]).map(dbToInstruction);
    },
    enabled: !!orderId,
  });

  const addMutation = useMutation({
    mutationFn: async (instruction: Omit<LoadUnloadInstruction, 'id'>) => {
      const { error } = await (supabase as any)
        .from('order_load_unload_instructions')
        .insert({
          order_id: instruction.orderId,
          assignment_id: instruction.assignmentId,
          action: instruction.action,
          vehicle_type: instruction.vehicleType,
          vehicle_count: instruction.vehicleCount,
          location: instruction.location,
          sequence_number: instruction.sequenceNumber,
          helper_count: instruction.helperCount,
          helper_driver_ids: instruction.helperDriverIds || [],
          custom_duration_minutes: instruction.customDurationMinutes,
          target_transport_id: instruction.targetTransportId,
          notes: instruction.notes,
          stay_loaded_count: instruction.stayLoadedCount || 0,
        });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (error) => {
      console.error('Error adding instruction:', error);
      toast({ title: 'Fout bij toevoegen instructie', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<LoadUnloadInstruction> }) => {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.action !== undefined) dbUpdates.action = updates.action;
      if (updates.vehicleType !== undefined) dbUpdates.vehicle_type = updates.vehicleType;
      if (updates.vehicleCount !== undefined) dbUpdates.vehicle_count = updates.vehicleCount;
      if (updates.location !== undefined) dbUpdates.location = updates.location;
      if (updates.sequenceNumber !== undefined) dbUpdates.sequence_number = updates.sequenceNumber;
      if (updates.helperCount !== undefined) dbUpdates.helper_count = updates.helperCount;
      if (updates.helperDriverIds !== undefined) dbUpdates.helper_driver_ids = updates.helperDriverIds;
      if (updates.customDurationMinutes !== undefined) dbUpdates.custom_duration_minutes = updates.customDurationMinutes;
      if (updates.targetTransportId !== undefined) dbUpdates.target_transport_id = updates.targetTransportId;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      if (updates.stayLoadedCount !== undefined) dbUpdates.stay_loaded_count = updates.stayLoadedCount;

      const { error } = await (supabase as any)
        .from('order_load_unload_instructions')
        .update(dbUpdates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (error) => {
      console.error('Error updating instruction:', error);
      toast({ title: 'Fout bij bijwerken instructie', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('order_load_unload_instructions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (error) => {
      console.error('Error deleting instruction:', error);
      toast({ title: 'Fout bij verwijderen instructie', variant: 'destructive' });
    },
  });

  const getInstructionsForAssignment = (assignmentId: string, action?: 'laden' | 'lossen') => {
    return instructions.filter(i => 
      i.assignmentId === assignmentId && 
      (action ? i.action === action : true)
    );
  };

  return {
    instructions,
    isLoading,
    addInstruction: (instruction: Omit<LoadUnloadInstruction, 'id'>) => addMutation.mutateAsync(instruction),
    updateInstruction: (id: string, updates: Partial<LoadUnloadInstruction>) => updateMutation.mutateAsync({ id, updates }),
    deleteInstruction: (id: string) => deleteMutation.mutateAsync(id),
    getInstructionsForAssignment,
  };
}
