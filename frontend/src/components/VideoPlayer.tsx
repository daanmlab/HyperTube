import { apiClient } from '@/api/client';
import type { VideoStatusResponseDto } from '@/api/generated/models/video-status-response-dto';
import { api } from '@/api/service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Hls from 'hls.js';
import {
  Maximize,
  Minimize,
  Pause,
  PictureInPicture,
  Play,
  RotateCcw,
  Settings,
  Volume1,
  Volume2,
  VolumeOff,
  VolumeX,
} from 'lucide-react';
import { type FC, useCallback, useEffect, useRef, useState } from 'react';

/**
 * Props for the VideoPlayer component
 */
interface VideoPlayerProps {
  videoId: string;
  title?: string;
  isMovie?: boolean;
}

/**
 * Constants for video player configuration
 */
const PLAYER_CONSTANTS = {
  CONTROLS_HIDE_DELAY: 3000, // milliseconds
  SAVE_PROGRESS_INTERVAL: 10000, // 10 seconds
  SEEK_INCREMENT: 5, // seconds
  VOLUME_INCREMENT: 0.1,
  LOW_BUFFER_THRESHOLD: 10, // seconds
  RETRY_DELAY: 5000, // milliseconds
  QUALITY_POLL_INTERVAL: 10000, // 10 seconds for movie transcoding
  STATUS_POLL_INTERVAL: 5000, // 5 seconds for video status
  GAP_SKIP_OFFSET: 0.1, // seconds to offset when skipping gaps
  QUALITY_SWITCH_DELAY: 1000, // milliseconds
  PLAYBACK_RESTORE_DELAY: 100, // milliseconds
} as const;

/**
 * Available playback speed options
 */
const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

/**
 * Quality resolution mappings
 */
const QUALITY_RESOLUTIONS = {
  '2160p': 2160,
  '1440p': 1440,
  '1080p': 1080,
  '720p': 720,
  '480p': 480,
  '360p': 360,
} as const;

/**
 * Formats time in seconds to MM:SS format
 */
const formatTime = (time: number): string => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Maps video height to quality label
 */
const getQualityLabel = (height: number): string => {
  if (height >= 2160) return '2160p';
  if (height >= 1440) return '1440p';
  if (height >= 1080) return '1080p';
  if (height >= 720) return '720p';
  if (height >= 480) return '480p';
  if (height >= 360) return '360p';
  return '360p';
};

/**
 * Main video player component with HLS streaming support
 * Features: adaptive bitrate, quality selection, keyboard shortcuts, watch progress tracking
 */
