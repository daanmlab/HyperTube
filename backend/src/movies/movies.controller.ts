import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import * as fs from 'fs';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MovieStatus } from '../entities/movie.entity';
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
@Public()
@ApiBearerAuth()
@ApiExtraModels(
  MovieDto,
  StartDownloadResponseDto,
  MessageResponseDto,
  SearchResponseDto,
  DeleteResponseDto
)
export class MoviesController {
  constructor(
    private readonly ytsService: YtsService,
    private readonly ariaService: AriaService,
    private readonly moviesService: MoviesService,
    private readonly tpbService: TpbService,
    private readonly optimizedSearchService: OptimizedSearchService
  ) {}

  /**
   * Safely parse JSON string, handling cases where value is already parsed or invalid
   */
  private safeJsonParse(value: any): any {
    if (!value) return undefined;
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      if (value.includes(',')) {
        return value.split(',').map((item: string) => item.trim());
      }
      return value; 
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
    @Query('page') page: string = '1'
  ): Promise<SearchResponseDto> {
    const pageNumber = parseInt(page, 10) || 1;
    let data = await this.ytsService.search(keywords, pageNumber);

    if (data === null) {
      console.log('YTS blocked or failed, returning empty results');
      data = [];
    }

    return { data };
  }

  @Get('search/optimized')
  @ApiOperation({
    summary: 'Optimized search with caching and parallel queries',
  })
  @ApiResponse({
    status: 200,
    description: 'Movies found with stats',
  })
  @ApiQuery({ name: 'keywords', description: 'Search keywords' })
  @ApiQuery({ name: 'page', description: 'Page number', required: false })
  async optimizedSearch(
    @Query('keywords') keywords: string,
    @Query('page') page: string = '1'
  ): Promise<any> {
    const pageNumber = parseInt(page, 10) || 1;
    return this.optimizedSearchService.search(keywords, pageNumber);
  }

