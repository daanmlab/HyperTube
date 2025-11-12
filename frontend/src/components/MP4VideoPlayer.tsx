import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  VideoPlayer,
  VideoPlayerContent,
  VideoPlayerControlBar,
  VideoPlayerMuteButton,
  VideoPlayerPlayButton,
  VideoPlayerSeekBackwardButton,
  VideoPlayerSeekForwardButton,
  VideoPlayerTimeDisplay,
  VideoPlayerTimeRange,
  VideoPlayerVolumeRange,
} from '@/components/ui/shadcn-io/video-player';
import { Play, RotateCcw, Subtitles } from 'lucide-react';
import { type FC, useCallback, useEffect, useRef, useState } from 'react';

interface MP4VideoPlayerProps {
  videoId: string;
  title?: string;
  isMovie?: boolean;
}

interface Subtitle {
  language: string;
  languageName: string;
  url: string;
}

const SAVE_PROGRESS_INTERVAL = 10000; // 10 seconds

export const MP4VideoPlayer: FC<MP4VideoPlayerProps> = ({ videoId, title, isMovie = false }) => {
  const lastSaveTimeRef = useRef<number>(0);

  const [error, setError] = useState<string | null>(null);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState<string | null>(null);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);

  // Construct video URL
  const videoUrl = isMovie
    ? `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/movies/${videoId}/stream`
    : `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/videos/${videoId}/stream`;

  // Load subtitles
  useEffect(() => {
    if (!isMovie) return;

    const loadSubtitles = async () => {
      try {
        const response = await apiClient.get(`/subtitles/${videoId}`);
        const data = response.data;

        if (data?.subtitles) {
          setSubtitles(data.subtitles);

          // Auto-select English subtitle if available
          const englishSubtitle = data.subtitles.find((s: Subtitle) => s.language === 'en');
          if (englishSubtitle) {
            setSelectedSubtitle(englishSubtitle.language);
          }
        }
      } catch {
        console.log('No subtitles available or error loading subtitles');
      }
    };

    loadSubtitles();
  }, [videoId, isMovie]);

  // Save watch progress
  const saveWatchProgress = useCallback(
    async (watchedSeconds: number, totalSeconds: number) => {
      if (!isMovie) return;

      try {
        await apiClient.post('/watch-history/progress', {
          imdbId: videoId,
          watchedSeconds: Math.floor(watchedSeconds),
          totalSeconds: Math.floor(totalSeconds),
        });
      } catch (err) {
        console.error('Failed to save watch progress:', err);
      }
    },
    [isMovie, videoId],
  );

  // Load saved watch progress
  useEffect(() => {
    if (!isMovie) return;

    const loadWatchProgress = async () => {
      try {
        const response = await apiClient.get(`/watch-history/movie/${videoId}`);
        if (response.data && response.data.watchedSeconds > 0 && !response.data.completed) {
          const video = document.querySelector('video');
          if (video) {
            video.currentTime = response.data.watchedSeconds;
          }
        }
      } catch {
        console.log('No saved progress found');
      }
    };

    // Load progress after video metadata is loaded
    const video = document.querySelector('video');
    if (video) {
      video.addEventListener('loadedmetadata', loadWatchProgress);
      return () => video.removeEventListener('loadedmetadata', loadWatchProgress);
    }
  }, [isMovie, videoId]);

  // Progress tracking
  useEffect(() => {
    if (!isMovie) return;

    const video = document.querySelector('video');
    if (!video) return;

    const handleTimeUpdate = () => {
      if (video.duration > 0) {
        const now = Date.now();

        if (lastSaveTimeRef.current === 0) {
          lastSaveTimeRef.current = now;
        }

        const timeSinceLastSave = now - lastSaveTimeRef.current;

        if (timeSinceLastSave >= SAVE_PROGRESS_INTERVAL) {
          lastSaveTimeRef.current = now;
          saveWatchProgress(video.currentTime, video.duration);
        }
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [isMovie, saveWatchProgress]);

  const handleReload = () => {
    const video = document.querySelector('video');
    if (!video) return;

    setError(null);
    video.load();
  };

  const handleSubtitleChange = (language: string | null) => {
    setSelectedSubtitle(language);
    setShowSubtitleMenu(false);

    // Update video text tracks
    const video = document.querySelector('video');
    if (video?.textTracks) {
      for (let i = 0; i < video.textTracks.length; i++) {
        const track = video.textTracks[i];
        track.mode = track.language === language ? 'showing' : 'hidden';
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          {title || `Video Player - ${videoId}`}
        </CardTitle>
        <CardDescription>
          Progressive MP4 streaming with native HTML5 video • Keyboard shortcuts enabled
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <VideoPlayer className="rounded-lg overflow-hidden">
          <VideoPlayerContent
            src={videoUrl}
            crossOrigin="anonymous"
            onError={() => setError('Failed to load video. It may still be transcoding.')}
            slot="media"
          >
            {/* Subtitle tracks */}
            {subtitles.map((subtitle) => (
              <track
                key={subtitle.language}
                kind="subtitles"
                src={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${subtitle.url}`}
                srcLang={subtitle.language}
                label={subtitle.languageName}
                default={subtitle.language === 'en'}
              />
            ))}
          </VideoPlayerContent>

          <VideoPlayerControlBar>
            <VideoPlayerPlayButton />
            <VideoPlayerSeekBackwardButton />
            <VideoPlayerSeekForwardButton />
            <VideoPlayerTimeDisplay showDuration />
            <VideoPlayerTimeRange />
            <VideoPlayerMuteButton />
            <VideoPlayerVolumeRange />

            {/* Subtitle selector */}
            {subtitles.length > 0 && (
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSubtitleMenu(!showSubtitleMenu)}
                  className="h-8 w-8 p-0"
                  title="Subtitles"
                >
                  <Subtitles className="h-4 w-4" />
                </Button>

                {showSubtitleMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-black/95 rounded-lg p-2 min-w-[150px] z-50">
                    <div className="text-xs text-white/70 mb-2 px-2">Subtitles</div>
                    <button
                      type="button"
                      onClick={() => handleSubtitleChange(null)}
                      className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-white/20 transition-colors ${
                        selectedSubtitle === null ? 'text-blue-400' : 'text-white'
                      }`}
                    >
                      Off {selectedSubtitle === null && '✓'}
                    </button>
                    {subtitles.map((subtitle) => (
                      <button
                        key={subtitle.language}
                        type="button"
                        onClick={() => handleSubtitleChange(subtitle.language)}
                        className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-white/20 transition-colors ${
                          selectedSubtitle === subtitle.language ? 'text-blue-400' : 'text-white'
                        }`}
                      >
                        {subtitle.languageName} {selectedSubtitle === subtitle.language && '✓'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </VideoPlayerControlBar>
        </VideoPlayer>

        {/* Error Message */}
        {error && (
          <div className="flex flex-col items-center justify-center bg-destructive/10 text-destructive p-4 rounded-lg">
            <p className="text-center mb-4">{error}</p>
            <Button variant="outline" onClick={handleReload} className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 space-y-1">
              <p>• Native HTML5 video with progressive MP4 streaming</p>
              <p>• Full seek support with HTTP Range requests</p>
              <p>• Automatic subtitle loading from OpenSubtitles</p>
              {isMovie && <p>• Watch progress automatically saved every 10 seconds</p>}
            </div>
            <div className="space-y-1 text-right">
              <p className="font-semibold">Keyboard Shortcuts:</p>
              <p>Space: Play/Pause • F: Fullscreen</p>
              <p>M: Mute • ← →: Seek</p>
              <p>↑ ↓: Volume</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
