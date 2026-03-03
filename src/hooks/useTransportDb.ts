import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TransportMaterial, CombiTransport, TransportType, VehicleType } from '@/data/transportData';
import { useToast } from '@/hooks/use-toast';

interface DbTransportMaterial {
  id: string;
  code: string;
  name: string;
  type: string;
  capacity_choppers: number;
  capacity_fatbikes: number;
  capacity_fietsen: number;
  capacity_bikes: number;
  capacity_tweepers: number;
  is_active: boolean;
}

interface DbTransportCombi {
  id: string;
  code: string;
  name: string;
  bakwagen_id: string;
  aanhanger_id: string;
  capacity_choppers: number;
  capacity_fatbikes: number;
  capacity_fietsen: number;
  capacity_bikes: number;
  capacity_tweepers: number;
  is_active: boolean;
}

// Convert DB to app format
const dbToMaterial = (db: DbTransportMaterial): TransportMaterial => ({
  id: db.code,
  name: db.name,
  type: db.type as TransportType,
  capacity: {
    'e-choppers': db.capacity_choppers,
    'e-fatbikes': db.capacity_fatbikes,
    'fietsen': db.capacity_fietsen,
    'e-bikes': db.capacity_bikes,
    'tweepers': db.capacity_tweepers,
  },
});

const dbToCombi = (db: DbTransportCombi, materials: DbTransportMaterial[]): CombiTransport => {
  const bakwagen = materials.find(m => m.id === db.bakwagen_id);
  const aanhanger = materials.find(m => m.id === db.aanhanger_id);
  
  return {
    id: db.code,
    name: db.name,
    bakwagenId: bakwagen?.code || '',
    aanhangerId: aanhanger?.code || '',
    capacity: {
      'e-choppers': db.capacity_choppers,
      'e-fatbikes': db.capacity_fatbikes,
      'fietsen': db.capacity_fietsen,
      'e-bikes': db.capacity_bikes,
      'tweepers': db.capacity_tweepers,
    },
  };
};

export function useTransportDb() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch transport materials
  const { data: materialsData = [], isLoading: isLoadingMaterials } = useQuery({
    queryKey: ['transport-materials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transport_materials')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as DbTransportMaterial[];
    },
  });

  // Fetch combis
  const { data: combisData = [], isLoading: isLoadingCombis } = useQuery({
    queryKey: ['transport-combis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transport_combis')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as DbTransportCombi[];
    },
  });

  // Convert to app format
  const allMaterials = materialsData.map(dbToMaterial);
  const bakwagens = allMaterials.filter(m => m.type === 'bakwagen');
  const aanhangers = allMaterials.filter(m => m.type === 'aanhanger');
  const combis = combisData.map(c => dbToCombi(c, materialsData));

  // Add material
  const addMaterialMutation = useMutation({
    mutationFn: async (material: Omit<TransportMaterial, 'id'> & { code: string }) => {
      const { error } = await supabase
        .from('transport_materials')
        .insert({
          code: material.code,
          name: material.name,
          type: material.type,
          capacity_choppers: material.capacity['e-choppers'],
          capacity_fatbikes: material.capacity['e-fatbikes'],
          capacity_fietsen: material.capacity['fietsen'],
          capacity_bikes: material.capacity['e-bikes'],
          capacity_tweepers: material.capacity['tweepers'],
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport-materials'] });
      toast({ title: 'Transport toegevoegd' });
    },
    onError: (error) => {
      console.error('Error adding transport:', error);
      toast({ title: 'Fout bij toevoegen', variant: 'destructive' });
    },
  });

  // Update material
  const updateMaterialMutation = useMutation({
    mutationFn: async ({ code, updates }: { code: string; updates: Partial<TransportMaterial> }) => {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.name) dbUpdates.name = updates.name;
      if (updates.capacity) {
        dbUpdates.capacity_choppers = updates.capacity['e-choppers'];
        dbUpdates.capacity_fatbikes = updates.capacity['e-fatbikes'];
        dbUpdates.capacity_fietsen = updates.capacity['fietsen'];
        dbUpdates.capacity_bikes = updates.capacity['e-bikes'];
        dbUpdates.capacity_tweepers = updates.capacity['tweepers'];
      }

      const { error } = await supabase
        .from('transport_materials')
        .update(dbUpdates)
        .eq('code', code);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport-materials'] });
    },
    onError: (error) => {
      console.error('Error updating transport:', error);
      toast({ title: 'Fout bij bijwerken', variant: 'destructive' });
    },
  });

  // Delete (soft delete)
  const deleteMaterialMutation = useMutation({
    mutationFn: async (code: string) => {
      const { error } = await supabase
        .from('transport_materials')
        .update({ is_active: false })
        .eq('code', code);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport-materials'] });
      toast({ title: 'Transport verwijderd' });
    },
    onError: (error) => {
      console.error('Error deleting transport:', error);
      toast({ title: 'Fout bij verwijderen', variant: 'destructive' });
    },
  });

  return {
    bakwagens,
    aanhangers,
    combis,
    allMaterials,
    isLoading: isLoadingMaterials || isLoadingCombis,
    addMaterial: (material: Omit<TransportMaterial, 'id'> & { code: string }) => 
      addMaterialMutation.mutate(material),
    updateMaterial: (code: string, updates: Partial<TransportMaterial>) => 
      updateMaterialMutation.mutate({ code, updates }),
    deleteMaterial: (code: string) => deleteMaterialMutation.mutate(code),
  };
}
