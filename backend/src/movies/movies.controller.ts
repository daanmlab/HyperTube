import {
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiExtraModels, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { AriaService } from './aria/aria.service';
import {
  DeleteResponseDto,
  MessageResponseDto,
  MovieDto,
  SearchResponseDto,
  StartDownloadResponseDto,
} from './dto';
import { MoviesService } from './movies.service';
import { OptimizedSearchService } from './search/optimized-search.service';
import { TpbService } from './tpb/tpb.service';
import { YtsService } from './yts/yts.service';

@ApiTags('movies')
@Controller('movies')
@Public() // Temporarily enabled for testing
// @ApiBearerAuth()
@ApiExtraModels(
  MovieDto,
  StartDownloadResponseDto,
  MessageResponseDto,
  SearchResponseDto,
  DeleteResponseDto,
)
export class MoviesController {
  constructor(
    private readonly ytsService: YtsService,
    private readonly ariaService: AriaService,
    private readonly moviesService: MoviesService,
    private readonly tpbService: TpbService,
    private readonly optimizedSearchService: OptimizedSearchService,
  ) {}

  /**
   * Safely parse JSON string, handling cases where value is already parsed or invalid
   */
  private safeJsonParse(value: any): any {
    if (!value) return undefined;
    if (typeof value !== 'string') return value; // Already parsed
    try {
      return JSON.parse(value);
    } catch {
      // If it's a comma-separated string, split it into an array
      if (value.includes(',')) {
        return value.split(',').map((item: string) => item.trim());
      }
      return value; // Return as-is if not valid JSON and not comma-separated
    }
  }

  @Get('test-dto')
  @ApiOperation({ summary: 'Test endpoint to verify DTO schema generation' })
  @ApiResponse({ status: 200, description: 'Test movie DTO', type: MovieDto })
  async testDto(): Promise<MovieDto> {
    return {
      imdbId: 'tt0000000',
      title: 'Test Movie',
      year: 2024,
      status: 'ready',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  @Get('search')
  @ApiOperation({ summary: 'Search movies using YTS API' })
  @ApiResponse({
    status: 200,
    description: 'Movies found',
    type: SearchResponseDto,
  })
  @ApiQuery({ name: 'keywords', description: 'Search keywords' })
  @ApiQuery({ name: 'page', description: 'Page number', required: false })
  async search(
    @Query('keywords') keywords: string,
    @Query('page') page: string = '1',
  ): Promise<SearchResponseDto> {
    const pageNumber = parseInt(page, 10) || 1;
    let data = await this.ytsService.search(keywords, pageNumber);

    // If YTS returns null (blocked/error), return empty array
    if (data === null) {
      console.log('YTS blocked or failed, returning empty results');
      data = [];
    }

    return { data };
  }

  @Get('search/optimized')
  @ApiOperation({ summary: 'Optimized search with caching and parallel queries' })
  @ApiResponse({
    status: 200,
    description: 'Movies found with stats',
  })
  @ApiQuery({ name: 'keywords', description: 'Search keywords' })
  @ApiQuery({ name: 'page', description: 'Page number', required: false })
  async optimizedSearch(
    @Query('keywords') keywords: string,
    @Query('page') page: string = '1',
  ): Promise<any> {
    const pageNumber = parseInt(page, 10) || 1;
    return this.optimizedSearchService.search(keywords, pageNumber);
  }

  @Delete('search/cache')
  @ApiOperation({ summary: 'Clear search cache' })
  @ApiQuery({ name: 'keywords', description: 'Clear specific keyword cache', required: false })
  async clearSearchCache(@Query('keywords') keywords?: string): Promise<{ message: string }> {
    await this.optimizedSearchService.clearCache(keywords);
    return { message: keywords ? `Cache cleared for "${keywords}"` : 'All search cache cleared' };
  }

  @Get('search/cache/stats')
  @ApiOperation({ summary: 'Get search cache statistics' })
  async getSearchCacheStats() {
    return this.optimizedSearchService.getCacheStats();
  }
  @Get('details')
  @ApiOperation({ summary: 'Get movie details by IMDB ID' })
  @ApiResponse({
    status: 200,
    description: 'Movie details',
    type: SearchResponseDto,
  })
  @ApiQuery({ name: 'imdbId', description: 'IMDB ID' })
  async details(@Query('imdbId') imdbId: string): Promise<SearchResponseDto> {
    const data = await this.ytsService.details(imdbId);
    return { data };
  }

  @Get('torrents')
  @ApiOperation({ summary: 'Get alternative torrents from TPB with seeders' })
  @ApiResponse({
    status: 200,
    description: 'Torrents from The Pirate Bay',
  })
  @ApiQuery({ name: 'query', description: 'Search query (movie title + year)' })
  async getTorrents(@Query('query') query: string) {
    if (!query) {
      throw new HttpException('query is required', HttpStatus.BAD_REQUEST);
    }

    const torrents = await this.tpbService.search(query);
    return {
      source: 'tpb',
      count: torrents.length,
      torrents,
    };
  }

  @Get('best-torrent')
  @ApiOperation({ summary: 'Get best quality torrent with seeders' })
  @ApiResponse({
    status: 200,
    description: 'Best torrent from TPB',
  })
  @ApiQuery({ name: 'title', description: 'Movie title' })
  @ApiQuery({ name: 'year', description: 'Release year', required: false })
  async getBestTorrent(@Query('title') title: string, @Query('year') year?: string) {
    if (!title) {
      throw new HttpException('title is required', HttpStatus.BAD_REQUEST);
    }

    const yearNum = year ? parseInt(year, 10) : undefined;
    const torrent = await this.tpbService.getBestTorrent(title, yearNum);

    if (!torrent) {
      throw new HttpException('No torrents found', HttpStatus.NOT_FOUND);
    }

    return torrent;
  }

  @Post('start-download')
  @ApiOperation({ summary: 'Start downloading a movie' })
  @ApiResponse({
    status: 200,
    description: 'Download started',
    type: StartDownloadResponseDto,
  })
  @ApiQuery({ name: 'imdbId', description: 'IMDB ID' })
  @ApiQuery({
    name: 'quality',
    description: 'Quality preference',
    required: false,
  })
  async startDownload(
    @Query('imdbId') imdbId: string,
    @Query('quality') quality?: string,
  ): Promise<StartDownloadResponseDto> {
    if (!imdbId) {
      throw new HttpException('imdbId is required', HttpStatus.BAD_REQUEST);
    }

    const movie = await this.ytsService.details(imdbId);
    if (!movie) {
      throw new HttpException('Movie not found', HttpStatus.NOT_FOUND);
    }

    if (!movie.torrents || movie.torrents.length === 0) {
      throw new HttpException('No torrents available for this movie', HttpStatus.NOT_FOUND);
    }

    // Allow quality selection via query param, fallback to best (largest size)
    let selectedTorrent = movie.torrents[0];
    if (quality) {
      const found = movie.torrents.find((t: any) => t.resolution === quality);
      if (found) selectedTorrent = found;
    } else {
      // Pick largest torrent if possible
      selectedTorrent = movie.torrents.reduce(
        (a: any, b: any) => (a.size > b.size ? a : b),
        movie.torrents[0],
      );
    }

    if (!selectedTorrent.magnet) {
      throw new HttpException('No magnet link found for selected torrent', HttpStatus.NOT_FOUND);
    }

    // Log download attempt
    console.log(
      `Starting download for imdbId=${imdbId}, quality=${quality || selectedTorrent.resolution}`,
    );

    try {
      const ariaResult = await this.ariaService.addUri([selectedTorrent.magnet], {});

      // Create or update movie record in database
      const movieRecord = await this.moviesService.createMovie({
        imdbId: (movie as any).imdb_id,
        title: movie.title,
        year: movie.year,
        synopsis: movie.synopsis,
        runtime: movie.runtime,
        genres: movie.genres,
        imageUrl: (movie as any).image,
        rating: movie.rating,
        trailerUrl: movie.trailer || undefined,
        ariaGid: ariaResult,
        magnetUrl: selectedTorrent.magnet,
        selectedQuality: selectedTorrent.resolution as any,
        totalSize: selectedTorrent.size,
      });

      return {
        message: 'Download started',
        imdbId,
        quality: selectedTorrent.resolution,
        ariaResult,
        movieRecord: {
          imdbId: movieRecord.imdbId,
          title: movieRecord.title,
          status: movieRecord.status as any,
          downloadProgress: movieRecord.downloadProgress?.toString(),
          transcodeProgress: movieRecord.transcodeProgress?.toString(),
          createdAt: movieRecord.createdAt?.toISOString(),
          updatedAt: movieRecord.updatedAt?.toISOString(),
        },
      };
    } catch (error) {
      console.error('Failed to start download:', error);
      throw new HttpException('Failed to start download', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('library')
  @ApiOperation({ summary: 'Get all movies in library' })
  @ApiResponse({
    status: 200,
    description: 'Movies library',
    schema: {
      type: 'array',
      items: { $ref: '#/components/schemas/MovieDto' },
    },
  })
  async getLibrary(): Promise<MovieDto[]> {
    const movies = await this.moviesService.getAllMovies();
    const fs = require('fs');
    const path = require('path');
    const { execSync } = require('child_process');

    return movies.map((movie) => {
      let transcodeProgress = movie.transcodeProgress?.toString() || '0';
      let currentQuality = '';
      let currentQualityProgress = 0;
      let canStream = false; // Flag to indicate if enough segments are available for streaming

      // Calculate accurate progress for transcoding movies
      if (movie.status === 'transcoding') {
        try {
          const hlsDir = path.join('/app/videos', `${movie.imdbId}_hls`);

          if (fs.existsSync(hlsDir)) {
            const qualities = ['480p', '720p'];
            let totalProgress = 0;
            const minSegmentsForStreaming = 30; // ~5 minutes at 10s/segment (adjustable)

            // Try to read metadata to get actual duration
            const metadataPath = path.join(hlsDir, 'metadata.json');
            let videoDuration = 11558; // Default ~3hr video duration in seconds
            const segmentTime = 10; // Updated to 10 seconds to match worker settings

            if (fs.existsSync(metadataPath)) {
              try {
                const metadataContent = fs.readFileSync(metadataPath, 'utf8');
                const metadata = JSON.parse(metadataContent);
                if (metadata.duration) {
                  videoDuration = metadata.duration;
                }
              } catch (err) {
                console.log(`[PROGRESS] Could not read metadata, using defaults`);
              }
            }

            const expectedSegments = Math.ceil(videoDuration / segmentTime);
            console.log(
              `[PROGRESS] ${movie.imdbId} - Expected segments: ${expectedSegments} (duration: ${videoDuration}s, segment: ${segmentTime}s)`,
            );

            for (let i = 0; i < qualities.length; i++) {
              const quality = qualities[i];
              const pattern = path.join(hlsDir, `output_${quality}_*.ts`);
              const playlistPath = path.join(hlsDir, `output_${quality}.m3u8`);

              try {
                const result = execSync(`ls -1 ${pattern} 2>/dev/null | wc -l`);
                const segmentCount = result.toString().trim();
                const currentSegments = parseInt(segmentCount) || 0;

                // Check if this quality is actually complete by checking for EXT-X-ENDLIST in playlist
                let isQualityComplete = false;
                if (fs.existsSync(playlistPath)) {
                  try {
                    const playlistContent = fs.readFileSync(playlistPath, 'utf8');
                    isQualityComplete = playlistContent.includes('#EXT-X-ENDLIST');
                  } catch {}
                }

                console.log(
                  `[PROGRESS] ${movie.imdbId} - ${quality}: ${currentSegments} segments${
                    isQualityComplete ? ' (COMPLETE)' : ''
                  }`,
                );

                // Check if we have enough segments for streaming (at least one quality)
                if (currentSegments >= minSegmentsForStreaming && !canStream) {
                  canStream = true;
                  console.log(
                    `[STREAMING] ${movie.imdbId} - ${quality} has ${currentSegments} segments, streaming enabled!`,
                  );
                }

                if (currentSegments > 0) {
                  const qualityWeight = 50;
                  let qualityProgress = Math.min(100, (currentSegments / expectedSegments) * 100);

                  // If quality is complete, set progress to 100%
                  if (isQualityComplete) {
                    qualityProgress = 100;
                  }

                  const weightedProgress = (qualityProgress * qualityWeight) / 100;

                  console.log(
                    `[PROGRESS] ${
                      movie.imdbId
                    } - ${quality}: ${currentSegments}/${expectedSegments} = ${qualityProgress.toFixed(
                      1,
                    )}% -> weighted: ${weightedProgress.toFixed(1)}%`,
                  );

                  totalProgress += weightedProgress;

                  // Track the current quality being transcoded
                  // Don't break if quality is complete - continue to next quality
                  if (!isQualityComplete && currentSegments > 0) {
                    currentQuality = quality;
                    currentQualityProgress = Math.round(qualityProgress);
                    // Don't break - we want to check all qualities
                  } else if (isQualityComplete) {
                    // Quality is complete, continue to next quality
                    if (i === qualities.length - 1) {
                      // Last quality completed
                      currentQuality = quality;
                      currentQualityProgress = 100;
                    }
                  }
                }
              } catch (err) {
                const error = err as Error;
                console.error(`[PROGRESS] Error counting segments for ${quality}:`, error.message);
              }
            }

            if (totalProgress > 0) {
              transcodeProgress = Math.round(totalProgress).toString();
              console.log(
                `[PROGRESS] ${movie.imdbId} - Final progress: ${transcodeProgress}% (${currentQuality} at ${currentQualityProgress}%)`,
              );
            }
          } else {
            console.log(`[PROGRESS] HLS dir not found: ${hlsDir}`);
          }
        } catch (error) {
          const err = error as Error;
          console.error(`[PROGRESS] Error calculating progress for ${movie.imdbId}:`, err.message);
          // Fall back to database value
        }
      }

      return {
        imdbId: movie.imdbId,
        title: movie.title,
        year: movie.year,
        synopsis: movie.synopsis,
        runtime: movie.runtime,
        genres: this.safeJsonParse(movie.genres),
        imageUrl: movie.imageUrl,
        rating: movie.rating?.toString(),
        trailerUrl: movie.trailerUrl,
        status: movie.status as any,
        canStream: canStream, // NEW: Indicates if streaming is available
        ariaGid: movie.ariaGid,
        magnetUrl: movie.magnetUrl,
        selectedQuality: movie.selectedQuality,
        totalSize: movie.totalSize?.toString(),
        downloadedSize: movie.downloadedSize?.toString(),
        downloadProgress: movie.downloadProgress?.toString(),
        downloadPath: movie.downloadPath,
        videoPath: movie.videoPath,
        transcodeProgress: transcodeProgress,
        currentQuality: currentQuality || undefined,
        currentQualityProgress:
          currentQualityProgress > 0 ? currentQualityProgress.toString() : undefined,
        availableQualities: this.safeJsonParse(movie.availableQualities),
        metadata: movie.metadata,
        errorMessage: movie.errorMessage,
        lastWatchedAt: movie.lastWatchedAt?.toISOString(),
        createdAt: movie.createdAt?.toISOString() || '',
        updatedAt: movie.updatedAt?.toISOString() || '',
      };
    });
  }

  @Get('status')
  @ApiOperation({ summary: 'Get movie status by IMDB ID' })
  @ApiResponse({ status: 200, description: 'Movie status', type: MovieDto })
  @ApiQuery({ name: 'imdbId', description: 'IMDB ID' })
  async getMovieStatus(@Query('imdbId') imdbId: string): Promise<MovieDto> {
    if (!imdbId) {
      throw new HttpException('imdbId is required', HttpStatus.BAD_REQUEST);
    }

    const movie = await this.moviesService.findByImdbId(imdbId);
    if (!movie) {
      throw new HttpException('Movie not found', HttpStatus.NOT_FOUND);
    }

    return {
      imdbId: movie.imdbId,
      title: movie.title,
      year: movie.year,
      synopsis: movie.synopsis,
      runtime: movie.runtime,
      genres: this.safeJsonParse(movie.genres),
      imageUrl: movie.imageUrl,
      rating: movie.rating?.toString(),
      trailerUrl: movie.trailerUrl,
      status: movie.status as any,
      ariaGid: movie.ariaGid,
      magnetUrl: movie.magnetUrl,
      selectedQuality: movie.selectedQuality,
      totalSize: movie.totalSize?.toString(),
      downloadedSize: movie.downloadedSize?.toString(),
      downloadProgress: movie.downloadProgress?.toString(),
      downloadPath: movie.downloadPath,
      videoPath: movie.videoPath,
      transcodeProgress: movie.transcodeProgress?.toString(),
      availableQualities: this.safeJsonParse(movie.availableQualities),
      metadata: movie.metadata,
      errorMessage: movie.errorMessage,
      lastWatchedAt: movie.lastWatchedAt?.toISOString(),
      createdAt: movie.createdAt?.toISOString() || '',
      updatedAt: movie.updatedAt?.toISOString() || '',
    };
  }

  @Get('transcode-status/:imdbId')
  @ApiOperation({ summary: 'Get detailed transcoding status from Redis' })
  @ApiResponse({ status: 200, description: 'Detailed transcoding status' })
  async getTranscodeStatus(@Param('imdbId') imdbId: string) {
    const movie = await this.moviesService.findByImdbId(imdbId);
    if (!movie) {
      throw new HttpException('Movie not found', HttpStatus.NOT_FOUND);
    }

    // If transcoding, calculate actual progress based on segment files
    if (movie.status === 'transcoding' && movie.videoPath) {
      try {
        const fs = require('fs');
        const path = require('path');

        // Determine HLS directory
        const hlsDir = path.join('/app/videos', `${imdbId}_hls`);

        if (fs.existsSync(hlsDir)) {
          // Count segments for the current quality being transcoded
          // Assume 480p for first quality, 720p for second
          const qualities = ['480p', '720p'];
          let totalProgress = 0;
          let currentQuality = '';

          for (let i = 0; i < qualities.length; i++) {
            const quality = qualities[i];
            const pattern = path.join(hlsDir, `output_${quality}_*.ts`);

            try {
              const { execSync } = require('child_process');
              const segmentCount = execSync(`ls -1 ${pattern} 2>/dev/null | wc -l`)
                .toString()
                .trim();
              const currentSegments = parseInt(segmentCount) || 0;

              if (currentSegments > 0) {
                // Get video metadata to calculate expected segments
                const metadataPath = path.join(hlsDir, 'metadata.json');
                const expectedSegments = 2889; // Default based on ~3hr video with 4s segments

                // Calculate progress for this quality (each quality gets 50% of total)
                const qualityWeight = 50; // Each quality is 50% of total progress
                const qualityProgress = Math.min(100, (currentSegments / expectedSegments) * 100);
                const weightedProgress = (qualityProgress * qualityWeight) / 100;

                totalProgress += weightedProgress;
                currentQuality = quality;

                // If this quality isn't complete, stop checking further qualities
                if (qualityProgress < 100) {
                  break;
                }
              }
            } catch (err) {
              console.error(`Error counting segments for ${quality}:`, err);
            }
          }

          return {
            imdbId: movie.imdbId,
            status: movie.status,
            transcodeProgress: Math.round(totalProgress).toString(),
            currentQuality: currentQuality,
            message: `Transcoding ${currentQuality}`,
          };
        }
      } catch (error) {
        console.error('Error calculating transcode progress:', error);
      }
    }

    return {
      imdbId: movie.imdbId,
      status: movie.status,
      transcodeProgress: movie.transcodeProgress?.toString() || '0',
      message:
        movie.status === 'transcoding' ? `Transcoding ${movie.selectedQuality}` : movie.status,
    };
  }

  @Post('update-progress')
  @ApiOperation({ summary: 'Update movie download progress' })
  @ApiResponse({
    status: 200,
    description: 'Progress updated',
    type: MessageResponseDto,
  })
  async updateProgress(
    @Query('imdbId') imdbId: string,
    @Query('downloadedSize') downloadedSize?: string,
    @Query('totalSize') totalSize?: string,
    @Query('downloadPath') downloadPath?: string,
    @Query('status') status?: string,
  ): Promise<MessageResponseDto> {
    if (!imdbId) {
      throw new HttpException('imdbId is required', HttpStatus.BAD_REQUEST);
    }

    const movie = await this.moviesService.findByImdbId(imdbId);
    if (!movie) {
      throw new HttpException('Movie not found', HttpStatus.NOT_FOUND);
    }

    if (downloadedSize) {
      await this.moviesService.updateDownloadProgress(
        imdbId,
        parseInt(downloadedSize),
        totalSize ? parseInt(totalSize) : undefined,
      );
    }

    if (downloadPath) {
      await this.moviesService.updateDownloadPath(imdbId, downloadPath);
    }

    if (status) {
      await this.moviesService.updateStatus(imdbId, status as any);
    }

    return { message: 'Progress updated successfully' };
  }

  @Post('update-video-path')
  @ApiOperation({ summary: 'Update movie video path' })
  @ApiResponse({
    status: 200,
    description: 'Video path updated',
    type: MessageResponseDto,
  })
  async updateVideoPath(
    @Query('imdbId') imdbId: string,
    @Query('videoPath') videoPath: string,
  ): Promise<MessageResponseDto> {
    if (!imdbId || !videoPath) {
      throw new HttpException('imdbId and videoPath are required', HttpStatus.BAD_REQUEST);
    }

    await this.moviesService.updateVideoPath(imdbId, videoPath);
    return { message: 'Video path updated successfully' };
  }

  @Post('update-transcode-progress')
  @ApiOperation({ summary: 'Update movie transcoding progress' })
  @ApiResponse({
    status: 200,
    description: 'Transcode progress updated',
    type: MessageResponseDto,
  })
  async updateTranscodeProgress(
    @Query('imdbId') imdbId: string,
    @Query('progress') progress: string,
  ): Promise<MessageResponseDto> {
    if (!imdbId || !progress) {
      throw new HttpException('imdbId and progress are required', HttpStatus.BAD_REQUEST);
    }

    await this.moviesService.updateTranscodeProgress(imdbId, parseFloat(progress));
    return { message: 'Transcode progress updated successfully' };
  }

  @Delete(':imdbId')
  @ApiOperation({ summary: 'Delete a movie by IMDB ID' })
  @ApiResponse({
    status: 200,
    description: 'Movie deleted',
    type: DeleteResponseDto,
  })
  async deleteMovie(@Param('imdbId') imdbId: string): Promise<DeleteResponseDto> {
    if (!imdbId) {
      throw new HttpException('imdbId is required', HttpStatus.BAD_REQUEST);
    }

    // First try to stop the aria2 download
    const movie = await this.moviesService.findByImdbId(imdbId);
    if (movie && movie.ariaGid) {
      try {
        await this.ariaService.removeDownload(movie.ariaGid);
        console.log(`Stopped aria2 download for ${imdbId}`);
      } catch (error) {
        console.log(`Could not stop aria2 download: ${(error as any).message}`);
      }
    }

    const deleted = await this.moviesService.deleteMovie(imdbId);
    if (!deleted) {
      throw new HttpException('Movie not found', HttpStatus.NOT_FOUND);
    }

    return { message: 'Movie deleted successfully' };
  }

  @Delete()
  @ApiOperation({ summary: 'Delete all movies' })
  @ApiResponse({
    status: 200,
    description: 'All movies deleted',
    type: DeleteResponseDto,
  })
  async deleteAllMovies(): Promise<DeleteResponseDto> {
    // Get all movies to stop their downloads
    const movies = await this.moviesService.getAllMovies();

    for (const movie of movies) {
      if (movie.ariaGid) {
        try {
          await this.ariaService.removeDownload(movie.ariaGid);
          console.log(`Stopped aria2 download for ${movie.imdbId}`);
        } catch (error) {
          console.log(`Could not stop aria2 download: ${(error as any).message}`);
        }
      }
    }

    await this.moviesService.deleteAllMovies();
    return { message: 'All movies deleted successfully' };
  }

  // HLS Streaming endpoints for movies
  @Get(':imdbId/master.m3u8')
  @Public()
  async getMovieMasterPlaylist(@Param('imdbId') imdbId: string, @Res() res: Response) {
    return this.moviesService.getMasterPlaylist(imdbId, res);
  }

  // Route for worker's flat file structure (output_480p.m3u8, output_720p.m3u8)
  @Get(':imdbId/output_:quality.m3u8')
  @Public()
  async getMovieOutputPlaylist(
    @Param('imdbId') imdbId: string,
    @Param('quality') quality: string,
    @Res() res: Response,
  ) {
    return this.moviesService.getOutputPlaylist(imdbId, quality, res);
  }

  // Route for worker's flat file structure segments (output_480p_000.ts)
  @Get(':imdbId/output_:filename')
  @Public()
  async getMovieOutputSegment(
    @Param('imdbId') imdbId: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    return this.moviesService.getOutputFile(imdbId, filename, res);
  }

  @Get(':imdbId/quality/:quality/index.m3u8')
  @Public()
  async getMovieQualityPlaylist(
    @Param('imdbId') imdbId: string,
    @Param('quality') quality: string,
    @Res() res: Response,
  ) {
    return this.moviesService.getQualityPlaylist(imdbId, quality, res);
  }

  @Get(':imdbId/quality/:quality/:segment')
  @Public()
  async getMovieSegment(
    @Param('imdbId') imdbId: string,
    @Param('quality') quality: string,
    @Param('segment') segment: string,
    @Res() res: Response,
  ) {
    return this.moviesService.getSegment(imdbId, quality, segment, res);
  }

  @Get(':imdbId/thumbnails/:thumbnailId')
  @Public()
  async getMovieThumbnail(
    @Param('imdbId') imdbId: string,
    @Param('thumbnailId') thumbnailId: string,
    @Res() res: Response,
  ) {
    return this.moviesService.getThumbnail(imdbId, thumbnailId, res);
  }
}