export const VideoPlayer: FC<VideoPlayerProps> = ({ videoId, title, isMovie = false }) => {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const lastSaveTimeRef = useRef<number>(0);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [actualDuration, setActualDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Audio state
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isWaitingForSegments, setIsWaitingForSegments] = useState(false);

  // Quality state
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const [currentQuality, setCurrentQuality] = useState<string>('auto');

  // Video status (for non-movie videos)
  const [videoStatus, setVideoStatus] = useState<VideoStatusResponseDto | null>(null);

  // Construct HLS URL
  const hlsUrl = isMovie
    ? `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/movies/${videoId}/master.m3u8`
    : `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/videos/${videoId}/master.m3u8`;

  // ========================================
  // Playback Control Functions
  // ========================================

  /**
   * Toggles play/pause state
   */
  const togglePlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (isPlaying) {
        video.pause();
      } else {
        await video.play();
      }
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error('Failed to play video:', error);
      setError('Failed to play video');
    }
  }, [isPlaying]);

  /**
   * Toggles mute state
   */
  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  /**
   * Toggles fullscreen mode
   */
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
    }
  }, []);

  /**
   * Toggles picture-in-picture mode
   */
  const togglePictureInPicture = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (error) {
      console.error('Picture-in-picture not supported or failed:', error);
    }
  }, []);

  /**
   * Resets the controls hide timeout
   */
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying && !isFullscreen) {
      controlsTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, PLAYER_CONSTANTS.CONTROLS_HIDE_DELAY);
    }
  }, [isPlaying, isFullscreen]);

  // ========================================
  // Keyboard Shortcuts
  // ========================================

  /**
   * Handles keyboard shortcuts for video control
   */
  const handleKeyPress = useCallback(
    (e: KeyboardEvent) => {
      if (!videoRef.current) return;

      switch (e.code) {
        case 'Space': {
          e.preventDefault();
          togglePlay();
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          videoRef.current.currentTime = Math.max(
            0,
            videoRef.current.currentTime - PLAYER_CONSTANTS.SEEK_INCREMENT,
          );
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          videoRef.current.currentTime = Math.min(
            duration,
            videoRef.current.currentTime + PLAYER_CONSTANTS.SEEK_INCREMENT,
          );
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const newVolUp = Math.min(1, volume + PLAYER_CONSTANTS.VOLUME_INCREMENT);
          setVolume(newVolUp);
          videoRef.current.volume = newVolUp;
          setIsMuted(false);
          videoRef.current.muted = false;
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          const newVolDown = Math.max(0, volume - PLAYER_CONSTANTS.VOLUME_INCREMENT);
          setVolume(newVolDown);
          videoRef.current.volume = newVolDown;
          break;
        }
        case 'KeyM': {
          e.preventDefault();
          toggleMute();
          break;
        }
        case 'KeyF': {
          e.preventDefault();
          toggleFullscreen();
          break;
        }
      }
    },
    [volume, duration, togglePlay, toggleMute, toggleFullscreen],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    // Only fetch video status for actual videos, not movies
    if (isMovie) return;

    const fetchStatus = async () => {
      try {
        const response = await api.videos.videosControllerGetVideoStatus(videoId);
        setVideoStatus(response.data);
        if (response.data.availableQualities) {
          setAvailableQualities(response.data.availableQualities);
        }
      } catch {
        console.error('Failed to fetch video status');
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [videoId, isMovie]);

  // Fetch movie metadata for actual duration (for movies)
  useEffect(() => {
    if (!isMovie) return;

    const fetchMovieMetadata = async () => {
      try {
        const response = await apiClient.get(`/movies/status?imdbId=${videoId}`);
        const movieData = response.data;

        console.log('Movie metadata response:', movieData);

        // Try to get duration from metadata first (in seconds from video file)
        if (movieData.metadata?.duration) {
          setActualDuration(movieData.metadata.duration);
          console.log('Loaded actual video duration from metadata:', movieData.metadata.duration);
        }
        // Fallback to runtime from movie database (in minutes)
        else if (movieData.runtime) {
          setActualDuration(movieData.runtime * 60);
          console.log('Loaded duration from movie runtime:', movieData.runtime * 60);
        }

        // Also get available qualities from the API as a fallback
        if (movieData.availableQualities && Array.isArray(movieData.availableQualities)) {
          console.log('Setting qualities from API:', movieData.availableQualities);
          // Only set if we don't have qualities from HLS yet
          setAvailableQualities((prev) => {
            if (prev.length <= 1) {
              // Only 'auto' or empty
              return ['auto', ...movieData.availableQualities];
            }
            return prev;
          });
        }
      } catch (error) {
        console.error('Failed to fetch movie metadata:', error);
        if (error instanceof Error) {
          console.error('Error details:', error.message);
        }
        // Log the full error response if available
        const axiosError = error as {
          response?: { status: number; data: unknown };
          config?: { url: string };
        };
        if (axiosError?.response) {
          console.error('API response error:', {
            status: axiosError.response.status,
            data: axiosError.response.data,
            url: axiosError.config?.url,
          });
        }
      }
    };

    fetchMovieMetadata();

    // Also poll for quality updates during transcoding
    const interval = setInterval(fetchMovieMetadata, 10000); // Every 10 seconds
    return () => clearInterval(interval);
  }, [isMovie, videoId]);

  // Save watch progress for movies
  const saveWatchProgress = useCallback(
    async (watchedSeconds: number, totalSeconds: number) => {
      if (!isMovie) return;

      console.log('Saving watch progress:', {
        watchedSeconds,
        totalSeconds,
        videoId,
      });

      try {
        await apiClient.post('/watch-history/progress', {
          imdbId: videoId,
          watchedSeconds: Math.floor(watchedSeconds),
          totalSeconds: Math.floor(totalSeconds),
        });
        console.log('Watch progress saved successfully');
      } catch {
        console.error('Failed to save watch progress');
      }
    },
    [isMovie, videoId],
  );

  // Load saved watch progress for movies
  useEffect(() => {
    if (!isMovie) return;

    const loadWatchProgress = async () => {
      try {
        const response = await apiClient.get(`/watch-history/movie/${videoId}`);
        if (response.data && response.data.watchedSeconds > 0 && !response.data.completed) {
          const video = videoRef.current;
          if (video && video.duration > 0) {
            video.currentTime = response.data.watchedSeconds;
          }
        }
      } catch {
        // No saved progress or error, start from beginning
        console.log('No saved progress found');
      }
    };

    // Load progress after video metadata is loaded
    const video = videoRef.current;
    if (video) {
      video.addEventListener('loadedmetadata', loadWatchProgress);
      return () => video.removeEventListener('loadedmetadata', loadWatchProgress);
    }
  }, [isMovie, videoId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;

    const updateTime = () => {
      setCurrentTime(video.currentTime);

      // Clear waiting state when playback is progressing (check via state callback)
      if (!video.paused) {
        setIsWaitingForSegments((prev) => (prev ? false : prev));
      }

      // Update buffered ranges
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        setBuffered((bufferedEnd / video.duration) * 100 || 0);
      }

      // Save progress every 10 seconds for movies
      if (isMovie && video.duration > 0) {
        const now = Date.now();

        // Initialize on first call
        if (lastSaveTimeRef.current === 0) {
          lastSaveTimeRef.current = now;
        }

        const timeSinceLastSave = now - lastSaveTimeRef.current;

        if (timeSinceLastSave >= 10000) {
          console.log('10 seconds elapsed, saving progress...');
          lastSaveTimeRef.current = now;
          // Use actualDuration if available for movies, otherwise use video.duration
          const totalDuration = isMovie && actualDuration > 0 ? actualDuration : video.duration;
          saveWatchProgress(video.currentTime, totalDuration);
        }
      }
    };

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
    video.addEventListener('progress', updateTime);

    if (Hls.isSupported()) {
      hls = new Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: true,
      });

      hlsRef.current = hls;

      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest parsed, ready to play');
        if (hls) {
          console.log('HLS levels found:', hls.levels.length);
          console.log(
            'HLS levels detail:',
            hls.levels.map((l) => ({
              height: l.height,
              width: l.width,
              bitrate: l.bitrate,
            })),
          );
        }
        setIsLoading(false);

        // Set available qualities
        if (hls && hls.levels.length > 0) {
          const qualities = hls.levels.map((level) => {
            console.log('Processing level with height:', level.height);
            return getQualityLabel(level.height);
          });
          console.log('Extracted qualities:', qualities);
          const uniqueQualities = Array.from(new Set(qualities));
          console.log('Unique qualities:', uniqueQualities);
          setAvailableQualities(['auto', ...uniqueQualities]);
        }
      });

      // Monitor buffering and check if we're near the end of transcoded content
      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        if (video && hls) {
          const currentTime = video.currentTime;
          const bufferedEnd =
            video.buffered.length > 0 ? video.buffered.end(video.buffered.length - 1) : 0;
          const bufferAhead = bufferedEnd - currentTime;

          // If we have less than 10 seconds of buffer and we're still transcoding
          if (
            isMovie &&
            bufferAhead < 10 &&
            actualDuration > 0 &&
            bufferedEnd < actualDuration - 30
          ) {
            console.log(
              `Low buffer detected: ${bufferAhead.toFixed(1)}s ahead. Movie still transcoding.`,
            );
          }
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.error('HLS error:', data);

        // Handle segment not found errors or buffer stalls (reached end of transcoded content or missing segments)
        const isSegmentMissing =
          data.type === Hls.ErrorTypes.NETWORK_ERROR &&
          data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR;
        const isBufferStalled =
          data.type === Hls.ErrorTypes.MEDIA_ERROR &&
          data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR;

        if (isSegmentMissing || isBufferStalled) {
          if (isBufferStalled) {
            console.warn(
              'Buffer stalled - missing segments in transcoded content or waiting for transcoding',
            );
            setIsWaitingForSegments(true);
          } else {
            console.warn(
              'Segment not found - reached end of transcoded content or buffering needed',
            );
            setIsWaitingForSegments(true);
          }

          // For buffer stalls, try to skip the gap if there's buffered content ahead
          if (isBufferStalled && data.bufferInfo && video) {
            const { buffered, end, nextStart } = data.bufferInfo;

            // Check if there's a gap and buffered content after it
            if (buffered && buffered.length > 1 && nextStart !== undefined && nextStart > end) {
              const gap = nextStart - end;
              console.log(`Detected ${gap.toFixed(1)}s gap in segments. Attempting to skip gap...`);

              // Skip to the next available buffered segment
              video.currentTime = nextStart + 0.1;
              setIsLoading(false);
              setIsWaitingForSegments(false);

              // Try to resume playback
              if (!video.paused) {
                video.play().catch(() => {
                  console.log('Failed to resume after gap skip');
                });
              }
              return;
            }
          }

          // If we're on a specific quality (not auto), try switching to auto or another quality
          if (hls && hls.currentLevel !== -1 && hls.levels.length > 1) {
            console.log('Attempting to switch to auto quality to find more segments');
            const currentTime = video?.currentTime || 0;
            const wasPlaying = video && !video.paused;

            // Switch to auto quality selection
            hls.currentLevel = -1;
            setCurrentQuality('auto');

            // Try to resume from current position
            setTimeout(() => {
              if (video && hls) {
                video.currentTime = currentTime;
                hls.startLoad();
                if (wasPlaying) {
                  video.play().catch(() => {
                    console.log('Waiting for more segments to be transcoded...');
                    setIsLoading(true);
                  });
                } else {
                  setIsWaitingForSegments(false);
                }
              }
            }, 1000);
          } else {
            // Already on auto or only one quality available - show buffering
            console.log('Buffering... waiting for more segments to be transcoded');
            setIsLoading(true);

            // Retry loading after a delay
            setTimeout(() => {
              if (video && hls) {
                console.log('Retrying segment load...');
                hls.startLoad();
                setIsLoading(false);
                setIsWaitingForSegments(false);

                // Try to play if it was playing before
                if (!video.paused) {
                  video.play().catch(() => {});
                }
              }
            }, 5000);
          }

          // Don't treat this as fatal
          return;
        }

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
      video.removeEventListener('progress', updateTime);

      if (hls) {
        hls.destroy();
      }
      hlsRef.current = null;
    };
  }, [hlsUrl, isMovie, saveWatchProgress, actualDuration]);

  /**
   * Handles volume slider change
   */
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    video.volume = newVolume;
    setIsMuted(newVolume === 0);
    video.muted = newVolume === 0;
  };

  /**
   * Handles playback rate change
   */
  const handlePlaybackRateChange = (rate: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSettings(false);
  };

  /**
   * Handles quality selection change
   */
  const handleQualityChange = (quality: string) => {
    if (!hlsRef.current || quality === currentQuality) return;

    const video = videoRef.current;
    if (!video) return;

    const currentTimeBeforeSwitch = video.currentTime;
    const wasPlaying = isPlaying;

    if (quality === 'auto') {
      hlsRef.current.currentLevel = -1;
    } else {
      const qualityIndex = hlsRef.current.levels.findIndex((level) => {
        const height = level.height;
        const targetHeight = QUALITY_RESOLUTIONS[quality as keyof typeof QUALITY_RESOLUTIONS];
        return height === targetHeight;
      });

      if (qualityIndex !== -1) {
        hlsRef.current.currentLevel = qualityIndex;
      }
    }

    setCurrentQuality(quality);
    setShowSettings(false);

    // Restore playback position and state
    setTimeout(() => {
      if (video) {
        video.currentTime = currentTimeBeforeSwitch;
        if (wasPlaying) {
          video.play().catch(() => {
            console.error('Failed to resume playback after quality change');
          });
        }
      }
    }, PLAYER_CONSTANTS.PLAYBACK_RESTORE_DELAY);
  };

  /**
   * Handles seeking to a new position in the video
   */
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const seekPercentage = parseFloat(e.target.value) / 100;
    const maxSeekTime = duration > 0 ? duration : displayDuration;
    const newTime = seekPercentage * Math.min(displayDuration, maxSeekTime);

    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  /**
   * Handles reload/retry after an error
   */
  const handleReload = () => {
    const video = videoRef.current;
    if (!video) return;

    setError(null);
    setIsLoading(true);
    video.load();
  };

  /**
   * Returns the appropriate volume icon based on current volume
   */
  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return <VolumeOff className="h-4 w-4" />;
    if (volume < 0.3) return <VolumeX className="h-4 w-4" />;
    if (volume < 0.7) return <Volume1 className="h-4 w-4" />;
    return <Volume2 className="h-4 w-4" />;
  };

  // Use actual duration for movies if available, otherwise use HLS duration
  const displayDuration = isMovie && actualDuration > 0 ? actualDuration : duration;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          {title || `Video Player - ${videoId}`}
        </CardTitle>
        <CardDescription>
          Multi-quality adaptive streaming with HLS • Keyboard shortcuts enabled
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <section
          ref={containerRef}
          className="relative bg-black rounded-lg overflow-hidden group"
          onMouseMove={resetControlsTimeout}
          onMouseEnter={() => setShowControls(true)}
          onMouseLeave={() => isPlaying && setShowControls(false)}
          aria-label="Video player"
        >
          <video
            ref={videoRef}
            className="w-full aspect-video"
            controls={false}
            crossOrigin="anonymous"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          >
            <track kind="captions" />
          </video>

          {/* Loading Spinner */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
          )}

          {/* Buffering/Waiting for Segments */}
          {isWaitingForSegments && !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-t-4 border-amber-500 mb-4"></div>
              <p className="text-white text-lg font-semibold mb-2">Buffering</p>
              <p className="text-white/80 text-sm">Waiting for more segments to transcode...</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 text-white p-4">
              <p className="text-center mb-4">{error}</p>
              <Button variant="outline" onClick={handleReload} className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          )}

          {/* Center Play/Pause Button */}
          {!isLoading && !error && (
            <button
              type="button"
              className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                showControls ? 'opacity-100' : 'opacity-0'
              }`}
              onClick={togglePlay}
              onKeyDown={(e) => e.key === 'Enter' && togglePlay()}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              <div className="bg-black/30 hover:bg-black/50 rounded-full p-6 cursor-pointer transition-all pointer-events-none">
                {isPlaying ? (
                  <Pause className="h-12 w-12 text-white" />
                ) : (
                  <Play className="h-12 w-12 text-white ml-1" />
                )}
              </div>
            </button>
          )}

          {/* Custom Controls */}
          <div
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-opacity duration-300 ${
              showControls ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* Progress Bar */}
            <div className="px-4 pt-4">
              <div className="relative group/progress">
                {/* Buffered Bar */}
                <div
                  className="absolute h-1 bg-white/30 rounded-full"
                  style={{ width: `${buffered}%` }}
                ></div>

                {/* Progress Input */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={displayDuration > 0 ? (currentTime / displayDuration) * 100 : 0}
                  onChange={handleSeek}
                  className="relative w-full h-1 bg-transparent appearance-none cursor-pointer z-10
                    [&::-webkit-slider-track]:bg-white/20 [&::-webkit-slider-track]:rounded-full [&::-webkit-slider-track]:h-1
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white 
                    [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-all
                    hover:[&::-webkit-slider-thumb]:scale-125
                    [&::-moz-range-track]:bg-white/20 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:h-1
                    [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full 
                    [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer
                    hover:[&::-moz-range-thumb]:scale-125"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
                      displayDuration > 0 ? (currentTime / displayDuration) * 100 : 0
                    }%, transparent ${
                      displayDuration > 0 ? (currentTime / displayDuration) * 100 : 0
                    }%, transparent 100%)`,
                  }}
                />
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                {/* Play/Pause */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={togglePlay}
                  disabled={isLoading || !!error}
                  className="text-white hover:bg-white/20 h-8 w-8 p-0"
                >
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </Button>

                {/* Volume */}
                <div className="flex items-center gap-2 group/volume">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleMute}
                    disabled={isLoading || !!error}
                    className="text-white hover:bg-white/20 h-8 w-8 p-0"
                  >
                    {getVolumeIcon()}
                  </Button>

                  {/* Volume Slider */}
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-0 group-hover/volume:w-20 transition-all duration-200 h-1 bg-white/20 rounded-full appearance-none cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 
                      [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white 
                      [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full 
                      [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0"
                  />
                </div>

                {/* Time Display */}
                <span className="text-sm text-white font-medium ml-2">
                  {formatTime(currentTime)} / {formatTime(displayDuration)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Playback Speed */}
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSettings(!showSettings)}
                    className="text-white hover:bg-white/20 text-xs px-2 h-8"
                  >
                    {playbackRate}x
                  </Button>

                  {showSettings && (
                    <div className="absolute bottom-full right-0 mb-2 bg-black/95 rounded-lg p-2 min-w-[120px]">
                      <div className="text-xs text-white/70 mb-2 px-2">Speed</div>
                      {PLAYBACK_RATES.map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => handlePlaybackRateChange(rate)}
                          className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-white/20 transition-colors ${
                            playbackRate === rate ? 'text-blue-400' : 'text-white'
                          }`}
                        >
                          {rate}x {playbackRate === rate && '✓'}
                        </button>
                      ))}

                      {availableQualities.length > 1 && (
                        <>
                          <div className="text-xs text-white/70 my-2 px-2 pt-2 border-t border-white/10">
                            Quality
                          </div>
                          {availableQualities.map((quality) => (
                            <button
                              key={quality}
                              type="button"
                              onClick={() => handleQualityChange(quality)}
                              className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-white/20 transition-colors ${
                                currentQuality === quality ? 'text-blue-400' : 'text-white'
                              }`}
                            >
                              {quality} {currentQuality === quality && '✓'}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Settings */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSettings(!showSettings)}
                  className="text-white hover:bg-white/20 h-8 w-8 p-0"
                >
                  <Settings className="h-5 w-5" />
                </Button>

                {/* Picture-in-Picture */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={togglePictureInPicture}
                  disabled={isLoading || !!error}
                  className="text-white hover:bg-white/20 h-8 w-8 p-0"
                >
                  <PictureInPicture className="h-5 w-5" />
                </Button>

                {/* Fullscreen */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleFullscreen}
                  disabled={isLoading || !!error}
                  className="text-white hover:bg-white/20 h-8 w-8 p-0"
                >
                  {isFullscreen ? (
                    <Minimize className="h-5 w-5" />
                  ) : (
                    <Maximize className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Video Info & Keyboard Shortcuts */}
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 space-y-1">
              <p>• Adaptive bitrate streaming (360p-2160p)</p>
              <p>• Automatic quality switching based on bandwidth</p>
              {isMovie && (
                <p className="text-amber-600">
                  • Smart buffering: switches quality if transcoding catches up
                </p>
              )}
              {videoStatus?.availableForStreaming &&
                videoStatus?.status === 'ready' &&
                videoStatus?.progress < 100 && (
                  <p className="text-blue-600">
                    • Additional qualities being processed ({videoStatus.progress}%)
                  </p>
                )}
              {videoStatus?.availableQualities && videoStatus.availableQualities.length > 0 && (
                <p>• Available: {videoStatus.availableQualities.join(', ')}</p>
              )}
            </div>
            <div className="space-y-1 text-right">
              <p className="font-semibold">Keyboard Shortcuts:</p>
              <p>Space: Play/Pause • F: Fullscreen</p>
              <p>M: Mute • ← →: Seek ±5s</p>
              <p>↑ ↓: Volume</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
