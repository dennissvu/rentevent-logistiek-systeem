import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DayRouteStop {
  id: string;
  route_id: string;
  order_id: string;
  assignment_id: string | null;
  sequence_number: number;
  stop_type: string; // 'laden_winkel' | 'aankoppelen_loods' | 'leveren' | 'ophalen' | 'lossen_winkel' | 'afkoppelen_loods'
  location_address: string | null;
  estimated_arrival: string | null;
  estimated_departure: string | null;
  drive_time_from_previous: number | null;
  load_unload_minutes: number | null;
  notes: string | null;
}

export interface DayRoute {
  id: string;
  driver_id: string;
  route_date: string;
  status: string; // 'concept' | 'bevestigd' | 'onderweg' | 'afgerond'
  notes: string | null;
  stops: DayRouteStop[];
}

/**
 * Hook voor het ophalen van dagroutes voor een specifieke chauffeur.
 * Bevat alle stops met hun volgorde.
 */
export function useDriverDayRoutes(driverId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['driver-day-routes', driverId],
    queryFn: async (): Promise<DayRoute[]> => {
      if (!driverId) return [];

      const { data: routes, error: routesErr } = await supabase
        .from('driver_day_routes')
        .select('*')
        .eq('driver_id', driverId)
        .order('route_date');

      if (routesErr) throw routesErr;
      if (!routes?.length) return [];

      const routeIds = routes.map(r => r.id);

      const { data: stops, error: stopsErr } = await supabase
        .from('driver_day_route_stops')
        .select('*')
        .in('route_id', routeIds)
        .order('sequence_number');

      if (stopsErr) throw stopsErr;

      const stopsMap = new Map<string, DayRouteStop[]>();
      for (const stop of (stops || [])) {
        const existing = stopsMap.get(stop.route_id) || [];
        existing.push(stop as DayRouteStop);
        stopsMap.set(stop.route_id, existing);
      }

      return routes.map(r => ({
        ...r,
        stops: stopsMap.get(r.id) || [],
      })) as DayRoute[];
    },
    enabled: !!driverId,
  });

  // Maak of update een dagroute voor een chauffeur+datum
  const upsertRouteMutation = useMutation({
    mutationFn: async (params: {
      driverId: string;
      routeDate: string;
      status?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('driver_day_routes')
        .upsert(
          {
            driver_id: params.driverId,
            route_date: params.routeDate,
            status: params.status || 'concept',
            notes: params.notes || null,
          },
          { onConflict: 'driver_id,route_date' }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-day-routes'] });
    },
  });

  // Stel stops in voor een route (vervangt alle bestaande stops)
  const setRouteStopsMutation = useMutation({
    mutationFn: async (params: {
      routeId: string;
      stops: Omit<DayRouteStop, 'id' | 'route_id'>[];
    }) => {
      // Verwijder bestaande stops
      await supabase
        .from('driver_day_route_stops')
        .delete()
        .eq('route_id', params.routeId);

      // Voeg nieuwe stops toe
      if (params.stops.length > 0) {
        const { error } = await supabase
          .from('driver_day_route_stops')
          .insert(
            params.stops.map((stop, idx) => ({
              route_id: params.routeId,
              order_id: stop.order_id,
              assignment_id: stop.assignment_id,
              sequence_number: idx + 1,
              stop_type: stop.stop_type,
              location_address: stop.location_address,
              estimated_arrival: stop.estimated_arrival,
              estimated_departure: stop.estimated_departure,
              drive_time_from_previous: stop.drive_time_from_previous,
              load_unload_minutes: stop.load_unload_minutes,
              notes: stop.notes,
            }))
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-day-routes'] });
    },
  });

  // Verwijder een dagroute
  const deleteRouteMutation = useMutation({
    mutationFn: async (routeId: string) => {
      const { error } = await supabase
        .from('driver_day_routes')
        .delete()
        .eq('id', routeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-day-routes'] });
    },
  });

  return {
    routes: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    upsertRoute: upsertRouteMutation.mutateAsync,
    setRouteStops: setRouteStopsMutation.mutateAsync,
    deleteRoute: deleteRouteMutation.mutateAsync,
  };
}

/**
 * Hook voor het ophalen van alle dagroutes voor een specifieke datum.
 * Handig voor het dagplanning overzicht.
 */
export function useDayRoutesForDate(date: string) {
  return useQuery({
    queryKey: ['day-routes-by-date', date],
    queryFn: async (): Promise<(DayRoute & { driverName: string })[]> => {
      const { data: routes, error: routesErr } = await supabase
        .from('driver_day_routes')
        .select('*')
        .eq('route_date', date);

      if (routesErr) throw routesErr;
      if (!routes?.length) return [];

      const routeIds = routes.map(r => r.id);
      const driverIds = [...new Set(routes.map(r => r.driver_id))];

      const [stopsRes, driversRes] = await Promise.all([
        supabase
          .from('driver_day_route_stops')
          .select('*')
          .in('route_id', routeIds)
          .order('sequence_number'),
        supabase
          .from('drivers')
          .select('id, name')
          .in('id', driverIds),
      ]);

      const stopsMap = new Map<string, DayRouteStop[]>();
      for (const stop of (stopsRes.data || [])) {
        const existing = stopsMap.get(stop.route_id) || [];
        existing.push(stop as DayRouteStop);
        stopsMap.set(stop.route_id, existing);
      }

      const driverMap = new Map(
        (driversRes.data || []).map(d => [d.id, d.name])
      );

      return routes.map(r => ({
        ...r,
        stops: stopsMap.get(r.id) || [],
        driverName: driverMap.get(r.driver_id) || 'Onbekend',
      })) as (DayRoute & { driverName: string })[];
    },
    enabled: !!date,
  });
}
