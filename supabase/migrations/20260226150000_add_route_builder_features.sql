-- Add assigned_vehicles to driver_day_route_stops for partial quantity assignment
-- Stores array of {type, count} objects, e.g. [{"type": "fietsen", "count": 60}]
ALTER TABLE driver_day_route_stops
  ADD COLUMN IF NOT EXISTS assigned_vehicles jsonb DEFAULT NULL;

-- Add transport_material_id to driver_day_routes for transport material assignment
-- References transport_materials or transport_combis by their text id
ALTER TABLE driver_day_routes
  ADD COLUMN IF NOT EXISTS transport_material_id text DEFAULT NULL;
