import { apiClient } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Film, Play, RefreshCw, Search } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Movie {
  imdbId: string;
  title: string;
  year: number;
  synopsis: string;
  runtime: number;
  genres: string[];
  imageUrl: string;
  rating: string;
  status: 'pending' | 'downloading' | 'transcoding' | 'ready' | 'error';
  downloadProgress: string;
  transcodeProgress: string;
  selectedQuality: string;
}

interface MovieListProps {
  refreshTrigger?: number;
}

export const MovieList: React.FC = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const loadMovies = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get('/movies/library');
      setMovies(response.data || []);
    } catch (error) {
      console.error('Failed to load movies:', error);
      setMovies([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMovies();

    // Auto-refresh every 5 seconds to update progress
    const interval = setInterval(loadMovies, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleMovieSelect = (imdbId: string) => {
    navigate(`/movie/${imdbId}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'bg-green-600';
      case 'transcoding':
        return 'bg-blue-600';
      case 'downloading':
        return 'bg-yellow-600';
      case 'error':
        return 'bg-red-600';
      default:
        return 'bg-gray-600';
    }
  };

  const getStatusText = (movie: Movie) => {
    switch (movie.status) {
      case 'ready':
        return 'Ready to stream';
      case 'transcoding':
        // Show detailed transcoding info with quality
        const progress = parseFloat(movie.transcodeProgress || '0').toFixed(0);
        const quality = movie.selectedQuality || '';
        return `Transcoding ${quality ? quality + ' - ' : ''}${progress}%`;
      case 'downloading':
        const downloadProgress = parseFloat(
          movie.downloadProgress || '0'
        ).toFixed(0);
        return `Downloading ${downloadProgress}%`;
      case 'error':
        return 'Error';
      default:
        return movie.status;
    }
  };

  const isPlayable = (movie: Movie) => {
    return (
      movie.status === 'ready' ||
      (movie.status === 'transcoding' &&
        parseFloat(movie.transcodeProgress) > 0)
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Film className="h-5 w-5" />
                Movie Library
              </CardTitle>
              <CardDescription>
                Your downloaded movies ready to stream
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadMovies}
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
          {movies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Film className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">
                No movies in your library yet
              </p>
              <p className="text-sm mb-4">
                Search and download movies to get started
              </p>
              <Button
                onClick={() => navigate('/search')}
                className="flex items-center gap-2 mx-auto"
              >
                <Search className="h-4 w-4" />
                Search Movies
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {movies.map(movie => (
                <Card key={movie.imdbId} className="overflow-hidden">
                  <div className="aspect-[2/3] relative">
                    <img
                      src={movie.imageUrl}
                      alt={movie.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2">
                      <Badge className={getStatusColor(movie.status)}>
                        {movie.status}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-bold text-lg mb-1 truncate">
                      {movie.title}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <span>{movie.year}</span>
                      <span>•</span>
                      <span>⭐ {movie.rating}</span>
                      <span>•</span>
                      <span>{movie.runtime}m</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {movie.genres?.slice(0, 3).map((genre, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {genre}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {movie.synopsis}
                    </p>
                    <div className="text-xs text-muted-foreground mb-3">
                      {getStatusText(movie)}
                    </div>
                    {(movie.status === 'downloading' ||
                      movie.status === 'transcoding') && (
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{
                            width: `${
                              movie.status === 'downloading'
                                ? movie.downloadProgress
                                : movie.transcodeProgress
                            }%`,
                          }}
                        />
                      </div>
                    )}
                    <Button
                      className="w-full"
                      onClick={() => handleMovieSelect(movie.imdbId)}
                      disabled={!isPlayable(movie)}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      {movie.status === 'ready' ? 'Play' : 'Stream'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
