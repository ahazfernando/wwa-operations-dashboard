"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock as ClockIcon, LogIn, LogOut } from 'lucide-react';
import { format } from 'date-fns';
import { TimeEntry } from './types';
import { formatTime } from './utils';

interface ClockControlsProps {
  currentTime: Date;
  isClockedIn: boolean;
  currentEntry: TimeEntry | null;
  onClockIn: () => void;
  onClockOut: () => void;
}

export const ClockControls = ({
  currentTime,
  isClockedIn,
  currentEntry,
  onClockIn,
  onClockOut,
}: ClockControlsProps) => {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClockIcon />
            Current Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-primary">
            {format(currentTime, 'h:mm:ss a')}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {format(currentTime, 'EEEE, MMMM dd, yyyy')}
          </p>
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
              onClick={onClockIn} 
              disabled={isClockedIn}
              className="flex-1"
            >
              <LogIn className="h-4 w-4 mr-2" />
              Clock In
            </Button>
            <Button 
              onClick={onClockOut} 
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
  );
};










