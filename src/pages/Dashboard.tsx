"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Clock, Star, Users, Calendar, TrendingUp, CheckSquare, ArrowRight, AlertCircle, Bell, Plus, LogOut, LogIn } from 'lucide-react';
import { getTasksByUser, getCompletedTasks, getCompletedTasksByUser } from '@/lib/tasks';
import { Task } from '@/types/task';
import { getRemindersByUser } from '@/lib/reminders';
import { Reminder } from '@/types/reminder';
import { format, formatDistanceToNow, isPast, isToday, isTomorrow, startOfWeek, endOfWeek, startOfDay } from 'date-fns';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { ActiveUsersSection } from '@/components/ActiveUsersSection';
import { doc, getDoc, setDoc, collection, query, where, getDocs, Timestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const Dashboard = () => {
  const { user, getAllUsers } = useAuth();
  const router = useRouter();
  const [assignedTasks, setAssignedTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loadingReminders, setLoadingReminders] = useState(true);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [loadingPhoto, setLoadingPhoto] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [loadingBusy, setLoadingBusy] = useState(true);
  const [recentActivity, setRecentActivity] = useState<{
    completedTask: Task | null;
    recentClockOut: { userName: string; clockOutTime: Date } | null;
    recentClockIn: { userName: string; clockInTime: Date } | null;
  }>({
    completedTask: null,
    recentClockOut: null,
    recentClockIn: null,
  });
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [kpiData, setKpiData] = useState({
    clockInToday: { value: '--', loading: true },
    weeklyRating: { value: '--', loading: true },
    pendingLeaveRequests: { value: '0', loading: true },
    completedTasks: { value: '0', loading: true },
  });

  useEffect(() => {
    if (user) {
      loadAssignedTasks();
      loadReminders();
      loadProfilePhoto();
      loadBusyStatus();
      loadRecentActivity();
      loadKPIData();
    }
  }, [user]);

  const loadProfilePhoto = async () => {
    if (!user) return;
    
    try {
      setLoadingPhoto(true);
      const profileDoc = await getDoc(doc(db, 'profiles', user.id));
      if (profileDoc.exists()) {
        const data = profileDoc.data();
        if (data.profilePhoto) {
          setProfilePhoto(data.profilePhoto);
        }
      }
    } catch (error) {
      console.error('Error loading profile photo:', error);
    } finally {
      setLoadingPhoto(false);
    }
  };

  const loadBusyStatus = async () => {
    if (!user) return;
    
    try {
      setLoadingBusy(true);
      const profileDoc = await getDoc(doc(db, 'profiles', user.id));
      if (profileDoc.exists()) {
        const data = profileDoc.data();
        if (data.isBusy !== undefined) {
          setIsBusy(Boolean(data.isBusy));
        }
      }
    } catch (error) {
      console.error('Error loading busy status:', error);
    } finally {
      setLoadingBusy(false);
    }
  };

  const handleBusyToggle = async (checked: boolean) => {
    if (!user) return;
    
    setIsBusy(checked);
    try {
      await setDoc(
        doc(db, 'profiles', user.id),
        {
          isBusy: checked,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error('Error saving busy status:', error);
      // Revert on error
      setIsBusy(!checked);
    }
  };

  const loadAssignedTasks = async () => {
    if (!user) return;
    
    try {
      setLoadingTasks(true);
      const tasks = await getTasksByUser(user.id);
      // Get latest 5 tasks
      const latestTasks = tasks.slice(0, 5);
      setAssignedTasks(latestTasks);
    } catch (error) {
      console.error('Error loading assigned tasks:', error);
    } finally {
      setLoadingTasks(false);
    }
  };

  const loadReminders = async () => {
    if (!user) return;
    
    try {
      setLoadingReminders(true);
      const userReminders = await getRemindersByUser(user.id);
      // Filter out completed reminders and get the most urgent one
      const activeReminders = userReminders
        .filter(reminder => !reminder.completed)
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
        .slice(0, 1); // Get only 1 reminder
      setReminders(activeReminders);
    } catch (error) {
      console.error('Error loading reminders:', error);
    } finally {
      setLoadingReminders(false);
    }
  };

  const getDueDateLabel = (date: Date) => {
    if (isPast(date) && !isToday(date)) {
      return 'Overdue';
    }
    if (isToday(date)) {
      return 'Today';
    }
    if (isTomorrow(date)) {
      return 'Tomorrow';
    }
    return format(date, 'MMM dd, yyyy');
  };

  const getPriorityColor = (priority: 'low' | 'medium' | 'high' | undefined) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const loadKPIData = async () => {
    if (!user) return;
    
    try {
      await Promise.all([
        loadClockInToday(),
        loadWeeklyRating(),
        loadPendingLeaveRequests(),
        loadCompletedTasks(),
      ]);
    } catch (error) {
      console.error('Error loading KPI data:', error);
    }
  };

  const loadClockInToday = async () => {
    if (!user || !db) return;
    
    try {
      setKpiData(prev => ({ ...prev, clockInToday: { ...prev.clockInToday, loading: true } }));
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateString = format(today, 'yyyy-MM-dd');
      
      const q = query(
        collection(db, 'timeEntries'),
        where('userId', '==', user.id),
        where('dateString', '==', dateString)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const data = getTimeEntryData(doc.data());
        
        if (data.clockIn) {
          const clockInTime = data.clockIn.toDate();
          const formattedTime = format(clockInTime, 'hh:mm a');
          setKpiData(prev => ({ 
            ...prev, 
            clockInToday: { value: formattedTime, loading: false } 
          }));
        } else {
          setKpiData(prev => ({ 
            ...prev, 
            clockInToday: { value: 'Not Clocked In', loading: false } 
          }));
        }
      } else {
        setKpiData(prev => ({ 
          ...prev, 
          clockInToday: { value: 'Not Clocked In', loading: false } 
        }));
      }
    } catch (error) {
      console.error('Error loading clock in today:', error);
      setKpiData(prev => ({ 
        ...prev, 
        clockInToday: { value: 'Error', loading: false } 
      }));
    }
  };

  const loadWeeklyRating = async () => {
    if (!user || !db) return;
    
    try {
      setKpiData(prev => ({ ...prev, weeklyRating: { ...prev.weeklyRating, loading: true } }));
      
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 }); // Sunday
      
      const q = query(
        collection(db, 'ratings'),
        where('employeeId', '==', user.id)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const ratings = querySnapshot.docs
          .map(doc => {
            const data = doc.data();
            const ratingDate = data.week ? new Date(data.week) : data.createdAt?.toDate() || new Date();
            return {
              rating: data.rating || 0,
              date: ratingDate,
            };
          })
          .filter(r => r.rating > 0 && r.date >= weekStart && r.date <= weekEnd);
        
        if (ratings.length > 0) {
          const sum = ratings.reduce((a, b) => a + b.rating, 0);
          const avg = Math.round((sum / ratings.length) * 10) / 10;
          setKpiData(prev => ({ 
            ...prev, 
            weeklyRating: { value: `${avg}/5`, loading: false } 
          }));
        } else {
          setKpiData(prev => ({ 
            ...prev, 
            weeklyRating: { value: 'No Rating', loading: false } 
          }));
        }
      } else {
        setKpiData(prev => ({ 
          ...prev, 
          weeklyRating: { value: 'No Rating', loading: false } 
        }));
      }
    } catch (error) {
      console.error('Error loading weekly rating:', error);
      setKpiData(prev => ({ 
        ...prev, 
        weeklyRating: { value: 'Error', loading: false } 
      }));
    }
  };

  const loadPendingLeaveRequests = async () => {
    if (!user || !db) return;
    
    try {
      setKpiData(prev => ({ ...prev, pendingLeaveRequests: { ...prev.pendingLeaveRequests, loading: true } }));
      
      const q = query(
        collection(db, 'leaveRequests'),
        where('status', '==', 'pending')
      );
      
      const querySnapshot = await getDocs(q);
      const pendingCount = querySnapshot.size;
      
      setKpiData(prev => ({ 
        ...prev, 
        pendingLeaveRequests: { 
          value: pendingCount > 0 ? `${pendingCount} Pending` : '0 Pending', 
          loading: false 
        } 
      }));
    } catch (error) {
      console.error('Error loading pending leave requests:', error);
      setKpiData(prev => ({ 
        ...prev, 
        pendingLeaveRequests: { value: 'Error', loading: false } 
      }));
    }
  };

  const loadCompletedTasks = async () => {
    if (!user) return;
    
    try {
      setKpiData(prev => ({ ...prev, completedTasks: { ...prev.completedTasks, loading: true } }));
      
      let completedTasks: Task[];
      
      if (user.role === 'admin') {
        completedTasks = await getCompletedTasks();
      } else {
        completedTasks = await getCompletedTasksByUser(user.id);
      }
      
      const totalCount = completedTasks.length;
      
      setKpiData(prev => ({ 
        ...prev, 
        completedTasks: { 
          value: totalCount.toString(), 
          loading: false 
        } 
      }));
    } catch (error) {
      console.error('Error loading completed tasks:', error);
      setKpiData(prev => ({ 
        ...prev, 
        completedTasks: { value: 'Error', loading: false } 
      }));
    }
  };

  const getTimeEntryData = (data: unknown): {
    userId: string;
    date: Timestamp;
    dateString?: string;
    clockIn: Timestamp | null;
    clockOut: Timestamp | null;
    totalHours: number | null;
    createdAt: Timestamp;
    updatedAt: Timestamp;
  } => {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid time entry data');
    }
    return data as {
      userId: string;
      date: Timestamp;
      dateString?: string;
      clockIn: Timestamp | null;
      clockOut: Timestamp | null;
      totalHours: number | null;
      createdAt: Timestamp;
      updatedAt: Timestamp;
    };
  };

  const loadRecentActivity = async () => {
    if (!user || !db) return;

    try {
      setLoadingActivity(true);

      // Load most recent completed task
      let completedTask: Task | null = null;
      try {
        const completedTasks = user.role === 'admin' 
          ? await getCompletedTasks()
          : await getCompletedTasksByUser(user.id);
        
        if (completedTasks.length > 0) {
          // Tasks are already sorted by completion date (most recent first)
          completedTask = completedTasks[0];
        }
      } catch (error) {
        console.error('Error loading completed task:', error);
      }

      // Load most recent clock out
      let recentClockOut: { userName: string; clockOutTime: Date } | null = null;
      try {
        // Fetch recent time entries and filter in memory
        const timeEntriesQuery = query(
          collection(db, 'timeEntries'),
          orderBy('updatedAt', 'desc'),
          limit(50) // Get recent entries to filter
        );
        const timeEntriesSnapshot = await getDocs(timeEntriesQuery);
        
        const clockOuts: Array<{ userId: string; clockOutTime: Date }> = [];
        timeEntriesSnapshot.docs.forEach((doc) => {
          try {
            const data = getTimeEntryData(doc.data());
            if (data.clockOut) {
              clockOuts.push({
                userId: data.userId,
                clockOutTime: data.clockOut.toDate(),
              });
            }
          } catch {
            // Skip invalid entries
          }
        });

        if (clockOuts.length > 0) {
          // Sort by clock out time (most recent first)
          clockOuts.sort((a, b) => b.clockOutTime.getTime() - a.clockOutTime.getTime());
          const mostRecent = clockOuts[0];
          const users = await getAllUsers();
          const userInfo = users.find((u: any) => u.id === mostRecent.userId);
          const userName = userInfo 
            ? (userInfo.name || `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || userInfo.email)
            : 'Unknown User';
          recentClockOut = {
            userName,
            clockOutTime: mostRecent.clockOutTime,
          };
        }
      } catch (error) {
        console.error('Error loading recent clock out:', error);
      }

      // Load most recent clock in
      let recentClockIn: { userName: string; clockInTime: Date } | null = null;
      try {
        // Fetch recent time entries and filter in memory
        const timeEntriesQuery = query(
          collection(db, 'timeEntries'),
          orderBy('updatedAt', 'desc'),
          limit(50) // Get recent entries to filter
        );
        const timeEntriesSnapshot = await getDocs(timeEntriesQuery);
        
        const clockIns: Array<{ userId: string; clockInTime: Date }> = [];
        timeEntriesSnapshot.docs.forEach((doc) => {
          try {
            const data = getTimeEntryData(doc.data());
            if (data.clockIn) {
              clockIns.push({
                userId: data.userId,
                clockInTime: data.clockIn.toDate(),
              });
            }
          } catch {
            // Skip invalid entries
          }
        });

        if (clockIns.length > 0) {
          // Sort by clock in time (most recent first)
          clockIns.sort((a, b) => b.clockInTime.getTime() - a.clockInTime.getTime());
          const mostRecent = clockIns[0];
          const users = await getAllUsers();
          const userInfo = users.find((u: any) => u.id === mostRecent.userId);
          const userName = userInfo 
            ? (userInfo.name || `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || userInfo.email)
            : 'Unknown User';
          recentClockIn = {
            userName,
            clockInTime: mostRecent.clockInTime,
          };
        }
      } catch (error) {
        console.error('Error loading recent clock in:', error);
      }

      setRecentActivity({
        completedTask,
        recentClockOut,
        recentClockIn,
      });
    } catch (error) {
      console.error('Error loading recent activity:', error);
    } finally {
      setLoadingActivity(false);
    }
  };

  const stats: Array<{
    title: string;
    value: string;
    loading: boolean;
    icon: React.ComponentType<any>;
    gradient: string;
    iconBg: string;
    iconColor: string;
    borderColor: string;
    adminOnly?: boolean;
  }> = [
    { 
      title: 'Clock In Today', 
      value: kpiData.clockInToday.value, 
      loading: kpiData.clockInToday.loading,
      icon: Clock, 
      gradient: 'from-blue-500 via-blue-600 to-indigo-600',
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
      borderColor: 'border-blue-500/20'
    },
    { 
      title: 'This Week Rating', 
      value: kpiData.weeklyRating.value, 
      loading: kpiData.weeklyRating.loading,
      icon: Star, 
      gradient: 'from-blue-500 via-blue-600 to-indigo-600',
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
      borderColor: 'border-blue-500/20'
    },
    { 
      title: 'Leave Requests', 
      value: kpiData.pendingLeaveRequests.value, 
      loading: kpiData.pendingLeaveRequests.loading,
      icon: Calendar, 
      gradient: 'from-blue-500 via-blue-600 to-indigo-600',
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
      borderColor: 'border-blue-500/20'
    },
    { 
      title: 'Tasks Completed', 
      value: kpiData.completedTasks.value, 
      loading: kpiData.completedTasks.loading,
      icon: CheckSquare, 
      gradient: 'from-blue-500 via-blue-600 to-indigo-600',
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
      borderColor: 'border-blue-500/20'
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'New':
        return 'bg-blue-500';
      case 'Progress':
        return 'bg-yellow-500';
      case 'Complete':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-4 sm:space-y-6 md:space-y-8">
      {/* Header Section with Modern Design */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card via-card to-card/80 border border-border/50 p-6 sm:p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-6">
            {loadingPhoto ? (
              <Skeleton className="h-14 w-14 sm:h-20 sm:w-20 rounded-full" />
            ) : (
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full blur-xl" />
                <Avatar className="h-14 w-14 sm:h-20 sm:w-20 rounded-full ring-2 ring-primary/20">
                  <AvatarImage src={profilePhoto || undefined} alt={user?.name || 'User'} />
                  <AvatarFallback className="text-lg sm:text-xl font-bold bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
                    {user?.name ? getInitials(user.name) : 'U'}
                  </AvatarFallback>
                </Avatar>
              </div>
            )}
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                Welcome, {user?.name}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-2 font-medium">
                We Will Australia Operations Dashboard
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm">
              <Switch
                id="isBusy"
                checked={isBusy}
                onCheckedChange={handleBusyToggle}
                disabled={loadingBusy}
                className="data-[state=checked]:bg-primary"
              />
              <Label htmlFor="isBusy" className="text-sm font-medium cursor-pointer whitespace-nowrap">
                Mark as Busy
              </Label>
            </div>
            {isBusy && (
              <Badge variant="destructive" className="text-xs px-3 py-1.5 animate-pulse">
                <AlertCircle className="h-3 w-3 mr-1.5" />
                Busy
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Modern Metric Cards with Gradients */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {stats
          .filter(stat => !stat.adminOnly || user?.role === 'admin')
          .map((stat) => (
          <Card 
            key={stat.title} 
            className={`group relative overflow-hidden border ${stat.borderColor} bg-card/50 backdrop-blur-sm transition-smooth hover:scale-[1.02] hover:border-opacity-40`}
          >
            {/* Gradient Background Overlay */}
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
            
            {/* Decorative Corner Gradient */}
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-10 blur-3xl transition-opacity duration-300`} />
            
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-4 sm:px-6 pt-4 sm:pt-6 relative z-10">
              <CardTitle className="text-sm sm:text-base font-semibold text-foreground/90">{stat.title}</CardTitle>
              <div className={`${stat.iconBg} p-2 rounded-lg group-hover:scale-110 transition-transform duration-300`}>
                <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6 relative z-10">
              {stat.loading ? (
                <Skeleton className="h-8 sm:h-10 md:h-12 w-24 sm:w-32" />
              ) : (
                <div className={`text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-br ${stat.gradient} bg-clip-text text-transparent`}>
                  {stat.value}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        <Card className="border-border/50 transition-smooth overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 sm:pb-6 bg-gradient-to-br from-card to-card/50">
            <div>
              <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10">
                  <Bell className="h-4 w-4 text-amber-500" />
                </div>
                My Reminders
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1.5 hidden sm:block text-muted-foreground">
                Upcoming and overdue reminders
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => router.push('/reminders')} 
              className="w-full sm:w-auto text-xs sm:text-sm hover:bg-primary hover:text-primary-foreground transition-smooth border-border/50"
            >
              View All
              <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 ml-2" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {loadingReminders ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg space-x-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-4 w-4" />
                </div>
              </div>
            ) : reminders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="inline-flex p-4 rounded-2xl bg-amber-500/10 mb-4">
                  <Bell className="h-8 w-8 text-amber-500 opacity-60" />
                </div>
                <p className="font-medium mb-1">No reminders yet</p>
                <p className="text-xs text-muted-foreground mb-4">Create your first reminder to stay organized</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 hover:bg-primary hover:text-primary-foreground transition-smooth"
                  onClick={() => router.push('/reminders')}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Reminder
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {reminders.map((reminder) => {
                  const isOverdue = isPast(reminder.dueDate) && !isToday(reminder.dueDate);
                  return (
                    <div
                      key={reminder.id}
                      className={`group/item flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-smooth ${
                        isOverdue 
                          ? 'border-red-500/30 bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent hover:from-red-500/15 hover:via-red-500/10' 
                          : 'border-border/50 hover:border-primary/30 hover:bg-accent/50'
                      }`}
                      onClick={() => router.push('/reminders')}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 flex-wrap">
                          <Badge className={`${getPriorityColor(reminder.priority)} text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5`}>
                            {reminder.priority ? reminder.priority.charAt(0).toUpperCase() + reminder.priority.slice(1) : 'Medium'}
                          </Badge>
                          {isOverdue && (
                            <Badge variant="destructive" className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                              Overdue
                            </Badge>
                          )}
                        </div>
                        <h4 className="font-medium text-sm sm:text-base flex items-center gap-1.5 sm:gap-2 mb-1">
                          <Bell className={`h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 ${isOverdue ? 'text-red-500' : ''}`} />
                          <span className="truncate">{reminder.title}</span>
                        </h4>
                        {reminder.description && (
                          <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2 sm:line-clamp-1">
                            {reminder.description}
                          </p>
                        )}
                        <p className={`text-xs sm:text-sm mt-1.5 ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-muted-foreground'}`}>
                          Due: {getDueDateLabel(reminder.dueDate)}
                        </p>
                        {reminder.assignedMembers && reminder.assignedMembers.length > 0 && (
                          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1.5 line-clamp-1">
                            {reminder.assignedMemberNames && reminder.assignedMemberNames.length > 0
                              ? `Assigned to: ${reminder.assignedMemberNames.slice(0, 2).join(', ')}${reminder.assignedMemberNames.length > 2 ? ` +${reminder.assignedMemberNames.length - 2}` : ''}`
                              : `${reminder.assignedMembers.length} member${reminder.assignedMembers.length !== 1 ? 's' : ''}`}
                          </p>
                        )}
                      </div>
                      <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0 group-hover/item:translate-x-1 transition-transform" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 transition-smooth overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="pb-4 sm:pb-6 bg-gradient-to-br from-card to-card/50">
            <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500/10">
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </div>
              Recent Activity
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1.5 hidden sm:block text-muted-foreground">
              Latest updates and notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {loadingActivity ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Skeleton className="h-4 w-4 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                {recentActivity.completedTask && (
                  <div className="flex items-start gap-3 p-3 rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 to-transparent hover:from-emerald-500/15 transition-smooth">
                    <div className="p-1.5 rounded-lg bg-emerald-500/20 flex-shrink-0">
                      <CheckSquare className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground">Task completed</p>
                      <p className="text-muted-foreground text-xs mt-0.5 truncate">
                        {recentActivity.completedTask.name}
                      </p>
                      <p className="text-muted-foreground text-xs mt-1">
                        {formatDistanceToNow(
                          recentActivity.completedTask.statusHistory?.find(h => h.status === 'Complete')?.timestamp || 
                          recentActivity.completedTask.updatedAt,
                          { addSuffix: true }
                        )}
                      </p>
                    </div>
                  </div>
                )}
                {recentActivity.recentClockOut && (
                  <div className="flex items-start gap-3 p-3 rounded-xl border border-blue-500/20 bg-gradient-to-r from-blue-500/10 to-transparent hover:from-blue-500/15 transition-smooth">
                    <div className="p-1.5 rounded-lg bg-blue-500/20 flex-shrink-0">
                      <LogOut className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground">User clocked out</p>
                      <p className="text-muted-foreground text-xs mt-0.5 truncate">
                        {recentActivity.recentClockOut.userName}
                      </p>
                      <p className="text-muted-foreground text-xs mt-1">
                        {formatDistanceToNow(
                          recentActivity.recentClockOut.clockOutTime,
                          { addSuffix: true }
                        )}
                      </p>
                    </div>
                  </div>
                )}
                {recentActivity.recentClockIn && (
                  <div className="flex items-start gap-3 p-3 rounded-xl border border-purple-500/20 bg-gradient-to-r from-purple-500/10 to-transparent hover:from-purple-500/15 transition-smooth">
                    <div className="p-1.5 rounded-lg bg-purple-500/20 flex-shrink-0">
                      <LogIn className="h-4 w-4 text-purple-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground">User clocked in</p>
                      <p className="text-muted-foreground text-xs mt-0.5 truncate">
                        {recentActivity.recentClockIn.userName}
                      </p>
                      <p className="text-muted-foreground text-xs mt-1">
                        {formatDistanceToNow(
                          recentActivity.recentClockIn.clockInTime,
                          { addSuffix: true }
                        )}
                      </p>
                    </div>
                  </div>
                )}
                {!recentActivity.completedTask && !recentActivity.recentClockOut && !recentActivity.recentClockIn && (
                  <div className="text-center py-12 text-muted-foreground">
                    <div className="inline-flex p-4 rounded-2xl bg-blue-500/10 mb-4">
                      <TrendingUp className="h-8 w-8 text-blue-500 opacity-60" />
                    </div>
                    <p className="font-medium">No recent activity</p>
                    <p className="text-xs mt-1">Activity will appear here as it happens</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active Users and Recent Clock Outs Section */}
      <ActiveUsersSection />

      {/* Assigned Tasks Section */}
      <Card className="border-border/50 transition-smooth overflow-hidden group">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 sm:pb-6 bg-gradient-to-br from-card to-card/50">
          <div>
            <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-500/10">
                <CheckSquare className="h-4 w-4 text-indigo-500" />
              </div>
              My Assigned Tasks
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1.5 hidden sm:block text-muted-foreground">
              Latest tasks assigned to you
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => router.push('/tasks')} 
            className="w-full sm:w-auto text-xs sm:text-sm hover:bg-primary hover:text-primary-foreground transition-smooth border-border/50"
          >
            View All
            <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 ml-2" />
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {loadingTasks ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded-lg space-x-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-4 w-4" />
                </div>
              ))}
            </div>
          ) : assignedTasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="inline-flex p-4 rounded-2xl bg-indigo-500/10 mb-4">
                <CheckSquare className="h-8 w-8 text-indigo-500 opacity-60" />
              </div>
              <p className="font-medium mb-1">No tasks assigned to you yet</p>
              <p className="text-xs">Tasks will appear here when assigned</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignedTasks.map((task) => (
                <div
                  key={task.id}
                  className="group/item flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-smooth border-border/50 hover:border-primary/30 hover:bg-accent/50"
                  onClick={() => router.push('/tasks')}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 flex-wrap">
                      <Badge className={`${getStatusColor(task.status)} text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5`}>
                        {task.status}
                      </Badge>
                      <span className="text-[10px] sm:text-xs text-muted-foreground">#{task.taskId}</span>
                    </div>
                    <h4 className="font-medium text-sm sm:text-base truncate mb-1">{task.name}</h4>
                    {task.description && (
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2 sm:line-clamp-1">
                        {task.description}
                      </p>
                    )}
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">
                      Due: {format(task.date, 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0 group-hover/item:translate-x-1 transition-transform" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {user?.role === 'itteam' && (
        <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg text-yellow-800 dark:text-yellow-200">Limited Access Notice</CardTitle>
            <CardDescription className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-300">
              IT team has restricted access by default. Contact an admin to request specific permissions.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
