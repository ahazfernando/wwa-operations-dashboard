"use client";

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, Trash2 } from 'lucide-react';
import { TimeEntry } from './types';
import { formatDate, formatTime } from './utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SessionDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUserSessions: TimeEntry[];
  selectedUserInfo: { name: string; email: string; date: Date } | null;
  isAdmin: boolean;
  onEditEntry: (entry: TimeEntry, sessionNumber: number) => void;
  onDeleteEntry?: (entry: TimeEntry) => void;
}

export const SessionDetailsDialog = ({
  open,
  onOpenChange,
  selectedUserSessions,
  selectedUserInfo,
  isAdmin,
  onEditEntry,
  onDeleteEntry,
}: SessionDetailsDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                                      onOpenChange(false);
                                      onEditEntry(session, index + 1);
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
                            {onDeleteEntry && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => onDeleteEntry(session)}
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
                            )}
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
  );
};


