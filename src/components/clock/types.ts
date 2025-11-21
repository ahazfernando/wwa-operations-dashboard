import { Timestamp } from 'firebase/firestore';
import { LocationData, SystemLocationData } from '@/lib/location';

export interface TimeEntry {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  date: Date;
  clockIn: Date | null;
  clockOut: Date | null;
  totalHours: number | null;
  clockInLocation?: LocationData;
  clockInSystemLocation?: SystemLocationData;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActiveUser {
  userId: string;
  userName: string;
  userEmail: string;
  clockInTime: Date;
  entryId: string;
}

export interface MergedTimeEntry {
  userId: string;
  userName: string;
  userEmail: string;
  date: Date;
  firstClockIn: Date | null;
  lastClockOut: Date | null;
  totalHours: number;
  sessionCount: number;
  isActive: boolean;
  clockInLocation?: LocationData;
  clockInSystemLocation?: SystemLocationData;
}

export interface FirestoreTimeEntry {
  userId: string;
  date: Timestamp;
  dateString?: string;
  clockIn: Timestamp | null;
  clockOut: Timestamp | null;
  totalHours: number | null;
  clockInLocation?: {
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
    timestamp: Timestamp;
    address?: string;
    error?: string;
  };
  clockInSystemLocation?: {
    timezone: string;
    timezoneOffset: number;
    language: string;
    userAgent: string;
    platform: string;
    ipAddress?: string;
    timestamp: Timestamp;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Type guard function to ensure data is properly typed
export const getTimeEntryData = (data: unknown): FirestoreTimeEntry => {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid time entry data');
  }
  return data as FirestoreTimeEntry;
};










