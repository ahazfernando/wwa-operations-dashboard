"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { DraggableTaskCard } from '@/components/tasks/DraggableTaskCard';
import { DroppableColumn } from '@/components/tasks/DroppableColumn';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskDetailsDialog } from '@/components/tasks/TaskDetailsDialog';
import { getAllTasks, getTasksByUser, updateTaskStatus } from '@/lib/tasks';
import { Task, TaskStatus } from '@/types/task';
import { toast } from '@/hooks/use-toast';
import { Loader2, Plus } from 'lucide-react';
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

  const getTasksByStatus = (status: TaskStatus): Task[] => {
    return tasks.filter(task => task.status === status);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find(t => t.id === active.id);
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
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) return;

    // Check if dropped on a column
    if (over.data.current?.type === 'column') {
      const newStatus = over.data.current.status as TaskStatus;
      
      // Don't update if status hasn't changed
      if (task.status === newStatus) return;

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

      try {
        // Optimistically update UI
        setTasks(prevTasks =>
          prevTasks.map(t =>
            t.id === taskId ? { ...t, status: newStatus } : t
          )
        );

        // Update in database
        await updateTaskStatus(taskId, newStatus);

        toast({
          title: 'Task moved',
          description: `Task status changed to ${newStatus}`,
        });
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

  const columns: { status: TaskStatus; title: string; color: string }[] = [
    { status: 'New', title: 'New', color: 'bg-blue-500' },
    { status: 'Progress', title: 'In Progress', color: 'bg-yellow-500' },
    { status: 'Complete', title: 'Completed', color: 'bg-green-500' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
            return (
              <DroppableColumn
                key={column.status}
                id={column.status}
                status={column.status}
                title={column.title}
                color={column.color}
                taskCount={columnTasks.length}
                isOver={draggedOverColumn === column.status}
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

export default Tasks;

