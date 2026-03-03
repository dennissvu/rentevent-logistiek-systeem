
-- Tabel voor opgeslagen handtekeningen bij orders
CREATE TABLE public.order_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  signer_name TEXT NOT NULL,
  signature_url TEXT NOT NULL,
  signed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  segment TEXT NOT NULL DEFAULT 'leveren',
  driver_id UUID REFERENCES public.drivers(id),
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.order_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signatures viewable by everyone"
  ON public.order_signatures FOR SELECT USING (true);

CREATE POLICY "Signatures can be created"
  ON public.order_signatures FOR INSERT WITH CHECK (true);

CREATE POLICY "Signatures can be deleted"
  ON public.order_signatures FOR DELETE USING (true);

-- Storage bucket voor handtekening afbeeldingen
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', true);

CREATE POLICY "Signatures storage viewable by everyone"
  ON storage.objects FOR SELECT USING (bucket_id = 'signatures');

CREATE POLICY "Signatures storage can be created"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'signatures');