  @Delete('search/cache')
  @ApiOperation({ summary: 'Clear search cache' })
  @ApiQuery({
    name: 'keywords',
    description: 'Clear specific keyword cache',
    required: false,
  })
  async clearSearchCache(
    @Query('keywords') keywords?: string
  ): Promise<{ message: string }> {
    await this.optimizedSearchService.clearCache(keywords);
    return {
      message: keywords
        ? `Cache cleared for "${keywords}"`
        : 'All search cache cleared',
    };
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
  async getBestTorrent(
    @Query('title') title: string,
    @Query('year') year?: string
  ) {
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
    @Query('quality') quality?: string
  ): Promise<StartDownloadResponseDto> {
    if (!imdbId) {
      throw new HttpException('imdbId is required', HttpStatus.BAD_REQUEST);
    }

    const movie = await this.ytsService.details(imdbId);
    if (!movie) {
      throw new HttpException('Movie not found', HttpStatus.NOT_FOUND);
    }

    if (!movie.torrents || movie.torrents.length === 0) {
      throw new HttpException(
        'No torrents available for this movie',
        HttpStatus.NOT_FOUND
      );
    }

    let selectedTorrent = movie.torrents[0];
    if (quality) {
      const found = movie.torrents.find((t: any) => t.resolution === quality);
      if (found) selectedTorrent = found;
    } else {
      selectedTorrent = movie.torrents.reduce(
        (a: any, b: any) => (a.size > b.size ? a : b),
        movie.torrents[0]
      );
    }

    if (!selectedTorrent.magnet) {
      throw new HttpException(
        'No magnet link found for selected torrent',
        HttpStatus.NOT_FOUND
      );
    }

    console.log(
      `Starting download for imdbId=${imdbId}, quality=${
        quality || selectedTorrent.resolution
      }`
    );

    try {
      const ariaResult = await this.ariaService.addUri(
        [selectedTorrent.magnet],
        {}
      );

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
      throw new HttpException(
        'Failed to start download',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
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

    return movies.map(movie => {
      let transcodeProgress = movie.transcodeProgress?.toString() || '0';
      let canStream = false;

      if (movie.transcodedPath && fs.existsSync(movie.transcodedPath)) {
        const stats = fs.statSync(movie.transcodedPath);
        if (stats.size > 1024 * 1024) {
          canStream = true;
        }
        
        if (movie.isFullyTranscoded) {
          transcodeProgress = '100';
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
        canStream,
        ariaGid: movie.ariaGid,
        magnetUrl: movie.magnetUrl,
        selectedQuality: movie.selectedQuality,
        totalSize: movie.totalSize?.toString(),
        downloadedSize: movie.downloadedSize?.toString(),
        downloadProgress: movie.downloadProgress?.toString(),
        downloadPath: movie.downloadPath,
        videoPath: movie.videoPath,
        transcodeProgress: transcodeProgress,
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
              const segmentCount = execSync(
                `ls -1 ${pattern} 2>/dev/null | wc -l`
              )
                .toString()
                .trim();
              const currentSegments = parseInt(segmentCount) || 0;

              if (currentSegments > 0) {
                // Get video metadata to calculate expected segments
                const metadataPath = path.join(hlsDir, 'metadata.json');
                const expectedSegments = 2889; // Default based on ~3hr video with 4s segments

                // Calculate progress for this quality (each quality gets 50% of total)
                const qualityWeight = 50; // Each quality is 50% of total progress
                const qualityProgress = Math.min(
                  100,
                  (currentSegments / expectedSegments) * 100
                );
                const weightedProgress =
                  (qualityProgress * qualityWeight) / 100;

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
        movie.status === 'transcoding'
          ? `Transcoding ${movie.selectedQuality}`
          : movie.status,
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
    @Query('status') status?: string
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
        totalSize ? parseInt(totalSize) : undefined
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
    @Query('videoPath') videoPath: string
  ): Promise<MessageResponseDto> {
    if (!imdbId || !videoPath) {
      throw new HttpException(
        'imdbId and videoPath are required',
        HttpStatus.BAD_REQUEST
      );
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
    @Query('progress') progress: string
  ): Promise<MessageResponseDto> {
    if (!imdbId || !progress) {
      throw new HttpException(
        'imdbId and progress are required',
        HttpStatus.BAD_REQUEST
      );
    }

    await this.moviesService.updateTranscodeProgress(
      imdbId,
      parseFloat(progress)
    );
    return { message: 'Transcode progress updated successfully' };
  }

  @Delete(':imdbId')
  @ApiOperation({ summary: 'Delete a movie by IMDB ID' })
  @ApiResponse({
    status: 200,
    description: 'Movie deleted',
    type: DeleteResponseDto,
  })
  async deleteMovie(
    @Param('imdbId') imdbId: string
  ): Promise<DeleteResponseDto> {
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
          console.log(
            `Could not stop aria2 download: ${(error as any).message}`
          );
        }
      }
    }

    await this.moviesService.deleteAllMovies();
    return { message: 'All movies deleted successfully' };
  }

  // MP4 Streaming endpoint
  @Get(':imdbId/stream')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Stream movie as MP4 with Range support' })
  @ApiResponse({ status: 200, description: 'MP4 video stream' })
  @ApiResponse({ status: 404, description: 'Movie not found' })
  @ApiResponse({
    status: 409,
    description: 'Movie still downloading or transcoding',
  })
  async streamMovie(
    @Param('imdbId') imdbId: string,
    @Headers('range') range: string,
    @Res() res: Response
  ) {
    const movie = await this.moviesService.findByImdbId(imdbId);

    if (!movie) {
      throw new HttpException('Movie not found', HttpStatus.NOT_FOUND);
    }

    // Update lastWatchedAt
    await this.moviesService.updateLastWatched(imdbId);

    // Check if download is still in progress
    if (movie.status === MovieStatus.DOWNLOADING) {
      throw new HttpException(
        'Movie is still downloading. Please wait.',
        HttpStatus.CONFLICT
      );
    }

    const videoPath = movie.downloadPath || movie.videoPath;
    if (!videoPath || !fs.existsSync(videoPath)) {
      throw new HttpException('Video file not found', HttpStatus.NOT_FOUND);
    }

    if (movie.transcodedPath && fs.existsSync(movie.transcodedPath)) {
      return this.serveCachedMP4(movie.transcodedPath, range, res);
    }

    if (movie.status !== MovieStatus.TRANSCODING && movie.status !== MovieStatus.READY) {
      await this.moviesService.triggerTranscoding(imdbId, videoPath);
    }

    return res.status(HttpStatus.ACCEPTED).json({
      message: 'Transcoding in progress. MP4 file will be available shortly.',
      status: 'transcoding',
      progress: movie.transcodeProgress || 0,
    });
  }

  private serveCachedMP4(filePath: string, range: string, res: Response): void {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4',
        'Access-Control-Allow-Origin': '*',
      });

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
      });

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    }
  }

  @Post('update-cache')
  @ApiOperation({ summary: 'Update MP4 cache information after transcoding' })
  @ApiResponse({
    status: 200,
    description: 'Cache updated',
    type: MessageResponseDto,
  })
  async updateCache(
    @Body()
    body: {
      imdbId: string;
      transcodedPath: string;
      isFullyTranscoded: boolean;
    }
  ): Promise<MessageResponseDto> {
    await this.moviesService.updateCache(
      body.imdbId,
      body.transcodedPath,
      body.isFullyTranscoded
    );

    return { message: 'Cache updated successfully' };
  }

  // HLS Streaming endpoints for movies
  @Get(':imdbId/master.m3u8')
  @Public()
  async getMovieMasterPlaylist(
    @Param('imdbId') imdbId: string,
    @Res() res: Response
  ) {
    return this.moviesService.getMasterPlaylist(imdbId, res);
  }

  // Route for worker's flat file structure (output_480p.m3u8, output_720p.m3u8)
  @Get(':imdbId/output_:quality.m3u8')
  @Public()
  async getMovieOutputPlaylist(
    @Param('imdbId') imdbId: string,
    @Param('quality') quality: string,
    @Res() res: Response
  ) {
    return this.moviesService.getOutputPlaylist(imdbId, quality, res);
  }

  // Route for worker's flat file structure segments (output_480p_000.ts)
  @Get(':imdbId/output_:filename')
  @Public()
  async getMovieOutputSegment(
    @Param('imdbId') imdbId: string,
    @Param('filename') filename: string,
    @Res() res: Response
  ) {
    return this.moviesService.getOutputFile(imdbId, filename, res);
  }

  @Get(':imdbId/quality/:quality/index.m3u8')
  @Public()
  async getMovieQualityPlaylist(
    @Param('imdbId') imdbId: string,
    @Param('quality') quality: string,
    @Res() res: Response
  ) {
    return this.moviesService.getQualityPlaylist(imdbId, quality, res);
  }

  @Get(':imdbId/quality/:quality/:segment')
  @Public()
  async getMovieSegment(
    @Param('imdbId') imdbId: string,
    @Param('quality') quality: string,
    @Param('segment') segment: string,
    @Res() res: Response
  ) {
    return this.moviesService.getSegment(imdbId, quality, segment, res);
  }

  @Get(':imdbId/thumbnails/:thumbnailId')
  @Public()
  async getMovieThumbnail(
    @Param('imdbId') imdbId: string,
    @Param('thumbnailId') thumbnailId: string,
    @Res() res: Response
  ) {
    return this.moviesService.getThumbnail(imdbId, thumbnailId, res);
  }
}
