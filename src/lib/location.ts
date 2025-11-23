/**
 * Location utility functions for capturing employee and system location
 */

export interface LocationData {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  timestamp: Date;
  address?: string;
  error?: string;
}

export interface SystemLocationData {
  timezone: string;
  timezoneOffset: number;
  language: string;
  userAgent: string;
  platform: string;
  ipAddress?: string;
  timestamp: Date;
}

/**
 * Get the user's GPS location using the browser's Geolocation API
 */
export const getEmployeeLocation = (): Promise<LocationData> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({
        latitude: null,
        longitude: null,
        accuracy: null,
        timestamp: new Date(),
        error: 'Geolocation is not supported by this browser',
      });
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000, // 10 seconds
      maximumAge: 0, // Don't use cached position
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date(),
        });
      },
      (error) => {
        let errorMessage = 'Unknown error';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'User denied the request for Geolocation';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'The request to get user location timed out';
            break;
        }
        resolve({
          latitude: null,
          longitude: null,
          accuracy: null,
          timestamp: new Date(),
          error: errorMessage,
        });
      },
      options
    );
  });
};

/**
 * Get system location information (timezone, language, etc.)
 */
export const getSystemLocation = (): SystemLocationData => {
  return {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    language: navigator.language || 'en-US',
    userAgent: navigator.userAgent,
    platform: navigator.platform || 'unknown',
    timestamp: new Date(),
  };
};

/**
 * Get both employee GPS location and system location
 * This function attempts to get GPS location but doesn't fail if it's unavailable
 */
export const getAllLocationData = async (): Promise<{
  employeeLocation: LocationData;
  systemLocation: SystemLocationData;
}> => {
  const [employeeLocation] = await Promise.all([
    getEmployeeLocation(),
    // We could add IP-based location here in the future if needed
  ]);

  const systemLocation = getSystemLocation();

  return {
    employeeLocation,
    systemLocation,
  };
};

/**
 * Calculate the distance between two coordinates using the Haversine formula
 * Returns distance in meters
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

/**
 * Check if a location is within a specified radius (in meters) of a reference location
 */
export const isWithinRadius = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  radiusMeters: number
): boolean => {
  const distance = calculateDistance(lat1, lon1, lat2, lon2);
  return distance <= radiusMeters;
};


