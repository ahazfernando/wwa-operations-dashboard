import { Timestamp } from 'firebase/firestore';

export interface TimeEntry {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  date: Date;
  clockIn: Date | null;
  clockOut: Date | null;
  totalHours: number | null;
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
}

export interface FirestoreTimeEntry {
  userId: string;
  date: Timestamp;
  dateString?: string;
  clockIn: Timestamp | null;
  clockOut: Timestamp | null;
  totalHours: number | null;
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


