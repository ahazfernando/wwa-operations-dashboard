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
import { ScrollArea } from '@/components/ui/scroll-area';
import { createTask } from '@/lib/tasks';
import { uploadImageToCloudinary } from '@/lib/cloudinary';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Loader2, X, Image as ImageIcon, ChevronDown } from 'lucide-react';
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
  });

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate file types
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

    setSelectedFiles(prev => [...prev, ...files]);
    
    // Create previews
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
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

      // Upload images to Cloudinary
      const uploadedImages: string[] = [];
      for (const file of selectedFiles) {
        try {
          const result = await uploadImageToCloudinary(file);
          uploadedImages.push(result.url);
        } catch (error: any) {
          console.error('Error uploading image:', error);
          toast({
            title: 'Image upload failed',
            description: `Failed to upload ${file.name}. Continuing with other images...`,
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
        createdBy: user?.id || '',
        createdByName: user?.name || '',
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
      });
      setSelectedFiles([]);
      setImagePreviews([]);
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
            {formData.assignedMembers.length === 0 && (
              <p className="text-xs text-muted-foreground">Select at least one member</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="images">Images</Label>
            <div className="flex items-center gap-2">
              <Input
                id="images"
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                disabled={uploadingImages}
              />
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
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
                  {uploadingImages ? 'Uploading images...' : 'Creating...'}
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

