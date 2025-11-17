"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, LogOut } from 'lucide-react';
import { ActiveUser } from './types';
import { formatTime } from './utils';

interface ActiveUsersCardProps {
  activeUsers: ActiveUser[];
  currentTime: Date;
  submitting: boolean;
  onClockOut: (entryId: string, userId: string, userName: string) => void;
}

export const ActiveUsersCard = ({
  activeUsers,
  currentTime,
  submitting,
  onClockOut,
}: ActiveUsersCardProps) => {
  return (
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
                    onClick={() => onClockOut(activeUser.entryId, activeUser.userId, activeUser.userName)}
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
  );
};










