# Clock In/Out Location Implementation - Ready-to-Use Code

This file contains simplified, ready-to-use code examples that you can directly copy into another project.

## 1. Location Utility (location.ts)

```typescript
/**
 * Location utility functions for clock in/out system
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
 */
export const getAllLocationData = async (): Promise<{
  employeeLocation: LocationData;
  systemLocation: SystemLocationData;
}> => {
  const employeeLocation = await getEmployeeLocation();
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
```

## 2. Clock In Handler Example

```typescript
import { getAllLocationData, isWithinRadius } from './location';
import { Timestamp } from 'firebase/firestore'; // or your database timestamp utility

const handleClockIn = async (userId: string) => {
  try {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // Check if user is already clocked in
    const activeEntry = await checkActiveEntry(userId);
    if (activeEntry) {
      throw new Error('You are already clocked in');
    }

    // Capture location data
    let locationData: {
      clockInLocation?: any;
      clockInSystemLocation?: any;
    } = {};

    try {
      const { employeeLocation, systemLocation } = await getAllLocationData();
      
      // Optional: Validate work-from-home location
      if (employeeLocation.latitude && employeeLocation.longitude) {
        const workFromHomeLocation = await getWorkFromHomeLocation(userId);
        
        if (workFromHomeLocation && !workFromHomeLocation.allowWorkFromAnywhere) {
          const withinRadius = isWithinRadius(
            employeeLocation.latitude,
            employeeLocation.longitude,
            workFromHomeLocation.latitude,
            workFromHomeLocation.longitude,
            50 // 50 meters
          );

          if (!withinRadius) {
            throw new Error('You must be within 50 meters of your approved work location');
          }
        }
      }
      
      // Build clockInLocation object
      const clockInLocation: any = {
        latitude: employeeLocation.latitude,
        longitude: employeeLocation.longitude,
        accuracy: employeeLocation.accuracy,
        timestamp: Timestamp.fromDate(employeeLocation.timestamp),
      };
      
      if (employeeLocation.address !== undefined) {
        clockInLocation.address = employeeLocation.address;
      }
      if (employeeLocation.error !== undefined) {
        clockInLocation.error = employeeLocation.error;
      }
      
      locationData.clockInLocation = clockInLocation;

      // Build clockInSystemLocation object
      const clockInSystemLocation: any = {
        timezone: systemLocation.timezone,
        timezoneOffset: systemLocation.timezoneOffset,
        language: systemLocation.language,
        userAgent: systemLocation.userAgent,
        platform: systemLocation.platform,
        timestamp: Timestamp.fromDate(systemLocation.timestamp),
      };
      
      if (systemLocation.ipAddress !== undefined) {
        clockInSystemLocation.ipAddress = systemLocation.ipAddress;
      }
      
      locationData.clockInSystemLocation = clockInSystemLocation;
    } catch (locationError) {
      // Don't fail clock-in if location capture fails
      console.error('Failed to capture location:', locationError);
      // Re-throw if it's a validation error (like radius check)
      if (locationError instanceof Error && locationError.message.includes('within')) {
        throw locationError;
      }
    }

    // Save clock-in entry
    const timeEntry = {
      userId: userId,
      date: Timestamp.fromDate(today),
      dateString: format(today, 'yyyy-MM-dd'),
      clockIn: Timestamp.fromDate(now),
      clockOut: null,
      totalHours: null,
      ...locationData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    // Save to your database
    await saveTimeEntry(timeEntry);

    return {
      success: true,
      message: `Clocked in at ${format(now, 'h:mm a')}`,
      entry: timeEntry,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to clock in',
      error: error,
    };
  }
};
```

## 3. Clock Out Handler Example

```typescript
const handleClockOut = async (userId: string) => {
  try {
    const now = new Date();
    
    // Find current active entry
    const activeEntry = await getActiveEntry(userId);
    if (!activeEntry) {
      throw new Error('No active clock-in found');
    }

    const clockInTime = activeEntry.clockIn;
    if (!clockInTime) {
      throw new Error('No clock in time found');
    }

    // Calculate total hours
    const totalMs = now.getTime() - clockInTime.getTime();
    const totalHours = totalMs / (1000 * 60 * 60); // Convert to hours

    // Update entry
    await updateTimeEntry(activeEntry.id, {
      clockOut: Timestamp.fromDate(now),
      totalHours: totalHours,
      updatedAt: Timestamp.now(),
    });

    return {
      success: true,
      message: `Clocked out at ${format(now, 'h:mm a')}`,
      totalHours: totalHours,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to clock out',
      error: error,
    };
  }
};
```

