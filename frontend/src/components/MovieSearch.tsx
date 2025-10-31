import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Download, Search, Star, Calendar, Clock, Film, Loader2, Play } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface Torrent {
  resolution: string;
  quality: string;
  size: string;
  seeds: number;
  peers: number;
  magnet: string;
}

interface SearchMovie {
  imdb_id: string;
  title: string;
  year: number;
  synopsis: string;
  runtime: number;
  genres: string[];
  image: string;
  rating: number;
  trailer?: string;
  torrents: Torrent[];
}

export const MovieSearch: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchMovie[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<SearchMovie | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ [key: string]: boolean }>({});
  const [libraryMovies, setLibraryMovies] = useState<{ [key: string]: any }>({});
  const navigate = useNavigate();

  // Load library movies to check which are already downloaded
  useEffect(() => {
    const loadLibrary = async () => {
      try {
        const response = await apiClient.get('/movies/library');
        const movies = response.data || [];
        const moviesMap: { [key: string]: any } = {};
        movies.forEach((movie: any) => {
          moviesMap[movie.imdbId] = movie;
        });
        setLibraryMovies(moviesMap);
      } catch (error) {
        console.error('Failed to load library:', error);
      }
    };
    loadLibrary();
    
    // Refresh library every 10 seconds
    const interval = setInterval(loadLibrary, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await apiClient.get('/movies/search', {
        params: { keywords: searchQuery, page: 1 },
      });
      setSearchResults(response.data?.data || []);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleDownload = async (movie: SearchMovie, quality?: string) => {
    setIsDownloading(true);
    setDownloadProgress(prev => ({ ...prev, [movie.imdb_id]: true }));
    
    try {
      console.log(`Starting download for ${movie.title} (${movie.imdb_id}) with quality: ${quality || 'auto'}`);
      
      const response = await apiClient.post('/movies/start-download', {}, {
        params: {
          imdbId: movie.imdb_id,  // Backend expects 'imdbId' not 'imdb_id'
          ...(quality && { quality }),  // Only include quality if provided
        },
      });

      if (response.data) {
        // Show success message
        alert(`Download started for "${movie.title}"! Check your library for progress.`);
        setSelectedMovie(null);
        
        // Reload library immediately to show new movie
        const libResponse = await apiClient.get('/movies/library');
        const movies = libResponse.data || [];
        const moviesMap: { [key: string]: any } = {};
        movies.forEach((m: any) => {
          moviesMap[m.imdbId] = m;
        });
        setLibraryMovies(moviesMap);
        
        // Navigate to dashboard after a short delay
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      }
    } catch (error: any) {
      console.error('Download failed:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to start download';
      alert(`Download failed: ${errorMessage}`);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(prev => ({ ...prev, [movie.imdb_id]: false }));
    }
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case '1080p':
        return 'bg-purple-600';
      case '720p':
        return 'bg-blue-600';
      case '480p':
        return 'bg-green-600';
      default:
        return 'bg-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Movies
          </CardTitle>
          <CardDescription>
            Search for movies and start streaming
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Search for movies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <Button 
              onClick={handleSearch} 
              disabled={isSearching || !searchQuery.trim()}
              className="flex items-center gap-2"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {searchResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
            <CardDescription>
              Found {searchResults.length} movies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {searchResults.map((movie) => (
                <Card key={movie.imdb_id} className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow">
                  <div 
                    className="aspect-[2/3] relative"
                    onClick={() => setSelectedMovie(movie)}
                  >
                    <img
                      src={movie.image}
                      alt={movie.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/300x450?text=No+Image';
                      }}
                    />
                    {movie.torrents && movie.torrents.length > 0 && (
                      <div className="absolute top-2 right-2 flex flex-col gap-1">
                        {movie.torrents.slice(0, 3).map((torrent, idx) => (
                          <Badge key={idx} className={getQualityColor(torrent.resolution)}>
                            {torrent.resolution}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-bold text-lg mb-1 truncate">
                      {movie.title}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {movie.year}
                      </span>
                      {movie.rating && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            {movie.rating.toFixed(1)}
                          </span>
                        </>
                      )}
                      {movie.runtime && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {movie.runtime}m
                          </span>
                        </>
                      )}
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
                    
                    {libraryMovies[movie.imdb_id] ? (
                      <>
                        <div className="text-xs text-muted-foreground mb-2">
                          {libraryMovies[movie.imdb_id].status === 'transcoding' ? (
                            <>
                              Transcoding {libraryMovies[movie.imdb_id].selectedQuality || ''} - {' '}
                              {parseFloat(libraryMovies[movie.imdb_id].transcodeProgress || '0').toFixed(0)}%
                            </>
                          ) : libraryMovies[movie.imdb_id].status === 'downloading' ? (
                            <>
                              Downloading - {parseFloat(libraryMovies[movie.imdb_id].downloadProgress || '0').toFixed(0)}%
                            </>
                          ) : (
                            <>Status: {libraryMovies[movie.imdb_id].status}</>
                          )}
                        </div>
                        {(libraryMovies[movie.imdb_id].status === 'downloading' || 
                          libraryMovies[movie.imdb_id].status === 'transcoding') && (
                          <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{
                                width: `${
                                  libraryMovies[movie.imdb_id].status === 'downloading'
                                    ? libraryMovies[movie.imdb_id].downloadProgress
                                    : libraryMovies[movie.imdb_id].transcodeProgress
                                }%`,
                              }}
                            />
                          </div>
                        )}
                        <Button
                          className="w-full"
                          onClick={() => navigate(`/movie/${movie.imdb_id}`)}
                          disabled={libraryMovies[movie.imdb_id].status !== 'ready'}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          {libraryMovies[movie.imdb_id].status === 'ready' ? 'Stream' : 'Processing...'}
                        </Button>
                      </>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => setSelectedMovie(movie)}
                        disabled={downloadProgress[movie.imdb_id] || !movie.torrents?.length}
                      >
                        {downloadProgress[movie.imdb_id] ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Starting...
                          </>
                        ) : (
                          <>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </>
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Movie Details Dialog */}
      <Dialog open={selectedMovie !== null} onOpenChange={() => setSelectedMovie(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedMovie && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{selectedMovie.title}</DialogTitle>
                <DialogDescription>
                  Select quality to download and stream
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <img
                    src={selectedMovie.image}
                    alt={selectedMovie.title}
                    className="w-full rounded-lg"
                    onError={(e) => {
                      e.currentTarget.src = 'https://via.placeholder.com/300x450?text=No+Image';
                    }}
                  />
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {selectedMovie.year}
                    </span>
                    {selectedMovie.rating && (
                      <span className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        {selectedMovie.rating.toFixed(1)}/10
                      </span>
                    )}
                    {selectedMovie.runtime && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {selectedMovie.runtime} min
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedMovie.genres?.map((genre, idx) => (
                      <Badge key={idx} variant="secondary">
                        {genre}
                      </Badge>
                    ))}
                  </div>

                  {selectedMovie.synopsis && (
                    <div>
                      <h3 className="font-semibold mb-2">Synopsis</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {selectedMovie.synopsis}
                      </p>
                    </div>
                  )}

                  {selectedMovie.torrents && selectedMovie.torrents.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2">Available Qualities</h3>
                      <div className="space-y-2">
                        {selectedMovie.torrents.map((torrent, idx) => (
                          <Card key={idx} className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Badge className={getQualityColor(torrent.resolution)}>
                                  {torrent.resolution}
                                </Badge>
                                <div className="text-sm">
                                  <div className="font-medium">{torrent.quality}</div>
                                  <div className="text-muted-foreground">
                                    {torrent.size} • {torrent.seeds} seeds
                                  </div>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleDownload(selectedMovie, torrent.resolution)}
                                disabled={isDownloading}
                              >
                                {isDownloading ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedMovie.trailer && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => window.open(selectedMovie.trailer, '_blank')}
                    >
                      <Film className="h-4 w-4 mr-2" />
                      Watch Trailer
                    </Button>
                  )}

                  <Button
                    className="w-full"
                    onClick={() => handleDownload(selectedMovie)}
                    disabled={isDownloading || !selectedMovie.torrents?.length}
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Starting Download...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Download Best Quality
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
