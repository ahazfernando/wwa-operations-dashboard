"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from '@/components/ui/pagination';
import { Calendar as CalendarIcon, Search, Edit, LogIn, LogOut } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { TimeEntry, ActiveUser } from './types';
import { formatDate, formatTime } from './utils';

interface IndividualEntriesTableProps {
  allUsersEntries: TimeEntry[];
  activeUsers: ActiveUser[];
  loadingAdmin: boolean;
  adminSelectedDate: Date | undefined;
  searchQuery: string;
  sortOrder: 'most' | 'least' | 'none';
  selectedMonth: string;
  currentPage: number;
  submitting: boolean;
  onDateChange: (date: Date | undefined) => void;
  onSearchChange: (query: string) => void;
  onSortChange: (order: 'most' | 'least' | 'none') => void;
  onMonthChange: (month: string) => void;
  onPageChange: (page: number) => void;
  onEditEntry: (entry: TimeEntry) => void;
  onClockInUser: (userId: string, userName: string) => void;
  onClockOutUser: (userId: string, userName: string) => void;
}

export const IndividualEntriesTable = ({
  allUsersEntries,
  activeUsers,
  loadingAdmin,
  adminSelectedDate,
  searchQuery,
  sortOrder,
  selectedMonth,
  currentPage,
  submitting,
  onDateChange,
  onSearchChange,
  onSortChange,
  onMonthChange,
  onPageChange,
  onEditEntry,
  onClockInUser,
  onClockOutUser,
}: IndividualEntriesTableProps) => {
  let filteredEntries = allUsersEntries.filter((entry) => {
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const userName = (entry.userName || '').toLowerCase();
      const userEmail = (entry.userEmail || '').toLowerCase();
      if (!userName.includes(query) && !userEmail.includes(query)) {
        return false;
      }
    }
    
    // Month filter
    if (selectedMonth !== 'all') {
      const entryMonth = entry.date.getMonth().toString();
      if (entryMonth !== selectedMonth) {
        return false;
      }
    }
    
    return true;
  });

  // Sort by hours
  if (sortOrder === 'most') {
    filteredEntries = [...filteredEntries].sort((a, b) => {
      const hoursA = a.totalHours || 0;
      const hoursB = b.totalHours || 0;
      return hoursB - hoursA;
    });
  } else if (sortOrder === 'least') {
    filteredEntries = [...filteredEntries].sort((a, b) => {
      const hoursA = a.totalHours || 0;
      const hoursB = b.totalHours || 0;
      return hoursA - hoursB;
    });
  }

  // Pagination
  const itemsPerPage = 5;
  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedEntries = filteredEntries.slice(startIndex, endIndex);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center mb-4">
          <div>
            <CardTitle className="mb-2">All Users Time Entries</CardTitle>
            <CardDescription>View individual clock in/out records for all users</CardDescription>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarIcon className="h-4 w-4 mr-2" />
                {adminSelectedDate ? format(adminSelectedDate, 'MMM dd, yyyy') : 'Today'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={adminSelectedDate}
                onSelect={(date) => {
                  onDateChange(date || new Date());
                }}
                initialFocus
              />
              <div className="p-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => onDateChange(new Date())}
                >
                  Show Today
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="mt-6 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={sortOrder} onValueChange={onSortChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Sort by hours" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No sorting</SelectItem>
              <SelectItem value="most">Most hours worked</SelectItem>
              <SelectItem value="least">Least hours worked</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedMonth} onValueChange={onMonthChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All months</SelectItem>
              <SelectItem value="0">January</SelectItem>
              <SelectItem value="1">February</SelectItem>
              <SelectItem value="2">March</SelectItem>
              <SelectItem value="3">April</SelectItem>
              <SelectItem value="4">May</SelectItem>
              <SelectItem value="5">June</SelectItem>
              <SelectItem value="6">July</SelectItem>
              <SelectItem value="7">August</SelectItem>
              <SelectItem value="8">September</SelectItem>
              <SelectItem value="9">October</SelectItem>
              <SelectItem value="10">November</SelectItem>
              <SelectItem value="11">December</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loadingAdmin ? (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <div className="space-y-3">
                <div className="grid grid-cols-8 gap-4 pb-2 border-b">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-4 w-20" />
                  ))}
                </div>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-8 gap-4 py-2">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <Skeleton key={j} className="h-8 w-full" />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : filteredEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {searchQuery || selectedMonth !== 'all' ? 'No time entries found matching your filters' : 'No time entries found for this date'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Total Hours</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {entry.userName || 'Unknown'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.userEmail}
                    </TableCell>
                    <TableCell>{formatDate(entry.date)}</TableCell>
                    <TableCell>{formatTime(entry.clockIn)}</TableCell>
                    <TableCell>{formatTime(entry.clockOut)}</TableCell>
                    <TableCell>
                      {entry.totalHours ? (
                        <Badge variant="outline">{entry.totalHours}h</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.clockOut ? (
                        <Badge variant="default">Completed</Badge>
                      ) : (
                        <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                          <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                          Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onEditEntry(entry)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Edit entry</p>
                            </TooltipContent>
                          </Tooltip>
                          {(() => {
                            const isUserActive = activeUsers.some(au => au.userId === entry.userId);
                            
                            if (isUserActive) {
                              return (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => onClockOutUser(entry.userId, entry.userName || 'User')}
                                      disabled={submitting}
                                      className="h-8 w-8 p-0"
                                    >
                                      <LogOut className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Clock out user</p>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            } else {
                              return (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => onClockInUser(entry.userId, entry.userName || 'User')}
                                      disabled={submitting}
                                      className="h-8 w-8 p-0"
                                    >
                                      <LogIn className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Clock in user</p>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            }
                          })()}
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className="mt-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage > 1) {
                            onPageChange(currentPage - 1);
                          }
                        }}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                onPageChange(page);
                              }}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      } else if (page === currentPage - 2 || page === currentPage + 2) {
                        return (
                          <PaginationItem key={page}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        );
                      }
                      return null;
                    })}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage < totalPages) {
                            onPageChange(currentPage + 1);
                          }
                        }}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};






