import { format } from 'date-fns';
import { TimeEntry, MergedTimeEntry } from './types';

export const formatTime = (date: Date | null) => {
  if (!date) return '-';
  return format(date, 'h:mm a');
};

export const formatDate = (date: Date) => {
  return format(date, 'MMM dd, yyyy');
};

// Function to merge entries by user and date
export const mergeEntriesByUserAndDate = (entries: TimeEntry[]): MergedTimeEntry[] => {
  const mergedMap = new Map<string, MergedTimeEntry>();

  entries.forEach((entry) => {
    const key = `${entry.userId}-${format(entry.date, 'yyyy-MM-dd')}`;
    
    if (!mergedMap.has(key)) {
      mergedMap.set(key, {
        userId: entry.userId,
        userName: entry.userName || 'Unknown',
        userEmail: entry.userEmail || 'N/A',
        date: entry.date,
        firstClockIn: entry.clockIn,
        lastClockOut: entry.clockOut,
        totalHours: entry.totalHours || 0,
        sessionCount: 1,
        isActive: !entry.clockOut,
        clockInLocation: entry.clockInLocation,
        clockInSystemLocation: entry.clockInSystemLocation,
      });
    } else {
      const merged = mergedMap.get(key)!;
      
      // Update first clock in (earliest) and location from first clock-in
      if (entry.clockIn && (!merged.firstClockIn || entry.clockIn < merged.firstClockIn)) {
        merged.firstClockIn = entry.clockIn;
        // Update location data from the earliest clock-in
        merged.clockInLocation = entry.clockInLocation;
        merged.clockInSystemLocation = entry.clockInSystemLocation;
      }
      
      // Update last clock out (latest)
      if (entry.clockOut && (!merged.lastClockOut || entry.clockOut > merged.lastClockOut)) {
        merged.lastClockOut = entry.clockOut;
      }
      
      // Add to total hours
      merged.totalHours += entry.totalHours || 0;
      
      // Increment session count
      merged.sessionCount += 1;
      
      // Update active status (if any entry is active, the merged entry is active)
      if (!entry.clockOut) {
        merged.isActive = true;
      }
    }
  });

  return Array.from(mergedMap.values()).sort((a, b) => {
    const dateCompare = b.date.getTime() - a.date.getTime();
    if (dateCompare !== 0) return dateCompare;
    return (a.userName || '').localeCompare(b.userName || '');
  });
};










