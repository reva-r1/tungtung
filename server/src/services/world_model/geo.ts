/**
 * Geospatial computation utilities for Revana World Model.
 * Provides spherical trigonometry (Haversine) and geometric distance to polylines / polygons.
 */

const EARTH_RADIUS_KM = 6371.0;

/**
 * Calculates the great-circle distance between two points on the Earth's surface
 * using the Haversine formula.
 *
 * @param lat1 Latitude of point 1 (decimal degrees)
 * @param lon1 Longitude of point 1 (decimal degrees)
 * @param lat2 Latitude of point 2 (decimal degrees)
 * @param lon2 Longitude of point 2 (decimal degrees)
 * @returns Distance in kilometers
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const radLat1 = (lat1 * Math.PI) / 180;
  const radLat2 = (lat2 * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

export type GeoPoint = [number, number] | { lat: number; lon: number };

function extractCoords(pt: GeoPoint): { lat: number; lon: number } {
  if (Array.isArray(pt)) {
    return { lat: pt[0], lon: pt[1] };
  }
  return { lat: pt.lat, lon: pt.lon };
}

/**
 * Calculates the shortest distance from a point to a geodesic line segment (A -> B).
 * Uses equirectangular projection onto the segment's local tangent plane, suitable for
 * local and regional corridor segments.
 *
 * @returns Distance in kilometers and closest interpolated point on segment
 */
export function pointToSegmentDistance(
  pLat: number,
  pLon: number,
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number
): { distanceKm: number; nearestPoint: { lat: number; lon: number } } {
  // If segment endpoints are identical, return distance to point A
  const segLength = haversineDistance(aLat, aLon, bLat, bLon);
  if (segLength < 1e-6) {
    return {
      distanceKm: haversineDistance(pLat, pLon, aLat, aLon),
      nearestPoint: { lat: aLat, lon: aLon },
    };
  }

  // Local equirectangular planar projection around segment midpoint
  const midLatRad = (((aLat + bLat) / 2) * Math.PI) / 180;
  const cosMidLat = Math.cos(midLatRad);

  const dx = ((bLon - aLon) * Math.PI / 180) * cosMidLat;
  const dy = ((bLat - aLat) * Math.PI) / 180;

  const px = ((pLon - aLon) * Math.PI / 180) * cosMidLat;
  const py = ((pLat - aLat) * Math.PI) / 180;

  const dot = px * dx + py * dy;
  const lenSq = dx * dx + dy * dy;

  // Clamp projection factor t to [0, 1] to stay within segment bounds
  const t = Math.max(0, Math.min(1, dot / (lenSq || 1e-12)));

  const nearestLat = aLat + t * (bLat - aLat);
  const nearestLon = aLon + t * (bLon - aLon);

  return {
    distanceKm: haversineDistance(pLat, pLon, nearestLat, nearestLon),
    nearestPoint: { lat: nearestLat, lon: nearestLon },
  };
}

/**
 * Calculates the minimum distance from a query point to any segment of a polyline.
 *
 * @param pLat Point latitude
 * @param pLon Point longitude
 * @param polyline Array of points defining the polyline path
 * @returns Shortest distance in kilometers and the closest point on the polyline
 */
export function pointToPolylineDistance(
  pLat: number,
  pLon: number,
  polyline: GeoPoint[]
): { distanceKm: number; nearestPoint: { lat: number; lon: number }; segmentIndex: number } {
  if (!polyline || polyline.length === 0) {
    throw new Error('Polyline must contain at least one point.');
  }

  if (polyline.length === 1) {
    const pt = extractCoords(polyline[0]);
    return {
      distanceKm: haversineDistance(pLat, pLon, pt.lat, pt.lon),
      nearestPoint: pt,
      segmentIndex: 0,
    };
  }

  let minDistance = Infinity;
  let closestPoint = extractCoords(polyline[0]);
  let closestSegment = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = extractCoords(polyline[i]);
    const b = extractCoords(polyline[i + 1]);

    const result = pointToSegmentDistance(pLat, pLon, a.lat, a.lon, b.lat, b.lon);
    if (result.distanceKm < minDistance) {
      minDistance = result.distanceKm;
      closestPoint = result.nearestPoint;
      closestSegment = i;
    }
  }

  return {
    distanceKm: minDistance,
    nearestPoint: closestPoint,
    segmentIndex: closestSegment,
  };
}

/**
 * Checks whether a point is within a circular radius of a center coordinate.
 */
export function isPointInRadius(
  pLat: number,
  pLon: number,
  centerLat: number,
  centerLon: number,
  radiusKm: number
): { inRange: boolean; distanceKm: number } {
  const d = haversineDistance(pLat, pLon, centerLat, centerLon);
  return {
    inRange: d <= radiusKm,
    distanceKm: d,
  };
}

/**
 * Checks whether a point is within a rectangular bounding box.
 */
export function isPointInBoundingBox(
  pLat: number,
  pLon: number,
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number }
): boolean {
  return (
    pLat >= bbox.minLat &&
    pLat <= bbox.maxLat &&
    pLon >= bbox.minLon &&
    pLon <= bbox.maxLon
  );
}
