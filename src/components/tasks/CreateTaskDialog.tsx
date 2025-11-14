"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { createTask } from '@/lib/tasks';
import { uploadImageToCloudinary, uploadFileToCloudinary } from '@/lib/cloudinary';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Loader2, X, Image as ImageIcon, FileText, ChevronDown, Upload, Clock, Repeat, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  name: string;
  email: string;
}

interface CreateTaskDialogProps {
  users: User[];
  onTaskCreated?: () => void;
}

export function CreateTaskDialog({ users, onTaskCreated }: CreateTaskDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  
  const [formData, setFormData] = useState({
    taskId: '',
    name: '',
    description: '',
    date: new Date(),
    assignedMembers: [] as string[],
    images: [] as string[],
    kpi: '',
    eta: undefined as Date | undefined,
    time: '09:00',
    recurring: false,
  });

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  const validateAndAddFiles = (files: File[]) => {
    if (files.length === 0) return;

    // Validate file types - allow images and PDFs
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const validPdfTypes = ['application/pdf'];
    const validTypes = [...validImageTypes, ...validPdfTypes];
    const invalidFiles = files.filter(file => !validTypes.includes(file.type));
    
    if (invalidFiles.length > 0) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload only image files (JPEG, PNG, GIF, WebP) or PDF documents',
        variant: 'destructive',
      });
      return;
    }

    // Validate file sizes (max 5MB per file)
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
    
    // Create previews for image files only
    files.forEach(file => {
      // Only create image previews for image files
      if (validImageTypes.includes(file.type)) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreviews(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      } else {
        // For PDFs, add empty string to maintain index alignment
        setImagePreviews(prev => [...prev, '']);
      }
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
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleMemberToggle = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      assignedMembers: prev.assignedMembers.includes(userId)
        ? prev.assignedMembers.filter(id => id !== userId)
        : [...prev.assignedMembers, userId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.taskId.trim() || !formData.name.trim()) {
      toast({
        title: 'Validation error',
        description: 'Task ID and Name are required',
        variant: 'destructive',
      });
      return;
    }

    if (formData.assignedMembers.length === 0) {
      toast({
        title: 'Validation error',
        description: 'Please assign at least one member',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      setUploadingImages(true);

      // Upload files to Cloudinary (images and PDFs)
      const uploadedImages: string[] = [];
      const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      
      for (const file of selectedFiles) {
        try {
          let result;
          // Use appropriate upload function based on file type
          if (validImageTypes.includes(file.type)) {
            result = await uploadImageToCloudinary(file);
          } else {
            // PDFs and other documents
            result = await uploadFileToCloudinary(file);
          }
          uploadedImages.push(result.url);
        } catch (error: any) {
          console.error('Error uploading file:', error);
          toast({
            title: 'File upload failed',
            description: `Failed to upload ${file.name}. Continuing with other files...`,
            variant: 'destructive',
          });
        }
      }

      setUploadingImages(false);

      // Get assigned member names
      const assignedMemberNames = formData.assignedMembers.map(userId => {
        const user = users.find(u => u.id === userId);
        return user?.name || '';
      }).filter(Boolean);

      // Create task
      await createTask({
        taskId: formData.taskId.trim(),
        name: formData.name.trim(),
        description: formData.description.trim(),
        date: formData.date,
        assignedMembers: formData.assignedMembers,
        assignedMemberNames,
        images: uploadedImages,
        kpi: formData.kpi.trim() || undefined,
        eta: formData.eta,
        time: formData.time || undefined,
        createdBy: user?.id || '',
        createdByName: user?.name || '',
        recurring: formData.recurring,
      });

      toast({
        title: 'Task created',
        description: 'Task has been created successfully',
      });

      // Reset form
      setFormData({
        taskId: '',
        name: '',
        description: '',
        date: new Date(),
        assignedMembers: [],
        images: [],
        kpi: '',
        eta: undefined,
        time: '09:00',
        recurring: false,
      });
      setSelectedFiles([]);
      setImagePreviews([]);
      setMemberSearchQuery('');
      setOpen(false);
      onTaskCreated?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create task',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setUploadingImages(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Task
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Create a new task and assign it to team members
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="taskId">Task ID *</Label>
              <Input
                id="taskId"
                placeholder="e.g., TASK-001"
                value={formData.taskId}
                onChange={(e) => setFormData(prev => ({ ...prev, taskId: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
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
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Task Name *</Label>
            <Input
              id="name"
              placeholder="Enter task name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Enter task description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="kpi">KPI</Label>
              <Input
                id="kpi"
                placeholder="e.g., 95% completion rate"
                value={formData.kpi}
                onChange={(e) => setFormData(prev => ({ ...prev, kpi: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eta">ETA</Label>
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
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                type="time"
                value={formData.time}
                onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recurring">Recurring Task</Label>
              <Select
                value={formData.recurring ? 'yes' : 'no'}
                onValueChange={(value) => setFormData(prev => ({ ...prev, recurring: value === 'yes' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                </SelectContent>
              </Select>
              {formData.recurring && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Repeat className="h-3 w-3" />
                  This task will automatically recreate when completed
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assign Members *</Label>
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
            {formData.assignedMembers.length === 0 && (
              <p className="text-xs text-muted-foreground">Select at least one member</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Files</Label>
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
              onClick={() => document.getElementById('files-input')?.click()}
            >
              <input
                id="files-input"
                type="file"
                accept="image/*,application/pdf"
                multiple
                onChange={handleFileSelect}
                disabled={uploadingImages}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-full border-2 border-muted-foreground/50 p-3">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Drag & drop files here</p>
                  <p className="text-xs text-muted-foreground">
                    Or click to browse (max 2 files, up to 5MB each) - Images or PDFs
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    document.getElementById('files-input')?.click();
                  }}
                  disabled={uploadingImages}
                >
                  Browse files
                </Button>
              </div>
            </div>
            {selectedFiles.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                {selectedFiles.map((file, index) => {
                  const isImage = file.type.startsWith('image/');
                  const isPdf = file.type === 'application/pdf';
                  
                  return (
                    <div key={index} className="relative group">
                      {isImage && imagePreviews[index] ? (
                        <img
                          src={imagePreviews[index]}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-20 object-cover rounded"
                        />
                      ) : isPdf ? (
                        <div className="w-full h-20 bg-muted rounded flex flex-col items-center justify-center gap-1">
                          <FileText className="h-8 w-8 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground truncate px-1 max-w-full">
                            {file.name}
                          </span>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || uploadingImages}>
              {loading || uploadingImages ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {uploadingImages ? 'Uploading files...' : 'Creating...'}
                </>
              ) : (
                'Create Task'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

