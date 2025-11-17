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
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { updateTask, updateTaskStatus, updateTaskImages, deleteTask, createTask } from '@/lib/tasks';
import { uploadImageToCloudinary } from '@/lib/cloudinary';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { CalendarIcon, Loader2, Camera, X, Edit, Save, User, Clock, Image as ImageIcon, ChevronDown, Trash2, Upload, Search, Copy } from 'lucide-react';
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isCloning, setIsCloning] = useState(false);

  const [formData, setFormData] = useState({
    taskId: '',
    name: '',
    description: '',
    date: new Date(),
    assignedMembers: [] as string[],
    status: 'New' as TaskStatus,
    expectedKpi: '',
    actualKpi: '',
    eta: undefined as Date | undefined,
    time: '09:00',
  });

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageDescriptions, setImageDescriptions] = useState<{ [key: number]: string }>({});
  const [isDragging, setIsDragging] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  useEffect(() => {
    if (task) {
      setFormData({
        taskId: task.taskId,
        name: task.name,
        description: task.description,
        date: task.date,
        assignedMembers: task.assignedMembers,
        status: task.status,
        expectedKpi: task.expectedKpi || '',
        actualKpi: task.actualKpi || '',
        eta: task.eta,
        time: task.time || '09:00',
      });
      setImagePreviews([]);
      setSelectedFiles([]);
      // Initialize image descriptions from existing images
      const descriptions: { [key: number]: string } = {};
      task.images.forEach((img, index) => {
        if (typeof img === 'object' && img.description) {
          descriptions[index] = img.description;
        }
      });
      setImageDescriptions(descriptions);
      setIsEditing(false);
      setMemberSearchQuery('');
    }
  }, [task]);

  const validateAndAddFiles = (files: File[]) => {
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

    // Check total file limit (max 2 files)
    const totalFiles = selectedFiles.length + files.length;
    if (totalFiles > 2) {
      toast({
        title: 'Too many files',
        description: 'Maximum 2 files allowed',
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    validateAndAddFiles(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    validateAndAddFiles(files);
  };

  const removeImage = (index: number) => {
    if (!task) return;
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    // Remove description for this image
    const newDescriptions = { ...imageDescriptions };
    delete newDescriptions[index];
    setImageDescriptions(newDescriptions);
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

      // Upload new images with descriptions
      const uploadedImages: Array<{ url: string; description?: string }> = [];
      const uploadErrors: string[] = [];
      
      for (let i = 0; i < selectedFiles.length; i++) {
        try {
          // Validate file type
          const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
          if (!validImageTypes.includes(selectedFiles[i].type)) {
            uploadErrors.push(`${selectedFiles[i].name}: Invalid file type`);
            continue;
          }

          // Validate file size (max 5MB)
          if (selectedFiles[i].size > 5 * 1024 * 1024) {
            uploadErrors.push(`${selectedFiles[i].name}: File too large (max 5MB)`);
            continue;
          }

          const result = await uploadImageToCloudinary(selectedFiles[i]);
          const description = imageDescriptions[task.images.length + i]?.trim();
          uploadedImages.push({
            url: result.url,
            description: description || undefined,
          });
        } catch (error: any) {
          console.error('Error uploading image:', error);
          uploadErrors.push(`${selectedFiles[i].name}: ${error.message || 'Upload failed'}`);
        }
      }

      // Show error messages if any uploads failed
      if (uploadErrors.length > 0) {
        toast({
          title: 'Some images failed to upload',
          description: uploadErrors.join(', '),
          variant: 'destructive',
        });
      }

      // Get assigned member names
      const assignedMemberNames = formData.assignedMembers.map(userId => {
        const user = users.find(u => u.id === userId);
        return user?.name || '';
      }).filter(Boolean);

      // Prepare existing images with updated descriptions
      const existingImages = task.images.map((img, index) => {
        const url = typeof img === 'string' ? img : img.url;
        const description = imageDescriptions[index]?.trim();
        return description
          ? { url, description }
          : url;
      });

      // Update task
      await updateTask(task.id, {
        taskId: formData.taskId.trim(),
        name: formData.name.trim(),
        description: formData.description.trim(),
        date: formData.date,
        assignedMembers: formData.assignedMembers,
        assignedMemberNames,
        images: [...existingImages, ...uploadedImages],
        expectedKpi: formData.expectedKpi.trim() || undefined,
        actualKpi: formData.actualKpi.trim() || undefined,
        eta: formData.eta,
        time: formData.time || undefined,
      });

      toast({
        title: 'Task updated',
        description: 'Task has been updated successfully',
      });

      setIsEditing(false);
      setImagePreviews([]);
      setSelectedFiles([]);
      setImageDescriptions({});
      setMemberSearchQuery('');
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
      await updateTaskStatus(task.id, newStatus, {
        changedBy: user?.id,
        changedByName: user?.name,
      });
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

  const handleDelete = async () => {
    if (!task) return;

    try {
      setIsDeleting(true);
      await deleteTask(task.id);
      toast({
        title: 'Task deleted',
        description: 'Task has been deleted successfully',
      });
      setDeleteDialogOpen(false);
      onOpenChange(false);
      onTaskUpdated?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete task',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClone = async () => {
    if (!task) return;

    try {
      setIsCloning(true);

      // Generate a new task ID
      const timestamp = Date.now();
      const newTaskId = `${task.taskId}-COPY-${timestamp}`;

      // Get assigned member names
      const assignedMemberNames = task.assignedMemberNames || task.assignedMembers.map(userId => {
        const user = users.find(u => u.id === userId);
        return user?.name || '';
      }).filter(Boolean);

      // Clone the task with all the same data
      await createTask({
        taskId: newTaskId,
        name: `${task.name} (Copy)`,
        description: task.description,
        date: new Date(), // Use current date for the cloned task
        assignedMembers: task.assignedMembers,
        assignedMemberNames,
        images: task.images, // Copy image URLs
        expectedKpi: task.expectedKpi || undefined,
        actualKpi: task.actualKpi || undefined,
        eta: task.eta,
        time: task.time || undefined,
        createdBy: user?.id || '',
        createdByName: user?.name || '',
        recurring: task.recurring || false,
        recurringFrequency: task.recurringFrequency || undefined,
      });

      toast({
        title: 'Task cloned',
        description: 'Task has been cloned successfully',
      });

      onTaskUpdated?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to clone task',
        variant: 'destructive',
      });
    } finally {
      setIsCloning(false);
    }
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div>
            <DialogTitle className="text-2xl">Task Details</DialogTitle>
            <DialogDescription>
              View and manage task information
            </DialogDescription>
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
            <div className="flex items-center gap-2">
              {!isEditing && (
                <Select
                  value={task.status}
                  onValueChange={(value) => handleStatusChange(value as TaskStatus)}
                >
                  <SelectTrigger className="w-32 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="Progress">Progress</SelectItem>
                    <SelectItem value="Complete">Complete</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {isAdmin && (
                <>
                  {!isEditing && (
                    <Button
                      variant="outline"
                      size="default"
                      className="h-10"
                      onClick={handleClone}
                      disabled={isCloning}
                    >
                      {isCloning ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Cloning...
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Clone Task
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    variant={isEditing ? 'outline' : 'default'}
                    size="default"
                    className="h-10"
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
                </>
              )}
            </div>
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

          {/* Due Date */}
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

          {/* Expected KPI and Actual KPI */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Expected KPI</Label>
              {isEditing ? (
                <Input
                  value={formData.expectedKpi}
                  onChange={(e) => setFormData(prev => ({ ...prev, expectedKpi: e.target.value }))}
                  placeholder="e.g., 95% completion rate"
                />
              ) : (
                <p className="text-muted-foreground">{task.expectedKpi || 'No Expected KPI set'}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Actual KPI</Label>
              {isEditing ? (
                <Input
                  value={formData.actualKpi}
                  onChange={(e) => setFormData(prev => ({ ...prev, actualKpi: e.target.value }))}
                  placeholder="e.g., 92% completion rate"
                />
              ) : (
                <p className="text-muted-foreground">{task.actualKpi || 'No Actual KPI set'}</p>
              )}
            </div>
          </div>

          {/* ETA */}
          <div className="space-y-2">
            <Label>ETA</Label>
            {isEditing ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.eta && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.eta ? format(formData.eta, "PPP") : "Pick ETA date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.eta}
                    onSelect={(date) => setFormData(prev => ({ ...prev, eta: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarIcon className="h-4 w-4" />
                <span>{task.eta ? format(task.eta, 'PPP') : 'No ETA set'}</span>
              </div>
            )}
          </div>

          {/* Time */}
          <div className="space-y-2">
            <Label>ETA Time</Label>
            {isEditing ? (
              <Input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
              />
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{task.time || 'No time set'}</span>
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
                <PopoverContent className="w-[400px] p-0" align="start" onWheel={(e) => e.stopPropagation()}>
                  <div className="p-3 border-b">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search members..."
                        value={memberSearchQuery}
                        onChange={(e) => setMemberSearchQuery(e.target.value)}
                        className="pl-10"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <div 
                    className="max-h-64 overflow-y-auto overscroll-contain"
                    style={{ maxHeight: '16rem' }}
                    tabIndex={0}
                    onWheel={(e) => {
                      e.stopPropagation();
                      const target = e.currentTarget;
                      const { scrollTop, scrollHeight, clientHeight } = target;
                      const maxScroll = scrollHeight - clientHeight;
                      const newScrollTop = Math.max(0, Math.min(maxScroll, scrollTop + e.deltaY));
                      target.scrollTop = newScrollTop;
                      e.preventDefault();
                    }}
                  >
                    <div className="p-2">
                      <div className="space-y-2">
                        {users
                          .filter((user) => {
                            if (!memberSearchQuery.trim()) return true;
                            const query = memberSearchQuery.toLowerCase();
                            return (
                              user.name.toLowerCase().includes(query) ||
                              user.email.toLowerCase().includes(query)
                            );
                          })
                          .map((user) => (
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
                                {user.name}
                              </label>
                            </div>
                          ))}
                        {users.filter((user) => {
                          if (!memberSearchQuery.trim()) return false;
                          const query = memberSearchQuery.toLowerCase();
                          return (
                            user.name.toLowerCase().includes(query) ||
                            user.email.toLowerCase().includes(query)
                          );
                        }).length === 0 && (
                          <div className="p-4 text-center text-sm text-muted-foreground">
                            No members found
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
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
              <div className="space-y-4">
                {task.images.map((image, index) => {
                  const imageUrl = typeof image === 'string' ? image : image.url;
                  const imageDescription = typeof image === 'object' ? image.description : undefined;
                  return (
                    <div key={index} className="space-y-2">
                      <div className="relative group">
                        <img
                          src={imageUrl}
                          alt={`Task image ${index + 1}`}
                          className="w-full h-32 object-cover rounded"
                        />
                        {isAdmin && !isEditing && (
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
                      {isEditing ? (
                        <Input
                          placeholder="Add description (optional)"
                          value={imageDescriptions[index] || ''}
                          onChange={(e) => {
                            setImageDescriptions(prev => ({
                              ...prev,
                              [index]: e.target.value,
                            }));
                          }}
                          className="text-sm"
                        />
                      ) : (
                        imageDescription && (
                          <p className="text-sm text-muted-foreground">{imageDescription}</p>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {isEditing && (
              <div className="space-y-2">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
                    isDragging
                      ? "border-primary bg-primary/10"
                      : "border-muted-foreground/25 hover:border-muted-foreground/50"
                  )}
                  onClick={() => document.getElementById('task-images-input')?.click()}
                >
                  <input
                    id="task-images-input"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    disabled={isUploading}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center gap-3">
                    <div className="rounded-full border-2 border-muted-foreground/50 p-3">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Drag & drop files here</p>
                      <p className="text-xs text-muted-foreground">
                        Or click to browse (max 2 files, up to 5MB each)
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        document.getElementById('task-images-input')?.click();
                      }}
                      disabled={isUploading}
                    >
                      Browse files
                    </Button>
                  </div>
                </div>
                {imagePreviews.length > 0 && (
                  <div className="space-y-4 mt-2">
                    {imagePreviews.map((preview, index) => {
                      const imageIndex = task.images.length + index;
                      return (
                        <div key={index} className="space-y-2">
                          <div className="relative group">
                            <img
                              src={preview}
                              alt={`Preview ${index + 1}`}
                              className="w-full h-32 object-cover rounded"
                            />
                            <button
                              type="button"
                              onClick={() => removeImage(index)}
                              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <Input
                            placeholder="Add description (optional)"
                            value={imageDescriptions[imageIndex] || ''}
                            onChange={(e) => {
                              setImageDescriptions(prev => ({
                                ...prev,
                                [imageIndex]: e.target.value,
                              }));
                            }}
                            className="text-sm"
                          />
                        </div>
                      );
                    })}
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

          {/* Status Transition Times (Admin Only) */}
          {isAdmin && task.statusHistory && task.statusHistory.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-base font-semibold">Status Transition Times</Label>
                <div className="space-y-3">
                  {(() => {
                    // Find the first (earliest) time each status was reached
                    const progressChanges = task.statusHistory.filter(change => change.status === 'Progress');
                    const completeChanges = task.statusHistory.filter(change => change.status === 'Complete');
                    
                    const progressChange = progressChanges.length > 0
                      ? progressChanges.reduce((earliest, current) => 
                          current.timestamp < earliest.timestamp ? current : earliest
                        )
                      : null;
                    
                    const completeChange = completeChanges.length > 0
                      ? completeChanges.reduce((earliest, current) => 
                          current.timestamp < earliest.timestamp ? current : earliest
                        )
                      : null;
                    
                    return (
                      <>
                        {progressChange && (
                          <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                            <div className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge className="bg-yellow-500">Moved to Progress</Badge>
                                <span className="text-sm text-muted-foreground">
                                  {format(progressChange.timestamp, 'PPP p')}
                                </span>
                              </div>
                              {progressChange.changedByName && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Changed by: {progressChange.changedByName}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {completeChange && (
                          <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                            <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge className="bg-green-500">Moved to Complete</Badge>
                                <span className="text-sm text-muted-foreground">
                                  {format(completeChange.timestamp, 'PPP p')}
                                </span>
                              </div>
                              {completeChange.changedByName && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Changed by: {completeChange.changedByName}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {!progressChange && !completeChange && (
                          <div className="text-sm text-muted-foreground">
                            No status transitions recorded yet.
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </>
          )}

          {/* Status History */}
          {task.statusHistory && task.statusHistory.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-base font-semibold">Status History</Label>
                <div className="space-y-2">
                  {task.statusHistory
                    .slice()
                    .reverse()
                    .map((change, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                      >
                        <div className={cn(
                          "w-2 h-2 rounded-full mt-2 flex-shrink-0",
                          getStatusColor(change.status)
                        )} />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(change.status)}>
                              {change.status}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {format(change.timestamp, 'PPP p')}
                            </span>
                          </div>
                          {change.changedByName && (
                            <div className="text-xs text-muted-foreground">
                              Changed by: {change.changedByName}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}

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
                      expectedKpi: task.expectedKpi || '',
                      actualKpi: task.actualKpi || '',
                      eta: task.eta,
                      time: task.time || '09:00',
                    });
                  }
                  setImagePreviews([]);
                  setSelectedFiles([]);
                  // Reset image descriptions to current task values
                  if (task) {
                    const descriptions: { [key: number]: string } = {};
                    task.images.forEach((img, index) => {
                      if (typeof img === 'object' && img.description) {
                        descriptions[index] = img.description;
                      }
                    });
                    setImageDescriptions(descriptions);
                  } else {
                    setImageDescriptions({});
                  }
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

          {/* Delete Button */}
          {isAdmin && !isEditing && (
            <div className="flex justify-end pt-4 border-t">
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Task
              </Button>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the task
              "{task?.name}" and all of its data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

