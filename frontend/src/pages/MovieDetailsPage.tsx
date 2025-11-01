import { apiClient } from '@/api/client';
import { Comments } from '@/components/Comments';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VideoPlayer } from '@/components/VideoPlayer';
import { ArrowLeft, Calendar, Clock, Star } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

interface Movie {
  imdbId: string;
  title: string;
  year: number;
  synopsis: string;
  runtime: number;
  genres: string[] | string;
  imageUrl: string;
  rating: string;
  status: string;
  canStream?: boolean; // Add canStream flag
  errorMessage?: string; // Error message if status is 'error'
}

export const MovieDetailsPage: React.FC = () => {
  const { imdbId } = useParams<{ imdbId: string }>();
  const navigate = useNavigate();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();

  useEffect(() => {
    const loadMovie = async () => {
      if (!imdbId) return;

      setIsLoading(true);
      try {
        const response = await apiClient.get('/movies/library');
        const movies = response.data || [];
        const foundMovie = movies.find((m: Movie) => m.imdbId === imdbId);
        setMovie(foundMovie || null);

        // Get current user from auth context
        const token = localStorage.getItem('authToken');
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            setCurrentUserId(payload.sub);
          } catch (e) {
            console.error('Failed to parse token:', e);
          }
        }
      } catch (error) {
        console.error('Failed to load movie:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMovie();
  }, [imdbId]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-center">Loading movie details...</p>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Button variant="outline" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Library
        </Button>
        <p className="text-center mt-8">Movie not found</p>
      </div>
    );
  }

  const genres = Array.isArray(movie.genres)
    ? movie.genres
    : typeof movie.genres === 'string'
      ? movie.genres.split(',').map((g: string) => g.trim())
      : [];

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Back Button */}
      <Button variant="outline" onClick={() => navigate('/dashboard')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Library
      </Button>

      {/* Movie Header */}
      <Card>
        <CardHeader>
          <div className="flex gap-6">
            <img
              src={movie.imageUrl}
              alt={movie.title}
              className="w-48 h-72 object-cover rounded-lg"
              onError={(e) => {
                e.currentTarget.src = 'https://via.placeholder.com/300x450?text=No+Image';
              }}
            />
            <div className="flex-1 space-y-4">
              <div>
                <CardTitle className="text-3xl">{movie.title}</CardTitle>
                <div className="flex gap-4 mt-2 text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {movie.year}
                  </span>
                  {movie.runtime && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {movie.runtime} min
                    </span>
                  )}
                  {movie.rating && (
                    <span className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      {movie.rating}/10
                    </span>
                  )}
                </div>
              </div>

              {/* Genres */}
              <div className="flex flex-wrap gap-2">
                {genres.map((genre: string, index: number) => (
                  <Badge key={index} variant="secondary">
                    {genre}
                  </Badge>
                ))}
              </div>

              {/* Synopsis */}
              {movie.synopsis && (
                <div>
                  <h3 className="font-semibold mb-2">Synopsis</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{movie.synopsis}</p>
                </div>
              )}

              {/* Status Badge */}
              <div>
                <Badge
                  variant={
                    movie.status === 'ready' ? 'default' : movie.canStream ? 'default' : 'secondary'
                  }
                >
                  {movie.status === 'ready'
                    ? 'Ready'
                    : movie.canStream
                      ? 'Streaming Available'
                      : movie.status}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Video Player - Show when ready OR when canStream is true (progressive streaming) */}
      {(movie.status === 'ready' || movie.canStream) && (
        <VideoPlayer videoId={movie.imdbId} title={movie.title} isMovie={true} />
      )}

      {/* Error Message - Show when status is error */}
      {movie.status === 'error' && (
        <Card className="border-red-500 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              <span>⚠️</span>
              Error Processing Video
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">
              {movie.errorMessage ||
                'An error occurred while processing this video. Please try re-downloading it.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Comments Section */}
      <Comments imdbId={movie.imdbId} currentUserId={currentUserId} />
    </div>
  );
};
