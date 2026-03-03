-- Create orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  
  -- Klantgegevens
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  company_name TEXT,
  
  -- Boeking details
  number_of_persons INTEGER NOT NULL DEFAULT 1,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  start_location TEXT NOT NULL,
  end_location TEXT NOT NULL,
  
  -- Extra
  notes TEXT,
  
  -- Voertuigen (JSONB array)
  vehicle_types JSONB DEFAULT '[]'::jsonb,
  
  -- Transport en chauffeur toewijzing
  assigned_transport_leveren TEXT,
  assigned_driver_leveren TEXT,
  assigned_transport_ophalen TEXT,
  assigned_driver_ophalen TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'offerte' CHECK (status IN ('offerte', 'optie', 'bevestigd')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (no auth required for now)
-- Later kan dit beperkt worden tot ingelogde gebruikers
CREATE POLICY "Orders are viewable by everyone" 
ON public.orders 
FOR SELECT 
USING (true);

CREATE POLICY "Orders can be created by everyone" 
ON public.orders 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Orders can be updated by everyone" 
ON public.orders 
FOR UPDATE 
USING (true);

CREATE POLICY "Orders can be deleted by everyone" 
ON public.orders 
FOR DELETE 
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for common queries
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_start_date ON public.orders(start_date);
CREATE INDEX idx_orders_order_number ON public.orders(order_number);