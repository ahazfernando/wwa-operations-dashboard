"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, LogOut, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ActiveUser } from '@/components/clock/types';
import { formatTime } from '@/components/clock/utils';

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
      setActiveUsers(active.slice(0, 3));
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
      setRecentClockOuts(recent.slice(0, 3));
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

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Active Users Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-600" />
            Active Users
          </CardTitle>
          <CardDescription>Users currently clocked in</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : activeUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No users currently clocked in</p>
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
                    className="flex items-center gap-3 p-3 border rounded-lg bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/30 transition-colors"
                  >
                    <div className="relative">
                      <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center text-white font-medium">
                        {activeUser.userName.charAt(0).toUpperCase()}
                      </div>
                      <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-green-500 border-2 border-white dark:border-gray-900 animate-pulse" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {activeUser.userName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {activeUser.userEmail}
                      </p>
                      {isAdmin && (
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            {formatTime(activeUser.clockInTime)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {Math.round(hoursActive * 100) / 100}h active
                          </span>
                        </div>
                      )}
                      {!isAdmin && (
                        <div className="mt-1">
                          <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-300">
                            Active
                          </Badge>
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5 text-blue-600" />
            Recent Clock Outs
          </CardTitle>
          <CardDescription>Users who clocked out recently</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentClockOuts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <LogOut className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No recent clock outs today</p>
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
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                      {recent.userName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {recent.userName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {recent.userEmail}
                      </p>
                      {isAdmin && (
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            <LogOut className="h-3 w-3 mr-1" />
                            {formatTime(recent.clockOutTime)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {Math.round(hoursWorked * 100) / 100}h worked
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(recent.clockOutTime, {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      )}
                      {!isAdmin && (
                        <div className="mt-1">
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(recent.clockOutTime, {
                              addSuffix: true,
                            })}
                          </span>
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

