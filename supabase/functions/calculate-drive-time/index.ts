import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Locaties voor berekening
const LOCATIONS = {
  winkel: "Haven 45, 1131 EP Volendam, Netherlands",
  loods: "Aan de Purmer, Purmerend, Netherlands",
};

interface RouteRequest {
  origin: string;
  destination: string;
  departureTime?: string; // ISO date string voor predictieve traffic
}

interface RouteResponse {
  durationMinutes: number;
  durationText: string;
  distanceKm: number;
  distanceText: string;
  trafficDurationMinutes?: number;
  trafficDurationText?: string;
  isEstimate: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    const body = await req.json();
    
    const { origin, destination, departureTime } = body as RouteRequest;
    
    // Resolve special location names
    const resolvedOrigin = origin === 'winkel' ? LOCATIONS.winkel 
      : origin === 'loods' ? LOCATIONS.loods 
      : origin;
    
    const resolvedDestination = destination === 'winkel' ? LOCATIONS.winkel 
      : destination === 'loods' ? LOCATIONS.loods 
      : destination;

    // Als geen API key, gebruik fallback geschatte tijden
    if (!GOOGLE_MAPS_API_KEY) {
      console.log('No Google Maps API key found, using estimates');
      const estimate = getEstimatedDriveTime(resolvedOrigin, resolvedDestination);
      return new Response(JSON.stringify(estimate), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build Google Maps Distance Matrix URL
    const params = new URLSearchParams({
      origins: resolvedOrigin,
      destinations: resolvedDestination,
      key: GOOGLE_MAPS_API_KEY,
      mode: 'driving',
      language: 'nl',
      units: 'metric',
    });

    // Add departure time for traffic prediction
    if (departureTime) {
      const departureTimestamp = Math.floor(new Date(departureTime).getTime() / 1000);
      // Alleen voor toekomstige tijden
      if (departureTimestamp > Math.floor(Date.now() / 1000)) {
        params.set('departure_time', departureTimestamp.toString());
        params.set('traffic_model', 'best_guess');
      }
    }

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`;
    console.log('Calling Google Maps API for route:', resolvedOrigin, '->', resolvedDestination);
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('Google Maps API error:', data);
      // Fallback naar schatting
      const estimate = getEstimatedDriveTime(resolvedOrigin, resolvedDestination);
      return new Response(JSON.stringify(estimate), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const element = data.rows[0]?.elements[0];
    if (!element || element.status !== 'OK') {
      console.error('No route found:', element);
      const estimate = getEstimatedDriveTime(resolvedOrigin, resolvedDestination);
      return new Response(JSON.stringify(estimate), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result: RouteResponse = {
      durationMinutes: Math.ceil(element.duration.value / 60),
      durationText: element.duration.text,
      distanceKm: element.distance.value / 1000,
      distanceText: element.distance.text,
      isEstimate: false,
    };

    // Add traffic duration if available
    if (element.duration_in_traffic) {
      result.trafficDurationMinutes = Math.ceil(element.duration_in_traffic.value / 60);
      result.trafficDurationText = element.duration_in_traffic.text;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in calculate-drive-time:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        isEstimate: true,
        durationMinutes: 30,
        durationText: '~30 min (schatting)',
        distanceKm: 25,
        distanceText: '~25 km',
      }),
      { 
        status: 200, // Return 200 with fallback data
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Fallback: geschatte rijtijden tussen bekende locaties
function getEstimatedDriveTime(origin: string, destination: string): RouteResponse {
  const estimates: Record<string, Record<string, { minutes: number; km: number }>> = {
    [LOCATIONS.winkel]: {
      [LOCATIONS.loods]: { minutes: 15, km: 12 },
    },
    [LOCATIONS.loods]: {
      [LOCATIONS.winkel]: { minutes: 15, km: 12 },
    },
  };

  // Check bekende routes
  if (estimates[origin]?.[destination]) {
    const est = estimates[origin][destination];
    return {
      durationMinutes: est.minutes,
      durationText: `~${est.minutes} min`,
      distanceKm: est.km,
      distanceText: `~${est.km} km`,
      isEstimate: true,
    };
  }

  // Standaard schatting: 25 km, 30 min
  return {
    durationMinutes: 30,
    durationText: '~30 min (schatting)',
    distanceKm: 25,
    distanceText: '~25 km',
    isEstimate: true,
  };
}
