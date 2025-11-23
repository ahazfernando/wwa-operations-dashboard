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
import { Calendar as CalendarIcon, Search, LogIn, LogOut, MapPin, Grid3x3, List, Clock as ClockIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { TimeEntry, MergedTimeEntry, ActiveUser } from './types';
import { formatDate, formatTime, mergeEntriesByUserAndDate } from './utils';

interface MergedEntriesTableProps {
  allUsersEntries: TimeEntry[];
  activeUsers: ActiveUser[];
  loadingAdmin: boolean;
  adminSelectedDate: Date | undefined;
  searchQuery: string;
  sortOrder: 'most' | 'least' | 'none';
  selectedMonth: string;
  statusFilter: 'all' | 'active' | 'completed';
  currentPage: number;
  submitting: boolean;
  onDateChange: (date: Date | undefined) => void;
  onSearchChange: (query: string) => void;
  onSortChange: (order: 'most' | 'least' | 'none') => void;
  onMonthChange: (month: string) => void;
  onStatusFilterChange: (filter: 'all' | 'active' | 'completed') => void;
  onPageChange: (page: number) => void;
  onShowSessions: (userId: string, userName: string, userEmail: string, date: Date) => void;
  onClockInUser: (userId: string, userName: string) => void;
  onClockOutUser: (userId: string, userName: string) => void;
}

export const MergedEntriesTable = ({
  allUsersEntries,
  activeUsers,
  loadingAdmin,
  adminSelectedDate,
  searchQuery,
  sortOrder,
  selectedMonth,
  statusFilter,
  currentPage,
  submitting,
  onDateChange,
  onSearchChange,
  onSortChange,
  onMonthChange,
  onStatusFilterChange,
  onPageChange,
  onShowSessions,
  onClockInUser,
  onClockOutUser,
}: MergedEntriesTableProps) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const mergedEntries = mergeEntriesByUserAndDate(allUsersEntries);
  
  let filteredEntries = mergedEntries.filter((entry) => {
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
    
    // Status filter
    if (statusFilter === 'active') {
      if (!entry.isActive) {
        return false;
      }
    } else if (statusFilter === 'completed') {
      if (entry.isActive) {
        return false;
      }
    }
    
    return true;
  });

  // Sort: Active users first, then by hours if specified
  filteredEntries = [...filteredEntries].sort((a, b) => {
    // First, sort by active status (active users first)
    if (a.isActive !== b.isActive) {
      return a.isActive ? -1 : 1; // Active (true) comes before completed (false)
    }
    
    // If both have the same status, apply hour-based sorting if specified
    if (sortOrder === 'most') {
      return b.totalHours - a.totalHours;
    } else if (sortOrder === 'least') {
      return a.totalHours - b.totalHours;
    }
    
    // If no sorting specified, maintain original order within each status group
    return 0;
  });

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
            <CardTitle className="mb-2">Merged Time Entries</CardTitle>
            <CardDescription>View merged clock in/out records grouped by user and date</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-3 rounded-r-none"
                onClick={() => setViewMode('grid')}
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-3 rounded-l-none"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
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
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active only</SelectItem>
              <SelectItem value="completed">Completed only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loadingAdmin ? (
          viewMode === 'grid' ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-6 w-32 mb-2" />
                    <Skeleton className="h-4 w-24 mb-4" />
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <div className="space-y-3">
                  <div className="grid grid-cols-10 gap-4 pb-2 border-b">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <Skeleton key={i} className="h-4 w-20" />
                    ))}
                  </div>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="grid grid-cols-10 gap-4 py-2">
                      {Array.from({ length: 10 }).map((_, j) => (
                        <Skeleton key={j} className="h-8 w-full" />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        ) : filteredEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {searchQuery || selectedMonth !== 'all' || statusFilter !== 'all' ? 'No merged entries found matching your filters' : 'No merged entries found for this date'}
          </p>
        ) : viewMode === 'grid' ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {paginatedEntries.map((entry, index) => {
                const isUserActive = activeUsers.some(au => au.userId === entry.userId);
                return (
                  <Card key={`${entry.userId}-${format(entry.date, 'yyyy-MM-dd')}-${index}`} className="relative">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <button
                            onClick={() => onShowSessions(entry.userId, entry.userName, entry.userEmail, entry.date)}
                            className="text-left hover:underline cursor-pointer"
                          >
                            <h3 className="font-semibold text-base mb-1">{entry.userName || 'Unknown'}</h3>
                            <p className="text-sm text-muted-foreground">{entry.userEmail}</p>
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          {entry.isActive ? (
                            <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                              <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="default">Completed</Badge>
                          )}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => isUserActive 
                                    ? onClockOutUser(entry.userId, entry.userName || 'User')
                                    : onClockInUser(entry.userId, entry.userName || 'User')
                                  }
                                  disabled={submitting}
                                  className="h-6 w-6 p-0"
                                >
                                  {isUserActive ? (
                                    <LogOut className="h-3 w-3" />
                                  ) : (
                                    <LogIn className="h-3 w-3" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{isUserActive ? 'Clock out user' : 'Clock in user'}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <ClockIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Date:</span>
                          <span className="font-medium">{formatDate(entry.date)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">First Clock In</span>
                          <span className="font-medium">{formatTime(entry.firstClockIn) || '-'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Last Clock Out</span>
                          <span className="font-medium">{formatTime(entry.lastClockOut) || '-'}</span>
                        </div>
                        {entry.clockInLocation || entry.clockInSystemLocation ? (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-xs text-muted-foreground cursor-help">
                                    {entry.clockInLocation?.latitude && entry.clockInLocation?.longitude
                                      ? `${entry.clockInLocation.latitude.toFixed(4)}, ${entry.clockInLocation.longitude.toFixed(4)}`
                                      : entry.clockInLocation?.error
                                      ? 'GPS unavailable'
                                      : 'No GPS'}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <div className="space-y-2">
                                    {entry.clockInLocation && (
                                      <div>
                                        <p className="font-semibold text-xs mb-1">GPS Location:</p>
                                        {entry.clockInLocation.latitude && entry.clockInLocation.longitude ? (
                                          <div className="text-xs space-y-1">
                                            <p>Coordinates: {entry.clockInLocation.latitude.toFixed(6)}, {entry.clockInLocation.longitude.toFixed(6)}</p>
                                            {entry.clockInLocation.accuracy && (
                                              <p>Accuracy: ±{Math.round(entry.clockInLocation.accuracy)}m</p>
                                            )}
                                            {entry.clockInLocation.address && (
                                              <p>Address: {entry.clockInLocation.address}</p>
                                            )}
                                            <a
                                              href={`https://www.google.com/maps?q=${entry.clockInLocation.latitude},${entry.clockInLocation.longitude}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-primary hover:underline"
                                            >
                                              View on Google Maps
                                            </a>
                                          </div>
                                        ) : (
                                          <p className="text-xs text-muted-foreground">
                                            {entry.clockInLocation.error || 'GPS location not available'}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                    {entry.clockInSystemLocation && (
                                      <div>
                                        <p className="font-semibold text-xs mb-1">System Info:</p>
                                        <div className="text-xs space-y-1">
                                          <p>Timezone: {entry.clockInSystemLocation.timezone}</p>
                                          <p>Platform: {entry.clockInSystemLocation.platform}</p>
                                          <p>Language: {entry.clockInSystemLocation.language}</p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        ) : null}
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Total Hours</span>
                            <Badge variant="outline">{Math.round(entry.totalHours * 100) / 100}h</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Sessions</span>
                            <Badge variant="secondary">{entry.sessionCount}</Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
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
          </>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>First Clock In</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Last Clock Out</TableHead>
                  <TableHead>Total Hours</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEntries.map((entry, index) => (
                  <TableRow key={`${entry.userId}-${format(entry.date, 'yyyy-MM-dd')}-${index}`}>
                    <TableCell className="font-medium">
                      <button
                        onClick={() => onShowSessions(entry.userId, entry.userName, entry.userEmail, entry.date)}
                        className="text-left hover:underline cursor-pointer text-primary"
                      >
                        {entry.userName || 'Unknown'}
                      </button>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.userEmail}
                    </TableCell>
                    <TableCell>{formatDate(entry.date)}</TableCell>
                    <TableCell>{formatTime(entry.firstClockIn)}</TableCell>
                    <TableCell>
                      {entry.clockInLocation || entry.clockInSystemLocation ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 text-sm cursor-help">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                {entry.clockInLocation?.latitude && entry.clockInLocation?.longitude ? (
                                  <span className="text-muted-foreground">
                                    {entry.clockInLocation.latitude.toFixed(4)}, {entry.clockInLocation.longitude.toFixed(4)}
                                  </span>
                                ) : entry.clockInLocation?.error ? (
                                  <span className="text-destructive text-xs">GPS unavailable</span>
                                ) : (
                                  <span className="text-muted-foreground text-xs">No GPS</span>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <div className="space-y-2">
                                {entry.clockInLocation && (
                                  <div>
                                    <p className="font-semibold text-xs mb-1">GPS Location:</p>
                                    {entry.clockInLocation.latitude && entry.clockInLocation.longitude ? (
                                      <div className="text-xs space-y-1">
                                        <p>Coordinates: {entry.clockInLocation.latitude.toFixed(6)}, {entry.clockInLocation.longitude.toFixed(6)}</p>
                                        {entry.clockInLocation.accuracy && (
                                          <p>Accuracy: ±{Math.round(entry.clockInLocation.accuracy)}m</p>
                                        )}
                                        {entry.clockInLocation.address && (
                                          <p>Address: {entry.clockInLocation.address}</p>
                                        )}
                                        <a
                                          href={`https://www.google.com/maps?q=${entry.clockInLocation.latitude},${entry.clockInLocation.longitude}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-primary hover:underline"
                                        >
                                          View on Google Maps
                                        </a>
                                      </div>
                                    ) : (
                                      <p className="text-xs text-muted-foreground">
                                        {entry.clockInLocation.error || 'GPS location not available'}
                                      </p>
                                    )}
                                  </div>
                                )}
                                {entry.clockInSystemLocation && (
                                  <div>
                                    <p className="font-semibold text-xs mb-1">System Info:</p>
                                    <div className="text-xs space-y-1">
                                      <p>Timezone: {entry.clockInSystemLocation.timezone}</p>
                                      <p>Platform: {entry.clockInSystemLocation.platform}</p>
                                      <p>Language: {entry.clockInSystemLocation.language}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell>{formatTime(entry.lastClockOut)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{Math.round(entry.totalHours * 100) / 100}h</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{entry.sessionCount}</Badge>
                    </TableCell>
                    <TableCell>
                      {entry.isActive ? (
                        <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                          <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="default">Completed</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <div className="flex items-center gap-1">
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






