-- Add field to track whether driver returns to shop during wait time
-- NULL = auto-calculate, true = force return, false = force wait at customer
ALTER TABLE public.orders 
ADD COLUMN driver_returns_to_shop boolean DEFAULT NULL;