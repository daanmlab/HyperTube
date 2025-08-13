import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Play, RefreshCw, Trash2, Video } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { VideoPlayer } from './VideoPlayer';

interface VideoItem {
  id: string;
  filename: string;
  status: 'processing' | 'ready' | 'error';
  createdAt?: string;
  availableQualities?: string[];
  hasMasterPlaylist?: boolean;
  enhancedStatus?: {
    status: string;
    progress?: number;
    message?: string;
    metadata?: any;
    availableForStreaming?: boolean;
  };
}

interface VideoListProps {
  onVideoSelect?: (videoId: string) => void;
  refreshTrigger?: number;
}

export const VideoList: React.FC<VideoListProps> = ({
  onVideoSelect,
  refreshTrigger,
}) => {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadVideos = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get('/videos');
      const videoData = response.data || [];

      const formattedVideos = videoData.map((video: any) => ({
        id: video.id,
        filename: video.filename,
        status:
          video.status === 'ready'
            ? 'ready'
            : video.status === 'processing'
            ? 'processing'
            : 'error',
        createdAt: video.createdAt,
        availableQualities: video.availableQualities || [],
        hasMasterPlaylist: video.hasMasterPlaylist || false,
        enhancedStatus: video.enhancedStatus || null,
      }));

      setVideos(formattedVideos);
    } catch (error) {
      console.error('Failed to load videos:', error);
      // Fallback to localStorage if API fails
      const uploadedVideos = JSON.parse(
        localStorage.getItem('uploadedVideos') || '[]'
      );
      const fallbackVideos = uploadedVideos.map((videoId: string) => ({
        id: videoId,
        filename: videoId,
        status: 'processing',
        createdAt: new Date().toISOString(),
      }));
      setVideos(fallbackVideos);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVideos();
  }, [refreshTrigger]);

  const handleVideoSelect = (videoId: string) => {
    setSelectedVideo(videoId);
    onVideoSelect?.(videoId);
  };

  const handleDeleteVideo = (videoId: string) => {
    const uploadedVideos = JSON.parse(
      localStorage.getItem('uploadedVideos') || '[]'
    );
    const updatedVideos = uploadedVideos.filter((id: string) => id !== videoId);
    localStorage.setItem('uploadedVideos', JSON.stringify(updatedVideos));
    setVideos(videos.filter(v => v.id !== videoId));
    if (selectedVideo === videoId) {
      setSelectedVideo(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'text-green-600';
      case 'processing':
        return 'text-yellow-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-muted-foreground';
    }
  };

  const getStatusText = (status: string, video: VideoItem) => {
    switch (status) {
      case 'ready':
        if (video.enhancedStatus?.availableForStreaming) {
          const qualities = video.availableQualities || [];
          if (qualities.length > 0) {
            return `Ready (${qualities.join(', ')})`;
          }
        }
        return 'Ready to stream';
      case 'processing':
        if (video.enhancedStatus?.availableForStreaming) {
          return 'Streaming available - processing more qualities...';
        }
        return 'Processing...';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Video Library
              </CardTitle>
              <CardDescription>
                Your uploaded and processed videos
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadVideos}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {videos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No videos uploaded yet</p>
              <p className="text-sm">Upload a video above to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {videos.map(video => (
                <div
                  key={video.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-8 bg-muted rounded flex items-center justify-center">
                      <Video className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{video.filename}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={getStatusColor(video.status)}>
                          {getStatusText(video.status, video)}
                        </span>
                        {video.enhancedStatus?.progress && (
                          <span className="text-muted-foreground">
                            ({video.enhancedStatus.progress}%)
                          </span>
                        )}
                        {video.availableQualities &&
                          video.availableQualities.length > 0 && (
                            <span className="text-muted-foreground">
                              • {video.availableQualities.join(', ')}
                            </span>
                          )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleVideoSelect(video.id)}
                      disabled={
                        video.status === 'error' ||
                        (!video.enhancedStatus?.availableForStreaming &&
                          video.status !== 'ready')
                      }
                      className="flex items-center gap-1"
                    >
                      <Play className="h-3 w-3" />
                      {video.enhancedStatus?.availableForStreaming &&
                      video.status === 'processing'
                        ? 'Stream'
                        : 'Play'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteVideo(video.id)}
                      className="flex items-center gap-1 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedVideo && (
        <VideoPlayer
          videoId={selectedVideo}
          title={`Transcoded Video - ${selectedVideo}`}
        />
      )}
    </div>
  );
};
