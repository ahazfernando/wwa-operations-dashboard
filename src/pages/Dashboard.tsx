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
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from 'date-fns';
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

  useEffect(() => {
    if (user) {
      loadAssignedTasks();
      loadReminders();
      loadProfilePhoto();
      loadBusyStatus();
      loadRecentActivity();
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

  const stats = [
    { title: 'Clock In Today', value: '08:30 AM', icon: Clock, color: 'text-blue-600' },
    { title: 'This Week Rating', value: '4.5/5', icon: Star, color: 'text-yellow-600' },
    { title: 'Active Leads', value: '23', icon: Users, color: 'text-green-600' },
    { title: 'Leave Requests', value: '5 Pending', icon: Calendar, color: 'text-purple-600' },
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {loadingPhoto ? (
            <Skeleton className="h-16 w-16 rounded-full" />
          ) : (
            <Avatar className="h-16 w-16">
              <AvatarImage src={profilePhoto || undefined} alt={user?.name || 'User'} />
              <AvatarFallback className="text-lg font-semibold">
                {user?.name ? getInitials(user.name) : 'U'}
              </AvatarFallback>
            </Avatar>
          )}
          <div>
            <h1 className="text-3xl font-bold text-foreground">Welcome, {user?.name}</h1>
            <p className="text-muted-foreground mt-1">We Will Australia Operations Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="isBusy"
              checked={isBusy}
              onCheckedChange={handleBusyToggle}
              disabled={loadingBusy}
            />
            <Label htmlFor="isBusy" className="text-sm font-medium cursor-pointer">
              Mark as Busy
            </Label>
          </div>
          {isBusy && (
            <Badge variant="destructive" className="text-xs">
              <AlertCircle className="h-3 w-3 mr-1" />
              Busy
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>My Reminders</CardTitle>
              <CardDescription>Upcoming and overdue reminders</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push('/reminders')}>
              View All
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardHeader>
          <CardContent>
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
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No reminders yet</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
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
                      className={`flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors ${
                        isOverdue ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20' : ''
                      }`}
                      onClick={() => router.push('/reminders')}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={getPriorityColor(reminder.priority)}>
                            {reminder.priority ? reminder.priority.charAt(0).toUpperCase() + reminder.priority.slice(1) : 'Medium'}
                          </Badge>
                          {isOverdue && (
                            <Badge variant="destructive" className="text-xs">
                              Overdue
                            </Badge>
                          )}
                        </div>
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <Bell className={`h-3 w-3 ${isOverdue ? 'text-red-500' : ''}`} />
                          {reminder.title}
                        </h4>
                        {reminder.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {reminder.description}
                          </p>
                        )}
                        <p className={`text-xs mt-1 ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-muted-foreground'}`}>
                          Due: {getDueDateLabel(reminder.dueDate)}
                        </p>
                        {reminder.assignedMembers && reminder.assignedMembers.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {reminder.assignedMemberNames && reminder.assignedMemberNames.length > 0
                              ? `Assigned to: ${reminder.assignedMemberNames.slice(0, 2).join(', ')}${reminder.assignedMemberNames.length > 2 ? ` +${reminder.assignedMemberNames.length - 2}` : ''}`
                              : `${reminder.assignedMembers.length} member${reminder.assignedMembers.length !== 1 ? 's' : ''}`}
                          </p>
                        )}
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground ml-4" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates and notifications</CardDescription>
          </CardHeader>
          <CardContent>
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
                  <div className="flex items-start gap-2">
                    <CheckSquare className="h-4 w-4 mt-0.5 text-green-600" />
                    <div>
                      <p className="font-medium">Task completed</p>
                      <p className="text-muted-foreground text-xs">
                        {recentActivity.completedTask.name} - {formatDistanceToNow(
                          recentActivity.completedTask.statusHistory?.find(h => h.status === 'Complete')?.timestamp || 
                          recentActivity.completedTask.updatedAt,
                          { addSuffix: true }
                        )}
                      </p>
                    </div>
                  </div>
                )}
                {recentActivity.recentClockOut && (
                  <div className="flex items-start gap-2">
                    <LogOut className="h-4 w-4 mt-0.5 text-blue-600" />
                    <div>
                      <p className="font-medium">User clocked out</p>
                      <p className="text-muted-foreground text-xs">
                        {recentActivity.recentClockOut.userName} - {formatDistanceToNow(
                          recentActivity.recentClockOut.clockOutTime,
                          { addSuffix: true }
                        )}
                      </p>
                    </div>
                  </div>
                )}
                {recentActivity.recentClockIn && (
                  <div className="flex items-start gap-2">
                    <LogIn className="h-4 w-4 mt-0.5 text-purple-600" />
                    <div>
                      <p className="font-medium">User clocked in</p>
                      <p className="text-muted-foreground text-xs">
                        {recentActivity.recentClockIn.userName} - {formatDistanceToNow(
                          recentActivity.recentClockIn.clockInTime,
                          { addSuffix: true }
                        )}
                      </p>
                    </div>
                  </div>
                )}
                {!recentActivity.completedTask && !recentActivity.recentClockOut && !recentActivity.recentClockIn && (
                  <div className="text-center py-4 text-muted-foreground text-xs">
                    No recent activity
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>My Assigned Tasks</CardTitle>
            <CardDescription>Latest tasks assigned to you</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push('/tasks')}>
            View All
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardHeader>
        <CardContent>
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
            <div className="text-center py-8 text-muted-foreground">
              <CheckSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No tasks assigned to you yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => router.push('/tasks')}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={getStatusColor(task.status)}>
                        {task.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">#{task.taskId}</span>
                    </div>
                    <h4 className="font-medium text-sm">{task.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {task.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Due: {format(task.date, 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground ml-4" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {user?.role === 'itteam' && (
        <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
          <CardHeader>
            <CardTitle className="text-yellow-800 dark:text-yellow-200">Limited Access Notice</CardTitle>
            <CardDescription className="text-yellow-700 dark:text-yellow-300">
              IT team has restricted access by default. Contact an admin to request specific permissions.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
