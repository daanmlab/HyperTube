import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import Hls from 'hls.js';
import { Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface VideoPlayerProps {
  videoId: string;
  title?: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoId, title }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<any>(null);

  const hlsUrl = `${
    import.meta.env.VITE_API_URL || 'http://localhost:3000'
  }/videos/${videoId}/master.m3u8`;

  // Fetch video status to show processing info
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(
          `${
            import.meta.env.VITE_API_URL || 'http://localhost:3000'
          }/videos/${videoId}/status`
        );
        if (response.ok) {
          const status = await response.json();
          setVideoStatus(status);
        }
      } catch (err) {
        console.error('Failed to fetch video status:', err);
      }
    };

    fetchStatus();
    // Poll for status updates if still processing
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [videoId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    console.log('VideoPlayer - HLS URL:', hlsUrl);
    console.log('VideoPlayer - API URL env:', import.meta.env.VITE_API_URL);

    let hls: Hls | null = null;

    const updateTime = () => setCurrentTime(video.currentTime);
    const updateDuration = () => setDuration(video.duration);
    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handleError = () => {
      setError('Failed to load video. It may still be processing.');
      setIsLoading(false);
    };

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', updateDuration);
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);

    // Load HLS
    if (Hls.isSupported()) {
      hls = new Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: true,
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest parsed, ready to play');
        setIsLoading(false);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS error:', data);
        if (data.fatal) {
          console.error('Fatal HLS error, cannot recover');
          setError('Failed to load video stream');
          setIsLoading(false);
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = hlsUrl;
    } else {
      setError('HLS playback not supported in this browser');
      setIsLoading(false);
    }

    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', updateDuration);
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);

      if (hls) {
        hls.destroy();
      }
    };
  }, [hlsUrl]);

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      try {
        await video.play();
      } catch (err) {
        setError('Failed to play video');
      }
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newTime = (parseFloat(e.target.value) / 100) * duration;
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleReload = () => {
    const video = videoRef.current;
    if (!video) return;

    setError(null);
    setIsLoading(true);
    video.load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          {title || `Video Player - ${videoId}`}
        </CardTitle>
        <CardDescription>
          Multi-quality adaptive streaming with HLS
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            className="w-full aspect-video"
            controls={false}
            crossOrigin="anonymous"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 text-white p-4">
              <p className="text-center mb-4">{error}</p>
              <Button
                variant="outline"
                onClick={handleReload}
                className="flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          )}
        </div>

        {/* Custom Controls */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="100"
              value={duration > 0 ? (currentTime / duration) * 100 : 0}
              onChange={handleSeek}
              className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={togglePlay}
                disabled={isLoading || !!error}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={toggleMute}
                disabled={isLoading || !!error}
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>

              <span className="text-sm text-muted-foreground">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="text-sm text-muted-foreground">
              Video ID: <code className="bg-muted px-1 rounded">{videoId}</code>
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Adaptive bitrate streaming (360p-1080p)</p>
          <p>• Automatic quality switching based on bandwidth</p>
          <p>• Video is transposed 90° clockwise during processing</p>
          {videoStatus?.availableForStreaming &&
            videoStatus?.status === 'ready' &&
            videoStatus?.progress < 100 && (
              <p className="text-blue-600">
                • Additional qualities being processed ({videoStatus.progress}%)
              </p>
            )}
          {videoStatus?.qualities && videoStatus.qualities.length > 0 && (
            <p>• Available: {videoStatus.qualities.join(', ')}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
