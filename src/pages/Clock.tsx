"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Clock as ClockIcon, LogIn, LogOut, Calendar as CalendarIcon, Plus, Loader2, Users, Activity, Search, Edit, UserPlus, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { type DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { collection, query, where, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { sendClockInEmailsToAdmins } from '@/lib/email';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from '@/components/ui/pagination';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface TimeEntry {
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

interface ActiveUser {
  userId: string;
  userName: string;
  userEmail: string;
  clockInTime: Date;
  entryId: string;
}

interface MergedTimeEntry {
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

interface FirestoreTimeEntry {
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
const getTimeEntryData = (data: unknown): FirestoreTimeEntry => {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid time entry data');
  }
  return data as FirestoreTimeEntry;
};

const Clock = () => {
  const { user, getAllUsers } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<TimeEntry | null>(null);
  const [openManualEntry, setOpenManualEntry] = useState(false);
  const [manualDate, setManualDate] = useState<Date>(new Date());
  const [manualClockIn, setManualClockIn] = useState('');
  const [manualClockOut, setManualClockOut] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Date range for regular user time entries
  const [userDateRange, setUserDateRange] = useState<DateRange | undefined>(undefined);
  
  // Admin view states
  const [allUsersEntries, setAllUsersEntries] = useState<TimeEntry[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'most' | 'least' | 'none'>('none');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [individualEntriesPage, setIndividualEntriesPage] = useState(1);
  const [mergedEntriesPage, setMergedEntriesPage] = useState(1);
  const [sessionDetailsOpen, setSessionDetailsOpen] = useState(false);
  const [selectedUserSessions, setSelectedUserSessions] = useState<TimeEntry[]>([]);
  const [selectedUserInfo, setSelectedUserInfo] = useState<{ name: string; email: string; date: Date } | null>(null);
  
  // Admin edit states
  const [editEntryOpen, setEditEntryOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [editingSessionNumber, setEditingSessionNumber] = useState<number | null>(null);
  const [editClockIn, setEditClockIn] = useState('');
  const [editClockOut, setEditClockOut] = useState('');
  const [editDate, setEditDate] = useState<Date>(new Date());
  
  // Admin clock in/out for other users
  const [clockUserDialogOpen, setClockUserDialogOpen] = useState(false);
  const [selectedUserForClock, setSelectedUserForClock] = useState<{ id: string; name: string; email: string } | null>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  
  // Admin delete session states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<TimeEntry | null>(null);

  useEffect(() => {
    // Update current time every second
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user) {
      loadTimeEntries();
      checkCurrentStatus();
      if (user.role === 'admin') {
        loadAllUsersEntries();
        loadActiveUsers();
      }
    }
  }, [user, userDateRange]);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadAllUsersEntries();
    }
  }, [dateRange, user]);

  const checkCurrentStatus = async () => {
    if (!user) return;

    try {
      // Query all entries for the user to find any active clock-in
      // This ensures we find active entries even after midnight when the date changes
      const q = query(
        collection(db, 'timeEntries'),
        where('userId', '==', user.id)
      );

      const querySnapshot = await getDocs(q);
      
      // Find the active entry (clocked in but not clocked out)
      // Check all entries regardless of date to handle clock-ins that span midnight
      let activeEntryDoc: { id: string; data: FirestoreTimeEntry } | null = null;
      for (const docSnapshot of querySnapshot.docs) {
        const entry = getTimeEntryData(docSnapshot.data());
        if (entry.clockIn && !entry.clockOut) {
          activeEntryDoc = { id: docSnapshot.id, data: entry };
          break; // Found the active entry
        }
      }

      if (activeEntryDoc) {
        const entry = activeEntryDoc.data;
        setIsClockedIn(true);
        setCurrentEntry({
          id: activeEntryDoc.id,
          userId: entry.userId,
          date: entry.date.toDate(),
          clockIn: entry.clockIn.toDate(),
          clockOut: entry.clockOut?.toDate() || null,
          totalHours: entry.totalHours || null,
          createdAt: entry.createdAt.toDate(),
          updatedAt: entry.updatedAt.toDate(),
        });
      } else {
        setIsClockedIn(false);
        setCurrentEntry(null);
      }
    } catch (error) {
      console.error('Error checking status:', error);
    }
  };

  const loadTimeEntries = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Fetch all entries for user (we'll filter by date range client-side)
      const q = query(
        collection(db, 'timeEntries'),
        where('userId', '==', user.id)
      );

      const querySnapshot = await getDocs(q);
      let entries: TimeEntry[] = querySnapshot.docs.map((doc) => {
        const data = getTimeEntryData(doc.data());
        return {
          id: doc.id,
          userId: data.userId,
          date: data.date.toDate(),
          clockIn: data.clockIn?.toDate() || null,
          clockOut: data.clockOut?.toDate() || null,
          totalHours: data.totalHours || null,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        };
      });

      // Filter by date range if specified
      if (userDateRange?.from || userDateRange?.to) {
        entries = entries.filter(entry => {
          const entryDate = new Date(entry.date);
          entryDate.setHours(0, 0, 0, 0);
          
          if (userDateRange.from && userDateRange.to) {
            const fromDate = new Date(userDateRange.from);
            fromDate.setHours(0, 0, 0, 0);
            const toDate = new Date(userDateRange.to);
            toDate.setHours(23, 59, 59, 999);
            return entryDate >= fromDate && entryDate <= toDate;
          } else if (userDateRange.from) {
            const fromDate = new Date(userDateRange.from);
            fromDate.setHours(0, 0, 0, 0);
            return entryDate >= fromDate;
          } else if (userDateRange.to) {
            const toDate = new Date(userDateRange.to);
            toDate.setHours(23, 59, 59, 999);
            return entryDate <= toDate;
          }
          return true;
        });
      }

      // Sort by date descending (newest first)
      entries.sort((a, b) => b.date.getTime() - a.date.getTime());

      setTimeEntries(entries);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load time entries',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async () => {
    if (!user) return;

    try {
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      // Check if there's already an active entry (clocked in but not clocked out)
      // Query all entries to handle clock-ins that span midnight
      const dateString = format(today, 'yyyy-MM-dd');

      const q = query(
        collection(db, 'timeEntries'),
        where('userId', '==', user.id)
      );

      const querySnapshot = await getDocs(q);
      
      // Check if user is already clocked in (has an entry with clockIn but no clockOut)
      // Check all entries regardless of date to prevent duplicate clock-ins after midnight
      const activeEntry = querySnapshot.docs.find(doc => {
        try {
          const data = getTimeEntryData(doc.data());
          return data.clockIn && !data.clockOut;
        } catch {
          return false;
        }
      });

      if (activeEntry) {
        toast({
          title: 'Already Clocked In',
          description: 'You are already clocked in. Please clock out first.',
          variant: 'destructive',
        });
        return;
      }

      // Always create a new entry for each clock in (supports multiple clock in/out cycles per day)
      await addDoc(collection(db, 'timeEntries'), {
        userId: user.id,
        date: Timestamp.fromDate(today),
        dateString: dateString,
        clockIn: Timestamp.fromDate(now),
        clockOut: null,
        totalHours: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Send email notifications to admin users
      try {
        const allUsers = await getAllUsers();
        const adminUsers = allUsers.filter((u: any) => u.role === 'admin' && u.email);
        const adminEmails = adminUsers.map((u: any) => u.email).filter(Boolean);
        
        if (adminEmails.length > 0) {
          sendClockInEmailsToAdmins(
            user.name || user.email,
            user.email,
            now,
            adminEmails
          );
        }
      } catch (emailError) {
        // Don't fail the clock-in if email fails
        console.error('Failed to send clock-in email notifications:', emailError);
      }

      toast({
        title: 'Clocked In',
        description: `Clocked in at ${format(now, 'h:mm a')}`,
      });

      await checkCurrentStatus();
      await loadTimeEntries();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to clock in',
        variant: 'destructive',
      });
    }
  };

  const handleClockOut = async () => {
    if (!user || !currentEntry) return;

    try {
      const now = new Date();
      const clockInTime = currentEntry.clockIn;
      
      if (!clockInTime) {
        toast({
          title: 'Error',
          description: 'No clock in time found',
          variant: 'destructive',
        });
        return;
      }

      const totalHours = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

      await updateDoc(doc(db, 'timeEntries', currentEntry.id), {
        clockOut: Timestamp.fromDate(now),
        totalHours: Math.round(totalHours * 100) / 100,
        updatedAt: serverTimestamp(),
      });

      toast({
        title: 'Clocked Out',
        description: `Clocked out at ${format(now, 'h:mm a')}. Total hours: ${Math.round(totalHours * 100) / 100}h`,
      });

      setIsClockedIn(false);
      setCurrentEntry(null);
      await checkCurrentStatus(); // Refresh status to ensure UI is in sync
      await loadTimeEntries();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to clock out',
        variant: 'destructive',
      });
    }
  };

  const handleManualEntry = async () => {
    if (!user) return;

    if (!manualClockIn || !manualClockOut) {
      toast({
        title: 'Error',
        description: 'Please fill in both clock in and clock out times',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const entryDate = new Date(manualDate);
      entryDate.setHours(0, 0, 0, 0);

      // Parse times
      const [clockInHour, clockInMin] = manualClockIn.split(':').map(Number);
      const [clockOutHour, clockOutMin] = manualClockOut.split(':').map(Number);

      const clockIn = new Date(entryDate);
      clockIn.setHours(clockInHour, clockInMin, 0, 0);

      const clockOut = new Date(entryDate);
      clockOut.setHours(clockOutHour, clockOutMin, 0, 0);

      if (clockOut <= clockIn) {
        toast({
          title: 'Error',
          description: 'Clock out time must be after clock in time',
          variant: 'destructive',
        });
        return;
      }

      const totalHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);

      // Check if entry already exists for this date using dateString
      const dateString = format(entryDate, 'yyyy-MM-dd');

      const q = query(
        collection(db, 'timeEntries'),
        where('userId', '==', user.id),
        where('dateString', '==', dateString)
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // Update existing entry
        await updateDoc(doc(db, 'timeEntries', querySnapshot.docs[0].id), {
          dateString: dateString, // Ensure dateString is set
          clockIn: Timestamp.fromDate(clockIn),
          clockOut: Timestamp.fromDate(clockOut),
          totalHours: Math.round(totalHours * 100) / 100,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create new entry
        await addDoc(collection(db, 'timeEntries'), {
          userId: user.id,
          date: Timestamp.fromDate(entryDate),
          dateString: dateString, // Add dateString for easier querying
          clockIn: Timestamp.fromDate(clockIn),
          clockOut: Timestamp.fromDate(clockOut),
          totalHours: Math.round(totalHours * 100) / 100,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      toast({
        title: 'Entry Added',
        description: `Time entry added for ${format(entryDate, 'MMM dd, yyyy')}`,
      });

      setOpenManualEntry(false);
      setManualClockIn('');
      setManualClockOut('');
      await loadTimeEntries();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add entry',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (date: Date | null) => {
    if (!date) return '-';
    return format(date, 'h:mm a');
  };

  const formatDate = (date: Date) => {
    return format(date, 'MMM dd, yyyy');
  };

  // Function to show session details for a user
  const handleShowSessions = (userId: string, userName: string, userEmail: string, date: Date) => {
    // Filter entries for this specific user and date
    const userSessions = allUsersEntries.filter(entry => {
      const entryDate = format(entry.date, 'yyyy-MM-dd');
      const targetDate = format(date, 'yyyy-MM-dd');
      return entry.userId === userId && entryDate === targetDate;
    });
    
    // Sort by clock in time
    userSessions.sort((a, b) => {
      if (!a.clockIn || !b.clockIn) return 0;
      return a.clockIn.getTime() - b.clockIn.getTime();
    });
    
    setSelectedUserSessions(userSessions);
    setSelectedUserInfo({ name: userName, email: userEmail, date });
    setSessionDetailsOpen(true);
  };

  // Function to open edit dialog for an entry
  const handleEditEntry = (entry: TimeEntry, sessionNumber?: number) => {
    setEditingEntry(entry);
    setEditingSessionNumber(sessionNumber || null);
    setEditDate(entry.date);
    
    // Format times for input fields (HH:MM format)
    if (entry.clockIn) {
      const hours = entry.clockIn.getHours().toString().padStart(2, '0');
      const minutes = entry.clockIn.getMinutes().toString().padStart(2, '0');
      setEditClockIn(`${hours}:${minutes}`);
    } else {
      setEditClockIn('');
    }
    
    if (entry.clockOut) {
      const hours = entry.clockOut.getHours().toString().padStart(2, '0');
      const minutes = entry.clockOut.getMinutes().toString().padStart(2, '0');
      setEditClockOut(`${hours}:${minutes}`);
    } else {
      setEditClockOut('');
    }
    
    setEditEntryOpen(true);
  };

  // Function to save edited entry
  const handleSaveEdit = async () => {
    if (!editingEntry || !user || user.role !== 'admin') return;

    if (!editClockIn) {
      toast({
        title: 'Error',
        description: 'Clock in time is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const entryDate = new Date(editDate);
      entryDate.setHours(0, 0, 0, 0);

      // Parse times
      const [clockInHour, clockInMin] = editClockIn.split(':').map(Number);
      const clockIn = new Date(entryDate);
      clockIn.setHours(clockInHour, clockInMin, 0, 0);

      let clockOut: Date | null = null;
      let totalHours: number | null = null;

      if (editClockOut) {
        const [clockOutHour, clockOutMin] = editClockOut.split(':').map(Number);
        clockOut = new Date(entryDate);
        clockOut.setHours(clockOutHour, clockOutMin, 0, 0);

        if (clockOut <= clockIn) {
          toast({
            title: 'Error',
            description: 'Clock out time must be after clock in time',
            variant: 'destructive',
          });
          return;
        }

        totalHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
      }

      const dateString = format(entryDate, 'yyyy-MM-dd');

      await updateDoc(doc(db, 'timeEntries', editingEntry.id), {
        date: Timestamp.fromDate(entryDate),
        dateString: dateString,
        clockIn: Timestamp.fromDate(clockIn),
        clockOut: clockOut ? Timestamp.fromDate(clockOut) : null,
        totalHours: totalHours ? Math.round(totalHours * 100) / 100 : null,
        updatedAt: serverTimestamp(),
      });

      toast({
        title: 'Success',
        description: 'Time entry updated successfully',
      });

      setEditEntryOpen(false);
      setEditingEntry(null);
      setEditingSessionNumber(null);
      setEditClockIn('');
      setEditClockOut('');
      await loadAllUsersEntries();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update entry',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Function to handle delete session
  const handleDeleteSession = async () => {
    if (!sessionToDelete || !user || user.role !== 'admin') return;

    try {
      setSubmitting(true);
      await deleteDoc(doc(db, 'timeEntries', sessionToDelete.id));

      toast({
        title: 'Success',
        description: 'Session deleted successfully',
      });

      setDeleteDialogOpen(false);
      setSessionToDelete(null);
      
      // Refresh data
      await loadAllUsersEntries();
      await loadActiveUsers();
      
      // If the session was in the currently displayed sessions, refresh them
      if (selectedUserInfo) {
        const dateString = format(selectedUserInfo.date, 'yyyy-MM-dd');
        const q = query(
          collection(db, 'timeEntries'),
          where('userId', '==', sessionToDelete.userId),
          where('dateString', '==', dateString)
        );
        const querySnapshot = await getDocs(q);
        const sessions: TimeEntry[] = querySnapshot.docs.map((doc) => {
          const data = getTimeEntryData(doc.data());
          return {
            id: doc.id,
            userId: data.userId,
            date: data.date.toDate(),
            clockIn: data.clockIn?.toDate() || null,
            clockOut: data.clockOut?.toDate() || null,
            totalHours: data.totalHours || null,
            createdAt: data.createdAt.toDate(),
            updatedAt: data.updatedAt.toDate(),
          };
        });
        // Sort client-side by clockIn time
        sessions.sort((a, b) => {
          if (!a.clockIn && !b.clockIn) return 0;
          if (!a.clockIn) return 1;
          if (!b.clockIn) return -1;
          return a.clockIn.getTime() - b.clockIn.getTime();
        });
        setSelectedUserSessions(sessions);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete session',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Function to clock in/out for another user
  const handleClockUser = async (action: 'in' | 'out') => {
    if (!selectedUserForClock || !user || user.role !== 'admin') return;

    try {
      setSubmitting(true);
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const dateString = format(today, 'yyyy-MM-dd');

      if (action === 'in') {
        // Check if user is already clocked in
        // Query all entries to handle clock-ins that span midnight
        const q = query(
          collection(db, 'timeEntries'),
          where('userId', '==', selectedUserForClock.id)
        );

        const querySnapshot = await getDocs(q);
        const activeEntry = querySnapshot.docs.find(doc => {
          try {
            const data = getTimeEntryData(doc.data());
            return data.clockIn && !data.clockOut;
          } catch {
            return false;
          }
        });

        if (activeEntry) {
          toast({
            title: 'Already Clocked In',
            description: 'User is already clocked in. Please clock out first.',
            variant: 'destructive',
          });
          return;
        }

        await addDoc(collection(db, 'timeEntries'), {
          userId: selectedUserForClock.id,
          date: Timestamp.fromDate(today),
          dateString: dateString,
          clockIn: Timestamp.fromDate(now),
          clockOut: null,
          totalHours: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Send email notifications to admin users (excluding the admin who performed the action)
        try {
          const allUsers = await getAllUsers();
          const adminUsers = allUsers.filter((u: any) => u.role === 'admin' && u.email && u.id !== user.id);
          const adminEmails = adminUsers.map((u: any) => u.email).filter(Boolean);
          
          if (adminEmails.length > 0) {
            sendClockInEmailsToAdmins(
              selectedUserForClock.name,
              selectedUserForClock.email,
              now,
              adminEmails
            );
          }
        } catch (emailError) {
          // Don't fail the clock-in if email fails
          console.error('Failed to send clock-in email notifications:', emailError);
        }

        toast({
          title: 'Success',
          description: `Clocked in ${selectedUserForClock.name} at ${format(now, 'h:mm a')}`,
        });
      } else {
        // Clock out - find active entry
        // Query all entries to handle clock-ins that span midnight
        const q = query(
          collection(db, 'timeEntries'),
          where('userId', '==', selectedUserForClock.id)
        );

        const querySnapshot = await getDocs(q);
        const activeEntryDoc = querySnapshot.docs.find(doc => {
          try {
            const data = getTimeEntryData(doc.data());
            return data.clockIn && !data.clockOut;
          } catch {
            return false;
          }
        });

        if (!activeEntryDoc) {
          toast({
            title: 'Error',
            description: 'User is not currently clocked in',
            variant: 'destructive',
          });
          return;
        }

        const entry = getTimeEntryData(activeEntryDoc.data());
        const clockInTime = entry.clockIn!.toDate();
        const totalHours = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

        await updateDoc(doc(db, 'timeEntries', activeEntryDoc.id), {
          clockOut: Timestamp.fromDate(now),
          totalHours: Math.round(totalHours * 100) / 100,
          updatedAt: serverTimestamp(),
        });

        toast({
          title: 'Success',
          description: `Clocked out ${selectedUserForClock.name} at ${format(now, 'h:mm a')}. Total hours: ${Math.round(totalHours * 100) / 100}h`,
        });
      }

      setClockUserDialogOpen(false);
      setSelectedUserForClock(null);
      await loadAllUsersEntries();
      await loadActiveUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || `Failed to clock ${action === 'in' ? 'in' : 'out'}`,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Function to clock out a user by entry ID (for active users)
  const handleClockOutByEntry = async (entryId: string, userId: string, userName: string) => {
    if (!user || user.role !== 'admin') return;

    try {
      setSubmitting(true);
      const now = new Date();
      
      const entryDoc = await getDoc(doc(db, 'timeEntries', entryId));
      if (!entryDoc.exists()) {
        toast({
          title: 'Error',
          description: 'Entry not found',
          variant: 'destructive',
        });
        return;
      }

      const entry = getTimeEntryData(entryDoc.data());
      if (!entry.clockIn) {
        toast({
          title: 'Error',
          description: 'No clock in time found',
          variant: 'destructive',
        });
        return;
      }

      const clockInTime = entry.clockIn.toDate();
      const totalHours = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

      await updateDoc(doc(db, 'timeEntries', entryId), {
        clockOut: Timestamp.fromDate(now),
        totalHours: Math.round(totalHours * 100) / 100,
        updatedAt: serverTimestamp(),
      });

      toast({
        title: 'Success',
        description: `Clocked out ${userName} at ${format(now, 'h:mm a')}. Total hours: ${Math.round(totalHours * 100) / 100}h`,
      });

      await loadAllUsersEntries();
      await loadActiveUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to clock out',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Function to clock in a user by user ID
  const handleClockInUser = async (userId: string, userName: string) => {
    if (!user || user.role !== 'admin') return;

    try {
      setSubmitting(true);
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const dateString = format(today, 'yyyy-MM-dd');

      // Check if user is already clocked in
      // Query all entries to handle clock-ins that span midnight
      const q = query(
        collection(db, 'timeEntries'),
        where('userId', '==', userId)
      );

      const querySnapshot = await getDocs(q);
      const activeEntry = querySnapshot.docs.find(doc => {
        try {
          const data = getTimeEntryData(doc.data());
          return data.clockIn && !data.clockOut;
        } catch {
          return false;
        }
      });

      if (activeEntry) {
        toast({
          title: 'Already Clocked In',
          description: 'User is already clocked in. Please clock out first.',
          variant: 'destructive',
        });
        return;
      }

      await addDoc(collection(db, 'timeEntries'), {
        userId: userId,
        date: Timestamp.fromDate(today),
        dateString: dateString,
        clockIn: Timestamp.fromDate(now),
        clockOut: null,
        totalHours: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Send email notifications to admin users (excluding the admin who performed the action)
      try {
        const allUsers = await getAllUsers();
        const adminUsers = allUsers.filter((u: any) => u.role === 'admin' && u.email && u.id !== user.id);
        const adminEmails = adminUsers.map((u: any) => u.email).filter(Boolean);
        
        // Get the clocked-in user's email
        const clockedInUser = allUsers.find((u: any) => u.id === userId);
        const clockedInUserEmail = clockedInUser?.email || '';
        
        if (adminEmails.length > 0) {
          sendClockInEmailsToAdmins(
            userName,
            clockedInUserEmail,
            now,
            adminEmails
          );
        }
      } catch (emailError) {
        // Don't fail the clock-in if email fails
        console.error('Failed to send clock-in email notifications:', emailError);
      }

      toast({
        title: 'Success',
        description: `Clocked in ${userName} at ${format(now, 'h:mm a')}`,
      });

      await loadAllUsersEntries();
      await loadActiveUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to clock in',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Function to clock out a user by user ID
  const handleClockOutUser = async (userId: string, userName: string) => {
    if (!user || user.role !== 'admin') return;

    try {
      setSubmitting(true);
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const dateString = format(today, 'yyyy-MM-dd');

      // Find active entry
      // Query all entries to handle clock-ins that span midnight
      const q = query(
        collection(db, 'timeEntries'),
        where('userId', '==', userId)
      );

      const querySnapshot = await getDocs(q);
      const activeEntryDoc = querySnapshot.docs.find(doc => {
        try {
          const data = getTimeEntryData(doc.data());
          return data.clockIn && !data.clockOut;
        } catch {
          return false;
        }
      });

      if (!activeEntryDoc) {
        toast({
          title: 'Error',
          description: 'User is not currently clocked in',
          variant: 'destructive',
        });
        return;
      }

      const entry = getTimeEntryData(activeEntryDoc.data());
      const clockInTime = entry.clockIn!.toDate();
      const totalHours = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

      await updateDoc(doc(db, 'timeEntries', activeEntryDoc.id), {
        clockOut: Timestamp.fromDate(now),
        totalHours: Math.round(totalHours * 100) / 100,
        updatedAt: serverTimestamp(),
      });

      toast({
        title: 'Success',
        description: `Clocked out ${userName} at ${format(now, 'h:mm a')}. Total hours: ${Math.round(totalHours * 100) / 100}h`,
      });

      await loadAllUsersEntries();
      await loadActiveUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to clock out',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Function to merge entries by user and date
  const mergeEntriesByUserAndDate = (entries: TimeEntry[]): MergedTimeEntry[] => {
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
        });
      } else {
        const merged = mergedMap.get(key)!;
        
        // Update first clock in (earliest)
        if (entry.clockIn && (!merged.firstClockIn || entry.clockIn < merged.firstClockIn)) {
          merged.firstClockIn = entry.clockIn;
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

  const loadAllUsersEntries = async () => {
    if (!user || user.role !== 'admin') return;

    try {
      setLoadingAdmin(true);
      const users = await getAllUsers();
      const userMap = new Map(users.map(u => [u.id, { name: u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email, email: u.email }]));

      // Get all entries and filter by date range client-side
      // Firestore doesn't support range queries on dateString, so we fetch all and filter
      const q = query(
        collection(db, 'timeEntries'),
        orderBy('dateString', 'desc')
      );

      const querySnapshot = await getDocs(q);
      let entries: TimeEntry[] = querySnapshot.docs.map((doc) => {
        const data = getTimeEntryData(doc.data());
        const userInfo = userMap.get(data.userId) || { name: 'Unknown', email: 'N/A' };
        return {
          id: doc.id,
          userId: data.userId,
          userName: userInfo.name,
          userEmail: userInfo.email,
          date: data.date.toDate(),
          clockIn: data.clockIn?.toDate() || null,
          clockOut: data.clockOut?.toDate() || null,
          totalHours: data.totalHours || null,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        };
      });

      // Filter by date range if specified
      if (dateRange?.from || dateRange?.to) {
        entries = entries.filter((entry) => {
          const entryDate = new Date(entry.date);
          entryDate.setHours(0, 0, 0, 0);
          
          if (dateRange.from && dateRange.to) {
            const fromDate = new Date(dateRange.from);
            fromDate.setHours(0, 0, 0, 0);
            const toDate = new Date(dateRange.to);
            toDate.setHours(23, 59, 59, 999);
            return entryDate >= fromDate && entryDate <= toDate;
          } else if (dateRange.from) {
            const fromDate = new Date(dateRange.from);
            fromDate.setHours(0, 0, 0, 0);
            return entryDate >= fromDate;
          } else if (dateRange.to) {
            const toDate = new Date(dateRange.to);
            toDate.setHours(23, 59, 59, 999);
            return entryDate <= toDate;
          }
          return true;
        });
      }

      // Sort by date descending, then by user name
      entries.sort((a, b) => {
        const dateCompare = b.date.getTime() - a.date.getTime();
        if (dateCompare !== 0) return dateCompare;
        return (a.userName || '').localeCompare(b.userName || '');
      });

      setAllUsersEntries(entries);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load all users entries',
        variant: 'destructive',
      });
    } finally {
      setLoadingAdmin(false);
    }
  };

  const loadActiveUsers = async () => {
    if (!user || user.role !== 'admin') return;

    try {
      // Get all time entries to find active users regardless of date
      // This ensures we show users who are still clocked in after midnight
      const q = query(
        collection(db, 'timeEntries')
      );

      const querySnapshot = await getDocs(q);
      const users = await getAllUsers();
      const userMap = new Map(users.map(u => [u.id, { name: u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email, email: u.email }]));

      const active: ActiveUser[] = [];
      querySnapshot.docs.forEach((doc) => {
        try {
          const data = getTimeEntryData(doc.data());
          // Check if user is clocked in but not clocked out
          if (data.clockIn && !data.clockOut) {
            const userInfo = userMap.get(data.userId);
            if (userInfo) {
              active.push({
                userId: data.userId,
                userName: userInfo.name,
                userEmail: userInfo.email,
                clockInTime: data.clockIn.toDate(),
                entryId: doc.id,
              });
            }
          }
        } catch {
          // Skip invalid entries
        }
      });

      // Sort by clock in time (most recent first)
      active.sort((a, b) => b.clockInTime.getTime() - a.clockInTime.getTime());
      setActiveUsers(active);
    } catch (error: any) {
      console.error('Error loading active users:', error);
    }
  };

  // Refresh active users every 30 seconds
  useEffect(() => {
    if (user?.role === 'admin') {
      loadActiveUsers();
      const interval = setInterval(() => {
        loadActiveUsers();
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
  }, [user]);

  // Load all users when clock user dialog opens
  useEffect(() => {
    if (clockUserDialogOpen && user?.role === 'admin') {
      getAllUsers().then(setAllUsers);
    }
  }, [clockUserDialogOpen, user]);

  // Reset pagination when filters change
  useEffect(() => {
    setIndividualEntriesPage(1);
    setMergedEntriesPage(1);
  }, [searchQuery, selectedMonth, dateRange]);

  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Time Clock</h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin ? 'Manage and view all users\' time tracking' : 'Track your working hours'}
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={openManualEntry} onOpenChange={setOpenManualEntry}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Manual Entry
              </Button>
            </DialogTrigger>
          </Dialog>
          {isAdmin && (
            <Dialog open={clockUserDialogOpen} onOpenChange={setClockUserDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Clock User In/Out
                </Button>
              </DialogTrigger>
            </Dialog>
          )}
        </div>
        
        <Dialog open={openManualEntry} onOpenChange={setOpenManualEntry}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Manual Time Entry</DialogTitle>
              <DialogDescription>
                Add a time entry for a past date
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {manualDate ? format(manualDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={manualDate}
                      onSelect={(date) => date && setManualDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="clockIn">Clock In Time (HH:MM)</Label>
                <Input
                  id="clockIn"
                  type="time"
                  value={manualClockIn}
                  onChange={(e) => setManualClockIn(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clockOut">Clock Out Time (HH:MM)</Label>
                <Input
                  id="clockOut"
                  type="time"
                  value={manualClockOut}
                  onChange={(e) => setManualClockOut(e.target.value)}
                  required
                />
              </div>
              <Button
                onClick={handleManualEntry}
                className="w-full"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Entry'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClockIcon />
              Current Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Sri Lankan Time</p>
                <div className="text-4xl font-bold text-primary">
                  {format(currentTime, 'h:mm:ss a')}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {format(currentTime, 'EEEE, MMMM dd, yyyy')}
                </p>
              </div>
              <div className="border-l pl-4">
                <p className="text-sm text-muted-foreground mb-1">Australian Time</p>
                <div className="text-4xl font-bold text-primary">
                  {format(new Date(currentTime.getTime() + (5 * 60 + 30) * 60 * 1000), 'h:mm:ss a')}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {format(new Date(currentTime.getTime() + (5 * 60 + 30) * 60 * 1000), 'EEEE, MMMM dd, yyyy')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${isClockedIn ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              <span className="font-medium">
                {isClockedIn ? 'Currently Clocked In' : 'Not Clocked In'}
              </span>
            </div>
            {isClockedIn && currentEntry?.clockIn && (
              <div className="text-sm text-muted-foreground">
                Clocked in at: {formatTime(currentEntry.clockIn)}
              </div>
            )}
            <div className="flex gap-2">
              <Button 
                onClick={handleClockIn} 
                disabled={isClockedIn}
                className="flex-1"
              >
                <LogIn className="h-4 w-4 mr-2" />
                Clock In
              </Button>
              <Button 
                onClick={handleClockOut} 
                disabled={!isClockedIn || !currentEntry}
                variant="outline"
                className="flex-1"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Clock Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Currently Active Users
            </CardTitle>
            <CardDescription>Users who are currently clocked in</CardDescription>
          </CardHeader>
          <CardContent>
            {activeUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No users currently clocked in
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {activeUsers.map((activeUser) => {
                  const hoursActive = (currentTime.getTime() - activeUser.clockInTime.getTime()) / (1000 * 60 * 60);
                  return (
                    <div key={activeUser.entryId} className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/20">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="font-medium">{activeUser.userName}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{activeUser.userEmail}</p>
                      <div className="mt-2 text-xs text-muted-foreground mb-3">
                        <p>Clocked in: {formatTime(activeUser.clockInTime)}</p>
                        <p>Active for: {Math.round(hoursActive * 100) / 100}h</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleClockOutByEntry(activeUser.entryId, activeUser.userId, activeUser.userName)}
                        disabled={submitting}
                        className="w-full"
                      >
                        <LogOut className="h-3 w-3 mr-2" />
                        Clock Out
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isAdmin ? (
        <Tabs defaultValue="all-users-merged" className="space-y-4">
          <TabsList>
            {/* <TabsTrigger value="all-users-individual">
              <Users className="h-4 w-4 mr-2" />
              All Users - Individual
            </TabsTrigger> */}
            <TabsTrigger value="all-users-merged">
              <Users className="h-4 w-4 mr-2" />
              All Users
            </TabsTrigger>
            <TabsTrigger value="my-entries">
              <ClockIcon className="h-4 w-4 mr-2" />
              My Entries
            </TabsTrigger>
          </TabsList>

          {/* <TabsContent value="all-users-individual" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <CardTitle className="mb-2">All Users Time Entries</CardTitle>
                        <CardDescription>View individual clock in/out records for all users</CardDescription>
                      </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        {adminSelectedDate ? format(adminSelectedDate, 'MMM dd, yyyy') : 'Today'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={adminSelectedDate}
                        onSelect={(date) => {
                          setAdminSelectedDate(date || new Date());
                        }}
                        initialFocus
                      />
                      <div className="p-3 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => setAdminSelectedDate(new Date())}
                        >
                          Show Today
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="mt-6 flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={sortOrder} onValueChange={(value: 'most' | 'least' | 'none') => setSortOrder(value)}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Sort by hours" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No sorting</SelectItem>
                      <SelectItem value="most">Most hours worked</SelectItem>
                      <SelectItem value="least">Least hours worked</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filter by month" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All months</SelectItem>
                      <SelectItem value="0">January</SelectItem>
                      <SelectItem value="1">February</SelectItem>
                      <SelectItem value="2">March</SelectItem>
                      <SelectItem value="3">April</SelectItem>
                      <SelectItem value="4">May</SelectItem>
                      <SelectItem value="5">June</SelectItem>
                      <SelectItem value="6">July</SelectItem>
                      <SelectItem value="7">August</SelectItem>
                      <SelectItem value="8">September</SelectItem>
                      <SelectItem value="9">October</SelectItem>
                      <SelectItem value="10">November</SelectItem>
                      <SelectItem value="11">December</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {loadingAdmin ? (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <div className="space-y-3">
                        <div className="grid grid-cols-8 gap-4 pb-2 border-b">
                          {Array.from({ length: 8 }).map((_, i) => (
                            <Skeleton key={i} className="h-4 w-20" />
                          ))}
                        </div>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="grid grid-cols-8 gap-4 py-2">
                            {Array.from({ length: 8 }).map((_, j) => (
                              <Skeleton key={j} className="h-8 w-full" />
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (() => {
                  let filteredEntries = allUsersEntries.filter((entry) => {
                    // Search filter
                    if (searchQuery.trim()) {
                      const query = searchQuery.toLowerCase();
                      const userName = (entry.userName || '').toLowerCase();
                      const userEmail = (entry.userEmail || '').toLowerCase();
                      if (!userName.includes(query) && !userEmail.includes(query)) {
                        return false;
                      }
                    }
                    
                    // Month filter
                    if (selectedMonth !== 'all') {
                      const entryMonth = entry.date.getMonth().toString();
                      if (entryMonth !== selectedMonth) {
                        return false;
                      }
                    }
                    
                    return true;
                  });

                  // Sort by hours
                  if (sortOrder === 'most') {
                    filteredEntries = [...filteredEntries].sort((a, b) => {
                      const hoursA = a.totalHours || 0;
                      const hoursB = b.totalHours || 0;
                      return hoursB - hoursA;
                    });
                  } else if (sortOrder === 'least') {
                    filteredEntries = [...filteredEntries].sort((a, b) => {
                      const hoursA = a.totalHours || 0;
                      const hoursB = b.totalHours || 0;
                      return hoursA - hoursB;
                    });
                  }

                  // Pagination
                  const itemsPerPage = 5;
                  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);
                  const startIndex = (individualEntriesPage - 1) * itemsPerPage;
                  const endIndex = startIndex + itemsPerPage;
                  const paginatedEntries = filteredEntries.slice(startIndex, endIndex);

                  return filteredEntries.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {searchQuery || selectedMonth !== 'all' ? 'No time entries found matching your filters' : 'No time entries found for this date'}
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Clock In</TableHead>
                            <TableHead>Clock Out</TableHead>
                            <TableHead>Total Hours</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedEntries.map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell className="font-medium">
                                {entry.userName || 'Unknown'}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {entry.userEmail}
                              </TableCell>
                              <TableCell>{formatDate(entry.date)}</TableCell>
                              <TableCell>{formatTime(entry.clockIn)}</TableCell>
                              <TableCell>{formatTime(entry.clockOut)}</TableCell>
                              <TableCell>
                                {entry.totalHours ? (
                                  <Badge variant="outline">{entry.totalHours}h</Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {entry.clockOut ? (
                                  <Badge variant="default">Completed</Badge>
                                ) : (
                                  <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                    Active
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <TooltipProvider>
                                  <div className="flex items-center gap-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleEditEntry(entry)}
                                          className="h-8 w-8 p-0"
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Edit entry</p>
                                      </TooltipContent>
                                    </Tooltip>
                                    {(() => {
                                      const isUserActive = activeUsers.some(au => au.userId === entry.userId);
                                      
                                      if (isUserActive) {
                                        return (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleClockOutUser(entry.userId, entry.userName || 'User')}
                                                disabled={submitting}
                                                className="h-8 w-8 p-0"
                                              >
                                                <LogOut className="h-4 w-4" />
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>Clock out user</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        );
                                      } else {
                                        return (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleClockInUser(entry.userId, entry.userName || 'User')}
                                                disabled={submitting}
                                                className="h-8 w-8 p-0"
                                              >
                                                <LogIn className="h-4 w-4" />
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>Clock in user</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        );
                                      }
                                    })()}
                                  </div>
                                </TooltipProvider>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {totalPages > 1 && (
                        <div className="mt-4">
                          <Pagination>
                            <PaginationContent>
                              <PaginationItem>
                                <PaginationPrevious
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    if (individualEntriesPage > 1) {
                                      setIndividualEntriesPage(individualEntriesPage - 1);
                                    }
                                  }}
                                  className={individualEntriesPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                                />
                              </PaginationItem>
                              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                                if (
                                  page === 1 ||
                                  page === totalPages ||
                                  (page >= individualEntriesPage - 1 && page <= individualEntriesPage + 1)
                                ) {
                                  return (
                                    <PaginationItem key={page}>
                                      <PaginationLink
                                        href="#"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          setIndividualEntriesPage(page);
                                        }}
                                        isActive={individualEntriesPage === page}
                                        className="cursor-pointer"
                                      >
                                        {page}
                                      </PaginationLink>
                                    </PaginationItem>
                                  );
                                } else if (page === individualEntriesPage - 2 || page === individualEntriesPage + 2) {
                                  return (
                                    <PaginationItem key={page}>
                                      <PaginationEllipsis />
                                    </PaginationItem>
                                  );
                                }
                                return null;
                              })}
                              <PaginationItem>
                                <PaginationNext
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    if (individualEntriesPage < totalPages) {
                                      setIndividualEntriesPage(individualEntriesPage + 1);
                                    }
                                  }}
                                  className={individualEntriesPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                                />
                              </PaginationItem>
                            </PaginationContent>
                          </Pagination>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent> */}

          <TabsContent value="all-users-merged" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <CardTitle className="mb-2">Merged Time Entries</CardTitle>
                        <CardDescription>View merged clock in/out records grouped by user and date</CardDescription>
                      </div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm">
                            <CalendarIcon className="h-4 w-4 mr-2" />
                            {dateRange?.from ? (
                              dateRange.to ? (
                                `${format(dateRange.from, 'MMM dd, yyyy')} - ${format(dateRange.to, 'MMM dd, yyyy')}`
                              ) : (
                                format(dateRange.from, 'MMM dd, yyyy')
                              )
                            ) : (
                              'Select date range'
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <Calendar
                            mode="range"
                            defaultMonth={dateRange?.from}
                            selected={dateRange}
                            onSelect={setDateRange}
                            numberOfMonths={2}
                            className="rounded-lg border shadow-sm"
                          />
                          <div className="p-3 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => {
                                const today = new Date();
                                setDateRange({
                                  from: today,
                                  to: today,
                                });
                              }}
                            >
                              Show Today
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="mt-6 flex gap-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="Search by name or email..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <Select value={sortOrder} onValueChange={(value: 'most' | 'least' | 'none') => setSortOrder(value)}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Sort by hours" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No sorting</SelectItem>
                          <SelectItem value="most">Most hours worked</SelectItem>
                          <SelectItem value="least">Least hours worked</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Filter by month" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All months</SelectItem>
                          <SelectItem value="0">January</SelectItem>
                          <SelectItem value="1">February</SelectItem>
                          <SelectItem value="2">March</SelectItem>
                          <SelectItem value="3">April</SelectItem>
                          <SelectItem value="4">May</SelectItem>
                          <SelectItem value="5">June</SelectItem>
                          <SelectItem value="6">July</SelectItem>
                          <SelectItem value="7">August</SelectItem>
                          <SelectItem value="8">September</SelectItem>
                          <SelectItem value="9">October</SelectItem>
                          <SelectItem value="10">November</SelectItem>
                          <SelectItem value="11">December</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={statusFilter} onValueChange={(value: 'all' | 'active' | 'completed') => setStatusFilter(value)}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All status</SelectItem>
                          <SelectItem value="active">Active only</SelectItem>
                          <SelectItem value="completed">Completed only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loadingAdmin ? (
                      <div className="space-y-4">
                        <div className="overflow-x-auto">
                          <div className="space-y-3">
                            <div className="grid grid-cols-9 gap-4 pb-2 border-b">
                              {Array.from({ length: 9 }).map((_, i) => (
                                <Skeleton key={i} className="h-4 w-20" />
                              ))}
                            </div>
                            {Array.from({ length: 5 }).map((_, i) => (
                              <div key={i} className="grid grid-cols-9 gap-4 py-2">
                                {Array.from({ length: 9 }).map((_, j) => (
                                  <Skeleton key={j} className="h-8 w-full" />
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (() => {
                      const mergedEntries = mergeEntriesByUserAndDate(allUsersEntries);
                      
                      let filteredEntries = mergedEntries.filter((entry) => {
                        // Search filter
                        if (searchQuery.trim()) {
                          const query = searchQuery.toLowerCase();
                          const userName = (entry.userName || '').toLowerCase();
                          const userEmail = (entry.userEmail || '').toLowerCase();
                          if (!userName.includes(query) && !userEmail.includes(query)) {
                            return false;
                          }
                        }
                        
                        // Month filter
                        if (selectedMonth !== 'all') {
                          const entryMonth = entry.date.getMonth().toString();
                          if (entryMonth !== selectedMonth) {
                            return false;
                          }
                        }
                        
                        // Status filter
                        if (statusFilter === 'active') {
                          if (!entry.isActive) {
                            return false;
                          }
                        } else if (statusFilter === 'completed') {
                          if (entry.isActive) {
                            return false;
                          }
                        }
                        
                        return true;
                      });

                      // Sort: Active users first, then by hours if specified
                      filteredEntries = [...filteredEntries].sort((a, b) => {
                        // First, sort by active status (active users first)
                        if (a.isActive !== b.isActive) {
                          return a.isActive ? -1 : 1; // Active (true) comes before completed (false)
                        }
                        
                        // If both have the same status, apply hour-based sorting if specified
                        if (sortOrder === 'most') {
                          return b.totalHours - a.totalHours;
                        } else if (sortOrder === 'least') {
                          return a.totalHours - b.totalHours;
                        }
                        
                        // If no sorting specified, maintain original order within each status group
                        return 0;
                      });

                      // Pagination
                      const itemsPerPage = 5;
                      const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);
                      const startIndex = (mergedEntriesPage - 1) * itemsPerPage;
                      const endIndex = startIndex + itemsPerPage;
                      const paginatedEntries = filteredEntries.slice(startIndex, endIndex);

                      return filteredEntries.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          {searchQuery || selectedMonth !== 'all' || statusFilter !== 'all' ? 'No merged entries found matching your filters' : 'No merged entries found for this date'}
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>First Clock In</TableHead>
                                <TableHead>Last Clock Out</TableHead>
                                <TableHead>Total Hours</TableHead>
                                <TableHead>Sessions</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {paginatedEntries.map((entry, index) => (
                                <TableRow key={`${entry.userId}-${format(entry.date, 'yyyy-MM-dd')}-${index}`}>
                                  <TableCell className="font-medium">
                                    <button
                                      onClick={() => handleShowSessions(entry.userId, entry.userName, entry.userEmail, entry.date)}
                                      className="text-left hover:underline cursor-pointer text-primary"
                                    >
                                      {entry.userName || 'Unknown'}
                                    </button>
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {entry.userEmail}
                                  </TableCell>
                                  <TableCell>{formatDate(entry.date)}</TableCell>
                                  <TableCell>{formatTime(entry.firstClockIn)}</TableCell>
                                  <TableCell>{formatTime(entry.lastClockOut)}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{Math.round(entry.totalHours * 100) / 100}h</Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="secondary">{entry.sessionCount}</Badge>
                                  </TableCell>
                                  <TableCell>
                                    {entry.isActive ? (
                                      <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                                        <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                        Active
                                      </Badge>
                                    ) : (
                                      <Badge variant="default">Completed</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <TooltipProvider>
                                      <div className="flex items-center gap-1">
                                        {(() => {
                                          const isUserActive = activeUsers.some(au => au.userId === entry.userId);
                                          
                                          if (isUserActive) {
                                            return (
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleClockOutUser(entry.userId, entry.userName || 'User')}
                                                    disabled={submitting}
                                                    className="h-8 w-8 p-0"
                                                  >
                                                    <LogOut className="h-4 w-4" />
                                                  </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  <p>Clock out user</p>
                                                </TooltipContent>
                                              </Tooltip>
                                            );
                                          } else {
                                            return (
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleClockInUser(entry.userId, entry.userName || 'User')}
                                                    disabled={submitting}
                                                    className="h-8 w-8 p-0"
                                                  >
                                                    <LogIn className="h-4 w-4" />
                                                  </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  <p>Clock in user</p>
                                                </TooltipContent>
                                              </Tooltip>
                                            );
                                          }
                                        })()}
                                      </div>
                                    </TooltipProvider>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          {totalPages > 1 && (
                            <div className="mt-4">
                              <Pagination>
                                <PaginationContent>
                                  <PaginationItem>
                                    <PaginationPrevious
                                      href="#"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        if (mergedEntriesPage > 1) {
                                          setMergedEntriesPage(mergedEntriesPage - 1);
                                        }
                                      }}
                                      className={mergedEntriesPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                                    />
                                  </PaginationItem>
                                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                                    if (
                                      page === 1 ||
                                      page === totalPages ||
                                      (page >= mergedEntriesPage - 1 && page <= mergedEntriesPage + 1)
                                    ) {
                                      return (
                                        <PaginationItem key={page}>
                                          <PaginationLink
                                            href="#"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              setMergedEntriesPage(page);
                                            }}
                                            isActive={mergedEntriesPage === page}
                                            className="cursor-pointer"
                                          >
                                            {page}
                                          </PaginationLink>
                                        </PaginationItem>
                                      );
                                    } else if (page === mergedEntriesPage - 2 || page === mergedEntriesPage + 2) {
                                      return (
                                        <PaginationItem key={page}>
                                          <PaginationEllipsis />
                                        </PaginationItem>
                                      );
                                    }
                                    return null;
                                  })}
                                  <PaginationItem>
                                    <PaginationNext
                                      href="#"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        if (mergedEntriesPage < totalPages) {
                                          setMergedEntriesPage(mergedEntriesPage + 1);
                                        }
                                      }}
                                      className={mergedEntriesPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                                    />
                                  </PaginationItem>
                                </PaginationContent>
                              </Pagination>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
          </TabsContent>

          <TabsContent value="my-entries">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <CardTitle className="mb-2">My Time Entries</CardTitle>
                    <CardDescription>Your clock in/out history</CardDescription>
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        {selectedDate ? format(selectedDate, 'MMM dd, yyyy') : 'All Dates'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => {
                          setSelectedDate(date);
                        }}
                        initialFocus
                      />
                      <div className="p-3 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => setSelectedDate(undefined)}
                        >
                          Show All Dates
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <div className="space-y-3">
                        <div className="grid grid-cols-5 gap-4 pb-2 border-b">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-4 w-20" />
                          ))}
                        </div>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="grid grid-cols-5 gap-4 py-2">
                            {Array.from({ length: 5 }).map((_, j) => (
                              <Skeleton key={j} className="h-8 w-full" />
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : timeEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No time entries found
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Clock In</TableHead>
                        <TableHead>Clock Out</TableHead>
                        <TableHead>Total Hours</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timeEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">
                            {formatDate(entry.date)}
                          </TableCell>
                          <TableCell>{formatTime(entry.clockIn)}</TableCell>
                          <TableCell>{formatTime(entry.clockOut)}</TableCell>
                          <TableCell>
                            {entry.totalHours ? (
                              <Badge variant="outline">{entry.totalHours}h</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {entry.clockOut ? (
                              <Badge variant="default">Completed</Badge>
                            ) : (
                              <Badge variant="secondary">In Progress</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center mb-4">
              <div>
                <CardTitle className="mb-2">Time Entries</CardTitle>
                <CardDescription>Your clock in/out history</CardDescription>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className={cn(
                      "justify-start text-left font-normal",
                      !userDateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {userDateRange?.from ? (
                      userDateRange.to ? (
                        <>
                          {format(userDateRange.from, 'MMM dd, yyyy')} - {format(userDateRange.to, 'MMM dd, yyyy')}
                        </>
                      ) : (
                        format(userDateRange.from, 'MMM dd, yyyy')
                      )
                    ) : (
                      'Filter by date range'
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    defaultMonth={userDateRange?.from}
                    selected={userDateRange}
                    onSelect={setUserDateRange}
                    numberOfMonths={2}
                    initialFocus
                  />
                  {userDateRange && (
                    <div className="p-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setUserDateRange(undefined)}
                      >
                        Clear date filter
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : timeEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No time entries found
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Total Hours</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {formatDate(entry.date)}
                      </TableCell>
                      <TableCell>{formatTime(entry.clockIn)}</TableCell>
                      <TableCell>{formatTime(entry.clockOut)}</TableCell>
                      <TableCell>
                        {entry.totalHours ? (
                          <Badge variant="outline">{entry.totalHours}h</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.clockOut ? (
                          <Badge variant="default">Completed</Badge>
                        ) : (
                          <Badge variant="secondary">In Progress</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Entry Dialog */}
      <Dialog open={editEntryOpen} onOpenChange={(open) => {
        setEditEntryOpen(open);
        if (!open) {
          setEditingEntry(null);
          setEditingSessionNumber(null);
          setEditClockIn('');
          setEditClockOut('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit Time Entry
              {editingSessionNumber && ` - Session ${editingSessionNumber}`}
            </DialogTitle>
            <DialogDescription>
              {editingEntry && `Edit clock in/out times for ${editingEntry.userName || 'user'}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editDate ? format(editDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={editDate}
                    onSelect={(date) => date && setEditDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editClockIn">Clock In Time (HH:MM)</Label>
              <Input
                id="editClockIn"
                type="time"
                value={editClockIn}
                onChange={(e) => setEditClockIn(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editClockOut">Clock Out Time (HH:MM) - Optional</Label>
              <Input
                id="editClockOut"
                type="time"
                value={editClockOut}
                onChange={(e) => setEditClockOut(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSaveEdit}
                className="flex-1"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditEntryOpen(false);
                  setEditingEntry(null);
                  setEditingSessionNumber(null);
                  setEditClockIn('');
                  setEditClockOut('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clock User In/Out Dialog */}
      <Dialog open={clockUserDialogOpen} onOpenChange={setClockUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clock User In/Out</DialogTitle>
            <DialogDescription>
              Clock in or clock out a user
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select User</Label>
              <Select
                value={selectedUserForClock?.id || ''}
                onValueChange={(userId) => {
                  const selectedUser = allUsers.find(u => u.id === userId);
                  if (selectedUser) {
                    setSelectedUserForClock({
                      id: selectedUser.id,
                      name: selectedUser.name || `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim() || selectedUser.email,
                      email: selectedUser.email,
                    });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {allUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedUserForClock && (
              <div className="space-y-2">
                <Label>Actions</Label>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleClockUser('in')}
                    className="flex-1"
                    disabled={submitting}
                  >
                    <LogIn className="h-4 w-4 mr-2" />
                    Clock In
                  </Button>
                  <Button
                    onClick={() => handleClockUser('out')}
                    variant="outline"
                    className="flex-1"
                    disabled={submitting}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Clock Out
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Session Details Dialog */}
      <Dialog open={sessionDetailsOpen} onOpenChange={setSessionDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Session Details</DialogTitle>
            <DialogDescription>
              {selectedUserInfo && (
                <>
                  Individual clock in/out sessions for <strong>{selectedUserInfo.name}</strong> on {formatDate(selectedUserInfo.date)}
                  <br />
                  <span className="text-xs text-muted-foreground">{selectedUserInfo.email}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {selectedUserSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No sessions found
              </p>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session #</TableHead>
                      <TableHead>Clock In</TableHead>
                      <TableHead>Clock Out</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Status</TableHead>
                      {isAdmin && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedUserSessions.map((session, index) => (
                      <TableRow key={session.id}>
                        <TableCell className="font-medium">
                          Session {index + 1}
                        </TableCell>
                        <TableCell>{formatTime(session.clockIn)}</TableCell>
                        <TableCell>{formatTime(session.clockOut)}</TableCell>
                        <TableCell>
                          {session.totalHours ? (
                            <Badge variant="outline">{session.totalHours}h</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {session.clockOut ? (
                            <Badge variant="default">Completed</Badge>
                          ) : (
                            <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                              <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                              Active
                            </Badge>
                          )}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setSessionDetailsOpen(false);
                                        handleEditEntry(session, index + 1);
                                      }}
                                      className="h-8 w-8 p-0"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Edit session</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setSessionToDelete(session);
                                        setDeleteDialogOpen(true);
                                      }}
                                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Delete session</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="pt-4 border-t">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Total Sessions:</span>
                    <Badge variant="secondary">{selectedUserSessions.length}</Badge>
                  </div>
                  <div className="flex justify-between items-center text-sm mt-2">
                    <span className="text-muted-foreground">Total Hours:</span>
                    <Badge variant="outline">
                      {Math.round(selectedUserSessions.reduce((sum, s) => sum + (s.totalHours || 0), 0) * 100) / 100}h
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Session Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this session? This action cannot be undone.
            </AlertDialogDescription>
            {sessionToDelete && (
              <div className="mt-2 p-2 bg-muted rounded text-sm">
                <div><strong>Clock In:</strong> {formatTime(sessionToDelete.clockIn)}</div>
                {sessionToDelete.clockOut && (
                  <div><strong>Clock Out:</strong> {formatTime(sessionToDelete.clockOut)}</div>
                )}
                {sessionToDelete.totalHours && (
                  <div><strong>Hours:</strong> {sessionToDelete.totalHours}h</div>
                )}
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSession}
              disabled={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Session'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Clock;
