import { LoadUnloadInstruction } from '@/hooks/useLoadUnloadInstructions';
import { estimateLoadUnloadTime, needsTrailer } from '@/utils/driverScheduleCalculator';

/**
 * Calculate the effective shop-side load/unload time for a specific driver.
 * Only includes time from instructions where the driver is listed as a helper.
 * If the driver is NOT in the helper list for an instruction, that duration
 * is excluded from their work time.
 */
export function calculateDriverShopTime(params: {
  instructions: LoadUnloadInstruction[];
  assignmentId: string;
  action: 'laden' | 'lossen';
  driverId: string | null | undefined;
  segment: 'leveren' | 'ophalen';
  transportId: string;
  location?: 'winkel' | 'loods'; // optional: filter by location
}): number {
  const { instructions, assignmentId, action, driverId, segment, transportId, location } = params;

  if (!driverId) return 0;

  let relevant = instructions.filter(
    i => i.assignmentId === assignmentId && i.action === action && i.location !== 'blijft_staan'
  );

  // Filter by location if specified
  if (location) {
    relevant = relevant.filter(i => i.location === location);
  }

  if (relevant.length === 0) return 0;

  // Sum vehicle counts from instructions where this driver participates
  const driverVehicleCount = relevant
    .filter(i => (i.helperDriverIds || []).includes(driverId))
    .reduce((sum, i) => sum + i.vehicleCount, 0);

  if (driverVehicleCount === 0) return 0;

  const hasTrailer = needsTrailer(transportId);

  return estimateLoadUnloadTime({
    segment,
    vehicleCount: driverVehicleCount,
    hasTrailer,
  });
}
