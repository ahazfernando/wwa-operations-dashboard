"use client";

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogIn, LogOut } from 'lucide-react';

interface User {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
}

interface ClockUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allUsers: User[];
  selectedUserForClock: { id: string; name: string; email: string } | null;
  onUserSelect: (userId: string) => void;
  onClockIn: () => void;
  onClockOut: () => void;
  submitting: boolean;
}

export const ClockUserDialog = ({
  open,
  onOpenChange,
  allUsers,
  selectedUserForClock,
  onUserSelect,
  onClockIn,
  onClockOut,
  submitting,
}: ClockUserDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              onValueChange={onUserSelect}
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
                  onClick={onClockIn}
                  className="flex-1"
                  disabled={submitting}
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Clock In
                </Button>
                <Button
                  onClick={onClockOut}
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
  );
};










