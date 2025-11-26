"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { Plus, Calendar, Trash2, Edit, Bell, CheckCircle2, Circle, AlertCircle, Image as ImageIcon, Upload, X, Loader2, Search, ChevronDown, Users } from 'lucide-react';
import { Reminder } from '@/types/reminder';
import { createReminder, getRemindersByUser, updateReminder, deleteReminder } from '@/lib/reminders';
import { uploadImageToCloudinary } from '@/lib/cloudinary';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface User {
  id: string;
  name: string;
  email: string;
}

const Reminders = () => {
  const { user, getAllUsers } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reminderToDelete, setReminderToDelete] = useState<Reminder | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>(new Date());
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [assignedMembers, setAssignedMembers] = useState<string[]>([]);
  const [selectedImageFiles, setSelectedImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (user) {
      loadReminders();
      loadUsers();
    }
  }, [user]);

  const loadUsers = async () => {
    try {
      const allUsers = await getAllUsers();
      // Filter only approved users
      const approvedUsers = allUsers
        .filter((u: any) => u.status === 'approved')
        .map((u: any) => ({
          id: u.id,
          name: u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
          email: u.email,
        }));
      setUsers(approvedUsers);
    } catch (error: any) {
      console.error('Error loading users:', error);
    }
  };

  const loadReminders = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const userReminders = await getRemindersByUser(user.id);
      setReminders(userReminders);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load reminders',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (reminder?: Reminder) => {
    if (reminder) {
      setEditingReminder(reminder);
      setTitle(reminder.title);
      setDescription(reminder.description || '');
      setDueDate(reminder.dueDate);
      setPriority(reminder.priority || 'medium');
      setAssignedMembers(reminder.assignedMembers || []);
      setSelectedImageFiles([]);
      setExistingImages(reminder.images || []);
      setImagePreviews(reminder.images || []);
    } else {
      setEditingReminder(null);
      setTitle('');
      setDescription('');
      setDueDate(new Date());
      setPriority('medium');
      setAssignedMembers([]);
      setSelectedImageFiles([]);
      setExistingImages([]);
      setImagePreviews([]);
    }
    setMemberSearchQuery('');
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingReminder(null);
    setTitle('');
    setDescription('');
    setDueDate(new Date());
    setPriority('medium');
    setAssignedMembers([]);
    setSelectedImageFiles([]);
    setExistingImages([]);
    setImagePreviews([]);
    setMemberSearchQuery('');
  };

  const handleMemberToggle = (userId: string) => {
    setAssignedMembers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
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

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    validateAndAddImages(files);
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

  const removeImage = (index: number) => {
    const existingImageCount = existingImages.length;
    
    if (index < existingImageCount) {
      // Remove existing image
      const updatedExisting = existingImages.filter((_, i) => i !== index);
      setExistingImages(updatedExisting);
      setImagePreviews(prev => {
        const newPreviews = [...prev];
        newPreviews.splice(index, 1);
        return newPreviews;
      });
    } else {
      // Remove new file
      const fileIndex = index - existingImageCount;
      setSelectedImageFiles(prev => prev.filter((_, i) => i !== fileIndex));
      setImagePreviews(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async () => {
    if (!user || !title.trim() || !dueDate) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUploadingImages(true);

      // Upload new images to Cloudinary
      const uploadedImages: string[] = [];
      
      // Keep existing images that weren't removed
      uploadedImages.push(...existingImages);
      
      // Upload new images
      for (const file of selectedImageFiles) {
        try {
          const result = await uploadImageToCloudinary(file, 'reminders');
          uploadedImages.push(result.url);
        } catch (error: any) {
          console.error('Error uploading image:', error);
          toast({
            title: 'Image upload failed',
            description: `Failed to upload ${file.name}. Continuing with other files...`,
            variant: 'destructive',
          });
        }
      }

      setUploadingImages(false);

      // Get assigned member names
      const assignedMemberNames = assignedMembers
        .map(userId => {
          const user = users.find(u => u.id === userId);
          return user?.name || '';
        })
        .filter(Boolean);

      if (editingReminder) {
        await updateReminder(editingReminder.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate,
          priority,
          images: uploadedImages.length > 0 ? uploadedImages : undefined,
          assignedMembers: assignedMembers.length > 0 ? assignedMembers : undefined,
          assignedMemberNames: assignedMemberNames.length > 0 ? assignedMemberNames : undefined,
        });
        toast({
          title: 'Success',
          description: 'Reminder updated successfully',
        });
      } else {
        await createReminder({
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate,
          userId: user.id,
          priority,
          images: uploadedImages.length > 0 ? uploadedImages : undefined,
          assignedMembers: assignedMembers.length > 0 ? assignedMembers : undefined,
          assignedMemberNames: assignedMemberNames.length > 0 ? assignedMemberNames : undefined,
        });
        toast({
          title: 'Success',
          description: 'Reminder created successfully',
        });
      }
      handleCloseDialog();
      loadReminders();
    } catch (error: any) {
      setUploadingImages(false);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save reminder',
        variant: 'destructive',
      });
    }
  };

  const handleToggleComplete = async (reminder: Reminder) => {
    if (!user) return;
    
    try {
      await updateReminder(reminder.id, {
        completed: !reminder.completed,
      });
      toast({
        title: 'Success',
        description: reminder.completed ? 'Reminder marked as incomplete' : 'Reminder marked as complete',
      });
      loadReminders();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update reminder',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteClick = (reminder: Reminder) => {
    setReminderToDelete(reminder);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!reminderToDelete) return;
    
    try {
      await deleteReminder(reminderToDelete.id);
      toast({
        title: 'Success',
        description: 'Reminder deleted successfully',
      });
      setDeleteDialogOpen(false);
      setReminderToDelete(null);
      loadReminders();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete reminder',
        variant: 'destructive',
      });
    }
  };

  const getDueDateLabel = (date: Date) => {
    if (isPast(date) && !isToday(date)) {
      return 'Overdue';
    }
    if (isToday(date)) {
      return 'Today';
    }
    if (isTomorrow(date)) {
      return 'Tomorrow';
    }
    return format(date, 'MMM dd, yyyy');
  };

  const getPriorityColor = (priority: 'low' | 'medium' | 'high') => {
    switch (priority) {
      case 'high':
        return 'bg-red-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getPriorityLabel = (priority: 'low' | 'medium' | 'high') => {
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  };

  // Filter reminders
  const { upcomingReminders, completedReminders, overdueReminders } = useMemo(() => {
    const now = new Date();
    const upcoming: Reminder[] = [];
    const completed: Reminder[] = [];
    const overdue: Reminder[] = [];

    reminders.forEach(reminder => {
      if (reminder.completed) {
        completed.push(reminder);
      } else if (isPast(reminder.dueDate) && !isToday(reminder.dueDate)) {
        overdue.push(reminder);
      } else {
        upcoming.push(reminder);
      }
    });

    return {
      upcomingReminders: upcoming.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()),
      completedReminders: completed.sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0)),
      overdueReminders: overdue.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()),
    };
  }, [reminders]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-5 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reminders</h1>
          <p className="text-muted-foreground mt-1">
            Manage your personal reminders and tasks
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              New Reminder
            </Button>
          </DialogTrigger>
          <DialogContent 
            className="max-w-5xl max-h-[90vh] overflow-hidden p-0 !grid-cols-1 gap-0 !bg-transparent"
            style={{ backgroundColor: 'transparent' }}
          >
            <div className="grid md:grid-cols-2 grid-cols-1 w-full border rounded-lg overflow-hidden">
              {/* Left side with background image and logo */}
              <div className="relative hidden md:block overflow-hidden min-h-[600px] flex flex-col">
                <div className="absolute inset-0 z-0">
                  <Image
                    src="/modalimages/eed0e449f25f0b6ea226cd6039f6a135.jpg"
                    alt="Reminder modal background"
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
                <div className="relative z-10 h-full flex flex-col justify-between p-8">
                  {/* Logo at top left */}
                  <div>
                    <Image
                      src="/logos/WWA - White (1).png"
                      alt="We Will Australia Logo"
                      width={120}
                      height={120}
                      className="object-contain"
                      priority
                    />
                  </div>
                  {/* Title and content at bottom */}
                  <div className="text-white space-y-2">
                    <h2 className="text-2xl font-bold">
                      {editingReminder ? 'Edit Reminder' : 'Create New Reminder'}
                    </h2>
                    <p className="text-sm text-white/80">
                      {editingReminder ? 'Update your reminder details' : 'Add a new reminder to keep track of important tasks'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right side with form content */}
              <div className="relative bg-background rounded-r-lg overflow-y-auto max-h-[90vh]">
                <div className="p-6">
                  <DialogHeader>
                    <DialogTitle className="text-2xl">
                      {editingReminder ? 'Edit Reminder' : 'Create New Reminder'}
                    </DialogTitle>
                    <DialogDescription>
                      {editingReminder ? 'Update your reminder details' : 'Add a new reminder to keep track of important tasks'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="Enter reminder title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Enter reminder description (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dueDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarPicker
                      mode="single"
                      selected={dueDate}
                      onSelect={setDueDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={(value: 'low' | 'medium' | 'high') => setPriority(value)}>
                  <SelectTrigger id="priority">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assign Members</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between",
                        assignedMembers.length === 0 && "text-muted-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {assignedMembers.length === 0
                          ? "Select members to assign"
                          : assignedMembers.length === 1
                          ? users.find(u => u.id === assignedMembers[0])?.name || "1 member selected"
                          : `${assignedMembers.length} members selected`}
                      </div>
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
                      onWheel={(e) => e.stopPropagation()}
                    >
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
                              checked={assignedMembers.includes(user.id)}
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
                  </PopoverContent>
                </Popover>
                {assignedMembers.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {assignedMembers.length} member{assignedMembers.length !== 1 ? 's' : ''} will be notified
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Images</Label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
                    isDragging
                      ? "border-primary bg-primary/10"
                      : "border-muted-foreground/25 hover:border-muted-foreground/50"
                  )}
                  onClick={() => document.getElementById('reminder-images-input')?.click()}
                >
                  <input
                    id="reminder-images-input"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageFileSelect}
                    disabled={uploadingImages}
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
                        document.getElementById('reminder-images-input')?.click();
                      }}
                      disabled={uploadingImages}
                    >
                      Browse images
                    </Button>
                  </div>
                </div>
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
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={handleCloseDialog} disabled={uploadingImages}>
                      Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={uploadingImages}>
                      {uploadingImages ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        editingReminder ? 'Update' : 'Create'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Overdue Reminders */}
      {overdueReminders.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <h2 className="text-xl font-semibold">Overdue</h2>
            <Badge variant="destructive">{overdueReminders.length}</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {overdueReminders.map((reminder) => (
              <Card key={reminder.id} className="border-red-200 dark:border-red-800">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Bell className="h-4 w-4 text-red-500" />
                        {reminder.title}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {getDueDateLabel(reminder.dueDate)}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getPriorityColor(reminder.priority || 'medium')}>
                        {getPriorityLabel(reminder.priority || 'medium')}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {reminder.description && (
                    <p className="text-sm text-muted-foreground mb-4">
                      {reminder.description}
                    </p>
                  )}
                  {reminder.images && reminder.images.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {reminder.images.map((imageUrl, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={imageUrl}
                            alt={`Reminder image ${index + 1}`}
                            className="w-full h-24 object-cover rounded"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {reminder.assignedMembers && reminder.assignedMembers.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <Users className="h-4 w-4" />
                        <span>Assigned to:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {reminder.assignedMemberNames && reminder.assignedMemberNames.length > 0 ? (
                          reminder.assignedMemberNames.map((name, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {name}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            {reminder.assignedMembers.length} member{reminder.assignedMembers.length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleComplete(reminder)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Mark Complete
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(reminder)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(reminder)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Reminders */}
      {upcomingReminders.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            <h2 className="text-xl font-semibold">Upcoming</h2>
            <Badge>{upcomingReminders.length}</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingReminders.map((reminder) => (
              <Card key={reminder.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Bell className="h-4 w-4" />
                        {reminder.title}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {getDueDateLabel(reminder.dueDate)}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getPriorityColor(reminder.priority || 'medium')}>
                        {getPriorityLabel(reminder.priority || 'medium')}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {reminder.description && (
                    <p className="text-sm text-muted-foreground mb-4">
                      {reminder.description}
                    </p>
                  )}
                  {reminder.images && reminder.images.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {reminder.images.map((imageUrl, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={imageUrl}
                            alt={`Reminder image ${index + 1}`}
                            className="w-full h-24 object-cover rounded"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {reminder.assignedMembers && reminder.assignedMembers.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <Users className="h-4 w-4" />
                        <span>Assigned to:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {reminder.assignedMemberNames && reminder.assignedMemberNames.length > 0 ? (
                          reminder.assignedMemberNames.map((name, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {name}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            {reminder.assignedMembers.length} member{reminder.assignedMembers.length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleComplete(reminder)}
                    >
                      <Circle className="h-4 w-4 mr-2" />
                      Mark Complete
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(reminder)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(reminder)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Completed Reminders */}
      {completedReminders.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <h2 className="text-xl font-semibold">Completed</h2>
            <Badge variant="secondary">{completedReminders.length}</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedReminders.map((reminder) => (
              <Card key={reminder.id} className="opacity-60">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2 line-through">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        {reminder.title}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Completed {reminder.completedAt ? format(reminder.completedAt, 'MMM dd, yyyy') : ''}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {reminder.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-through">
                      {reminder.description}
                    </p>
                  )}
                  {reminder.images && reminder.images.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mb-4 opacity-60">
                      {reminder.images.map((imageUrl, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={imageUrl}
                            alt={`Reminder image ${index + 1}`}
                            className="w-full h-24 object-cover rounded"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleComplete(reminder)}
                    >
                      <Circle className="h-4 w-4 mr-2" />
                      Mark Incomplete
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(reminder)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(reminder)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {reminders.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No reminders yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first reminder to get started
            </p>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Create Reminder
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Reminder</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{reminderToDelete?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Reminders;

