-- Add column for trailer permission
ALTER TABLE public.drivers 
ADD COLUMN can_drive_trailer boolean NOT NULL DEFAULT true;