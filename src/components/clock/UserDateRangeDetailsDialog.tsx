"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Edit, Trash2, Calendar, Clock, UserCheck, CalendarOff, TrendingUp, Plus, Download, DollarSign } from 'lucide-react';
import { TimeEntry } from './types';
import { formatDate, formatTime } from './utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';
import { type DateRange } from 'react-day-picker';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface UserDateRangeDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEntries: TimeEntry[];
  userInfo: { userId: string; name: string; email: string };
  dateRange: DateRange | undefined;
  leaveDays: number;
  isAdmin: boolean;
  onEditEntry: (entry: TimeEntry | null, sessionNumber: number, date?: Date, userId?: string) => void;
  onDeleteEntry?: (entry: TimeEntry) => void;
}

interface DayEntry {
  date: Date;
  entries: TimeEntry[];
  totalHours: number;
  hasClockIn: boolean;
  isLeave: boolean;
}

export const UserDateRangeDetailsDialog = ({
  open,
  onOpenChange,
  userEntries,
  userInfo,
  dateRange,
  leaveDays,
  isAdmin,
  onEditEntry,
  onDeleteEntry,
}: UserDateRangeDetailsDialogProps) => {
  const [hourlyRate, setHourlyRate] = useState<string>('');
  const [currency, setCurrency] = useState<'LKR' | 'AUD'>('LKR');
  const [exchangeRate, setExchangeRate] = useState<string>('220'); // Default: 1 AUD = 220 LKR
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  // Load profile photo when dialog opens
  useEffect(() => {
    const loadProfilePhoto = async () => {
      if (!open || !userInfo.userId || !db) return;
      
      try {
        const profileDoc = await getDoc(doc(db, 'profiles', userInfo.userId));
        if (profileDoc.exists()) {
          const data = profileDoc.data();
          setProfilePhoto(data.profilePhoto || null);
        } else {
          setProfilePhoto(null);
        }
      } catch (error) {
        console.error('Error loading profile photo:', error);
        setProfilePhoto(null);
      }
    };

    loadProfilePhoto();
  }, [open, userInfo.userId]);

  if (!dateRange?.from || !dateRange?.to) {
    return null;
  }

  // Generate all dates in the range
  const startDate = startOfDay(dateRange.from);
  const endDate = endOfDay(dateRange.to);
  const allDates = eachDayOfInterval({ start: startDate, end: endDate });

  // Group entries by date
  const entriesByDate = new Map<string, TimeEntry[]>();
  userEntries.forEach(entry => {
    const dateKey = format(entry.date, 'yyyy-MM-dd');
    if (!entriesByDate.has(dateKey)) {
      entriesByDate.set(dateKey, []);
    }
    entriesByDate.get(dateKey)!.push(entry);
  });

  // Create day entries with leave information
  const dayEntries: DayEntry[] = allDates.map(date => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const entries = entriesByDate.get(dateKey) || [];
    
    // Sort entries by clock in time
    const sortedEntries = [...entries].sort((a, b) => {
      if (!a.clockIn || !b.clockIn) return 0;
      return a.clockIn.getTime() - b.clockIn.getTime();
    });

    const totalHours = sortedEntries.reduce((sum, e) => sum + (e.totalHours || 0), 0);
    const hasClockIn = sortedEntries.some(e => e.clockIn !== null);
    
    return {
      date,
      entries: sortedEntries,
      totalHours,
      hasClockIn,
      isLeave: false, // Will be calculated based on leaveDays if needed
    };
  });

  // Calculate statistics
  const attendanceDays = dayEntries.filter(d => d.hasClockIn).length;
  const totalHoursWorked = userEntries.reduce((sum, e) => sum + (e.totalHours || 0), 0);
  const totalSessions = userEntries.length;

  // CSV download function
  const handleDownloadCSV = () => {
    // Create CSV content
    const csvRows: string[] = [];

    // Add header information
    csvRows.push('User Time Details Report');
    csvRows.push(`User: ${userInfo.name}`);
    csvRows.push(`Email: ${userInfo.email}`);
    csvRows.push(`Period: ${format(dateRange.from, 'MMM dd, yyyy')} - ${format(dateRange.to, 'MMM dd, yyyy')}`);
    csvRows.push(''); // Empty row

    // Add summary statistics
    csvRows.push('Summary Statistics');
    csvRows.push(`Attendance Days,${attendanceDays}`);
    csvRows.push(`Leave Days,${leaveDays}`);
    csvRows.push(`Total Hours,${Math.round(totalHoursWorked * 100) / 100}`);
    csvRows.push(`Total Sessions,${totalSessions}`);
    csvRows.push(`Average Hours/Day,${attendanceDays > 0 ? Math.round((totalHoursWorked / attendanceDays) * 100) / 100 : 0}`);
    csvRows.push(''); // Empty row

    // Add daily breakdown header
    csvRows.push('Daily Breakdown');
    csvRows.push('Date,First Clock In,Last Clock Out,Sessions,Hours,Status');

    // Add daily breakdown data
    dayEntries.forEach((dayEntry) => {
      const firstEntry = dayEntry.entries[0];
      const lastEntry = dayEntry.entries[dayEntry.entries.length - 1];
      const hasActiveSession = dayEntry.entries.some(e => !e.clockOut);

      const date = formatDate(dayEntry.date);
      const firstClockIn = firstEntry?.clockIn ? formatTime(firstEntry.clockIn) : '-';
      const lastClockOut = lastEntry?.clockOut ? formatTime(lastEntry.clockOut) : '-';
      const sessions = dayEntry.entries.length.toString();
      const hours = dayEntry.totalHours > 0 ? `${Math.round(dayEntry.totalHours * 100) / 100}` : '-';
      
      let status = 'No Entry';
      if (dayEntry.hasClockIn) {
        status = hasActiveSession ? 'Active' : 'Completed';
      }

      csvRows.push(`${date},${firstClockIn},${lastClockOut},${sessions},${hours},${status}`);
    });

    csvRows.push(''); // Empty row

    // Add detailed sessions
    if (dayEntries.some(de => de.entries.length > 0)) {
      csvRows.push('Detailed Sessions');
      csvRows.push('Date,Session #,Clock In,Clock Out,Hours,Status');

      dayEntries
        .filter(de => de.entries.length > 0)
        .forEach((dayEntry) => {
          dayEntry.entries.forEach((entry, index) => {
            const date = formatDate(dayEntry.date);
            const sessionNum = (index + 1).toString();
            const clockIn = formatTime(entry.clockIn);
            const clockOut = formatTime(entry.clockOut);
            const hours = entry.totalHours ? entry.totalHours.toString() : '-';
            const status = entry.clockOut ? 'Completed' : 'Active';

            csvRows.push(`${date},${sessionNum},${clockIn},${clockOut},${hours},${status}`);
          });
        });
    }

    // Convert to CSV string
    const csvContent = csvRows.join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `time-details-${userInfo.name.replace(/\s+/g, '-')}-${format(dateRange.from, 'yyyy-MM-dd')}-${format(dateRange.to, 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  // Calculate salary
  const hourlyRateNum = parseFloat(hourlyRate) || 0;
  const exchangeRateNum = parseFloat(exchangeRate) || 220;
  
  // Calculate salary in LKR (base currency)
  const totalSalaryLKR = totalHoursWorked * hourlyRateNum;
  const totalSalaryAUD = totalSalaryLKR / exchangeRateNum;
  
  // Get salary based on selected currency
  const totalSalary = currency === 'LKR' ? totalSalaryLKR : totalSalaryAUD;
  const hourlyRateDisplay = currency === 'LKR' ? hourlyRateNum : hourlyRateNum / exchangeRateNum;
  
  const salaryByDay = dayEntries.map(dayEntry => {
    const salaryLKR = dayEntry.totalHours * hourlyRateNum;
    const salaryAUD = salaryLKR / exchangeRateNum;
    return {
      date: dayEntry.date,
      hours: dayEntry.totalHours,
      salaryLKR,
      salaryAUD,
      salary: currency === 'LKR' ? salaryLKR : salaryAUD,
      hasEntry: dayEntry.hasClockIn,
    };
  });
  
  const currencySymbol = currency === 'LKR' ? 'Rs.' : 'A$';
  const formatCurrency = (amount: number) => {
    return currency === 'LKR' 
      ? `Rs. ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `A$ ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary/20 flex-shrink-0">
              <AvatarImage src={profilePhoto || undefined} alt={userInfo.name} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                {userInfo.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <DialogTitle>User Time Details</DialogTitle>
              <DialogDescription>
                Time tracking details for {userInfo.name}
              </DialogDescription>
              <div className="space-y-1 mt-2">
                <div className="text-xs text-muted-foreground">
                  {userInfo.email}
                </div>
                <div className="text-xs text-muted-foreground">
                  Period: {format(dateRange.from, 'MMM dd, yyyy')} - {format(dateRange.to, 'MMM dd, yyyy')}
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="time-details" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="time-details">Time Details</TabsTrigger>
            <TabsTrigger value="salary">Salary Calculation</TabsTrigger>
          </TabsList>

          <TabsContent value="time-details" className="mt-4">
            {/* Download CSV Button */}
            <div className="flex justify-end mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadCSV}
              >
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </Button>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Attendance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{attendanceDays}</div>
              <p className="text-xs text-muted-foreground">days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <CalendarOff className="h-4 w-4" />
                Leave Days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{leaveDays}</div>
              <p className="text-xs text-muted-foreground">days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Total Hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(totalHoursWorked * 100) / 100}h
              </div>
              <p className="text-xs text-muted-foreground">
                {totalSessions} sessions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Avg Hours/Day
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {attendanceDays > 0 
                  ? Math.round((totalHoursWorked / attendanceDays) * 100) / 100 
                  : 0}h
              </div>
              <p className="text-xs text-muted-foreground">per day</p>
            </CardContent>
          </Card>
        </div>

        {/* Daily Entries Table */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4">Daily Breakdown</h3>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>First Clock In</TableHead>
                  <TableHead>Last Clock Out</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {dayEntries.map((dayEntry) => {
                  const firstEntry = dayEntry.entries[0];
                  const lastEntry = dayEntry.entries[dayEntry.entries.length - 1];
                  const hasActiveSession = dayEntry.entries.some(e => !e.clockOut);

                  return (
                    <TableRow key={format(dayEntry.date, 'yyyy-MM-dd')}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatDate(dayEntry.date)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {firstEntry?.clockIn ? (
                          formatTime(firstEntry.clockIn)
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {lastEntry?.clockOut ? (
                          formatTime(lastEntry.clockOut)
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{dayEntry.entries.length}</Badge>
                      </TableCell>
                      <TableCell>
                        {dayEntry.totalHours > 0 ? (
                          <Badge variant="outline">
                            {Math.round(dayEntry.totalHours * 100) / 100}h
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {!dayEntry.hasClockIn ? (
                          <Badge variant="outline" className="text-muted-foreground">
                            No Entry
                          </Badge>
                        ) : hasActiveSession ? (
                          <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="default">Completed</Badge>
                        )}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {dayEntry.entries.length > 0 ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        onOpenChange(false);
                                        onEditEntry(dayEntry.entries[0], 1);
                                      }}
                                      className="h-8 w-8 p-0"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Edit entry</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        onOpenChange(false);
                                        onEditEntry(null, 1, dayEntry.date, userInfo.userId);
                                      }}
                                      className="h-8 w-8 p-0"
                                    >
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Add entry</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Detailed Sessions View (Expandable) */}
        {dayEntries.some(de => de.entries.length > 0) && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-4">Detailed Sessions</h3>
            <div className="space-y-4">
              {dayEntries
                .filter(de => de.entries.length > 0)
                .map((dayEntry) => (
                  <Card key={format(dayEntry.date, 'yyyy-MM-dd')}>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {formatDate(dayEntry.date)}
                      </CardTitle>
                      <CardDescription>
                        {dayEntry.entries.length} session{dayEntry.entries.length !== 1 ? 's' : ''} • {Math.round(dayEntry.totalHours * 100) / 100}h total
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
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
                          {dayEntry.entries.map((entry, index) => (
                            <TableRow key={entry.id}>
                              <TableCell className="font-medium">
                                Session {index + 1}
                              </TableCell>
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
                                              onEditEntry(entry, index + 1);
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
                                              onClick={() => onDeleteEntry(entry)}
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
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        )}
          </TabsContent>

          <TabsContent value="salary" className="mt-4">
            <div className="space-y-6">
              {/* Hourly Rate Input */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Salary Calculation Settings
                  </CardTitle>
                  <CardDescription>
                    Enter the hourly rate in LKR to calculate the employee's salary for this period
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="hourly-rate">Hourly Rate (LKR)</Label>
                        <Input
                          id="hourly-rate"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Enter hourly rate in LKR"
                          value={hourlyRate}
                          onChange={(e) => setHourlyRate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="currency">Display Currency</Label>
                        <Select value={currency} onValueChange={(value: 'LKR' | 'AUD') => setCurrency(value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="LKR">LKR (Sri Lankan Rupees)</SelectItem>
                            <SelectItem value="AUD">AUD (Australian Dollars)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="exchange-rate">Exchange Rate (1 AUD = ? LKR)</Label>
                      <Input
                        id="exchange-rate"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="220"
                        value={exchangeRate}
                        onChange={(e) => setExchangeRate(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Current rate: 1 AUD = {exchangeRateNum.toFixed(2)} LKR
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Salary Summary */}
              {hourlyRateNum > 0 && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Total Hours
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {Math.round(totalHoursWorked * 100) / 100}h
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Hourly Rate ({currency})
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {formatCurrency(hourlyRateDisplay)}
                        </div>
                        {currency === 'AUD' && (
                          <p className="text-xs text-muted-foreground mt-1">
                            (Rs. {hourlyRateNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          Total Salary ({currency})
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                          {formatCurrency(totalSalary)}
                        </div>
                        {currency === 'AUD' && (
                          <p className="text-xs text-muted-foreground mt-1">
                            (Rs. {totalSalaryLKR.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                          </p>
                        )}
                        {currency === 'LKR' && (
                          <p className="text-xs text-muted-foreground mt-1">
                            (A$ {totalSalaryAUD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Daily Salary Breakdown */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Daily Salary Breakdown</CardTitle>
                      <CardDescription>
                        Salary calculation for each day in the selected period
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Hours</TableHead>
                              <TableHead>Rate</TableHead>
                              <TableHead>Salary</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {salaryByDay.map((day) => (
                              <TableRow key={format(day.date, 'yyyy-MM-dd')}>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    {formatDate(day.date)}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {day.hours > 0 ? (
                                    <Badge variant="outline">
                                      {Math.round(day.hours * 100) / 100}h
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {day.hours > 0 ? (
                                    <div>
                                      <span>{formatCurrency(hourlyRateDisplay)}/h</span>
                                      {currency === 'AUD' && (
                                        <p className="text-xs text-muted-foreground">
                                          (Rs. {hourlyRateNum.toFixed(2)}/h)
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {day.hours > 0 ? (
                                    <div>
                                      <span className="font-semibold text-green-600">
                                        {formatCurrency(day.salary)}
                                      </span>
                                      {currency === 'AUD' && (
                                        <p className="text-xs text-muted-foreground">
                                          (Rs. {day.salaryLKR.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                                        </p>
                                      )}
                                      {currency === 'LKR' && (
                                        <p className="text-xs text-muted-foreground">
                                          (A$ {day.salaryAUD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">{formatCurrency(0)}</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="font-bold bg-muted/50">
                              <TableCell colSpan={3} className="text-right">
                                Total ({currency}):
                              </TableCell>
                              <TableCell className="text-green-600">
                                <div>
                                  {formatCurrency(totalSalary)}
                                  {currency === 'AUD' && (
                                    <p className="text-xs text-muted-foreground font-normal">
                                      (Rs. {totalSalaryLKR.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                                    </p>
                                  )}
                                  {currency === 'LKR' && (
                                    <p className="text-xs text-muted-foreground font-normal">
                                      (A$ {totalSalaryAUD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              {hourlyRateNum === 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center text-muted-foreground py-8">
                      Enter an hourly rate above to calculate the salary
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

