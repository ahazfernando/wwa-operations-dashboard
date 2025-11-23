"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, X, FileText, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

interface DragDropFileUploadProps {
  label: string;
  accept?: string;
  maxSize?: number; // in MB
  fileTypes?: string; // Display text for file types
  value?: File | null;
  preview?: string | null;
  onChange: (file: File | null) => void;
  onRemove?: () => void;
  disabled?: boolean;
  className?: string;
}

export function DragDropFileUpload({
  label,
  accept = "image/*,application/pdf,.doc,.docx,.xlsx,.txt",
  maxSize = 50,
  fileTypes = "PDF, DOCX, JPEG, XLSX, TXT",
  value,
  preview,
  onChange,
  onRemove,
  disabled = false,
  className,
}: DragDropFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [imageError, setImageError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Reset image error when preview changes
  useEffect(() => {
    setImageError(false);
  }, [preview]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    // Reset image error when selecting a new file
    setImageError(false);
    
    // Validate file size
    const maxSizeBytes = maxSize * 1024 * 1024; // Convert MB to bytes
    if (file.size > maxSizeBytes) {
      toast({
        variant: 'destructive',
        title: 'File too large',
        description: `File size exceeds the maximum limit of ${maxSize}MB. Please choose a smaller file.`,
      });
      return;
    }

    onChange(file);
  }, [maxSize, toast, onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [disabled, handleFileSelect]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
    // Reset input value to allow selecting the same file again
    // This is done after a small delay to ensure the change event is processed
    setTimeout(() => {
      if (e.target) {
        e.target.value = '';
      }
    }, 0);
  }, [handleFileSelect]);

  const handleClick = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!disabled && fileInputRef.current) {
      // Reset the input value to allow selecting the same file again
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Clear both file and preview
    onChange(null);
    if (onRemove) {
      onRemove();
    }
  };

  const getFileIcon = () => {
    if (value) {
      const fileType = value.type;
      if (fileType.startsWith('image/')) {
        return <ImageIcon className="h-6 w-6 text-muted-foreground" />;
      }
      return <FileText className="h-6 w-6 text-muted-foreground" />;
    }
    // Check if preview is an image URL
    if (preview && (preview.startsWith('http') || preview.startsWith('https'))) {
      // Try to determine if it's an image based on URL or assume it's an image for saved files
      if (preview.includes('image') || preview.match(/\.(jpg|jpeg|png|gif|webp)/i)) {
        return <ImageIcon className="h-6 w-6 text-muted-foreground" />;
      }
      return <FileText className="h-6 w-6 text-muted-foreground" />;
    }
    return <Upload className="h-6 w-6 text-muted-foreground" />;
  };

  // Show preview if there's a file OR if there's a saved preview URL
  const hasFile = value !== null && value !== undefined;
  const hasSavedFile = !hasFile && preview && (preview.startsWith('http') || preview.startsWith('https') || preview.startsWith('blob:'));
  const showPreview = hasFile || hasSavedFile;

  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        {label}
      </label>
      
      {showPreview && preview ? (
        <div className="relative">
          <div className="border-2 border-border rounded-lg p-4 bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {preview.startsWith('data:image') || preview.startsWith('blob:') || preview.startsWith('http') || preview.startsWith('https') ? (
                  <div className="relative">
                    {!imageError ? (
                      <img
                        src={preview}
                        alt="Preview"
                        className="h-16 w-16 object-cover rounded border border-border"
                        onError={() => setImageError(true)}
                      />
                    ) : (
                      <div className="h-16 w-16 flex items-center justify-center bg-background rounded border border-border">
                        {getFileIcon()}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-16 w-16 flex items-center justify-center bg-background rounded border border-border">
                    {getFileIcon()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {value ? (
                    <>
                      <p className="text-sm font-medium truncate">{value.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(value.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium truncate">
                        {preview.includes('contract') ? 'Contract Document' : 
                         preview.includes('id') ? 'ID Document' :
                         preview.includes('passport') ? 'Passport Document' :
                         preview.includes('visa') ? 'Visa Document' :
                         preview.includes('selfie') ? 'Selfie Photo' :
                         'Saved Document'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {hasSavedFile && (
                          <span className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-green-500"></span>
                            Saved
                          </span>
                        )}
                      </p>
                    </>
                  )}
                </div>
              </div>
              {(value || hasSavedFile) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleRemove}
                  disabled={disabled}
                  className="h-8 w-8"
                  title={hasSavedFile ? "Remove saved file" : "Remove file"}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => handleClick(e)}
              disabled={disabled}
            >
              {hasSavedFile ? 'Re-upload' : 'Change File'}
            </Button>
            {hasSavedFile && (preview.startsWith('http') || preview.startsWith('https')) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(preview, '_blank');
                }}
                disabled={disabled}
              >
                View
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={(e) => {
            e.stopPropagation();
            handleClick(e);
          }}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
            isDragging
              ? "border-primary bg-primary/10"
              : "border-muted-foreground/25 hover:border-muted-foreground/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleInputChange}
            disabled={disabled}
            className="hidden"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-full border-2 border-muted-foreground/50 p-3">
              {getFileIcon()}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Choose a file or drag & drop it here</p>
              <p className="text-xs text-muted-foreground">
                {fileTypes} - Up to {maxSize}MB
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleClick();
              }}
              disabled={disabled}
              className="mt-2"
            >
              Browse files
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