## 4. React Component Example

```typescript
import React, { useState } from 'react';
import { getAllLocationData } from './location';

const ClockInOut = () => {
  const [loading, setLoading] = useState(false);
  const [isClockedIn, setIsClockedIn] = useState(false);

  const handleClockIn = async () => {
    setLoading(true);
    try {
      const result = await handleClockIn(userId);
      if (result.success) {
        setIsClockedIn(true);
        // Show success message
      } else {
        // Show error message
      }
    } catch (error) {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    setLoading(true);
    try {
      const result = await handleClockOut(userId);
      if (result.success) {
        setIsClockedIn(false);
        // Show success message
      } else {
        // Show error message
      }
    } catch (error) {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button 
        onClick={handleClockIn} 
        disabled={loading || isClockedIn}
      >
        Clock In
      </button>
      <button 
        onClick={handleClockOut} 
        disabled={loading || !isClockedIn}
      >
        Clock Out
      </button>
    </div>
  );
};
```

## 5. Database Schema (Firestore Example)

```typescript
// Collection: timeEntries
{
  userId: string,
  date: Timestamp,
  dateString: string, // "2024-01-15"
  clockIn: Timestamp,
  clockOut: Timestamp | null,
  totalHours: number | null,
  clockInLocation: {
    latitude: number | null,
    longitude: number | null,
    accuracy: number | null,
    timestamp: Timestamp,
    address?: string,
    error?: string,
  },
  clockInSystemLocation: {
    timezone: string,
    timezoneOffset: number,
    language: string,
    userAgent: string,
    platform: string,
    timestamp: Timestamp,
    ipAddress?: string,
  },
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

## 6. Helper Functions

```typescript
// Check if user has active clock-in
const checkActiveEntry = async (userId: string) => {
  const query = query(
    collection(db, 'timeEntries'),
    where('userId', '==', userId),
    where('clockOut', '==', null)
  );
  const snapshot = await getDocs(query);
  return snapshot.docs[0] || null;
};

// Get work-from-home location (optional)
const getWorkFromHomeLocation = async (userId: string) => {
  const doc = await getDoc(doc(db, 'workFromHomeLocations', userId));
  if (doc.exists() && doc.data().status === 'approved') {
    return doc.data();
  }
  return null;
};
```

## 7. Environment Setup

### Required Browser APIs:
- `navigator.geolocation` - For GPS location
- `Intl.DateTimeFormat` - For timezone detection

### HTTPS Required:
- Geolocation API only works on HTTPS (or localhost for development)

### Permissions:
- Browser will prompt user for location permission on first use
- Handle permission denial gracefully

## 8. Error Handling Best Practices

```typescript
// Always wrap location capture in try-catch
try {
  const { employeeLocation, systemLocation } = await getAllLocationData();
  // Use location data
} catch (error) {
  // Log error but don't block clock-in
  console.error('Location capture failed:', error);
  // Continue with clock-in without location
}

// For validation errors, you might want to block clock-in
if (locationError.message.includes('within')) {
  throw locationError; // Block clock-in
}
```

## Quick Start Checklist

- [ ] Copy `location.ts` utility file
- [ ] Implement `handleClockIn` function
- [ ] Implement `handleClockOut` function
- [ ] Set up database schema
- [ ] Create React component (or your framework equivalent)
- [ ] Test on HTTPS (or localhost)
- [ ] Handle location permission prompts
- [ ] Add error handling
- [ ] Optional: Add work-from-home validation
- [ ] Optional: Add reverse geocoding for addresses

## Notes

1. **Location is optional**: Clock-in should work even if location fails
2. **User experience**: Show clear messages about location permission
3. **Privacy**: Inform users why location is needed
4. **Performance**: Location capture adds ~1-2 seconds to clock-in
5. **Mobile**: Works well on mobile devices with GPS
