
ALTER TABLE public.orders
ADD COLUMN combined_unloading_leveren boolean NOT NULL DEFAULT false,
ADD COLUMN combined_unloading_ophalen boolean NOT NULL DEFAULT false;
