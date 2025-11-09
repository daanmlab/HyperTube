import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Response } from 'express';
import * as fs from 'fs';

import * as path from 'path';
import type { Repository } from 'typeorm';
import { Movie, MovieStatus, type TorrentQuality } from '../entities/movie.entity';

/**
 * Data Transfer Object for creating a new movie entry
 */
export interface CreateMovieDto {
  imdbId: string;
  title: string;
  year: number;
  synopsis?: string;
  runtime?: number;
  genres?: string[];
  imageUrl?: string;
  rating?: number;
  trailerUrl?: string;
  ariaGid: string;
  magnetUrl: string;
  selectedQuality: TorrentQuality;
  totalSize?: number;
}

/**
 * Quality variant configuration for HLS streaming
 */
interface QualityVariant {
  name: string;
  bandwidth: number;
  resolution: string;
}

/**
 * Constants for HLS streaming configuration
 */
const HLS_CONSTANTS = {
  VIDEO_BASE_PATH: '/app/videos',
  HLS_SUFFIX: '_hls',
  MASTER_PLAYLIST_VERSION: 3,
  CONTENT_TYPES: {
    M3U8: 'application/vnd.apple.mpegurl',
    MP2T: 'video/mp2t',
    PNG: 'image/png',
  },
  CACHE_CONTROL: {
    NO_CACHE: 'no-cache',
  },
} as const;

/**
 * Available quality variants for HLS streaming
 */
const QUALITY_VARIANTS: readonly QualityVariant[] = [
  { name: '360p', bandwidth: 800_000, resolution: '640x360' },
  { name: '480p', bandwidth: 1_000_000, resolution: '854x480' },
  { name: '720p', bandwidth: 2_000_000, resolution: '1280x720' },
  { name: '1080p', bandwidth: 5_000_000, resolution: '1920x1080' },
  { name: '1440p', bandwidth: 10_000_000, resolution: '2560x1440' },
  { name: '2160p', bandwidth: 20_000_000, resolution: '3840x2160' },
] as const;

/**
 * Service responsible for managing movie downloads, transcoding, and HLS streaming
 */
