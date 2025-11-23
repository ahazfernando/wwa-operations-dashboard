"use client";

import { useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TaskCard } from './TaskCard';
import { Task } from '@/types/task';

interface DraggableTaskCardProps {
  task: Task;
  onStatusChange?: () => void;
  canEdit?: boolean;
  onCardClick?: (task: Task) => void;
}

export function DraggableTaskCard({ task, onStatusChange, canEdit, onCardClick }: DraggableTaskCardProps) {
  const wasDraggingRef = useRef(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: 'task',
      task,
    },
  });

  useEffect(() => {
    if (isDragging) {
      wasDraggingRef.current = true;
    } else if (wasDraggingRef.current) {
      // Just finished dragging, reset after a short delay
      setTimeout(() => {
        wasDraggingRef.current = false;
      }, 100);
    }
  }, [isDragging]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleClick = (e: React.MouseEvent) => {
    // Only trigger click if we didn't just drag
    if (!wasDraggingRef.current && !isDragging) {
      // Check if click was on an interactive element
      const target = e.target as HTMLElement;
      if (
        target.closest('button') ||
        target.closest('select') ||
        target.closest('input') ||
        target.closest('label') ||
        target.closest('[role="button"]')
      ) {
        return;
      }
      onCardClick?.(task);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing"
      onClick={handleClick}
    >
      <TaskCard
        task={task}
        onStatusChange={onStatusChange}
        canEdit={canEdit}
        onCardClick={onCardClick}
      />
    </div>
  );
}

