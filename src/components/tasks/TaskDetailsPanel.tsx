"use client";

import { useState, useEffect } from 'react';
import { Task, TaskStatus } from '@/types/task';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { CalendarIcon, Loader2, Camera, X, Edit, Save, User, Clock, Image as ImageIcon, ChevronDown, Trash2, Upload, Search, Copy, FileText, Plus, CheckSquare, Download, MoreVertical, Share2, MessageSquare, Activity } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface User {
  id: string;
  name: string;
  email: string;
}

interface TaskDetailsPanelProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
  onTaskUpdated?: () => void;
}

export function TaskDetailsPanel({
  task,
  open,
  onOpenChange,
  users,
  onTaskUpdated,
}: TaskDetailsPanelProps) {
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
      const imgDescriptions: { [key: number]: string } = {};
      task.images.forEach((img, index) => {
        if (typeof img === 'object' && img.description) {
          imgDescriptions[index] = img.description;
        }
      });
      setImageDescriptions(imgDescriptions);
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

  // Reuse all the handler functions from TaskDetailsDialog
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

      const existingImages = subtask?.images || [];
      const existingFiles = subtask?.files || [];
      
      const normalizedExistingImages = existingImages.map((img: any) => {
        if (typeof img === 'string') return img;
        return img.url || img;
      });
      
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
    const newDescriptions = { ...imageDescriptions };
    delete newDescriptions[index];
    setImageDescriptions(newDescriptions);
  };

  const removeDocumentFile = (index: number) => {
    if (!task) return;
    setSelectedDocumentFiles(prev => prev.filter((_, i) => i !== index));
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

      const uploadedImages: Array<{ url: string; description?: string }> = [];
      const imageUploadErrors: string[] = [];
      
      for (let i = 0; i < selectedImageFiles.length; i++) {
        try {
          const result = await uploadImageToCloudinary(selectedImageFiles[i]);
          const description = imageDescriptions[task.images.length + i]?.trim();
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

      const uploadedFiles: Array<{ url: string; name: string; description?: string }> = [];
      const fileUploadErrors: string[] = [];
      
      for (let i = 0; i < selectedDocumentFiles.length; i++) {
        try {
          const result = await uploadFileToCloudinary(selectedDocumentFiles[i]);
          const fileIndex = (task.files?.length || 0) + i;
          const description = fileDescriptions[fileIndex]?.trim();
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

      const assignedMemberNames = formData.assignedMembers.map(userId => {
        const user = users.find(u => u.id === userId);
        return user?.name || '';
      }).filter(Boolean);

      const existingImages = task.images.map((img, index) => {
        const url = typeof img === 'string' ? img : img.url;
        const description = imageDescriptions[index]?.trim();
        if (description && description.length > 0) {
          return { url, description };
        }
        return url;
      });

      const existingFiles = (task.files || []).map((file, index) => {
        const url = typeof file === 'string' ? file : file.url;
        const name = typeof file === 'string' ? 'Document' : file.name;
        const description = fileDescriptions[index]?.trim();
        if (description && description.length > 0) {
          return { url, name, description };
        }
        return { url, name };
      });

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

    if (newStatus === 'Complete' && !task.collaborative) {
      const currentActualKpi = task.actualKpi;
      const currentExpectedKpi = task.expectedKpi;
      
      if (currentExpectedKpi !== undefined && currentExpectedKpi !== null) {
        if (currentActualKpi === undefined || currentActualKpi === null) {
          toast({
            title: 'Cannot complete task',
            description: 'Please fill in the Actual KPI before completing the task',
            variant: 'destructive',
          });
          return;
        }
        
        if (currentActualKpi !== currentExpectedKpi) {
          toast({
            title: 'Cannot complete task',
            description: 'Expected KPI has not been met',
            variant: 'destructive',
          });
          return;
        }
      }
    }

    try {
      await updateTaskStatus(task.id, newStatus, {
        changedBy: user?.id,
        changedByName: user?.name,
      });
      setFormData(prev => ({ ...prev, status: newStatus }));
      
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

  const getStatusBadgeColor = (status: TaskStatus) => {
    switch (status) {
      case 'New':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20';
      case 'Progress':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20';
      case 'Complete':
        return 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20';
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20';
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

      const timestamp = Date.now();
      const newTaskId = `${task.taskId}-COPY-${timestamp}`;

      const assignedMemberNames = task.assignedMemberNames || task.assignedMembers.map(userId => {
        const user = users.find(u => u.id === userId);
        return user?.name || '';
      }).filter(Boolean);

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
        date: new Date(),
        assignedMembers: task.assignedMembers,
        assignedMemberNames,
        images: task.images,
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

  const completedSubtasks = task.subtasks?.filter(s => s.completed).length || 0;
  const totalSubtasks = task.subtasks?.length || 0;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:w-[600px] lg:w-[700px] overflow-hidden p-0">
          <SheetHeader>
            <SheetTitle className="sr-only">
              {task ? `Task Details: ${task.name}` : 'Task Details'}
            </SheetTitle>
          </SheetHeader>
          {task ? (
            <ScrollArea className="h-full">
              <div className="p-6 space-y-6 pb-20">
              {/* Header with breadcrumb and actions */}
              <div className="flex items-center justify-between border-b pb-4 mb-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Tasks</span>
                  <span>/</span>
                  <span className="text-foreground font-medium">{task.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && !isEditing && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleClone}
                        disabled={isCloning}
                        className="h-9 w-9"
                        title="Clone task"
                      >
                        {isCloning ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        title="Share task"
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        title="More options"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {isAdmin && (
                    <Button
                      variant={isEditing ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => {
                        if (isEditing) {
                          setIsEditing(false);
                        } else {
                          setIsEditing(true);
                        }
                      }}
                      className="h-9"
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
              </div>

              {/* Task Title */}
              <div className="mb-6">
                {isEditing ? (
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter task name"
                    className="text-2xl font-bold border-0 p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                ) : (
                  <h1 className="text-2xl font-bold leading-tight">{task.name}</h1>
                )}
              </div>

              {/* Status, Due Date, Assignees */}
              <div className="space-y-4 mb-6">
                {/* Status */}
                <div className="flex items-center gap-3">
                  <div className={cn("w-3 h-3 rounded-full flex-shrink-0", getStatusColor(task.status))} />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Status</span>
                    {isEditing ? (
                      <Select
                        value={task.status}
                        onValueChange={(value) => handleStatusChange(value as TaskStatus)}
                      >
                        <SelectTrigger className="w-32 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="New">New</SelectItem>
                          <SelectItem value="Progress">Progress</SelectItem>
                          <SelectItem value="Complete">Complete</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge className={cn("border", getStatusBadgeColor(task.status))}>
                        {task.status}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Due Date */}
                <div className="flex items-center gap-3">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Due date</span>
                    {isEditing ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "h-8 justify-start text-left font-normal",
                              !formData.date && "text-muted-foreground"
                            )}
                          >
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
                      <span className="text-sm font-medium">{format(task.date, 'PPP')}</span>
                    )}
                  </div>
                </div>

                {/* Assignees */}
                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <span className="text-sm text-muted-foreground block">Assignee</span>
                    {isEditing ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            role="combobox"
                            className={cn(
                              "h-8 justify-between w-full",
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
                          <div className="p-3 border-b">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                placeholder="Search members..."
                                value={memberSearchQuery}
                                onChange={(e) => setMemberSearchQuery(e.target.value)}
                                className="pl-10"
                              />
                            </div>
                          </div>
                          <div className="max-h-64 overflow-y-auto p-2">
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
                                      className="text-sm font-medium leading-none cursor-pointer flex-1"
                                    >
                                      {user.name}
                                    </label>
                                  </div>
                                ))}
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
                                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                    {getInitials(name)}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                            </div>
                            <span className="text-sm font-medium">
                              {task.assignedMemberNames.join(', ')}
                            </span>
                            {isAdmin && (
                              <Button variant="ghost" size="sm" className="h-8 text-xs">
                                Invite
                              </Button>
                            )}
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">No members assigned</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2 mb-6">
                <Label className="text-sm font-semibold">Description</Label>
                {isEditing ? (
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter task description"
                    rows={4}
                    className="resize-none"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {task.description || 'No description'}
                  </p>
                )}
              </div>

              {/* Attachments */}
              {(task.images.length > 0 || (task.files && task.files.length > 0)) && (
                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">
                      Attachment ({task.images.length + (task.files?.length || 0)})
                    </Label>
                    {(task.images.length > 0 || (task.files && task.files.length > 0)) && (
                      <Button variant="ghost" size="sm" className="h-8 text-xs">
                        <Download className="h-3 w-3 mr-1" />
                        Download All
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {task.files && task.files.map((file, index) => {
                      const fileUrl = typeof file === 'string' ? file : file.url;
                      const fileName = typeof file === 'string' ? 'Document' : file.name;
                      return (
                        <div key={index} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                          <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium hover:underline block truncate"
                            >
                              {fileName}
                            </a>
                            <p className="text-xs text-muted-foreground">{(file as any).size || 'N/A'}</p>
                          </div>
                          <Button variant="ghost" size="sm" className="h-8 text-xs flex-shrink-0">
                            Download
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  {isEditing && (
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('task-files-input')?.click()}
                        className="h-8"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add File
                      </Button>
                      <input
                        id="task-files-input"
                        type="file"
                        accept="application/pdf"
                        multiple
                        onChange={handleDocumentFileSelect}
                        className="hidden"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Tabs for Subtasks, Comments, Activities */}
              <Tabs defaultValue="subtasks" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="subtasks" className="text-xs">
                    Subtasks
                  </TabsTrigger>
                  <TabsTrigger value="comments" className="text-xs">
                    Comments {task.subtasks && task.subtasks.length > 0 ? `(${task.subtasks.length})` : ''}
                  </TabsTrigger>
                  <TabsTrigger value="activities" className="text-xs">
                    Activities
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="subtasks" className="space-y-4 mt-4">
                  {totalSubtasks > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{completedSubtasks}/{totalSubtasks}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${(completedSubtasks / totalSubtasks) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                  
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
                        className="h-9"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addSubtask}
                        size="sm"
                        className="h-9"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {task.subtasks && task.subtasks.length > 0 && (
                    <div className="space-y-3">
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
                                {subtask.completed && (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                                      <X className="h-3 w-3" />
                                      Blocker: {subtask.description}
                                    </span>
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
                </TabsContent>

                <TabsContent value="comments" className="mt-4">
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Comments feature coming soon</p>
                  </div>
                </TabsContent>

                <TabsContent value="activities" className="mt-4">
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Activity log coming soon</p>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Save Button */}
              {isEditing && (
                <div className="flex justify-end gap-2 pt-4 border-t sticky bottom-0 bg-background">
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
                      if (task) {
                        const imgDesc: { [key: number]: string } = {};
                        task.images.forEach((img, index) => {
                          if (typeof img === 'object' && img.description) {
                            imgDesc[index] = img.description;
                          }
                        });
                        setImageDescriptions(imgDesc);
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
                    size="sm"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Task
                  </Button>
                </div>
              )}
              </div>
            </ScrollArea>
          ) : null}
        </SheetContent>
      </Sheet>

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
    </>
  );
}

