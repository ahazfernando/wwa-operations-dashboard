"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { DraggableTaskCard } from '@/components/tasks/DraggableTaskCard';
import { DroppableColumn } from '@/components/tasks/DroppableColumn';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskDetailsDialog } from '@/components/tasks/TaskDetailsDialog';
import { getAllTasks, getTasksByUser, updateTaskStatus, getCompletedTasks, getCompletedTasksByUser, reorderTasksInStatus, updateTaskOrder } from '@/lib/tasks';
import { Task, TaskStatus } from '@/types/task';
import { toast } from '@/hooks/use-toast';
import { Plus, Search, CalendarIcon, X, CheckCircle2, Download, Users, UsersRound } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { type DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

const Tasks = () => {
  const { user, getAllUsers: fetchAllUsers } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'assigned'>('all');
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskDetailsOpen, setTaskDetailsOpen] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [loadingCompleted, setLoadingCompleted] = useState(false);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [showCollaborativeOnly, setShowCollaborativeOnly] = useState(false);
  
  // Completed tasks filter states
  const [completedSearchQuery, setCompletedSearchQuery] = useState('');
  const [completedDateRange, setCompletedDateRange] = useState<DateRange | undefined>();
  const [completedSelectedEmployee, setCompletedSelectedEmployee] = useState<string>('all');
  const [showCompletedCollaborativeOnly, setShowCompletedCollaborativeOnly] = useState(false);

  const isAdmin = user?.role === 'admin';

  // Configure sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before starting drag
      },
    })
  );

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    loadTasks();
    loadCompletedTasks();
  }, [user, filter]);

  const loadUsers = async () => {
    try {
      const allUsers = await fetchAllUsers();
      // Filter only approved users
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
        // Admins see all tasks
        fetchedTasks = await getAllTasks();
      } else {
        // Regular users see only assigned tasks
        if (filter === 'assigned' && user) {
          fetchedTasks = await getTasksByUser(user.id);
        } else if (filter === 'all' && user) {
          // For non-admins, 'all' still means assigned tasks
          fetchedTasks = await getTasksByUser(user.id);
        } else {
          fetchedTasks = [];
        }
      }

      setTasks(fetchedTasks);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load tasks',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCompletedTasks = async () => {
    try {
      setLoadingCompleted(true);
      let fetchedTasks: Task[];

      if (isAdmin) {
        fetchedTasks = await getCompletedTasks();
      } else if (user) {
        fetchedTasks = await getCompletedTasksByUser(user.id);
      } else {
        fetchedTasks = [];
      }

      // Sort by completion date (most recent first)
      fetchedTasks.sort((a, b) => {
        const aCompleted = a.statusHistory?.find(h => h.status === 'Complete')?.timestamp || a.updatedAt;
        const bCompleted = b.statusHistory?.find(h => h.status === 'Complete')?.timestamp || b.updatedAt;
        return bCompleted.getTime() - aCompleted.getTime();
      });

      // Limit to 10 most recent completed tasks
      setCompletedTasks(fetchedTasks.slice(0, 10));
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load completed tasks',
        variant: 'destructive',
      });
    } finally {
      setLoadingCompleted(false);
    }
  };

  // Filter tasks based on search query, date range, employee, and collaborative filter
  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];

    // Filter by employee (only for admins)
    if (isAdmin && selectedEmployee !== 'all') {
      filtered = filtered.filter(task => 
        task.assignedMembers.includes(selectedEmployee)
      );
    }

    // Filter by collaborative tasks
    if (showCollaborativeOnly) {
      filtered = filtered.filter(task => task.collaborative === true);
    }

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

    // Filter by date range
    if (dateRange?.from || dateRange?.to) {
      filtered = filtered.filter(task => {
        const taskDate = new Date(task.date);
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
  }, [tasks, searchQuery, dateRange, selectedEmployee, showCollaborativeOnly, isAdmin]);

  const getTasksByStatus = (status: TaskStatus): Task[] => {
    let tasks: Task[] = [];
    
    if (status === 'Complete') {
      // For completed tasks, only show those completed within the last 24 hours
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      tasks = filteredTasks.filter(task => {
        if (task.status !== 'Complete') return false;
        
        // Get completion date from status history
        const completedEntry = task.statusHistory?.find(h => h.status === 'Complete');
        const completionDate = completedEntry?.timestamp || task.updatedAt;
        
        // Only show if completed within the last 24 hours
        return completionDate >= oneDayAgo;
      });
    } else {
      // For other statuses, filter normally
      tasks = filteredTasks.filter(task => task.status === status);
    }
    
    // Sort by order (if available), then by createdAt descending
    return tasks.sort((a, b) => {
      // If both have order, sort by order
      if (a.order !== undefined && a.order !== null && b.order !== undefined && b.order !== null) {
        return a.order - b.order;
      }
      // If only one has order, prioritize it
      if (a.order !== undefined && a.order !== null) return -1;
      if (b.order !== undefined && b.order !== null) return 1;
      // Otherwise, sort by createdAt descending
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = filteredTasks.find(t => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (over && over.data.current?.type === 'column') {
      setDraggedOverColumn(over.id as string);
    } else {
      setDraggedOverColumn(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    setDraggedOverColumn(null);

    if (!over) return;

    const taskId = active.id as string;
    // Find task in original tasks array for updates
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) return;

    // Check if dropped on another task (reordering within same column)
    if (over.data.current?.type === 'task' && over.id !== taskId) {
      const overTask = tasks.find(t => t.id === over.id);
      if (!overTask || overTask.status !== task.status) return;
      
      // Reordering within the same column
      const columnTasks = getTasksByStatus(task.status);
      const oldIndex = columnTasks.findIndex(t => t.id === taskId);
      const newIndex = columnTasks.findIndex(t => t.id === over.id);
      
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      
      // Reorder tasks using arrayMove
      const reorderedTasks = arrayMove(columnTasks, oldIndex, newIndex);
      
      // Update orders for all tasks in the column
      const taskOrders = reorderedTasks.map((t, index) => ({
        taskId: t.id,
        order: index,
      }));
      
      try {
        // Optimistically update UI
        setTasks(prevTasks =>
          prevTasks.map(t => {
            const orderUpdate = taskOrders.find(to => to.taskId === t.id);
            if (orderUpdate) {
              return { ...t, order: orderUpdate.order };
            }
            return t;
          })
        );
        
        // Update in database
        await reorderTasksInStatus(task.status, taskOrders);
      } catch (error: any) {
        // Revert on error
        loadTasks();
        toast({
          title: 'Error',
          description: error.message || 'Failed to reorder tasks',
          variant: 'destructive',
        });
      }
      return;
    }

    // Check if dropped on a column
    if (over.data.current?.type === 'column') {
      const newStatus = over.data.current.status as TaskStatus;
      
      // If status hasn't changed, this is a reorder within the same column (dropped on column area)
      if (task.status === newStatus) {
        // Handle reordering within the same column - move to end
        const columnTasks = getTasksByStatus(newStatus);
        const oldIndex = columnTasks.findIndex(t => t.id === taskId);
        
        if (oldIndex === -1) return;
        
        // Move to end
        const reorderedTasks = arrayMove(columnTasks, oldIndex, columnTasks.length - 1);
        
        const taskOrders = reorderedTasks.map((t, index) => ({
          taskId: t.id,
          order: index,
        }));
        
        try {
          setTasks(prevTasks =>
            prevTasks.map(t => {
              const orderUpdate = taskOrders.find(to => to.taskId === t.id);
              if (orderUpdate) {
                return { ...t, order: orderUpdate.order };
              }
              return t;
            })
          );
          
          await reorderTasksInStatus(newStatus, taskOrders);
        } catch (error: any) {
          loadTasks();
          toast({
            title: 'Error',
            description: error.message || 'Failed to reorder tasks',
            variant: 'destructive',
          });
        }
        return;
      }

      // Check permissions
      const isAssigned = user && task.assignedMembers.includes(user.id);
      if (!isAssigned && !isAdmin) {
        toast({
          title: 'Permission denied',
          description: 'You can only move tasks assigned to you.',
          variant: 'destructive',
        });
        return;
      }

      // Validate KPI only if Expected KPI is set
      // Skip this check for collaborative tasks as they have their own completion logic
      if (newStatus === 'Complete' && !task.collaborative) {
        // Only validate KPI if Expected KPI is set
        if (task.expectedKpi !== undefined && task.expectedKpi !== null) {
          // If Expected KPI is set, Actual KPI must be set and must match
          if (task.actualKpi === undefined || task.actualKpi === null) {
            toast({
              title: 'Cannot complete task',
              description: 'Please fill in the Actual KPI before completing the task',
              variant: 'destructive',
            });
            return;
          }
          
          // Check if Actual KPI equals Expected KPI
          if (task.actualKpi !== task.expectedKpi) {
            toast({
              title: 'Cannot complete task',
              description: 'Expected KPI has not been met',
              variant: 'destructive',
            });
            return;
          }
        }
        // If Expected KPI is not set, task can be completed without KPI validation
      }

      try {
        // Get tasks in the new status column to determine the new order
        const newStatusTasks = getTasksByStatus(newStatus);
        const newOrder = newStatusTasks.length; // Place at the end
        
        // Optimistically update UI
        setTasks(prevTasks =>
          prevTasks.map(t =>
            t.id === taskId ? { ...t, status: newStatus, order: newOrder } : t
          )
        );

        // Update in database
        await updateTaskStatus(taskId, newStatus, {
          changedBy: user?.id,
          changedByName: user?.name,
        });
        
        // Update the order in the database
        await updateTaskOrder(taskId, newOrder);

        // Show appropriate message for collaborative tasks
        if (task.collaborative && newStatus === 'Complete') {
          const userCompleted = task.completedBy?.some(entry => entry.userId === user?.id);
          if (!userCompleted) {
            toast({
              title: 'Your part completed',
              description: 'You have marked your part as complete. The task will be fully completed when all members finish and Actual KPI is filled.',
            });
          } else {
            toast({
              title: 'Task moved',
              description: `Task status changed to ${newStatus}`,
            });
          }
        } else {
          toast({
            title: 'Task moved',
            description: `Task status changed to ${newStatus}`,
          });
        }
      } catch (error: any) {
        // Revert on error
        setTasks(prevTasks =>
          prevTasks.map(t =>
            t.id === taskId ? { ...t, status: task.status } : t
          )
        );

        toast({
          title: 'Error',
          description: error.message || 'Failed to update task status',
          variant: 'destructive',
        });
      }
    }
  };

  const handleTaskCardClick = (task: Task) => {
    setSelectedTask(task);
    setTaskDetailsOpen(true);
  };

  const exportCompletedTasksToCSV = () => {
    // Get filtered completed tasks
    let filteredCompleted = [...completedTasks];

    // Apply the same filters as the display
    // Filter by employee (only for admins)
    if (isAdmin && completedSelectedEmployee !== 'all') {
      filteredCompleted = filteredCompleted.filter(task => 
        task.assignedMembers.includes(completedSelectedEmployee)
      );
    }

    // Filter by collaborative tasks
    if (showCompletedCollaborativeOnly) {
      filteredCompleted = filteredCompleted.filter(task => task.collaborative === true);
    }

    if (completedSearchQuery.trim()) {
      const query = completedSearchQuery.toLowerCase();
      filteredCompleted = filteredCompleted.filter(task => 
        task.name.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query) ||
        task.taskId.toLowerCase().includes(query) ||
        task.assignedMemberNames?.some(name => name.toLowerCase().includes(query))
      );
    }

    if (completedDateRange?.from || completedDateRange?.to) {
      filteredCompleted = filteredCompleted.filter(task => {
        const completionDate = task.statusHistory?.find(h => h.status === 'Complete')?.timestamp || task.updatedAt;
        const taskDate = new Date(completionDate);
        taskDate.setHours(0, 0, 0, 0);
        
        if (completedDateRange.from && completedDateRange.to) {
          const fromDate = new Date(completedDateRange.from);
          fromDate.setHours(0, 0, 0, 0);
          const toDate = new Date(completedDateRange.to);
          toDate.setHours(23, 59, 59, 999);
          return taskDate >= fromDate && taskDate <= toDate;
        } else if (completedDateRange.from) {
          const fromDate = new Date(completedDateRange.from);
          fromDate.setHours(0, 0, 0, 0);
          return taskDate >= fromDate;
        } else if (completedDateRange.to) {
          const toDate = new Date(completedDateRange.to);
          toDate.setHours(23, 59, 59, 999);
          return taskDate <= toDate;
        }
        return true;
      });
    }

    // Create CSV content
    const headers = ['Task ID', 'Task Name', 'Description', 'Assigned To', 'Completed Date', 'Due Date', 'Created Date'];
    const rows = filteredCompleted.map(task => {
      const completionDate = task.statusHistory?.find(h => h.status === 'Complete')?.timestamp || task.updatedAt;
      const assignedTo = task.assignedMemberNames?.join('; ') || 'Unassigned';
      
      // Escape commas and quotes in CSV values
      const escapeCSV = (value: string) => {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      return [
        escapeCSV(task.taskId),
        escapeCSV(task.name),
        escapeCSV(task.description || ''),
        escapeCSV(assignedTo),
        format(completionDate, 'MMM dd, yyyy'),
        format(task.date, 'MMM dd, yyyy'),
        format(task.createdAt, 'MMM dd, yyyy'),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `completed-tasks-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: 'Export successful',
      description: `Exported ${filteredCompleted.length} completed task(s) to CSV`,
    });
  };

  const columns: { status: TaskStatus; title: string; color: string }[] = [
    { status: 'New', title: 'New', color: 'bg-blue-500' },
    { status: 'Progress', title: 'In Progress', color: 'bg-yellow-500' },
    { status: 'Complete', title: 'Completed', color: 'bg-green-500' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-5 w-64" />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <Skeleton className="h-10 flex-1 sm:max-w-sm" />
          <Skeleton className="h-10 w-full sm:w-[300px]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <Skeleton key={j} className="h-32 rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const clearFilters = () => {
    setSearchQuery('');
    setDateRange(undefined);
    setSelectedEmployee('all');
    setShowCollaborativeOnly(false);
  };

  const hasActiveFilters = searchQuery.trim() !== '' || dateRange?.from || dateRange?.to || (isAdmin && selectedEmployee !== 'all') || showCollaborativeOnly;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tasks</h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin ? 'Manage all tasks' : 'View your assigned tasks'}
          </p>
        </div>
        {isAdmin && (
          <CreateTaskDialog users={users} onTaskCreated={loadTasks} />
        )}
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

        {/* Employee Filter (Admin Only) */}
        {isAdmin && (
          <div className="relative w-full sm:w-[200px]">
            <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-full pl-10">
                <SelectValue placeholder="Filter by employee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

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
                <span>Filter by date range</span>
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

        {/* Collaborative Tasks Filter */}
        <div className="flex items-center space-x-2 px-3 py-2 border rounded-md bg-background">
          <Checkbox
            id="collaborative-filter"
            checked={showCollaborativeOnly}
            onCheckedChange={(checked) => setShowCollaborativeOnly(checked === true)}
          />
          <Label
            htmlFor="collaborative-filter"
            className="text-sm font-normal cursor-pointer flex items-center gap-2"
          >
            <UsersRound className="h-4 w-4 text-muted-foreground" />
            Collaborative Tasks
          </Label>
        </div>

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

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {columns.map((column) => {
            const columnTasks = getTasksByStatus(column.status);
            const taskIds = columnTasks.map(task => task.id);
            return (
              <DroppableColumn
                key={column.status}
                id={column.status}
                status={column.status}
                title={column.title}
                color={column.color}
                taskCount={columnTasks.length}
                isOver={draggedOverColumn === column.status}
                taskIds={taskIds}
              >
                {columnTasks.map((task) => (
                  <DraggableTaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={loadTasks}
                    canEdit={isAdmin}
                    onCardClick={handleTaskCardClick}
                  />
                ))}
              </DroppableColumn>
            );
          })}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="opacity-90 rotate-2">
              <TaskCard
                task={activeTask}
                onStatusChange={loadTasks}
                canEdit={isAdmin}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Completed Tasks Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600 mb-2" />
            Completed Tasks
          </CardTitle>
          <CardDescription>
            Recently completed tasks - Click on a task to view details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter Section for Completed Tasks */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-1">
              {/* Search Input */}
              <div className="relative flex-1 w-full sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search completed tasks..."
                  value={completedSearchQuery}
                  onChange={(e) => setCompletedSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Employee Filter (Admin Only) */}
              {isAdmin && (
                <div className="relative w-full sm:w-[200px]">
                  <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                  <Select value={completedSelectedEmployee} onValueChange={setCompletedSelectedEmployee}>
                    <SelectTrigger className="w-full pl-10">
                      <SelectValue placeholder="Filter by employee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Employees</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Date Range Picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full sm:w-[300px] justify-start text-left font-normal",
                      !completedDateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {completedDateRange?.from ? (
                      completedDateRange.to ? (
                        <>
                          {format(completedDateRange.from, "LLL dd, y")} -{" "}
                          {format(completedDateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(completedDateRange.from, "LLL dd, y")
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
                    defaultMonth={completedDateRange?.from}
                    selected={completedDateRange}
                    onSelect={setCompletedDateRange}
                    numberOfMonths={2}
                  />
                  {completedDateRange && (
                    <div className="p-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setCompletedDateRange(undefined)}
                      >
                        Clear date filter
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              {/* Collaborative Tasks Filter */}
              <div className="flex items-center space-x-2 px-3 py-2 border rounded-md bg-background">
                <Checkbox
                  id="completed-collaborative-filter"
                  checked={showCompletedCollaborativeOnly}
                  onCheckedChange={(checked) => setShowCompletedCollaborativeOnly(checked === true)}
                />
                <Label
                  htmlFor="completed-collaborative-filter"
                  className="text-sm font-normal cursor-pointer flex items-center gap-2"
                >
                  <UsersRound className="h-4 w-4 text-muted-foreground" />
                  Collaborative Tasks
                </Label>
              </div>

              {/* Clear Filters Button */}
              {(completedSearchQuery.trim() !== '' || completedDateRange?.from || completedDateRange?.to || (isAdmin && completedSelectedEmployee !== 'all') || showCompletedCollaborativeOnly) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCompletedSearchQuery('');
                    setCompletedDateRange(undefined);
                    setCompletedSelectedEmployee('all');
                    setShowCompletedCollaborativeOnly(false);
                  }}
                  className="text-muted-foreground"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear filters
                </Button>
              )}
            </div>

            {/* Export CSV Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={exportCompletedTasksToCSV}
              disabled={loadingCompleted || completedTasks.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {/* Filtered Completed Tasks */}
          {(() => {
            // Filter completed tasks based on search, date range, and employee
            let filteredCompleted = [...completedTasks];

            // Filter by employee (only for admins)
            if (isAdmin && completedSelectedEmployee !== 'all') {
              filteredCompleted = filteredCompleted.filter(task => 
                task.assignedMembers.includes(completedSelectedEmployee)
              );
            }

            // Filter by collaborative tasks
            if (showCompletedCollaborativeOnly) {
              filteredCompleted = filteredCompleted.filter(task => task.collaborative === true);
            }

            // Filter by search query
            if (completedSearchQuery.trim()) {
              const query = completedSearchQuery.toLowerCase();
              filteredCompleted = filteredCompleted.filter(task => 
                task.name.toLowerCase().includes(query) ||
                task.description.toLowerCase().includes(query) ||
                task.taskId.toLowerCase().includes(query) ||
                task.assignedMemberNames?.some(name => name.toLowerCase().includes(query))
              );
            }

            // Filter by date range (using completion date)
            if (completedDateRange?.from || completedDateRange?.to) {
              filteredCompleted = filteredCompleted.filter(task => {
                const completionDate = task.statusHistory?.find(h => h.status === 'Complete')?.timestamp || task.updatedAt;
                const taskDate = new Date(completionDate);
                taskDate.setHours(0, 0, 0, 0);
                
                if (completedDateRange.from && completedDateRange.to) {
                  const fromDate = new Date(completedDateRange.from);
                  fromDate.setHours(0, 0, 0, 0);
                  const toDate = new Date(completedDateRange.to);
                  toDate.setHours(23, 59, 59, 999);
                  return taskDate >= fromDate && taskDate <= toDate;
                } else if (completedDateRange.from) {
                  const fromDate = new Date(completedDateRange.from);
                  fromDate.setHours(0, 0, 0, 0);
                  return taskDate >= fromDate;
                } else if (completedDateRange.to) {
                  const toDate = new Date(completedDateRange.to);
                  toDate.setHours(23, 59, 59, 999);
                  return taskDate <= toDate;
                }
                return true;
              });
            }

            return (
              <>
                {loadingCompleted ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-4 p-3 border rounded-lg">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 flex-1" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    ))}
                  </div>
                ) : filteredCompleted.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>
                      {(completedSearchQuery.trim() !== '' || completedDateRange?.from || completedDateRange?.to || (isAdmin && completedSelectedEmployee !== 'all') || showCompletedCollaborativeOnly)
                        ? 'No completed tasks found matching your filters'
                        : 'No completed tasks yet'}
                    </p>
                    {(completedSearchQuery.trim() !== '' || completedDateRange?.from || completedDateRange?.to || (isAdmin && completedSelectedEmployee !== 'all') || showCompletedCollaborativeOnly) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCompletedSearchQuery('');
                          setCompletedDateRange(undefined);
                          setCompletedSelectedEmployee('all');
                          setShowCompletedCollaborativeOnly(false);
                        }}
                        className="mt-4"
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Task ID</TableHead>
                          <TableHead>Task Name</TableHead>
                          <TableHead>Assigned To</TableHead>
                          <TableHead>Completed Date</TableHead>
                          <TableHead>Due Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCompleted.map((task) => {
                          const completionDate = task.statusHistory?.find(h => h.status === 'Complete')?.timestamp || task.updatedAt;
                          return (
                            <TableRow
                              key={task.id}
                              className="cursor-pointer hover:bg-accent"
                              onClick={() => handleTaskCardClick(task)}
                            >
                              <TableCell className="font-mono text-sm">
                                {task.taskId}
                              </TableCell>
                              <TableCell className="font-medium">
                                {task.name}
                              </TableCell>
                              <TableCell>
                                {task.assignedMemberNames && task.assignedMemberNames.length > 0 ? (
                                  <div className="flex flex-col gap-1">
                                    {task.assignedMemberNames.slice(0, 2).map((name, idx) => (
                                      <span key={idx} className="text-sm">{name}</span>
                                    ))}
                                    {task.assignedMemberNames.length > 2 && (
                                      <span className="text-xs text-muted-foreground">
                                        +{task.assignedMemberNames.length - 2} more
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-sm text-muted-foreground">Unassigned</span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">
                                {format(completionDate, 'MMM dd, yyyy')}
                              </TableCell>
                              <TableCell className="text-sm">
                                {format(task.date, 'MMM dd, yyyy')}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            );
          })()}
        </CardContent>
      </Card>

      {/* Task Details Dialog */}
      <TaskDetailsDialog
        task={selectedTask}
        open={taskDetailsOpen}
        onOpenChange={setTaskDetailsOpen}
        users={users}
        onTaskUpdated={() => {
          loadTasks();
          loadCompletedTasks();
          setTaskDetailsOpen(false);
        }}
      />
    </div>
  );
};

export default Tasks;

