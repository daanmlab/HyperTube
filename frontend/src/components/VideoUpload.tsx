import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AlertCircle, CheckCircle, FileVideo, Upload } from 'lucide-react';
import React, { useState } from 'react';

interface UploadStatus {
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
  message?: string;
  videoId?: string;
}

interface VideoUploadProps {
  onVideoUploaded?: (videoId: string) => void;
}

export const VideoUpload: React.FC<VideoUploadProps> = ({
  onVideoUploaded,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    status: 'idle',
  });
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = (file: File) => {
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
      setUploadStatus({ status: 'idle' });
    } else {
      setUploadStatus({
        status: 'error',
        message: 'Please select a valid video file',
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      setUploadStatus({ status: 'uploading', message: 'Uploading video...' });

      const response = await apiClient.post('/videos/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const { filename } = response.data;
      setUploadStatus({
        status: 'processing',
        message: 'Video uploaded! Processing and transposing...',
        videoId: filename,
      });

      // Poll for processing completion
      const pollInterval = setInterval(async () => {
        try {
          const checkResponse = await apiClient.get(
            `/videos/${filename}/hls.m3u8`
          );
          if (checkResponse.status === 200) {
            clearInterval(pollInterval);
            setUploadStatus({
              status: 'completed',
              message: 'Video processed successfully!',
              videoId: filename,
            });
            onVideoUploaded?.(filename);
          }
        } catch (error) {
          // Still processing, continue polling
        }
      }, 3000);

      // Stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (uploadStatus.status === 'processing') {
          setUploadStatus({
            status: 'error',
            message: 'Processing timeout. Please try again.',
          });
        }
      }, 300000);
    } catch (error: any) {
      setUploadStatus({
        status: 'error',
        message: error.response?.data?.message || 'Upload failed',
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = () => {
    switch (uploadStatus.status) {
      case 'uploading':
      case 'processing':
        return (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
        );
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Video Upload & Transpose
        </CardTitle>
        <CardDescription>
          Upload a video to test the transposition and streaming functionality
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragOver
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {selectedFile ? (
            <div className="space-y-2">
              <FileVideo className="h-8 w-8 mx-auto text-primary" />
              <p className="font-medium">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
          ) : (
            <>
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-2">
                Drop a video file here or click to browse
              </p>
              <input
                type="file"
                accept="video/*"
                onChange={e =>
                  e.target.files?.[0] && handleFileSelect(e.target.files[0])
                }
                className="hidden"
                id="video-upload"
              />
              <label htmlFor="video-upload">
                <Button variant="outline" className="cursor-pointer" asChild>
                  <span>Choose Video File</span>
                </Button>
              </label>
            </>
          )}
        </div>

        {uploadStatus.status !== 'idle' && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
            {getStatusIcon()}
            <span className="text-sm">{uploadStatus.message}</span>
          </div>
        )}

        {selectedFile && uploadStatus.status === 'idle' && (
          <Button onClick={handleUpload} className="w-full">
            Upload & Process Video
          </Button>
        )}

        {uploadStatus.status === 'completed' && uploadStatus.videoId && (
          <div className="text-center text-sm text-muted-foreground">
            Video ID:{' '}
            <code className="bg-muted px-1 rounded">
              {uploadStatus.videoId}
            </code>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
