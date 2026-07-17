"use client";

import * as React from "react";
import Image from "@/components/ui/cloudflare-image";
import { Upload, X, Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { uploadFile } from "@/lib/api";
import type { UploadCategory } from "@/lib/uploads";

interface MultiImageUploadProps {
  value: string[];
  onChange: (value: string[]) => void;
  mainPhotoUrl?: string;
  onSetMain?: (url: string) => void;
  category: UploadCategory;
}

export function MultiImageUpload({
  value,
  onChange,
  mainPhotoUrl,
  onSetMain,
  category,
}: MultiImageUploadProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);

  const handleFiles = async (files: FileList) => {
    setIsUploading(true);
    const uploadPromises: Promise<string>[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file && file.type.startsWith("image/")) {
        uploadPromises.push(uploadFile(file, category));
      } else {
        toast.error("Invalid file type", {
          description: `File "${file.name}" is not an image.`,
        });
      }
    }

    try {
      const newImageUrls = await Promise.all(uploadPromises);
      onChange([...value, ...newImageUrls]);
    } catch (error) {
      toast.error("Some uploads failed", {
        description: (error as Error).message,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleRemove = (urlToRemove: string) => {
    const newValue = value.filter((url) => url !== urlToRemove);
    onChange(newValue);
    if (mainPhotoUrl === urlToRemove) {
      onSetMain?.(newValue[0] || "");
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "relative w-full border-2 border-dashed rounded-lg p-4 flex items-center justify-center bg-muted/50 cursor-pointer transition-colors min-h-[120px]",
          isDragging && "border-primary bg-primary/10"
        )}
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          multiple
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          disabled={isUploading}
        />
        <div className="text-center text-muted-foreground">
          {isUploading ? (
            <>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="text-sm mt-2">Uploading...</p>
            </>
          ) : (
            <>
              <Upload className="mx-auto h-8 w-8" />
              <p className="text-sm mt-2">
                Drag & drop images here, or click to select files
              </p>
            </>
          )}
        </div>
      </div>
      {value.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {value.map((url) => (
            <div key={url} className="relative aspect-square group">
              <Image
                src={url}
                alt="Upload preview"
                fill
                className="object-cover rounded-lg"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                {onSetMain && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetMain(url);
                    }}
                  >
                    <Star
                      className={cn(
                        "h-4 w-4",
                        mainPhotoUrl === url && "fill-yellow-400 text-yellow-500"
                      )}
                    />
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(url);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
