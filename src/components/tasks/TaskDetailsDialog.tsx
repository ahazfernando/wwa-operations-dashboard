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
import { updateTask, updateTaskStatus, updateTaskImages, updateTaskFiles, updateTaskSubtasks, deleteTask, createTask } from '@/lib/tasks';
import { Subtask } from '@/types/task';
import { uploadImageToCloudinary, uploadFileToCloudinary } from '@/lib/cloudinary';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { CalendarIcon, Loader2, Camera, X, Edit, Save, User, Clock, Image as ImageIcon, ChevronDown, Trash2, Upload, Search, Copy, FileText, Plus, CheckSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

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
  const [isEditingActualKpi, setIsEditingActualKpi] = useState(false);
  const [isSavingActualKpi, setIsSavingActualKpi] = useState(false);

  const [formData, setFormData] = useState({
    taskId: '',
    name: '',
    description: '',
    date: new Date(),
    assignedMembers: [] as string[],
    status: 'New' as TaskStatus,
    expectedKpi: undefined as number | undefined,
    actualKpi: undefined as number | undefined,
    eta: undefined as Date | undefined,
    time: '09:00',
  });

  const [selectedImageFiles, setSelectedImageFiles] = useState<File[]>([]);
  const [selectedDocumentFiles, setSelectedDocumentFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageDescriptions, setImageDescriptions] = useState<{ [key: number]: string }>({});
  const [fileDescriptions, setFileDescriptions] = useState<{ [key: number]: string }>({});
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [newSubtaskDescription, setNewSubtaskDescription] = useState('');
  const [subtaskImageFiles, setSubtaskImageFiles] = useState<{ [subtaskId: string]: File[] }>({});
  const [subtaskDocumentFiles, setSubtaskDocumentFiles] = useState<{ [subtaskId: string]: File[] }>({});
  const [subtaskImagePreviews, setSubtaskImagePreviews] = useState<{ [subtaskId: string]: string[] }>({});
  const [uploadingSubtaskId, setUploadingSubtaskId] = useState<string | null>(null);

  useEffect(() => {
    if (task) {
      setFormData({
        taskId: task.taskId,
        name: task.name,
        description: task.description,
        date: task.date,
        assignedMembers: task.assignedMembers,
        status: task.status,
        expectedKpi: task.expectedKpi,
        actualKpi: task.actualKpi,
        eta: task.eta,
        time: task.time || '09:00',
      });
      setImagePreviews([]);
      setSelectedImageFiles([]);
      setSelectedDocumentFiles([]);
      // Initialize image descriptions from existing images
      const imgDescriptions: { [key: number]: string } = {};
      task.images.forEach((img, index) => {
        if (typeof img === 'object' && img.description) {
          imgDescriptions[index] = img.description;
        }
      });
      setImageDescriptions(imgDescriptions);
      // Initialize file descriptions from existing files
      const fileDesc: { [key: number]: string } = {};
      if (task.files) {
        task.files.forEach((file, index) => {
          if (typeof file === 'object' && file.description) {
            fileDesc[index] = file.description;
          }
        });
      }
      setFileDescriptions(fileDesc);
      setIsEditing(false);
      setIsEditingActualKpi(false);
      setMemberSearchQuery('');
      setNewSubtaskDescription('');
      setSubtaskImageFiles({});
      setSubtaskDocumentFiles({});
      setSubtaskImagePreviews({});
      setUploadingSubtaskId(null);
    }
  }, [task]);

  const addSubtask = async () => {
    if (!task || !newSubtaskDescription.trim()) {
      toast({
        title: 'Validation error',
        description: 'Please enter a subtask description',
        variant: 'destructive',
      });
      return;
    }

    const newSubtask: Subtask = {
      id: Date.now().toString(),
      description: newSubtaskDescription.trim(),
      addedAt: new Date(),
      completed: false,
    };

    const updatedSubtasks = [...(task.subtasks || []), newSubtask];

    try {
      await updateTaskSubtasks(task.id, updatedSubtasks);
      toast({
        title: 'Subtask added',
        description: 'Subtask has been added successfully',
      });
      setNewSubtaskDescription('');
      onTaskUpdated?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add subtask',
        variant: 'destructive',
      });
    }
  };

  const toggleSubtaskCompletion = async (subtaskId: string) => {
    if (!task) return;

    const updatedSubtasks = (task.subtasks || []).map(subtask => {
      if (subtask.id === subtaskId) {
        return {
          ...subtask,
          completed: !subtask.completed,
          completedAt: !subtask.completed ? new Date() : undefined,
        };
      }
      return subtask;
    });

    try {
      await updateTaskSubtasks(task.id, updatedSubtasks);
      toast({
        title: 'Subtask updated',
        description: 'Subtask completion status has been updated',
      });
      onTaskUpdated?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update subtask',
        variant: 'destructive',
      });
    }
  };

  const removeSubtask = async (subtaskId: string) => {
    if (!task) return;

    const updatedSubtasks = (task.subtasks || []).filter(subtask => subtask.id !== subtaskId);

    try {
      await updateTaskSubtasks(task.id, updatedSubtasks);
      toast({
        title: 'Subtask removed',
        description: 'Subtask has been removed successfully',
      });
      // Clean up associated files
      const newImageFiles = { ...subtaskImageFiles };
      const newDocumentFiles = { ...subtaskDocumentFiles };
      const newImagePreviews = { ...subtaskImagePreviews };
      delete newImageFiles[subtaskId];
      delete newDocumentFiles[subtaskId];
      delete newImagePreviews[subtaskId];
      setSubtaskImageFiles(newImageFiles);
      setSubtaskDocumentFiles(newDocumentFiles);
      setSubtaskImagePreviews(newImagePreviews);
      onTaskUpdated?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove subtask',
        variant: 'destructive',
      });
    }
  };

  const handleSubtaskImageSelect = (subtaskId: string, files: File[]) => {
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

    const currentFiles = subtaskImageFiles[subtaskId] || [];
    const existingImages = task?.subtasks?.find(s => s.id === subtaskId)?.images || [];
    if (currentFiles.length + existingImages.length + files.length > 2) {
      toast({
        title: 'Too many files',
        description: 'Maximum 2 image files per subtask',
        variant: 'destructive',
      });
      return;
    }

    setSubtaskImageFiles(prev => ({
      ...prev,
      [subtaskId]: [...(prev[subtaskId] || []), ...files],
    }));

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSubtaskImagePreviews(prev => ({
          ...prev,
          [subtaskId]: [...(prev[subtaskId] || []), reader.result as string],
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubtaskDocumentSelect = (subtaskId: string, files: File[]) => {
    if (files.length === 0) return;

    const validTypes = ['application/pdf'];
    const invalidFiles = files.filter(file => !validTypes.includes(file.type));

    if (invalidFiles.length > 0) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload only PDF files',
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

    const currentFiles = subtaskDocumentFiles[subtaskId] || [];
    const existingFiles = task?.subtasks?.find(s => s.id === subtaskId)?.files || [];
    if (currentFiles.length + existingFiles.length + files.length > 2) {
      toast({
        title: 'Too many files',
        description: 'Maximum 2 document files per subtask',
        variant: 'destructive',
      });
      return;
    }

    setSubtaskDocumentFiles(prev => ({
      ...prev,
      [subtaskId]: [...(prev[subtaskId] || []), ...files],
    }));
  };

  const uploadSubtaskAttachments = async (subtaskId: string) => {
    if (!task) return;

    try {
      setUploadingSubtaskId(subtaskId);
      const imageFiles = subtaskImageFiles[subtaskId] || [];
      const documentFiles = subtaskDocumentFiles[subtaskId] || [];
      const subtask = task.subtasks?.find(s => s.id === subtaskId);
      
      const uploadedImages: string[] = [];
      const uploadedFiles: Array<{ url: string; name: string }> = [];

      // Upload images
      for (const file of imageFiles) {
        try {
          const result = await uploadImageToCloudinary(file);
          uploadedImages.push(result.url);
        } catch (error: any) {
          console.error('Error uploading subtask image:', error);
          toast({
            title: 'Image upload failed',
            description: `Failed to upload image. Continuing...`,
            variant: 'destructive',
          });
        }
      }

      // Upload files
      for (const file of documentFiles) {
        try {
          const result = await uploadFileToCloudinary(file);
          uploadedFiles.push({ url: result.url, name: file.name });
        } catch (error: any) {
          console.error('Error uploading subtask file:', error);
          toast({
            title: 'File upload failed',
            description: `Failed to upload file. Continuing...`,
            variant: 'destructive',
          });
        }
      }

      // Update subtask with new attachments
      const existingImages = subtask?.images || [];
      const existingFiles = subtask?.files || [];
      
      // Normalize existing images to strings/objects
      const normalizedExistingImages = existingImages.map((img: any) => {
        if (typeof img === 'string') return img;
        return img.url || img;
      });
      
      // Normalize existing files to objects
      const normalizedExistingFiles = existingFiles.map((file: any) => {
        if (typeof file === 'string') return { url: file, name: 'Document' };
        return { url: file.url || '', name: file.name || 'Document' };
      });
      
      const updatedSubtasks = (task.subtasks || []).map(s => {
        if (s.id === subtaskId) {
          return {
            ...s,
            images: [...normalizedExistingImages, ...uploadedImages],
            files: [...normalizedExistingFiles, ...uploadedFiles],
          };
        }
        return s;
      });

      await updateTaskSubtasks(task.id, updatedSubtasks);

      // Clear uploaded files
      const newImageFiles = { ...subtaskImageFiles };
      const newDocumentFiles = { ...subtaskDocumentFiles };
      const newImagePreviews = { ...subtaskImagePreviews };
      delete newImageFiles[subtaskId];
      delete newDocumentFiles[subtaskId];
      delete newImagePreviews[subtaskId];
      setSubtaskImageFiles(newImageFiles);
      setSubtaskDocumentFiles(newDocumentFiles);
      setSubtaskImagePreviews(newImagePreviews);

      toast({
        title: 'Attachments uploaded',
        description: 'Subtask attachments have been uploaded successfully',
      });
      onTaskUpdated?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload attachments',
        variant: 'destructive',
      });
    } finally {
      setUploadingSubtaskId(null);
    }
  };

  const removeSubtaskImage = async (subtaskId: string, index: number) => {
    if (!task) return;

    const subtask = task.subtasks?.find(s => s.id === subtaskId);
    if (!subtask) return;

    const updatedImages = (subtask.images || []).filter((_, i) => i !== index);
    const updatedSubtasks = (task.subtasks || []).map(s => {
      if (s.id === subtaskId) {
        return { ...s, images: updatedImages };
      }
      return s;
    });

    try {
      await updateTaskSubtasks(task.id, updatedSubtasks);
      toast({
        title: 'Image removed',
        description: 'Image has been removed from the subtask',
      });
      onTaskUpdated?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove image',
        variant: 'destructive',
      });
    }
  };

  const removeSubtaskFile = async (subtaskId: string, index: number) => {
    if (!task) return;

    const subtask = task.subtasks?.find(s => s.id === subtaskId);
    if (!subtask) return;

    const updatedFiles = (subtask.files || []).filter((_, i) => i !== index);
    const updatedSubtasks = (task.subtasks || []).map(s => {
      if (s.id === subtaskId) {
        return { ...s, files: updatedFiles };
      }
      return s;
    });

    try {
      await updateTaskSubtasks(task.id, updatedSubtasks);
      toast({
        title: 'File removed',
        description: 'File has been removed from the subtask',
      });
      onTaskUpdated?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove file',
        variant: 'destructive',
      });
    }
  };

  const validateAndAddImages = (files: File[]) => {
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
    const totalFiles = selectedImageFiles.length + files.length;
    if (totalFiles > 2) {
      toast({
        title: 'Too many files',
        description: 'Maximum 2 image files allowed',
        variant: 'destructive',
      });
      return;
    }

    setSelectedImageFiles(prev => [...prev, ...files]);

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const validateAndAddDocumentFiles = (files: File[]) => {
    if (files.length === 0) return;

    const validTypes = ['application/pdf'];
    const invalidFiles = files.filter(file => !validTypes.includes(file.type));

    if (invalidFiles.length > 0) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload only PDF files',
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
    const totalFiles = selectedDocumentFiles.length + files.length;
    if (totalFiles > 2) {
      toast({
        title: 'Too many files',
        description: 'Maximum 2 document files allowed',
        variant: 'destructive',
      });
      return;
    }

    setSelectedDocumentFiles(prev => [...prev, ...files]);
  };

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    validateAndAddImages(files);
  };

  const handleDocumentFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    validateAndAddDocumentFiles(files);
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
    validateAndAddImages(files);
  };

  const handleDragOverFiles = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFiles(true);
  };

  const handleDragLeaveFiles = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFiles(false);
  };

  const handleDropFiles = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFiles(false);

    const files = Array.from(e.dataTransfer.files);
    validateAndAddDocumentFiles(files);
  };

  const removeImage = (index: number) => {
    if (!task) return;
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    setSelectedImageFiles(prev => prev.filter((_, i) => i !== index));
    // Remove description for this image
    const newDescriptions = { ...imageDescriptions };
    delete newDescriptions[index];
    setImageDescriptions(newDescriptions);
  };

  const removeDocumentFile = (index: number) => {
    if (!task) return;
    setSelectedDocumentFiles(prev => prev.filter((_, i) => i !== index));
    // Remove description for this file
    const newDescriptions = { ...fileDescriptions };
    delete newDescriptions[index];
    setFileDescriptions(newDescriptions);
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
      const imageUploadErrors: string[] = [];
      
      for (let i = 0; i < selectedImageFiles.length; i++) {
        try {
          const result = await uploadImageToCloudinary(selectedImageFiles[i]);
          const description = imageDescriptions[task.images.length + i]?.trim();
          // Only include description if it's not empty
          const imageObj: { url: string; description?: string } = { url: result.url };
          if (description && description.length > 0) {
            imageObj.description = description;
          }
          uploadedImages.push(imageObj);
        } catch (error: any) {
          console.error('Error uploading image:', error);
          imageUploadErrors.push(`${selectedImageFiles[i].name}: ${error.message || 'Upload failed'}`);
        }
      }

      // Upload new document files with descriptions
      const uploadedFiles: Array<{ url: string; name: string; description?: string }> = [];
      const fileUploadErrors: string[] = [];
      
      for (let i = 0; i < selectedDocumentFiles.length; i++) {
        try {
          const result = await uploadFileToCloudinary(selectedDocumentFiles[i]);
          const fileIndex = (task.files?.length || 0) + i;
          const description = fileDescriptions[fileIndex]?.trim();
          // Only include description if it's not empty
          const fileObj: { url: string; name: string; description?: string } = { 
            url: result.url, 
            name: selectedDocumentFiles[i].name 
          };
          if (description && description.length > 0) {
            fileObj.description = description;
          }
          uploadedFiles.push(fileObj);
        } catch (error: any) {
          console.error('Error uploading file:', error);
          fileUploadErrors.push(`${selectedDocumentFiles[i].name}: ${error.message || 'Upload failed'}`);
        }
      }

      // Show error messages if any uploads failed
      if (imageUploadErrors.length > 0) {
        toast({
          title: 'Some images failed to upload',
          description: imageUploadErrors.join(', '),
          variant: 'destructive',
        });
      }
      if (fileUploadErrors.length > 0) {
        toast({
          title: 'Some files failed to upload',
          description: fileUploadErrors.join(', '),
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
        // Only include description if it's not empty
        if (description && description.length > 0) {
          return { url, description };
        }
        return url;
      });

      // Prepare existing files with updated descriptions
      const existingFiles = (task.files || []).map((file, index) => {
        const url = typeof file === 'string' ? file : file.url;
        const name = typeof file === 'string' ? 'Document' : file.name;
        const description = fileDescriptions[index]?.trim();
        // Only include description if it's not empty
        if (description && description.length > 0) {
          return { url, name, description };
        }
        return { url, name };
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
        files: [...existingFiles, ...uploadedFiles],
        expectedKpi: formData.expectedKpi,
        actualKpi: formData.actualKpi,
        eta: formData.eta,
        time: formData.time || undefined,
        subtasks: task.subtasks,
      });

      toast({
        title: 'Task updated',
        description: 'Task has been updated successfully',
      });

      setIsEditing(false);
      setIsEditingActualKpi(false);
      setImagePreviews([]);
      setSelectedImageFiles([]);
      setSelectedDocumentFiles([]);
      setImageDescriptions({});
      setFileDescriptions({});
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

    // Validate KPI only if Expected KPI is set
    // Skip this check for collaborative tasks as they have their own completion logic
    if (newStatus === 'Complete' && !task.collaborative) {
      const currentActualKpi = task.actualKpi;
      const currentExpectedKpi = task.expectedKpi;
      
      // Only validate KPI if Expected KPI is set
      if (currentExpectedKpi !== undefined && currentExpectedKpi !== null) {
        // If Expected KPI is set, Actual KPI must be set and must match
        if (currentActualKpi === undefined || currentActualKpi === null) {
          toast({
            title: 'Cannot complete task',
            description: 'Please fill in the Actual KPI before completing the task',
            variant: 'destructive',
          });
          return;
        }
        
        // Check if Actual KPI equals Expected KPI
        if (currentActualKpi !== currentExpectedKpi) {
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
      await updateTaskStatus(task.id, newStatus, {
        changedBy: user?.id,
        changedByName: user?.name,
      });
      setFormData(prev => ({ ...prev, status: newStatus }));
      
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
      // Reset subtasks completion status when cloning
      const clonedSubtasks = task.subtasks?.map(subtask => ({
        ...subtask,
        id: `${subtask.id}-${Date.now()}`,
        completed: false,
        completedAt: undefined,
        addedAt: new Date(),
      })) || [];

      await createTask({
        taskId: newTaskId,
        name: `${task.name} (Copy)`,
        description: task.description,
        date: new Date(), // Use current date for the cloned task
        assignedMembers: task.assignedMembers,
        assignedMemberNames,
        images: task.images, // Copy image URLs
        expectedKpi: task.expectedKpi,
        actualKpi: task.actualKpi,
        eta: task.eta,
        time: task.time || undefined,
        createdBy: user?.id || '',
        createdByName: user?.name || '',
        recurring: task.recurring || false,
        recurringFrequency: task.recurringFrequency || undefined,
        recurringStartDate: task.recurringStartDate,
        recurringEndDate: task.recurringEndDate,
        collaborative: task.collaborative || false,
        subtasks: clonedSubtasks,
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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0">
        <div className="w-full h-full">
          {/* Content */}
          <div className="relative bg-background rounded-lg overflow-y-auto max-h-[90vh]">
            <div className="p-6">
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
                  type="number"
                  step="0.01"
                  value={formData.expectedKpi ?? ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData(prev => ({ 
                      ...prev, 
                      expectedKpi: value === '' ? undefined : parseFloat(value) 
                    }));
                  }}
                  placeholder="e.g., 95"
                />
              ) : (
                <p className="text-muted-foreground">{task.expectedKpi !== undefined ? task.expectedKpi : 'No Expected KPI set'}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Actual KPI *</Label>
              {isEditingActualKpi ? (
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.actualKpi ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData(prev => ({ 
                        ...prev, 
                        actualKpi: value === '' ? undefined : parseFloat(value) 
                      }));
                    }}
                    placeholder="e.g., 92"
                    disabled={isSavingActualKpi}
                  />
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (!task) return;
                      try {
                        setIsSavingActualKpi(true);
                        await updateTask(task.id, {
                          taskId: task.taskId,
                          name: task.name,
                          description: task.description,
                          date: task.date,
                          assignedMembers: task.assignedMembers,
                          assignedMemberNames: task.assignedMemberNames || [],
                          images: task.images,
                          files: task.files,
                          expectedKpi: task.expectedKpi,
                          actualKpi: formData.actualKpi,
                          eta: task.eta,
                          time: task.time || undefined,
                        });
                        setIsEditingActualKpi(false);
                        toast({
                          title: 'Actual KPI updated',
                          description: 'Actual KPI has been updated successfully',
                        });
                        onTaskUpdated?.();
                      } catch (error: any) {
                        toast({
                          title: 'Error',
                          description: error.message || 'Failed to update Actual KPI',
                          variant: 'destructive',
                        });
                      } finally {
                        setIsSavingActualKpi(false);
                      }
                    }}
                    disabled={isSavingActualKpi}
                  >
                    {isSavingActualKpi ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsEditingActualKpi(false);
                      setFormData(prev => ({ ...prev, actualKpi: task.actualKpi }));
                    }}
                    disabled={isSavingActualKpi}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-muted-foreground flex-1">{task.actualKpi !== undefined ? task.actualKpi : 'No Actual KPI set'}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsEditingActualKpi(true);
                      setFormData(prev => ({ ...prev, actualKpi: task.actualKpi }));
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
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

          {/* Subtasks */}
          <div className="space-y-2">
            <Label>Subtasks</Label>
            {!isAdmin && (
              <p className="text-xs text-muted-foreground">Only admins can create subtasks</p>
            )}
            <div className="space-y-3">
              {isAdmin && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter subtask description"
                    value={newSubtaskDescription}
                    onChange={(e) => setNewSubtaskDescription(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSubtask();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addSubtask}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              )}
              {task.subtasks && task.subtasks.length > 0 && (
                <div className="space-y-3 border rounded-lg p-3">
                  {task.subtasks.map((subtask) => {
                    const subtaskImageFilesList = subtaskImageFiles[subtask.id] || [];
                    const subtaskDocumentFilesList = subtaskDocumentFiles[subtask.id] || [];
                    const subtaskImagePreviewsList = subtaskImagePreviews[subtask.id] || [];
                    const existingImages = subtask.images || [];
                    const existingFiles = subtask.files || [];
                    const hasPendingUploads = subtaskImageFilesList.length > 0 || subtaskDocumentFilesList.length > 0;
                    
                    return (
                      <div
                        key={subtask.id}
                        className="space-y-2 p-3 border rounded-md bg-card"
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={subtask.completed}
                            onCheckedChange={() => toggleSubtaskCompletion(subtask.id)}
                            disabled={!isAdmin && !task.assignedMembers.includes(user?.id || '')}
                            className="mt-1"
                          />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <p className={cn(
                                "text-sm flex-1",
                                subtask.completed && "line-through text-muted-foreground"
                              )}>
                                {subtask.description}
                              </p>
                              {isAdmin && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeSubtask(subtask.id)}
                                  className="h-6 w-6 p-0"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Added: {format(subtask.addedAt, 'MMM dd, yyyy HH:mm')}
                              </span>
                              {subtask.completed && subtask.completedAt && (
                                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                  <CheckSquare className="h-3 w-3" />
                                  Completed: {format(subtask.completedAt, 'MMM dd, yyyy HH:mm')}
                                </span>
                              )}
                            </div>

                            {/* Existing Subtask Images */}
                            {existingImages.length > 0 && (
                              <div className="flex gap-2 flex-wrap mt-2">
                                {existingImages.map((image, index) => {
                                  const imageUrl = typeof image === 'string' ? image : image.url;
                                  return (
                                    <div key={index} className="relative group">
                                      <img
                                        src={imageUrl}
                                        alt={`Subtask image ${index + 1}`}
                                        className="w-16 h-16 object-cover rounded cursor-pointer"
                                        onClick={() => {
                                          // Could open in a dialog for full view
                                        }}
                                      />
                                      {isAdmin && (
                                        <button
                                          onClick={() => removeSubtaskImage(subtask.id, index)}
                                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Pending Image Previews */}
                            {subtaskImagePreviewsList.length > 0 && (
                              <div className="flex gap-2 flex-wrap mt-2">
                                {subtaskImagePreviewsList.map((preview, index) => (
                                  <div key={index} className="relative group">
                                    <img
                                      src={preview}
                                      alt={`Preview ${index + 1}`}
                                      className="w-16 h-16 object-cover rounded"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newFiles = { ...subtaskImageFiles };
                                        const newPreviews = { ...subtaskImagePreviews };
                                        if (newFiles[subtask.id]) {
                                          newFiles[subtask.id] = newFiles[subtask.id].filter((_, i) => i !== index);
                                        }
                                        if (newPreviews[subtask.id]) {
                                          newPreviews[subtask.id] = newPreviews[subtask.id].filter((_, i) => i !== index);
                                        }
                                        setSubtaskImageFiles(newFiles);
                                        setSubtaskImagePreviews(newPreviews);
                                      }}
                                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Existing Subtask Files */}
                            {existingFiles.length > 0 && (
                              <div className="space-y-1 mt-2">
                                {existingFiles.map((file, index) => {
                                  const fileUrl = typeof file === 'string' ? file : file.url;
                                  const fileName = typeof file === 'string' ? 'Document' : file.name;
                                  return (
                                    <div key={index} className="flex items-center gap-2 p-2 border rounded bg-muted/50">
                                      <FileText className="h-4 w-4 text-muted-foreground" />
                                      <a
                                        href={fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs flex-1 hover:underline"
                                      >
                                        {fileName}
                                      </a>
                                      {isAdmin && (
                                        <button
                                          onClick={() => removeSubtaskFile(subtask.id, index)}
                                          className="text-red-500 hover:text-red-700"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Pending Document Files */}
                            {subtaskDocumentFilesList.length > 0 && (
                              <div className="space-y-1 mt-2">
                                {subtaskDocumentFilesList.map((file, index) => (
                                  <div key={index} className="flex items-center gap-2 p-2 border rounded bg-muted/50">
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-xs flex-1">{file.name}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newFiles = { ...subtaskDocumentFiles };
                                        if (newFiles[subtask.id]) {
                                          newFiles[subtask.id] = newFiles[subtask.id].filter((_, i) => i !== index);
                                        }
                                        setSubtaskDocumentFiles(newFiles);
                                      }}
                                      className="text-red-500 hover:text-red-700"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Subtask Attachment Buttons */}
                            {isAdmin && (
                              <div className="flex items-center gap-2 mt-2">
                                <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                                  <ImageIcon className="h-3 w-3" />
                                  <span>Add Image</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={(e) => {
                                      const files = Array.from(e.target.files || []);
                                      handleSubtaskImageSelect(subtask.id, files);
                                      e.target.value = '';
                                    }}
                                    className="hidden"
                                    disabled={uploadingSubtaskId === subtask.id}
                                  />
                                </label>
                                <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                                  <FileText className="h-3 w-3" />
                                  <span>Add File</span>
                                  <input
                                    type="file"
                                    accept="application/pdf"
                                    multiple
                                    onChange={(e) => {
                                      const files = Array.from(e.target.files || []);
                                      handleSubtaskDocumentSelect(subtask.id, files);
                                      e.target.value = '';
                                    }}
                                    className="hidden"
                                    disabled={uploadingSubtaskId === subtask.id}
                                  />
                                </label>
                                {hasPendingUploads && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => uploadSubtaskAttachments(subtask.id)}
                                    disabled={uploadingSubtaskId === subtask.id}
                                    className="ml-auto"
                                  >
                                    {uploadingSubtaskId === subtask.id ? (
                                      <>
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                        Uploading...
                                      </>
                                    ) : (
                                      <>
                                        <Upload className="h-3 w-3 mr-1" />
                                        Upload
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {(!task.subtasks || task.subtasks.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No subtasks added yet
                </p>
              )}
            </div>
          </div>

          {/* Images and Files */}
          <div className="space-y-2">
            <Label>Attachments</Label>
            <Tabs defaultValue="images" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="images">
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Images
                </TabsTrigger>
                <TabsTrigger value="files">
                  <FileText className="h-4 w-4 mr-2" />
                  Files
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="images" className="space-y-4">
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
                        onChange={handleImageFileSelect}
                        disabled={isUploading}
                        className="hidden"
                      />
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-full border-2 border-muted-foreground/50 p-3">
                          <Upload className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Drag & drop images here</p>
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
                          Browse images
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
              </TabsContent>
              
              <TabsContent value="files" className="space-y-4">
                {task.files && task.files.length > 0 && (
                  <div className="space-y-4">
                    {task.files.map((file, index) => {
                      const fileUrl = typeof file === 'string' ? file : file.url;
                      const fileName = typeof file === 'string' ? 'Document' : file.name;
                      const fileDescription = typeof file === 'object' ? file.description : undefined;
                      return (
                        <div key={index} className="space-y-2">
                          <div className="relative group p-4 border rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3">
                              <FileText className="h-8 w-8 text-muted-foreground" />
                              <div className="flex-1">
                                <a
                                  href={fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium hover:underline"
                                >
                                  {fileName}
                                </a>
                                {fileDescription && !isEditing && (
                                  <p className="text-xs text-muted-foreground mt-1">{fileDescription}</p>
                                )}
                              </div>
                              {isAdmin && !isEditing && (
                                <button
                                  onClick={async () => {
                                    try {
                                      setUploadingIndex(index);
                                      const updatedFiles = task.files?.filter((_, i) => i !== index) || [];
                                      await updateTaskFiles(task.id, updatedFiles);
                                      toast({
                                        title: 'File removed',
                                        description: 'File has been removed from the task',
                                      });
                                      onTaskUpdated?.();
                                    } catch (error: any) {
                                      toast({
                                        title: 'Error',
                                        description: error.message || 'Failed to remove file',
                                        variant: 'destructive',
                                      });
                                    } finally {
                                      setUploadingIndex(null);
                                    }
                                  }}
                                  disabled={uploadingIndex === index}
                                  className="bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  {uploadingIndex === index ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <X className="h-4 w-4" />
                                  )}
                                </button>
                              )}
                            </div>
                            {isEditing && (
                              <Input
                                placeholder="Add description (optional)"
                                value={fileDescriptions[index] || ''}
                                onChange={(e) => {
                                  setFileDescriptions(prev => ({
                                    ...prev,
                                    [index]: e.target.value,
                                  }));
                                }}
                                className="text-sm mt-2"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {isEditing && (
                  <div className="space-y-2">
                    <div
                      onDragOver={handleDragOverFiles}
                      onDragLeave={handleDragLeaveFiles}
                      onDrop={handleDropFiles}
                      className={cn(
                        "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
                        isDraggingFiles
                          ? "border-primary bg-primary/10"
                          : "border-muted-foreground/25 hover:border-muted-foreground/50"
                      )}
                      onClick={() => document.getElementById('task-files-input')?.click()}
                    >
                      <input
                        id="task-files-input"
                        type="file"
                        accept="application/pdf"
                        multiple
                        onChange={handleDocumentFileSelect}
                        disabled={isUploading}
                        className="hidden"
                      />
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-full border-2 border-muted-foreground/50 p-3">
                          <Upload className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Drag & drop PDF files here</p>
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
                            document.getElementById('task-files-input')?.click();
                          }}
                          disabled={isUploading}
                        >
                          Browse files
                        </Button>
                      </div>
                    </div>
                    {selectedDocumentFiles.length > 0 && (
                      <div className="space-y-4 mt-2">
                        {selectedDocumentFiles.map((file, index) => {
                          const fileIndex = (task.files?.length || 0) + index;
                          return (
                            <div key={index} className="space-y-2">
                              <div className="relative group p-4 border rounded-lg bg-muted/50">
                                <div className="flex items-center gap-3">
                                  <FileText className="h-8 w-8 text-muted-foreground" />
                                  <div className="flex-1">
                                    <p className="text-sm font-medium">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {(file.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeDocumentFile(index)}
                                    className="bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                                <Input
                                  placeholder="Add description (optional)"
                                  value={fileDescriptions[fileIndex] || ''}
                                  onChange={(e) => {
                                    setFileDescriptions(prev => ({
                                      ...prev,
                                      [fileIndex]: e.target.value,
                                    }));
                                  }}
                                  className="text-sm mt-2"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
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

          {/* Collaborative Task Completion Status */}
          {task.collaborative && task.assignedMembers && task.assignedMembers.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-base font-semibold">Collaborative Task Progress</Label>
                <div className="space-y-2">
                  {task.assignedMembers.map((memberId) => {
                    const memberIndex = task.assignedMembers.indexOf(memberId);
                    const memberName = task.assignedMemberNames?.[memberIndex] || 
                      users.find(u => u.id === memberId)?.name || 
                      'Unknown';
                    const completed = task.completedBy?.some(entry => entry.userId === memberId);
                    
                    return (
                      <div
                        key={memberId}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                      >
                        <div className={cn(
                          "w-2 h-2 rounded-full flex-shrink-0",
                          completed ? "bg-green-500" : "bg-gray-400"
                        )} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{memberName}</span>
                            {completed && (
                              <Badge className="bg-green-500">
                                Completed
                              </Badge>
                            )}
                            {!completed && (
                              <Badge variant="outline">
                                Pending
                              </Badge>
                            )}
                          </div>
                          {completed && (() => {
                            const completionEntry = task.completedBy?.find(entry => entry.userId === memberId);
                            return completionEntry ? (
                              <div className="text-xs text-muted-foreground mt-1">
                                Completed on: {format(completionEntry.completedAt, 'PPP p')}
                              </div>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {task.completedBy && task.completedBy.length > 0 && (
                  <div className="mt-3 p-3 rounded-lg bg-muted">
                    <p className="text-sm font-medium">
                      {task.completedBy.length} of {task.assignedMembers.length} members completed
                    </p>
                    {task.completedBy.length === task.assignedMembers.length && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        ✓ All members have completed this task
                      </p>
                    )}
                  </div>
                )}
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
                  setIsEditingActualKpi(false);
                  if (task) {
                    setFormData({
                      taskId: task.taskId,
                      name: task.name,
                      description: task.description,
                      date: task.date,
                      assignedMembers: task.assignedMembers,
                      status: task.status,
        expectedKpi: task.expectedKpi,
        actualKpi: task.actualKpi,
                      eta: task.eta,
                      time: task.time || '09:00',
                    });
                  }
                  setImagePreviews([]);
                  setSelectedImageFiles([]);
                  setSelectedDocumentFiles([]);
                  // Reset image descriptions to current task values
                  if (task) {
                    const imgDesc: { [key: number]: string } = {};
                    task.images.forEach((img, index) => {
                      if (typeof img === 'object' && img.description) {
                        imgDesc[index] = img.description;
                      }
                    });
                    setImageDescriptions(imgDesc);
                    // Reset file descriptions to current task values
                    const fileDesc: { [key: number]: string } = {};
                    if (task.files) {
                      task.files.forEach((file, index) => {
                        if (typeof file === 'object' && file.description) {
                          fileDesc[index] = file.description;
                        }
                      });
                    }
                    setFileDescriptions(fileDesc);
                  } else {
                    setImageDescriptions({});
                    setFileDescriptions({});
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
            </div>
          </div>
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

