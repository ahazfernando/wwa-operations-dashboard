"use client";

import { useState, useEffect } from 'react';
import { Task, TaskStatus } from '@/types/task';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { updateTask, updateTaskStatus, updateTaskImages } from '@/lib/tasks';
import { uploadImageToCloudinary } from '@/lib/cloudinary';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { CalendarIcon, Loader2, Camera, X, Edit, Save, User, Clock, Image as ImageIcon, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  name: string;
  email: string;
}

interface TaskDetailsDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
  onTaskUpdated?: () => void;
}

export function TaskDetailsDialog({
  task,
  open,
  onOpenChange,
  users,
  onTaskUpdated,
}: TaskDetailsDialogProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    taskId: '',
    name: '',
    description: '',
    date: new Date(),
    assignedMembers: [] as string[],
    status: 'New' as TaskStatus,
  });

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  useEffect(() => {
    if (task) {
      setFormData({
        taskId: task.taskId,
        name: task.name,
        description: task.description,
        date: task.date,
        assignedMembers: task.assignedMembers,
        status: task.status,
      });
      setImagePreviews([]);
      setSelectedFiles([]);
      setIsEditing(false);
    }
  }, [task]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const invalidFiles = files.filter(file => !validTypes.includes(file.type));

    if (invalidFiles.length > 0) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload only image files (JPEG, PNG, GIF, WebP)',
        variant: 'destructive',
      });
      return;
    }

    const largeFiles = files.filter(file => file.size > 5 * 1024 * 1024);
    if (largeFiles.length > 0) {
      toast({
        title: 'File too large',
        description: 'Please upload files smaller than 5MB',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFiles(prev => [...prev, ...files]);

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    if (!task) return;
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = async (index: number) => {
    if (!task) return;

    try {
      setUploadingIndex(index);
      const updatedImages = task.images.filter((_, i) => i !== index);
      await updateTaskImages(task.id, updatedImages);
      toast({
        title: 'Image removed',
        description: 'Image has been removed from the task',
      });
      onTaskUpdated?.();
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

  const handleMemberToggle = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      assignedMembers: prev.assignedMembers.includes(userId)
        ? prev.assignedMembers.filter(id => id !== userId)
        : [...prev.assignedMembers, userId],
    }));
  };

  const handleSave = async () => {
    if (!task) return;

    if (!formData.taskId.trim() || !formData.name.trim()) {
      toast({
        title: 'Validation error',
        description: 'Task ID and Name are required',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);

      // Upload new images
      const uploadedImages: string[] = [];
      for (const file of selectedFiles) {
        try {
          const result = await uploadImageToCloudinary(file);
          uploadedImages.push(result.url);
        } catch (error: any) {
          console.error('Error uploading image:', error);
        }
      }

      // Get assigned member names
      const assignedMemberNames = formData.assignedMembers.map(userId => {
        const user = users.find(u => u.id === userId);
        return user?.name || '';
      }).filter(Boolean);

      // Update task
      await updateTask(task.id, {
        taskId: formData.taskId.trim(),
        name: formData.name.trim(),
        description: formData.description.trim(),
        date: formData.date,
        assignedMembers: formData.assignedMembers,
        assignedMemberNames,
        images: [...task.images, ...uploadedImages],
      });

      toast({
        title: 'Task updated',
        description: 'Task has been updated successfully',
      });

      setIsEditing(false);
      setImagePreviews([]);
      setSelectedFiles([]);
      onTaskUpdated?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update task',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!task) return;

    try {
      await updateTaskStatus(task.id, newStatus);
      setFormData(prev => ({ ...prev, status: newStatus }));
      toast({
        title: 'Status updated',
        description: `Task status changed to ${newStatus}`,
      });
      onTaskUpdated?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update task status',
        variant: 'destructive',
      });
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

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl">Task Details</DialogTitle>
              <DialogDescription>
                View and manage task information
              </DialogDescription>
            </div>
            {isAdmin && (
              <Button
                variant={isEditing ? 'outline' : 'default'}
                onClick={() => {
                  if (isEditing) {
                    setIsEditing(false);
                  } else {
                    setIsEditing(true);
                  }
                }}
              >
                {isEditing ? (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </>
                ) : (
                  <>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Task ID and Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isEditing ? (
                <Input
                  value={formData.taskId}
                  onChange={(e) => setFormData(prev => ({ ...prev, taskId: e.target.value }))}
                  className="w-32"
                  placeholder="Task ID"
                />
              ) : (
                <span className="text-lg font-semibold">#{task.taskId}</span>
              )}
              <Badge className={getStatusColor(task.status)}>
                {task.status}
              </Badge>
            </div>
            {!isEditing && (
              <Select
                value={task.status}
                onValueChange={(value) => handleStatusChange(value as TaskStatus)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="New">New</SelectItem>
                  <SelectItem value="Progress">Progress</SelectItem>
                  <SelectItem value="Complete">Complete</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Task Name */}
          <div className="space-y-2">
            <Label>Task Name</Label>
            {isEditing ? (
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter task name"
              />
            ) : (
              <p className="text-lg font-semibold">{task.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            {isEditing ? (
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter task description"
                rows={4}
              />
            ) : (
              <p className="text-muted-foreground whitespace-pre-wrap">{task.description || 'No description'}</p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Due Date</Label>
            {isEditing ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.date ? format(formData.date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.date}
                    onSelect={(date) => date && setFormData(prev => ({ ...prev, date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarIcon className="h-4 w-4" />
                <span>{format(task.date, 'PPP')}</span>
              </div>
            )}
          </div>

          {/* Assigned Members */}
          <div className="space-y-2">
            <Label>Assigned Members</Label>
            {isEditing ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn(
                      "w-full justify-between",
                      formData.assignedMembers.length === 0 && "text-muted-foreground"
                    )}
                  >
                    {formData.assignedMembers.length === 0
                      ? "Select members..."
                      : formData.assignedMembers.length === 1
                      ? users.find(u => u.id === formData.assignedMembers[0])?.name || "1 member selected"
                      : `${formData.assignedMembers.length} members selected`}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <ScrollArea className="h-64">
                    <div className="p-2">
                      <div className="space-y-2">
                        {users.map((user) => (
                          <div key={user.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent cursor-pointer">
                            <Checkbox
                              id={`member-${user.id}`}
                              checked={formData.assignedMembers.includes(user.id)}
                              onCheckedChange={() => handleMemberToggle(user.id)}
                            />
                            <label
                              htmlFor={`member-${user.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                            >
                              {user.name} ({user.email})
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                {task.assignedMemberNames && task.assignedMemberNames.length > 0 ? (
                  <>
                    <div className="flex -space-x-2">
                      {task.assignedMemberNames.map((name, index) => (
                        <Avatar key={index} className="h-8 w-8 border-2 border-background">
                          <AvatarFallback className="text-xs">
                            {getInitials(name)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {task.assignedMemberNames.join(', ')}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">No members assigned</span>
                )}
              </div>
            )}
          </div>

          {/* Images */}
          <div className="space-y-2">
            <Label>Images</Label>
            {task.images.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {task.images.map((image, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={image}
                      alt={`Task image ${index + 1}`}
                      className="w-full h-32 object-cover rounded"
                    />
                    {isAdmin && (
                      <button
                        onClick={() => removeExistingImage(index)}
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
            )}
            {isEditing && (
              <div>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  disabled={isUploading}
                />
                {imagePreviews.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={preview}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-20 object-cover rounded"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Task Metadata */}
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              <span>
                <strong>Created by:</strong> {task.createdByName || 'Unknown'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                <strong>Created:</strong> {format(task.createdAt, 'PPP p')}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                <strong>Last updated:</strong> {format(task.updatedAt, 'PPP p')}
              </span>
            </div>
          </div>

          {/* Save Button */}
          {isEditing && (
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  if (task) {
                    setFormData({
                      taskId: task.taskId,
                      name: task.name,
                      description: task.description,
                      date: task.date,
                      assignedMembers: task.assignedMembers,
                      status: task.status,
                    });
                  }
                  setImagePreviews([]);
                  setSelectedFiles([]);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

