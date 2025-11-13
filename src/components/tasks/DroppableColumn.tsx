"use client";

import { useDroppable } from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TaskStatus } from '@/types/task';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DroppableColumnProps {
  id: string;
  status: TaskStatus;
  title: string;
  color: string;
  taskCount: number;
  children: ReactNode;
  isOver?: boolean;
}

export function DroppableColumn({
  id,
  status,
  title,
  color,
  taskCount,
  children,
  isOver,
}: DroppableColumnProps) {
  const { setNodeRef, isOver: isOverColumn } = useDroppable({
    id,
    data: {
      type: 'column',
      status,
    },
  });

  const isActive = isOver || isOverColumn;

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        "flex flex-col transition-colors",
        isActive && "ring-2 ring-primary ring-offset-2"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${color}`} />
            <CardTitle className="text-lg">{title}</CardTitle>
            <span className="text-sm text-muted-foreground">
              ({taskCount})
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-4">
        <ScrollArea className="h-[calc(100vh-300px)]">
          <div className="pr-4">
            {taskCount === 0 && !isActive ? (
              <div className="text-center text-muted-foreground py-8">
                <p className="text-sm">No tasks in this column</p>
              </div>
            ) : (
              <div className={cn("space-y-2", isActive && "min-h-[100px]")}>
                {children}
                {isActive && taskCount === 0 && (
                  <div className="text-center text-muted-foreground py-8 border-2 border-dashed border-primary rounded-lg">
                    <p className="text-sm">Drop task here</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

