"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Activity, LogOut, Clock, AlertCircle, CheckSquare } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { collection, query, where, getDocs, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ActiveUser } from '@/components/clock/types';
import { formatTime } from '@/components/clock/utils';
import { getTasksByUser } from '@/lib/tasks';
import { Task } from '@/types/task';

interface RecentClockOut {
  userId: string;
  userName: string;
  userEmail: string;
  clockOutTime: Date;
  clockInTime: Date;
  entryId: string;
}

export const ActiveUsersSection = () => {
  const { user, getAllUsers } = useAuth();
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [recentClockOuts, setRecentClockOuts] = useState<RecentClockOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [profilePhotos, setProfilePhotos] = useState<Record<string, string>>({});
  const [busyStatus, setBusyStatus] = useState<Record<string, boolean>>({});
  const [userTasks, setUserTasks] = useState<Record<string, Task | null>>({});

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

  const loadProfilePhoto = async (userId: string): Promise<string | null> => {
    if (!db) return null;
    
    try {
      const profileDoc = await getDoc(doc(db, 'profiles', userId));
      if (profileDoc.exists()) {
        const data = profileDoc.data();
        return data.profilePhoto || null;
      }
    } catch (error) {
      console.error(`Error loading profile photo for user ${userId}:`, error);
    }
    return null;
  };

  const loadBusyStatus = async (userId: string): Promise<boolean> => {
    if (!db) return false;
    
    try {
      const profileDoc = await getDoc(doc(db, 'profiles', userId));
      if (profileDoc.exists()) {
        const data = profileDoc.data();
        return Boolean(data.isBusy);
      }
    } catch (error) {
      console.error(`Error loading busy status for user ${userId}:`, error);
    }
    return false;
  };

  const loadMostRecentActiveTask = async (userId: string): Promise<Task | null> => {
    try {
      const tasks = await getTasksByUser(userId);
      // Filter out completed tasks and get the most recent active task
      const activeTasks = tasks.filter(task => task.status !== 'Complete');
      if (activeTasks.length > 0) {
        // Sort by updatedAt descending to get the most recently updated active task
        activeTasks.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        return activeTasks[0];
      }
      return null;
    } catch (error) {
      console.error(`Error loading most recent active task for user ${userId}:`, error);
      return null;
    }
  };

  const loadActiveUsers = async () => {
    if (!user || !db) return;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateString = format(today, 'yyyy-MM-dd');

      // Get all time entries for today
      const q = query(
        collection(db, 'timeEntries'),
        where('dateString', '==', dateString)
      );

      const querySnapshot = await getDocs(q);
      const users = await getAllUsers();
      const userMap = new Map(
        users.map((u: any) => [
          u.id,
          {
            name: u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
            email: u.email,
          },
        ])
      );

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

      // Sort by clock in time (most recent first) and limit to 3
      active.sort((a, b) => b.clockInTime.getTime() - a.clockInTime.getTime());
      const limitedActive = active.slice(0, 3);
      setActiveUsers(limitedActive);

      // Load profile photos, busy status, and most recent active task for active users
      const photoPromises = limitedActive.map(async (activeUser) => {
        const [photo, isBusy, task] = await Promise.all([
          loadProfilePhoto(activeUser.userId),
          loadBusyStatus(activeUser.userId),
          loadMostRecentActiveTask(activeUser.userId)
        ]);
        return { userId: activeUser.userId, photo, isBusy, task };
      });
      const results = await Promise.all(photoPromises);
      const newPhotos: Record<string, string> = {};
      const newBusyStatus: Record<string, boolean> = {};
      const newTasks: Record<string, Task | null> = {};
      results.forEach(({ userId, photo, isBusy, task }) => {
        if (photo) {
          newPhotos[userId] = photo;
        }
        newBusyStatus[userId] = isBusy;
        newTasks[userId] = task;
      });
      setProfilePhotos(prev => ({ ...prev, ...newPhotos }));
      setBusyStatus(prev => ({ ...prev, ...newBusyStatus }));
      setUserTasks(prev => ({ ...prev, ...newTasks }));
    } catch (error: any) {
      console.error('Error loading active users:', error);
    }
  };

  const loadRecentClockOuts = async () => {
    if (!user || !db) return;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateString = format(today, 'yyyy-MM-dd');

      // Get all time entries for today (we'll filter for clock outs in memory)
      const q = query(
        collection(db, 'timeEntries'),
        where('dateString', '==', dateString)
      );

      const querySnapshot = await getDocs(q);
      const users = await getAllUsers();
      const userMap = new Map(
        users.map((u: any) => [
          u.id,
          {
            name: u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
            email: u.email,
          },
        ])
      );

      const recent: RecentClockOut[] = [];
      querySnapshot.docs.forEach((doc) => {
        try {
          const data = getTimeEntryData(doc.data());
          // Only include entries that have clocked out
          if (data.clockOut && data.clockIn) {
            const userInfo = userMap.get(data.userId);
            if (userInfo) {
              recent.push({
                userId: data.userId,
                userName: userInfo.name,
                userEmail: userInfo.email,
                clockOutTime: data.clockOut.toDate(),
                clockInTime: data.clockIn.toDate(),
                entryId: doc.id,
              });
            }
          }
        } catch {
          // Skip invalid entries
        }
      });

      // Sort by clock out time (most recent first) and limit to 3
      recent.sort((a, b) => b.clockOutTime.getTime() - a.clockOutTime.getTime());
      const limitedRecent = recent.slice(0, 3);
      setRecentClockOuts(limitedRecent);

      // Load profile photos and most recent active task for recent clock outs
      const photoPromises = limitedRecent.map(async (recentUser) => {
        const [photo, task] = await Promise.all([
          loadProfilePhoto(recentUser.userId),
          loadMostRecentActiveTask(recentUser.userId)
        ]);
        return { userId: recentUser.userId, photo, task };
      });
      const photoResults = await Promise.all(photoPromises);
      const newPhotos: Record<string, string> = {};
      const newTasks: Record<string, Task | null> = {};
      photoResults.forEach(({ userId, photo, task }) => {
        if (photo) {
          newPhotos[userId] = photo;
        }
        newTasks[userId] = task;
      });
      setProfilePhotos(prev => ({ ...prev, ...newPhotos }));
      setUserTasks(prev => ({ ...prev, ...newTasks }));
    } catch (error: any) {
      console.error('Error loading recent clock outs:', error);
    }
  };

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await Promise.all([loadActiveUsers(), loadRecentClockOuts()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      loadData();
      setCurrentTime(new Date());
    }, 30000);

    // Update current time every minute for display (only needed for admin)
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => {
      clearInterval(interval);
      clearInterval(timeInterval);
    };
  }, [user]);

  const isAdmin = user?.role === 'admin';

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
      {/* Active Users Card */}
      <Card className="border-border/50 transition-smooth overflow-hidden group">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        <CardHeader className="pb-4 sm:pb-6 bg-gradient-to-br from-card to-card/50">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold">
            <div className="p-1.5 rounded-lg bg-emerald-500/10">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
            </div>
            Active Users
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm mt-1.5 hidden sm:block text-muted-foreground">
            Users currently clocked in
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 sm:p-4 border rounded-lg">
                  <Skeleton className="h-10 w-10 sm:h-12 sm:w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : activeUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="inline-flex p-4 rounded-2xl bg-emerald-500/10 mb-4">
                <Activity className="h-8 w-8 text-emerald-500 opacity-60" />
              </div>
              <p className="font-medium mb-1">No users currently clocked in</p>
              <p className="text-xs">Active users will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeUsers.map((activeUser) => {
                const hoursActive =
                  (currentTime.getTime() - activeUser.clockInTime.getTime()) /
                  (1000 * 60 * 60);
                return (
                  <div
                    key={activeUser.entryId}
                    className="group/item flex items-start gap-3 p-4 border rounded-xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent hover:from-emerald-500/15 hover:via-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/30 transition-smooth"
                  >
                    <div className="relative flex-shrink-0">
                      <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-lg animate-pulse" />
                      <Avatar className="relative h-12 w-12 sm:h-14 sm:w-14 border-2 border-emerald-500/50 ring-2 ring-emerald-500/20">
                        <AvatarImage 
                          src={profilePhotos[activeUser.userId] || undefined} 
                          alt={activeUser.userName}
                          className="object-cover"
                        />
                        <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-semibold">
                          {getInitials(activeUser.userName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-emerald-500 border-2 border-card animate-pulse ring-2 ring-emerald-500/30" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm sm:text-base truncate mb-0.5">
                        {activeUser.userName}
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate mb-2">
                        {activeUser.userEmail}
                      </p>
                      <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 flex-wrap">
                        {busyStatus[activeUser.userId] && (
                          <Badge variant="destructive" className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                            <AlertCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                            Busy
                          </Badge>
                        )}
                        {isAdmin && (
                          <>
                            <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                              <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                              <span className="hidden sm:inline">{formatTime(activeUser.clockInTime)}</span>
                              <span className="sm:hidden">{formatTime(activeUser.clockInTime).split(' ')[0]}</span>
                            </Badge>
                            <span className="text-[10px] sm:text-xs text-muted-foreground">
                              {Math.round(hoursActive * 100) / 100}h
                            </span>
                          </>
                        )}
                        {!isAdmin && (
                          <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-300">
                            Active
                          </Badge>
                        )}
                      </div>
                      {userTasks[activeUser.userId] && (
                        <div className="mt-3 pt-3 border-t border-emerald-500/20">
                          <div className="flex items-start gap-2.5">
                            <div className="p-1 rounded-lg bg-emerald-500/20 flex-shrink-0">
                              <CheckSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400 truncate mb-1">
                                {userTasks[activeUser.userId]?.name}
                              </p>
                              {userTasks[activeUser.userId]?.description && (
                                <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2 sm:line-clamp-1">
                                  {userTasks[activeUser.userId]?.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Clock Outs Card */}
      <Card className="border-border/50 transition-smooth overflow-hidden group">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        <CardHeader className="pb-4 sm:pb-6 bg-gradient-to-br from-card to-card/50">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold">
            <div className="p-1.5 rounded-lg bg-blue-500/10">
              <LogOut className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
            </div>
            Recent Clock Outs
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm mt-1.5 hidden sm:block text-muted-foreground">
            Users who clocked out recently
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 sm:p-4 border rounded-lg">
                  <Skeleton className="h-10 w-10 sm:h-12 sm:w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentClockOuts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="inline-flex p-4 rounded-2xl bg-blue-500/10 mb-4">
                <LogOut className="h-8 w-8 text-blue-500 opacity-60" />
              </div>
              <p className="font-medium mb-1">No recent clock outs today</p>
              <p className="text-xs">Recent clock outs will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentClockOuts.map((recent) => {
                const hoursWorked =
                  (recent.clockOutTime.getTime() - recent.clockInTime.getTime()) /
                  (1000 * 60 * 60);
                return (
                  <div
                    key={recent.entryId}
                    className="group/item flex items-start gap-3 p-4 border rounded-xl bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent hover:from-blue-500/15 hover:via-blue-500/10 border-blue-500/20 hover:border-blue-500/30 transition-smooth"
                  >
                    <div className="relative flex-shrink-0">
                      <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-lg" />
                      <Avatar className="relative h-12 w-12 sm:h-14 sm:w-14 border-2 border-blue-500/50 ring-2 ring-blue-500/20">
                        <AvatarImage 
                          src={profilePhotos[recent.userId] || undefined} 
                          alt={recent.userName}
                          className="object-cover"
                        />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white font-semibold">
                          {getInitials(recent.userName)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm sm:text-base truncate mb-0.5">
                        {recent.userName}
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate mb-2">
                        {recent.userEmail}
                      </p>
                      {isAdmin && (
                        <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                            <LogOut className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                            <span className="hidden sm:inline">{formatTime(recent.clockOutTime)}</span>
                            <span className="sm:hidden">{formatTime(recent.clockOutTime).split(' ')[0]}</span>
                          </Badge>
                          <span className="text-[10px] sm:text-xs text-muted-foreground">
                            {Math.round(hoursWorked * 100) / 100}h
                          </span>
                          <span className="text-[10px] sm:text-xs text-muted-foreground">
                            {formatDistanceToNow(recent.clockOutTime, {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      )}
                      {!isAdmin && (
                        <div className="mt-1.5">
                          <span className="text-xs sm:text-sm text-muted-foreground">
                            {formatDistanceToNow(recent.clockOutTime, {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      )}
                      {userTasks[recent.userId] && (
                        <div className="mt-3 pt-3 border-t border-blue-500/20">
                          <div className="flex items-start gap-2.5">
                            <div className="p-1 rounded-lg bg-blue-500/20 flex-shrink-0">
                              <CheckSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-400 truncate mb-1">
                                {userTasks[recent.userId]?.name}
                              </p>
                              {userTasks[recent.userId]?.description && (
                                <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2 sm:line-clamp-1">
                                  {userTasks[recent.userId]?.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

