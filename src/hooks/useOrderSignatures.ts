import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export interface OrderSignature {
  id: string;
  orderId: string;
  signerName: string;
  signatureUrl: string;
  signedAt: string;
  segment: string;
  driverId: string | null;
}

export function useOrderSignatures(orderId: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: signatures = [], isLoading } = useQuery({
    queryKey: ['order-signatures', orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await supabase
        .from('order_signatures')
        .select('*')
        .eq('order_id', orderId)
        .order('signed_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(s => ({
        id: s.id,
        orderId: s.order_id,
        signerName: s.signer_name,
        signatureUrl: s.signature_url,
        signedAt: s.signed_at,
        segment: s.segment,
        driverId: s.driver_id,
      }));
    },
    enabled: !!orderId,
  });

  const saveSignature = useMutation({
    mutationFn: async (params: {
      orderId: string;
      signerName: string;
      signatureDataUrl: string;
      segment: string;
      driverId?: string;
    }) => {
      // Convert data URL to blob
      const res = await fetch(params.signatureDataUrl);
      const blob = await res.blob();
      const fileName = `${params.orderId}/${params.segment}-${Date.now()}.png`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('signatures')
        .upload(fileName, blob, { contentType: 'image/png' });
      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('signatures')
        .getPublicUrl(fileName);

      // Save record
      const { error: insertError } = await supabase
        .from('order_signatures')
        .insert({
          order_id: params.orderId,
          signer_name: params.signerName,
          signature_url: urlData.publicUrl,
          segment: params.segment,
          driver_id: params.driverId || null,
        });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-signatures', orderId] });
      toast({ title: 'Handtekening opgeslagen', description: 'De verhuurovereenkomst is ondertekend.' });
    },
    onError: (error) => {
      toast({ title: 'Fout', description: 'Kon handtekening niet opslaan.', variant: 'destructive' });
      console.error('Signature save error:', error);
    },
  });

  return { signatures, isLoading, saveSignature };
}
