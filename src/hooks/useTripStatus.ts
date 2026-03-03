import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type TripStatus = 'gepland' | 'onderweg' | 'geladen' | 'geleverd' | 'opgehaald' | 'retour' | 'afgerond';

export const TRIP_STATUS_FLOW: Record<string, { next: TripStatus; label: string; color: string }[]> = {
  'gepland': [
    { next: 'onderweg', label: 'Onderweg', color: 'bg-blue-600 hover:bg-blue-700' },
  ],
  'onderweg': [
    { next: 'geladen', label: 'Geladen', color: 'bg-amber-600 hover:bg-amber-700' },
    { next: 'geleverd', label: 'Geleverd', color: 'bg-green-600 hover:bg-green-700' },
  ],
  'geladen': [
    { next: 'geleverd', label: 'Geleverd', color: 'bg-green-600 hover:bg-green-700' },
    { next: 'opgehaald', label: 'Opgehaald', color: 'bg-green-600 hover:bg-green-700' },
  ],
  'geleverd': [
    { next: 'retour', label: 'Retour', color: 'bg-purple-600 hover:bg-purple-700' },
    { next: 'afgerond', label: 'Afgerond', color: 'bg-green-700 hover:bg-green-800' },
  ],
  'opgehaald': [
    { next: 'retour', label: 'Retour', color: 'bg-purple-600 hover:bg-purple-700' },
    { next: 'afgerond', label: 'Afgerond', color: 'bg-green-700 hover:bg-green-800' },
  ],
  'retour': [
    { next: 'afgerond', label: 'Afgerond', color: 'bg-green-700 hover:bg-green-800' },
  ],
  'afgerond': [],
};

export function useTripStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateStatus = useMutation({
    mutationFn: async ({ assignmentId, status }: { assignmentId: string; status: TripStatus }) => {
      const { error } = await supabase
        .from('order_transport_assignments')
        .update({ trip_status: status } as any)
        .eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['driver-day-overview'] });
      queryClient.invalidateQueries({ queryKey: ['chauffeur-today'] });
    },
    onError: (error) => {
      console.error('Error updating trip status:', error);
      toast({
        title: 'Fout bij status update',
        description: 'Er ging iets mis bij het bijwerken van de status.',
        variant: 'destructive',
      });
    },
  });

  return {
    updateTripStatus: (assignmentId: string, status: TripStatus) =>
      updateStatus.mutate({ assignmentId, status }),
    isUpdating: updateStatus.isPending,
  };
}
