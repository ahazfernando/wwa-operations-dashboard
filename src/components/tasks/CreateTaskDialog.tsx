"use client";

import { useState, useEffect } from 'react';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import Image from 'next/image';

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
    expectedKpi: '',
    actualKpi: '',
    eta: new Date(),
    time: '09:00',
    recurring: false,
    recurringFrequency: [] as string[], // Array of day names or ['all'] for all days
    recurringDateRange: undefined as { from: Date; to?: Date } | undefined,
    collaborative: false,
  });

  const [selectedImageFiles, setSelectedImageFiles] = useState<File[]>([]);
  const [selectedDocumentFiles, setSelectedDocumentFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  // Reset ETA to current date when dialog opens
  useEffect(() => {
    if (open) {
      setFormData(prev => ({ ...prev, eta: new Date(), recurringDateRange: undefined }));
    } else {
      // Reset file selections when dialog closes
      setSelectedImageFiles([]);
      setSelectedDocumentFiles([]);
      setImagePreviews([]);
    }
  }, [open]);

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
    setSelectedImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const removeDocumentFile = (index: number) => {
    setSelectedDocumentFiles(prev => prev.filter((_, i) => i !== index));
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

      // Upload images to Cloudinary
      const uploadedImages: string[] = [];
      
      for (const file of selectedImageFiles) {
        try {
          const result = await uploadImageToCloudinary(file);
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

      // Upload document files to Cloudinary
      const uploadedFiles: Array<{ url: string; name: string }> = [];
      
      for (const file of selectedDocumentFiles) {
        try {
          const result = await uploadFileToCloudinary(file);
          uploadedFiles.push({ url: result.url, name: file.name });
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

      // Validate recurring frequency if recurring is enabled
      if (formData.recurring && formData.recurringFrequency.length === 0) {
        toast({
          title: 'Validation error',
          description: 'Please select recurring frequency (All Days or specific days)',
          variant: 'destructive',
        });
        setLoading(false);
        setUploadingImages(false);
        return;
      }

      // Validate recurring date range if recurring is enabled
      if (formData.recurring && (!formData.recurringDateRange || !formData.recurringDateRange.from)) {
        toast({
          title: 'Validation error',
          description: 'Please select a date range for the recurring task',
          variant: 'destructive',
        });
        setLoading(false);
        setUploadingImages(false);
        return;
      }

      if (formData.recurring && formData.recurringDateRange && !formData.recurringDateRange.to) {
        toast({
          title: 'Validation error',
          description: 'Please select an end date for the recurring task',
          variant: 'destructive',
        });
        setLoading(false);
        setUploadingImages(false);
        return;
      }

      // Create task
      await createTask({
        taskId: formData.taskId.trim(),
        name: formData.name.trim(),
        description: formData.description.trim(),
        date: formData.date,
        assignedMembers: formData.assignedMembers,
        assignedMemberNames,
        images: uploadedImages,
        files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
        expectedKpi: formData.expectedKpi.trim() || undefined,
        actualKpi: formData.actualKpi.trim() || undefined,
        eta: formData.eta,
        time: formData.time || undefined,
        createdBy: user?.id || '',
        createdByName: user?.name || '',
        recurring: formData.recurring,
        recurringFrequency: formData.recurring ? formData.recurringFrequency : undefined,
        recurringStartDate: formData.recurring && formData.recurringDateRange?.from ? formData.recurringDateRange.from : undefined,
        recurringEndDate: formData.recurring && formData.recurringDateRange?.to ? formData.recurringDateRange.to : undefined,
        collaborative: formData.collaborative,
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
        expectedKpi: '',
        actualKpi: '',
        eta: new Date(),
        time: '09:00',
        recurring: false,
        recurringFrequency: [],
        recurringDateRange: undefined,
        collaborative: false,
      });
      setSelectedImageFiles([]);
      setSelectedDocumentFiles([]);
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
                alt="Task modal background"
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
                <h2 className="text-2xl font-bold">Create New Task</h2>
                <p className="text-sm text-white/80">
                  Create a new task and assign it to team members. Fill in the task details below to get started.
                </p>
              </div>
            </div>
          </div>

          {/* Right side with form content */}
          <div className="relative bg-background rounded-r-lg overflow-y-auto max-h-[90vh]">
            <div className="p-6">
              <DialogHeader>
                <DialogTitle className="text-2xl">Create New Task</DialogTitle>
                <DialogDescription>
                  Create a new task and assign it to team members. Fill in the task details below to get started.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-6">
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

          <div className="space-y-2">
            <Label htmlFor="expectedKpi">Expected KPI</Label>
            <Input
              id="expectedKpi"
              placeholder="e.g., 95% completion rate"
              value={formData.expectedKpi}
              onChange={(e) => setFormData(prev => ({ ...prev, expectedKpi: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
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
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="time"
                  type="text"
                  placeholder="e.g., 09:00 AM"
                  value={formData.time}
                  onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="recurring">Recurring Task</Label>
              <Select
                value={formData.recurring ? 'yes' : 'no'}
                onValueChange={(value) => {
                  const isRecurring = value === 'yes';
                  setFormData(prev => ({ 
                    ...prev, 
                    recurring: isRecurring,
                    recurringFrequency: isRecurring ? prev.recurringFrequency : []
                  }));
                }}
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
            <Label htmlFor="collaborative">Collaborative Task</Label>
            <Select
              value={formData.collaborative ? 'yes' : 'no'}
              onValueChange={(value) => {
                setFormData(prev => ({ 
                  ...prev, 
                  collaborative: value === 'yes'
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
              </SelectContent>
            </Select>
            {formData.collaborative && (
              <p className="text-xs text-muted-foreground">
                All assigned members must complete this task for it to be marked as fully completed
              </p>
            )}
          </div>

          {formData.recurring && (
            <>
              <div className="space-y-2">
                <Label htmlFor="recurringDateRange">Recurring Date Range *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.recurringDateRange?.from && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.recurringDateRange?.from ? (
                        formData.recurringDateRange.to ? (
                          <>
                            {format(formData.recurringDateRange.from, "LLL dd, y")} -{" "}
                            {format(formData.recurringDateRange.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(formData.recurringDateRange.from, "LLL dd, y")
                        )
                      ) : (
                        <span>Select date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      defaultMonth={formData.recurringDateRange?.from}
                      selected={formData.recurringDateRange}
                      onSelect={(range) => setFormData(prev => ({ ...prev, recurringDateRange: range }))}
                      numberOfMonths={2}
                      initialFocus
                    />
                    {formData.recurringDateRange && (
                      <div className="p-3 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => setFormData(prev => ({ ...prev, recurringDateRange: undefined }))}
                        >
                          Clear date range
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  Select when the recurring task should start and end
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recurringFrequency">Recurring Frequency *</Label>
                <Select
                  value={formData.recurringFrequency.includes('all') ? 'all' : formData.recurringFrequency.length > 0 ? 'custom' : 'custom'}
                  onValueChange={(value) => {
                    if (value === 'all') {
                      setFormData(prev => ({ ...prev, recurringFrequency: ['all'] }));
                    } else {
                      // When "Select Days" is chosen, keep existing selections or start with empty array
                      setFormData(prev => ({ 
                        ...prev, 
                        recurringFrequency: prev.recurringFrequency.includes('all') ? [] : prev.recurringFrequency
                      }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Days</SelectItem>
                    <SelectItem value="custom">Select Days</SelectItem>
                  </SelectContent>
                </Select>
                {!formData.recurringFrequency.includes('all') && (
                  <div className="space-y-2 mt-2">
                    <Label className="text-sm text-muted-foreground">Select specific days:</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                        <div key={day} className="flex items-center space-x-2">
                          <Checkbox
                            id={`day-${day}`}
                            checked={formData.recurringFrequency.includes(day)}
                            onCheckedChange={(checked) => {
                              setFormData(prev => ({
                                ...prev,
                                recurringFrequency: checked
                                  ? [...prev.recurringFrequency, day]
                                  : prev.recurringFrequency.filter(d => d !== day)
                              }));
                            }}
                          />
                          <label
                            htmlFor={`day-${day}`}
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            {day}
                          </label>
                        </div>
                      ))}
                    </div>
                    {formData.recurringFrequency.length === 0 && (
                      <p className="text-xs text-muted-foreground">Please select at least one day or choose 'All Days'</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

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
                  onClick={() => document.getElementById('images-input')?.click()}
                >
                  <input
                    id="images-input"
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
                        document.getElementById('images-input')?.click();
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
              </TabsContent>
              
              <TabsContent value="files" className="space-y-4">
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
                  onClick={() => document.getElementById('files-input')?.click()}
                >
                  <input
                    id="files-input"
                    type="file"
                    accept="application/pdf"
                    multiple
                    onChange={handleDocumentFileSelect}
                    disabled={uploadingImages}
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
                        document.getElementById('files-input')?.click();
                      }}
                      disabled={uploadingImages}
                    >
                      Browse files
                    </Button>
                  </div>
                </div>
                {selectedDocumentFiles.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {selectedDocumentFiles.map((file, index) => (
                      <div key={index} className="relative group p-4 border rounded-lg bg-muted/50">
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
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
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
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

