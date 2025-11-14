"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { TaskDetailsDialog } from '@/components/tasks/TaskDetailsDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getCompletedTasks, getCompletedTasksByUser } from '@/lib/tasks';
import { Task } from '@/types/task';
import { toast } from '@/hooks/use-toast';
import { Search, CalendarIcon, X, Eye, History } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { type DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

const TaskHistory = () => {
  const { user, getAllUsers: fetchAllUsers } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskDetailsOpen, setTaskDetailsOpen] = useState(false);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    loadTasks();
  }, [user]);

  const loadUsers = async () => {
    try {
      const allUsers = await fetchAllUsers();
      const approvedUsers = allUsers.filter((u: any) => u.status === 'approved');
      setUsers(approvedUsers);
    } catch (error: any) {
      console.error('Error loading users:', error);
    }
  };

  const loadTasks = async () => {
    try {
      setLoading(true);
      let fetchedTasks: Task[];

      if (isAdmin) {
        fetchedTasks = await getCompletedTasks();
      } else if (user) {
        fetchedTasks = await getCompletedTasksByUser(user.id);
      } else {
        fetchedTasks = [];
      }

      setTasks(fetchedTasks);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load task history',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter tasks based on search query and date range
  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(task => 
        task.name.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query) ||
        task.taskId.toLowerCase().includes(query) ||
        task.assignedMemberNames?.some(name => name.toLowerCase().includes(query))
      );
    }

    // Filter by date range (using completion date from status history or updatedAt)
    if (dateRange?.from || dateRange?.to) {
      filtered = filtered.filter(task => {
        // Get completion date from status history
        const completedDate = task.statusHistory?.find(h => h.status === 'Complete')?.timestamp || task.updatedAt;
        const taskDate = new Date(completedDate);
        taskDate.setHours(0, 0, 0, 0);
        
        if (dateRange.from && dateRange.to) {
          const fromDate = new Date(dateRange.from);
          fromDate.setHours(0, 0, 0, 0);
          const toDate = new Date(dateRange.to);
          toDate.setHours(23, 59, 59, 999);
          return taskDate >= fromDate && taskDate <= toDate;
        } else if (dateRange.from) {
          const fromDate = new Date(dateRange.from);
          fromDate.setHours(0, 0, 0, 0);
          return taskDate >= fromDate;
        } else if (dateRange.to) {
          const toDate = new Date(dateRange.to);
          toDate.setHours(23, 59, 59, 999);
          return taskDate <= toDate;
        }
        return true;
      });
    }

    return filtered;
  }, [tasks, searchQuery, dateRange]);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setTaskDetailsOpen(true);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getCompletionDate = (task: Task) => {
    const completedEntry = task.statusHistory?.find(h => h.status === 'Complete');
    return completedEntry?.timestamp || task.updatedAt;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-5 w-64" />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <Skeleton className="h-10 flex-1 sm:max-w-sm" />
          <Skeleton className="h-10 w-full sm:w-[300px]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-4 p-6 border rounded-lg">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const clearFilters = () => {
    setSearchQuery('');
    setDateRange(undefined);
  };

  const hasActiveFilters = searchQuery.trim() !== '' || dateRange?.from || dateRange?.to;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <History className="h-8 w-8" />
            Task History
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin ? 'View all completed tasks' : 'View your completed tasks'}
          </p>
        </div>
      </div>

      {/* Filter Section */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        {/* Search Input */}
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks by name, description, ID, or assignee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Date Range Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full sm:w-[300px] justify-start text-left font-normal",
                !dateRange && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "LLL dd, y")} -{" "}
                    {format(dateRange.to, "LLL dd, y")}
                  </>
                ) : (
                  format(dateRange.from, "LLL dd, y")
                )
              ) : (
                <span>Filter by completion date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
            />
            {dateRange && (
              <div className="p-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setDateRange(undefined)}
                >
                  Clear date filter
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4 mr-2" />
            Clear filters
          </Button>
        )}
      </div>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <History className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-lg">
              {hasActiveFilters 
                ? 'No completed tasks found matching your filters' 
                : 'No completed tasks yet'}
            </p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="mt-4"
              >
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map((task) => {
            const completionDate = getCompletionDate(task);
            return (
              <Card 
                key={task.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleTaskClick(task)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-green-500">Complete</Badge>
                        <span className="text-xs text-muted-foreground font-mono">
                          {task.taskId}
                        </span>
                      </div>
                      <CardTitle className="text-lg line-clamp-2">
                        {task.name}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {task.description}
                  </p>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarIcon className="h-4 w-4" />
                      <span>Completed: {format(completionDate, "MMM dd, yyyy")}</span>
                    </div>
                  </div>

                  {task.assignedMemberNames && task.assignedMemberNames.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {task.assignedMemberNames.slice(0, 3).map((name, index) => (
                          <Avatar key={index} className="h-8 w-8 border-2 border-background">
                            <AvatarFallback className="text-xs">
                              {getInitials(name)}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {task.assignedMemberNames.length > 3 && (
                          <Avatar className="h-8 w-8 border-2 border-background">
                            <AvatarFallback className="text-xs bg-muted">
                              +{task.assignedMemberNames.length - 3}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {task.assignedMemberNames.length} {task.assignedMemberNames.length === 1 ? 'member' : 'members'}
                      </span>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTaskClick(task);
                    }}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Task Details Dialog */}
      <TaskDetailsDialog
        task={selectedTask}
        open={taskDetailsOpen}
        onOpenChange={setTaskDetailsOpen}
        users={users}
        onTaskUpdated={() => {
          loadTasks();
          setTaskDetailsOpen(false);
        }}
      />
    </div>
  );
};

export default TaskHistory;

