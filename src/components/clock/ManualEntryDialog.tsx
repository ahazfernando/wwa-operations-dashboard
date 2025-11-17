"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Plus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface ManualEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (date: Date, clockIn: string, clockOut: string) => Promise<void>;
  submitting: boolean;
}

export const ManualEntryDialog = ({
  open,
  onOpenChange,
  onSubmit,
  submitting,
}: ManualEntryDialogProps) => {
  const [manualDate, setManualDate] = useState<Date>(new Date());
  const [manualClockIn, setManualClockIn] = useState('');
  const [manualClockOut, setManualClockOut] = useState('');

  const handleSubmit = async () => {
    await onSubmit(manualDate, manualClockIn, manualClockOut);
    setManualClockIn('');
    setManualClockOut('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Add Manual Entry
        </Button>
      </DialogTrigger>
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
            onClick={handleSubmit}
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
  );
};










