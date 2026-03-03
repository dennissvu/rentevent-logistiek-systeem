import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Driver } from '@/data/planningData';
import { useToast } from '@/hooks/use-toast';

interface DbDriver {
  id: string;
  name: string;
  phone: string | null;
  is_available: boolean;
  is_active: boolean;
  can_drive_trailer: boolean;
}

// Convert DB to app format
const dbToDriver = (db: DbDriver): Driver => ({
  id: db.id,
  name: db.name,
  phone: db.phone || '',
  available: db.is_available,
  canDriveTrailer: db.can_drive_trailer,
});

export function useDriversDb() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch drivers
  const { data: driversData = [], isLoading } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as DbDriver[];
    },
  });

  const drivers = driversData.map(dbToDriver);

  // Add driver
  const addDriverMutation = useMutation({
    mutationFn: async (driver: Omit<Driver, 'id'>) => {
      const { data, error } = await supabase
        .from('drivers')
        .insert({
          name: driver.name,
          phone: driver.phone || null,
          is_available: driver.available,
          can_drive_trailer: driver.canDriveTrailer,
        })
        .select()
        .single();
      
      if (error) throw error;
      return dbToDriver(data as DbDriver);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast({ title: 'Chauffeur toegevoegd' });
    },
    onError: (error) => {
      console.error('Error adding driver:', error);
      toast({ title: 'Fout bij toevoegen', variant: 'destructive' });
    },
  });

  // Update driver
  const updateDriverMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Driver> }) => {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone || null;
      if (updates.available !== undefined) dbUpdates.is_available = updates.available;
      if (updates.canDriveTrailer !== undefined) dbUpdates.can_drive_trailer = updates.canDriveTrailer;

      const { error } = await supabase
        .from('drivers')
        .update(dbUpdates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
    onError: (error) => {
      console.error('Error updating driver:', error);
      toast({ title: 'Fout bij bijwerken', variant: 'destructive' });
    },
  });

  // Delete (soft delete)
  const deleteDriverMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('drivers')
        .update({ is_active: false })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast({ title: 'Chauffeur verwijderd' });
    },
    onError: (error) => {
      console.error('Error deleting driver:', error);
      toast({ title: 'Fout bij verwijderen', variant: 'destructive' });
    },
  });

  return {
    drivers,
    isLoading,
    addDriver: (driver: Omit<Driver, 'id'>) => addDriverMutation.mutate(driver),
    updateDriver: (id: string, updates: Partial<Driver>) => 
      updateDriverMutation.mutate({ id, updates }),
    deleteDriver: (id: string) => deleteDriverMutation.mutate(id),
  };
}
