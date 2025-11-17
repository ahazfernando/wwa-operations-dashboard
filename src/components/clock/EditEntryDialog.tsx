"use client";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { TimeEntry } from './types';

interface EditEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingEntry: TimeEntry | null;
  editingSessionNumber: number | null;
  editDate: Date;
  editClockIn: string;
  editClockOut: string;
  onDateChange: (date: Date) => void;
  onClockInChange: (value: string) => void;
  onClockOutChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  submitting: boolean;
}

export const EditEntryDialog = ({
  open,
  onOpenChange,
  editingEntry,
  editingSessionNumber,
  editDate,
  editClockIn,
  editClockOut,
  onDateChange,
  onClockInChange,
  onClockOutChange,
  onSave,
  onCancel,
  submitting,
}: EditEntryDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                  onSelect={(date) => date && onDateChange(date)}
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
              onChange={(e) => onClockInChange(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editClockOut">Clock Out Time (HH:MM) - Optional</Label>
            <Input
              id="editClockOut"
              type="time"
              value={editClockOut}
              onChange={(e) => onClockOutChange(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={onSave}
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
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};










