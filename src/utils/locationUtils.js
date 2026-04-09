/**
 * Calculates the distance between two GPS coordinates in meters using the Haversine formula.
 * @param {number} lat1 Latitude of first point
 * @param {number} lon1 Longitude of first point
 * @param {number} lat2 Latitude of second point
 * @param {number} lon2 Longitude of second point
 * @returns {number} Distance in meters
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radius of the earth in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Checks if a point is within a given radius of a center point.
 * @param {number} centerLat 
 * @param {number} centerLon 
 * @param {number} pointLat 
 * @param {number} pointLon 
 * @param {number} radiusMeters 
 * @returns {boolean}
 */
export function isWithinRadius(centerLat, centerLon, pointLat, pointLon, radiusMeters = 200) {
  const distance = calculateDistance(centerLat, centerLon, pointLat, pointLon);
  return distance <= radiusMeters;
}

/**
 * Checks if the current time is after a target time (format HH:MM).
 * @param {string} currentTime HH:MM:SS or HH:MM
 * @param {string} targetTime HH:MM
 * @returns {boolean}
 */
export function isLate(currentTime, targetTime) {
  const [curH, curM] = currentTime.split(':').map(Number);
  const [tarH, tarM] = targetTime.split(':').map(Number);

  if (curH > tarH) return true;
  if (curH === tarH && curM > tarM) return true;
  return false;
}