@Injectable()
export class MoviesService {
  private readonly logger = new Logger(MoviesService.name);

  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
  ) {}

  /**
   * Creates a new movie or updates an existing one
   * If a movie with the same IMDB ID exists, resets its download status
   */
  async createMovie(createMovieDto: CreateMovieDto): Promise<Movie> {
    const existingMovie = await this.movieRepository.findOne({
      where: { imdbId: createMovieDto.imdbId },
    });

    if (existingMovie) {
      return this.updateExistingMovieForRedownload(existingMovie, createMovieDto);
    }

    return this.createNewMovie(createMovieDto);
  }

  /**
   * Updates an existing movie to restart the download process
   */
  private async updateExistingMovieForRedownload(
    movie: Movie,
    dto: CreateMovieDto,
  ): Promise<Movie> {
    movie.status = MovieStatus.DOWNLOADING;
    movie.ariaGid = dto.ariaGid;
    movie.magnetUrl = dto.magnetUrl;
    movie.selectedQuality = dto.selectedQuality;
    movie.totalSize = dto.totalSize ?? movie.totalSize;
    movie.downloadedSize = 0;
    movie.downloadProgress = 0;
    movie.transcodeProgress = 0;
    movie.errorMessage = undefined;

    return this.movieRepository.save(movie);
  }

  /**
   * Creates a new movie entity
   */
  private async createNewMovie(dto: CreateMovieDto): Promise<Movie> {
    const movie = this.movieRepository.create({
      imdbId: dto.imdbId,
      title: dto.title,
      year: dto.year,
      synopsis: dto.synopsis,
      runtime: dto.runtime,
      genres: dto.genres ? JSON.stringify(dto.genres) : undefined,
      imageUrl: dto.imageUrl,
      rating: dto.rating,
      trailerUrl: dto.trailerUrl,
      ariaGid: dto.ariaGid,
      magnetUrl: dto.magnetUrl,
      selectedQuality: dto.selectedQuality,
      totalSize: dto.totalSize,
      status: MovieStatus.DOWNLOADING,
      downloadedSize: 0,
      downloadProgress: 0,
      transcodeProgress: 0,
    });

    return this.movieRepository.save(movie);
  }

  /**
   * Finds a movie by its IMDB ID
   */
  async findByImdbId(imdbId: string): Promise<Movie | null> {
    return this.movieRepository.findOne({ where: { imdbId } });
  }

  /**
   * Finds a movie by its Aria2 GID
   */
  async findByAriaGid(ariaGid: string): Promise<Movie | null> {
    return this.movieRepository.findOne({ where: { ariaGid } });
  }

  /**
   * Updates download progress for a movie
   */
  async updateDownloadProgress(
    imdbId: string,
    downloadedSize: number,
    totalSize?: number,
  ): Promise<Movie | null> {
    const movie = await this.findByImdbId(imdbId);
    if (!movie) {
      this.logger.warn(`Movie not found for download progress update: ${imdbId}`);
      return null;
    }

    if (totalSize) {
      movie.totalSize = totalSize;
    }

    movie.downloadedSize = downloadedSize;

    if (movie.totalSize && movie.totalSize > 0) {
      movie.downloadProgress = Number(((downloadedSize / movie.totalSize) * 100).toFixed(2));
    }

    return this.movieRepository.save(movie);
  }

  /**
   * Updates the status of a movie
   */
  async updateStatus(imdbId: string, status: MovieStatus): Promise<Movie | null> {
    const movie = await this.findByImdbId(imdbId);
    if (!movie) {
      this.logger.warn(`Movie not found for status update: ${imdbId}`);
      return null;
    }

    movie.status = status;
    return this.movieRepository.save(movie);
  }

  /**
   * Updates transcode progress for a movie
   */
  async updateTranscodeProgress(imdbId: string, progress: number): Promise<Movie | null> {
    const movie = await this.findByImdbId(imdbId);
    if (!movie) {
      this.logger.warn(`Movie not found for transcode progress update: ${imdbId}`);
      return null;
    }

    movie.transcodeProgress = progress;
    return this.movieRepository.save(movie);
  }

  /**
   * Updates the video path for a movie
   */
  async updateVideoPath(imdbId: string, videoPath: string): Promise<Movie | null> {
    const movie = await this.findByImdbId(imdbId);
    if (!movie) {
      this.logger.warn(`Movie not found for video path update: ${imdbId}`);
      return null;
    }

    movie.videoPath = videoPath;
    return this.movieRepository.save(movie);
  }

  /**
   * Updates the download path for a movie
   */
  async updateDownloadPath(imdbId: string, downloadPath: string): Promise<Movie | null> {
    const movie = await this.findByImdbId(imdbId);
    if (!movie) {
      this.logger.warn(`Movie not found for download path update: ${imdbId}`);
      return null;
    }

    movie.downloadPath = downloadPath;
    return this.movieRepository.save(movie);
  }

  /**
   * Sets error status and message for a movie
   */
  async setError(imdbId: string, errorMessage: string): Promise<Movie | null> {
    const movie = await this.findByImdbId(imdbId);
    if (!movie) {
      this.logger.warn(`Movie not found for error update: ${imdbId}`);
      return null;
    }

    movie.status = MovieStatus.ERROR;
    movie.errorMessage = errorMessage;
    this.logger.error(`Movie ${imdbId} encountered error: ${errorMessage}`);
    return this.movieRepository.save(movie);
  }

  /**
   * Updates the lastWatchedAt timestamp for a movie
   */
  async updateLastWatched(imdbId: string): Promise<Movie | null> {
    const movie = await this.findByImdbId(imdbId);
    if (!movie) {
      this.logger.warn(`Movie not found for lastWatchedAt update: ${imdbId}`);
      return null;
    }

    movie.lastWatchedAt = new Date();
    return this.movieRepository.save(movie);
  }

  /**
   * Triggers on-demand MP4 transcoding for a movie
   * Runs asynchronously in the background using child_process
   */
  async triggerTranscoding(imdbId: string, inputPath: string): Promise<void> {
    const outputPath = path.join('/app/videos', `${imdbId}.mp4`);
    const tempPath = path.join('/app/videos', `${imdbId}_temp.mp4`);

    this.logger.log(`Starting transcoding for ${imdbId}: ${inputPath} -> ${outputPath}`);

    // Update status
    await this.updateStatus(imdbId, MovieStatus.TRANSCODING);

    // Run transcoding in background (non-blocking)
    this.transcodeInBackground(imdbId, inputPath, tempPath, outputPath);
  }

  /**
   * Transcode video using FFmpeg child process
   * Runs asynchronously without blocking the request
   */
  private transcodeInBackground(
    imdbId: string,
    inputPath: string,
    tempPath: string,
    finalPath: string,
  ): void {
    // Run async after a tick to not block the response
    setImmediate(async () => {
      try {
        await this.transcodeMovie(imdbId, inputPath, tempPath, finalPath);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Transcoding failed for ${imdbId}: ${errorMessage}`);
        await this.setError(imdbId, `Transcoding failed: ${errorMessage}`);
      }
    });
  }

  /**
   * Execute FFmpeg transcoding using child_process
   */
  private async transcodeMovie(
    imdbId: string,
    inputPath: string,
    tempPath: string,
    finalPath: string,
  ): Promise<void> {
    const { spawn } = await import('child_process');

    return new Promise((resolve, reject) => {
      // Validate input file
      if (!fs.existsSync(inputPath)) {
        reject(new Error(`Input file not found: ${inputPath}`));
        return;
      }

      const stats = fs.statSync(inputPath);
      if (stats.size === 0) {
        reject(new Error(`Input file is empty: ${inputPath}`));
        return;
      }

      this.logger.log(`Input validated: ${stats.size} bytes`);

      // Spawn FFmpeg process
      const ffmpeg = spawn('ffmpeg', [
        '-i',
        inputPath,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast', // Fast encoding
        '-crf',
        '23', // Good quality
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-ac',
        '2',
        '-ar',
        '44100',
        '-movflags',
        '+faststart', // Web streaming optimization
        '-pix_fmt',
        'yuv420p', // Browser compatibility
        '-vf',
        'scale=1280:720', // 720p
        '-y', // Overwrite output
        tempPath,
      ]);

      let lastProgress = 0;

      // Parse FFmpeg stderr for progress
      ffmpeg.stderr.on('data', async (data: Buffer) => {
        const output = data.toString();

        // Extract time progress: time=00:01:23.45
        const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1]);
          const minutes = parseInt(timeMatch[2]);
          const seconds = parseInt(timeMatch[3]);
          const currentSeconds = hours * 3600 + minutes * 60 + seconds;

          // Estimate progress (assuming ~2 hour movie = 7200 seconds)
          const estimatedDuration = 7200;
          const progress = Math.min(95, Math.round((currentSeconds / estimatedDuration) * 100));

          // Update every 5%
          if (progress >= lastProgress + 5) {
            lastProgress = progress;
            this.logger.log(`Transcoding ${imdbId}: ${progress}%`);
            await this.updateTranscodeProgress(imdbId, progress);
          }
        }
      });

      ffmpeg.on('close', async (code) => {
        if (code === 0) {
          this.logger.log(`✅ Transcoding complete for ${imdbId}`);

          // Rename temp to final
          try {
            fs.renameSync(tempPath, finalPath);
            this.logger.log(`Renamed ${tempPath} -> ${finalPath}`);

            // Update database
            await this.updateCache(imdbId, finalPath, true);
            await this.updateTranscodeProgress(imdbId, 100);

            resolve();
          } catch (error) {
            reject(error);
          }
        } else {
          this.logger.error(`❌ FFmpeg exited with code ${code}`);

          // Cleanup temp file
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }

          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });

      ffmpeg.on('error', (error) => {
        this.logger.error(`FFmpeg spawn error: ${error.message}`);
        reject(error);
      });
    });
  }

  /**
   * Updates MP4 cache information after transcoding completes
   */
  async updateCache(
    imdbId: string,
    transcodedPath: string,
    isFullyTranscoded: boolean,
  ): Promise<Movie | null> {
    const movie = await this.findByImdbId(imdbId);
    if (!movie) {
      this.logger.warn(`Movie not found for cache update: ${imdbId}`);
      return null;
    }

    movie.transcodedPath = transcodedPath;
    movie.isFullyTranscoded = isFullyTranscoded;
    movie.cacheCreatedAt = new Date();
    movie.status = MovieStatus.READY;

    this.logger.log(`Cache updated for ${imdbId}: ${transcodedPath}`);
    return this.movieRepository.save(movie);
  }

  /**
   * Retrieves all movies, ordered by creation date (newest first)
   */
  async getAllMovies(): Promise<Movie[]> {
    return this.movieRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Retrieves all movies currently being downloaded
   */
  async getDownloadingMovies(): Promise<Movie[]> {
    return this.movieRepository.find({
      where: { status: MovieStatus.DOWNLOADING },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Retrieves all movies that are ready for streaming
   */
  async getReadyMovies(): Promise<Movie[]> {
    return this.movieRepository.find({
      where: { status: MovieStatus.READY },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Deletes a movie by IMDB ID
   */
  async deleteMovie(imdbId: string): Promise<boolean> {
    const movie = await this.findByImdbId(imdbId);
    if (!movie) {
      this.logger.warn(`Movie not found for deletion: ${imdbId}`);
      return false;
    }

    await this.movieRepository.remove(movie);
    this.logger.log(`Movie deleted: ${imdbId}`);
    return true;
  }

  /**
   * Deletes all movies from the database
   * Use with caution!
   */
  async deleteAllMovies(): Promise<void> {
    await this.movieRepository.clear();
    this.logger.warn('All movies have been deleted from the database');
  }

  // ========================================
  // HLS Streaming Methods
  // ========================================

  /**
   * Gets the HLS directory path for a movie
   */
  private getMovieHlsPath(imdbId: string): string {
    return path.join(HLS_CONSTANTS.VIDEO_BASE_PATH, `${imdbId}${HLS_CONSTANTS.HLS_SUFFIX}`);
  }

  /**
   * Gets available quality variants for a movie
   */
  private async getAvailableQualities(hlsPath: string): Promise<QualityVariant[]> {
    const availableQualities = QUALITY_VARIANTS.filter((quality) => {
      const playlistPath = path.join(hlsPath, `output_${quality.name}.m3u8`);
      const exists = fs.existsSync(playlistPath);
      this.logger.debug(`Checking ${quality.name} at ${playlistPath}: ${exists}`);
      return exists;
    });

    return availableQualities;
  }

  /**
   * Generates HLS master playlist content
   */
  private generateMasterPlaylistContent(qualities: QualityVariant[]): string {
    let playlist = `#EXTM3U\n#EXT-X-VERSION:${HLS_CONSTANTS.MASTER_PLAYLIST_VERSION}\n\n`;

    for (const quality of qualities) {
      playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${quality.bandwidth},RESOLUTION=${quality.resolution}\n`;
      playlist += `output_${quality.name}.m3u8\n\n`;
    }

    return playlist;
  }

  /**
   * Serves the HLS master playlist for a movie
   * The master playlist contains references to all available quality variants
   */
  async getMasterPlaylist(imdbId: string, res: Response): Promise<void> {
    const movie = await this.findByImdbId(imdbId);
    if (!movie) {
      throw new NotFoundException('Movie not found');
    }

    const hlsPath = this.getMovieHlsPath(imdbId);
    const availableQualities = await this.getAvailableQualities(hlsPath);

    if (availableQualities.length === 0) {
      throw new NotFoundException(
        'No quality variants available yet - movie may still be transcoding',
      );
    }

    const masterPlaylist = this.generateMasterPlaylistContent(availableQualities);

    res.setHeader('Content-Type', HLS_CONSTANTS.CONTENT_TYPES.M3U8);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', HLS_CONSTANTS.CACHE_CONTROL.NO_CACHE);
    res.send(masterPlaylist);
  }

  /**
   * Serves a quality-specific playlist file
   */
  async getOutputPlaylist(imdbId: string, quality: string, res: Response): Promise<void> {
    const movie = await this.findByImdbId(imdbId);
    if (!movie) {
      throw new NotFoundException('Movie not found');
    }

    const hlsPath = this.getMovieHlsPath(imdbId);
    const playlistPath = path.join(hlsPath, `output_${quality}.m3u8`);

    if (!fs.existsSync(playlistPath)) {
      throw new NotFoundException(`Quality playlist not found: output_${quality}.m3u8`);
    }

    res.setHeader('Content-Type', HLS_CONSTANTS.CONTENT_TYPES.M3U8);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(playlistPath);
  }

  /**
   * Serves a video segment file for a specific quality
   */
  async getOutputSegment(
    imdbId: string,
    quality: string,
    segment: string,
    res: Response,
  ): Promise<void> {
    const movie = await this.findByImdbId(imdbId);
    if (!movie) {
      throw new NotFoundException('Movie not found');
    }

    const hlsPath = this.getMovieHlsPath(imdbId);
    const segmentPath = path.join(hlsPath, `output_${quality}_${segment}`);

    if (!fs.existsSync(segmentPath)) {
      throw new NotFoundException(`Segment not found: output_${quality}_${segment}`);
    }

    res.setHeader('Content-Type', HLS_CONSTANTS.CONTENT_TYPES.MP2T);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(segmentPath);
  }

  /**
   * Serves any HLS output file (playlist or segment)
   */
  async getOutputFile(imdbId: string, filename: string, res: Response): Promise<void> {
    const movie = await this.findByImdbId(imdbId);
    if (!movie) {
      throw new NotFoundException('Movie not found');
    }

    const hlsPath = this.getMovieHlsPath(imdbId);
    const filePath = path.join(hlsPath, `output_${filename}`);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`File not found: output_${filename}`);
    }

    const contentType = filename.endsWith('.m3u8')
      ? HLS_CONSTANTS.CONTENT_TYPES.M3U8
      : HLS_CONSTANTS.CONTENT_TYPES.MP2T;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(filePath);
  }

  /**
   * Serves a quality-specific playlist (legacy method)
   * @deprecated Use getOutputPlaylist instead
   */
  async getQualityPlaylist(imdbId: string, quality: string, res: Response): Promise<void> {
    const movie = await this.findByImdbId(imdbId);
    if (!movie) {
      throw new NotFoundException('Movie not found');
    }

    const hlsPath = this.getMovieHlsPath(imdbId);
    const playlistPath = path.join(hlsPath, quality, 'index.m3u8');

    if (!fs.existsSync(playlistPath)) {
      throw new NotFoundException(`Quality playlist not found: ${quality}`);
    }

    res.setHeader('Content-Type', HLS_CONSTANTS.CONTENT_TYPES.M3U8);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(playlistPath);
  }

  /**
   * Serves a video segment (legacy method)
   * @deprecated Use getOutputSegment instead
   */
  async getSegment(imdbId: string, quality: string, segment: string, res: Response): Promise<void> {
    const movie = await this.findByImdbId(imdbId);
    if (!movie) {
      throw new NotFoundException('Movie not found');
    }

    const hlsPath = this.getMovieHlsPath(imdbId);
    const segmentPath = path.join(hlsPath, quality, segment);

    if (!fs.existsSync(segmentPath)) {
      throw new NotFoundException(`Segment not found: ${segment}`);
    }

    res.setHeader('Content-Type', HLS_CONSTANTS.CONTENT_TYPES.MP2T);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(segmentPath);
  }

  /**
   * Serves a thumbnail image for video scrubbing
   */
  async getThumbnail(imdbId: string, thumbnailId: string, res: Response): Promise<void> {
    const movie = await this.findByImdbId(imdbId);
    if (!movie) {
      throw new NotFoundException('Movie not found');
    }

    const hlsPath = this.getMovieHlsPath(imdbId);
    const thumbnailPath = path.join(hlsPath, 'thumbnails', `${thumbnailId}.png`);

    if (!fs.existsSync(thumbnailPath)) {
      throw new NotFoundException(`Thumbnail not found: ${thumbnailId}`);
    }

    res.setHeader('Content-Type', HLS_CONSTANTS.CONTENT_TYPES.PNG);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(thumbnailPath);
  }
}
