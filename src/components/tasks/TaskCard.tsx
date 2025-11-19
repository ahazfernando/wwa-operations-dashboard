"use client";

import { useState, useRef } from 'react';
import { Task, TaskStatus, TaskImage } from '@/types/task';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateTaskStatus, updateTaskImages } from '@/lib/tasks';
import { uploadImageToCloudinary } from '@/lib/cloudinary';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Image as ImageIcon, X, Loader2, Camera, GripVertical, Eye } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface TaskCardProps {
  task: Task;
  onStatusChange?: () => void;
  canEdit?: boolean;
  onCardClick?: (task: Task) => void;
}

export function TaskCard({ task, onStatusChange, canEdit = false, onCardClick }: TaskCardProps) {
  const { user } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAssigned = user && task.assignedMembers.includes(user.id);

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!isAssigned && !canEdit) {
      toast({
        title: 'Permission denied',
        description: 'You can only change status of tasks assigned to you.',
        variant: 'destructive',
      });
      return;
    }

    // Validate that actualKpi is filled before allowing status change to Complete
    // Skip this check for collaborative tasks as they have their own completion logic
    if (newStatus === 'Complete' && !task.collaborative && (!task.actualKpi || task.actualKpi.trim() === '')) {
      toast({
        title: 'Cannot complete task',
        description: 'Please fill in the Actual KPI before completing the task',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsUpdating(true);
      await updateTaskStatus(task.id, newStatus, {
        changedBy: user?.id,
        changedByName: user?.name,
      });
      
      // Show appropriate message for collaborative tasks
      if (task.collaborative && newStatus === 'Complete') {
        const userCompleted = task.completedBy?.some(entry => entry.userId === user?.id);
        if (!userCompleted) {
          toast({
            title: 'Your part completed',
            description: 'You have marked your part as complete. The task will be fully completed when all members finish.',
          });
        } else {
          toast({
            title: 'Status updated',
            description: `Task status changed to ${newStatus}`,
          });
        }
      } else {
        toast({
          title: 'Status updated',
          description: `Task status changed to ${newStatus}`,
        });
      }
      onStatusChange?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update task status',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!isAssigned && !canEdit) {
      toast({
        title: 'Permission denied',
        description: 'You can only add images to tasks assigned to you.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file type
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validImageTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file (JPEG, PNG, GIF, or WebP)',
        variant: 'destructive',
      });
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 5MB',
        variant: 'destructive',
      });
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    try {
      setIsUploading(true);
      const result = await uploadImageToCloudinary(file);
      const updatedImages = [...task.images, result.url];
      await updateTaskImages(task.id, updatedImages);
      toast({
        title: 'Image uploaded',
        description: 'Image has been added to the task',
      });
      onStatusChange?.();
    } catch (error: any) {
      console.error('Image upload error:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload image. Please check your Cloudinary configuration.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      // Reset file input after upload attempt
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = async (index: number) => {
    if (!isAssigned && !canEdit) {
      toast({
        title: 'Permission denied',
        description: 'You can only remove images from tasks assigned to you.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUploadingIndex(index);
      const updatedImages = task.images.filter((_, i) => i !== index);
      await updateTaskImages(task.id, updatedImages);
      toast({
        title: 'Image removed',
        description: 'Image has been removed from the task',
      });
      onStatusChange?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove image',
        variant: 'destructive',
      });
    } finally {
      setUploadingIndex(null);
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'New':
        return 'bg-blue-500';
      case 'Progress':
        return 'bg-yellow-500';
      case 'Complete':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getImageUrl = (image: string | TaskImage): string => {
    return typeof image === 'string' ? image : image.url;
  };

  return (
    <>
      <Card 
        className="mb-4 hover:shadow-md transition-shadow"
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={getStatusColor(task.status)}>
                  {task.status}
                </Badge>
                <span className="text-xs text-muted-foreground">#{task.taskId}</span>
              </div>
              <h3 className="font-semibold text-sm">{task.name}</h3>
            </div>
            <GripVertical className="h-4 w-4 text-muted-foreground opacity-50" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {task.description}
          </p>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{format(task.date, 'MMM dd, yyyy')}</span>
            {(isAssigned || canEdit) && (
              <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                <Select
                  value={task.status}
                  onValueChange={(value) => handleStatusChange(value as TaskStatus)}
                  disabled={isUpdating}
                >
                  <SelectTrigger className="h-7 text-xs w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="Progress">Progress</SelectItem>
                    <SelectItem value="Complete">Complete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {task.images.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {task.images.slice(0, 3).map((image, index) => (
                <div key={index} className="relative group">
                  <img
                    src={getImageUrl(image)}
                    alt={`Task image ${index + 1}`}
                    className="w-16 h-16 object-cover rounded cursor-pointer"
                    onClick={() => {
                      setSelectedImage(getImageUrl(image));
                      setImageDialogOpen(true);
                    }}
                  />
                  {(isAssigned || canEdit) && (
                    <button
                      onClick={() => handleRemoveImage(index)}
                      disabled={uploadingIndex === index}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {uploadingIndex === index ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>
              ))}
              {task.images.length > 3 && (
                <div className="w-16 h-16 bg-muted rounded flex items-center justify-center text-xs">
                  +{task.images.length - 3}
                </div>
              )}
            </div>
          )}

          {(isAssigned || canEdit) && (
            <div className="pt-2 border-t" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4" />
                    <span>Add Image</span>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleImageUpload(file);
                    }
                  }}
                  disabled={isUploading}
                />
              </label>
            </div>
          )}

          {task.assignedMemberNames && task.assignedMemberNames.length > 0 && (
            <div className="flex items-center gap-2 pt-2 border-t">
              <div className="flex -space-x-2">
                {task.assignedMemberNames.slice(0, 3).map((name, index) => (
                  <Avatar key={index} className="h-6 w-6 border-2 border-background">
                    <AvatarFallback className="text-xs">
                      {getInitials(name)}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {task.assignedMemberNames.length > 3 && (
                  <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs">
                    +{task.assignedMemberNames.length - 3}
                  </div>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {task.assignedMemberNames.length} {task.assignedMemberNames.length === 1 ? 'member' : 'members'}
              </span>
            </div>
          )}

          <div className="pt-2 border-t" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => onCardClick?.(task)}
            >
              <Eye className="h-4 w-4 mr-2" />
              View Task
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Task Images</DialogTitle>
            <DialogDescription>
              View all images for this task
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
            {task.images.map((image, index) => (
              <div key={index} className="relative group">
                <img
                  src={getImageUrl(image)}
                  alt={`Task image ${index + 1}`}
                  className="w-full h-48 object-cover rounded"
                />
                {(isAssigned || canEdit) && (
                  <button
                    onClick={() => handleRemoveImage(index)}
                    disabled={uploadingIndex === index}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {uploadingIndex === index ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

