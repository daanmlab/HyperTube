import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { Movie, MovieStatus, TorrentQuality } from '../entities/movie.entity';

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

@Injectable()
export class MoviesService {
  constructor(
    @InjectRepository(Movie)
    private movieRepository: Repository<Movie>,
  ) {}

  async createMovie(createMovieDto: CreateMovieDto): Promise<Movie> {
    const existingMovie = await this.movieRepository.findOne({
      where: { imdbId: createMovieDto.imdbId },
    });

    if (existingMovie) {
      // Update existing movie with new download
      existingMovie.status = MovieStatus.DOWNLOADING;
      existingMovie.ariaGid = createMovieDto.ariaGid;
      existingMovie.magnetUrl = createMovieDto.magnetUrl;
      existingMovie.selectedQuality = createMovieDto.selectedQuality;
      if (createMovieDto.totalSize) {
        existingMovie.totalSize = createMovieDto.totalSize;
      }
      existingMovie.downloadedSize = 0;
      existingMovie.downloadProgress = 0;
      existingMovie.transcodeProgress = 0;
      existingMovie.errorMessage = undefined;
      return this.movieRepository.save(existingMovie);
    }

    const movie = this.movieRepository.create({
      imdbId: createMovieDto.imdbId,
      title: createMovieDto.title,
      year: createMovieDto.year,
      synopsis: createMovieDto.synopsis,
      runtime: createMovieDto.runtime,
      genres: createMovieDto.genres ? JSON.stringify(createMovieDto.genres) : undefined,
      imageUrl: createMovieDto.imageUrl,
      rating: createMovieDto.rating,
      trailerUrl: createMovieDto.trailerUrl,
      ariaGid: createMovieDto.ariaGid,
      magnetUrl: createMovieDto.magnetUrl,
      selectedQuality: createMovieDto.selectedQuality,
      totalSize: createMovieDto.totalSize,
      status: MovieStatus.DOWNLOADING,
      downloadedSize: 0,
      downloadProgress: 0,
      transcodeProgress: 0,
    });

    return this.movieRepository.save(movie);
  }

  async findByImdbId(imdbId: string): Promise<Movie | null> {
    return this.movieRepository.findOne({ where: { imdbId } });
  }

  async findByAriaGid(ariaGid: string): Promise<Movie | null> {
    return this.movieRepository.findOne({ where: { ariaGid } });
  }

  async updateDownloadProgress(
    imdbId: string,
    downloadedSize: number,
    totalSize?: number,
  ): Promise<Movie | null> {
    const movie = await this.findByImdbId(imdbId);
    if (!movie) return null;

    if (totalSize) {
      movie.totalSize = totalSize;
    }

    movie.downloadedSize = downloadedSize;
    if (movie.totalSize && movie.totalSize > 0) {
      movie.downloadProgress = Number(
        ((downloadedSize / movie.totalSize) * 100).toFixed(2),
      );
    }

    return this.movieRepository.save(movie);
  }

  async updateStatus(imdbId: string, status: MovieStatus): Promise<Movie | null> {
    const movie = await this.findByImdbId(imdbId);
    if (!movie) return null;

    movie.status = status;
    return this.movieRepository.save(movie);
  }

  async updateTranscodeProgress(
    imdbId: string,
    progress: number,
  ): Promise<Movie | null> {
    const movie = await this.findByImdbId(imdbId);
    if (!movie) return null;

    movie.transcodeProgress = progress;
    return this.movieRepository.save(movie);
  }

  async updateVideoPath(imdbId: string, videoPath: string): Promise<Movie | null> {
    const movie = await this.findByImdbId(imdbId);
    if (!movie) return null;

    movie.videoPath = videoPath;
    return this.movieRepository.save(movie);
  }

  async updateDownloadPath(imdbId: string, downloadPath: string): Promise<Movie | null> {
    const movie = await this.findByImdbId(imdbId);
    if (!movie) return null;

    movie.downloadPath = downloadPath;
    return this.movieRepository.save(movie);
  }

  async setError(imdbId: string, errorMessage: string): Promise<Movie | null> {
    const movie = await this.findByImdbId(imdbId);
    if (!movie) return null;

    movie.status = MovieStatus.ERROR;
    movie.errorMessage = errorMessage;
    return this.movieRepository.save(movie);
  }

  async getAllMovies(): Promise<Movie[]> {
    return this.movieRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getDownloadingMovies(): Promise<Movie[]> {
    return this.movieRepository.find({
      where: { status: MovieStatus.DOWNLOADING },
      order: { createdAt: 'DESC' },
    });
  }

  async getReadyMovies(): Promise<Movie[]> {
    return this.movieRepository.find({
      where: { status: MovieStatus.READY },
      order: { createdAt: 'DESC' },
    });
  }

  async deleteMovie(imdbId: string): Promise<boolean> {
    const movie = await this.findByImdbId(imdbId);
    if (!movie) return false;

    await this.movieRepository.remove(movie);
    return true;
  }

  async deleteAllMovies(): Promise<void> {
    await this.movieRepository.clear();
  }

  // HLS Streaming methods for movies
  private getMovieHlsPath(imdbId: string): string {
    return path.join('/app/videos', `${imdbId}_hls`);
  }

  async getMasterPlaylist(imdbId: string, res: Response): Promise<void> {
    const movie = await this.findByImdbId(imdbId);
    if (!movie) {
      throw new NotFoundException('Movie not found');
    }

    const hlsPath = this.getMovieHlsPath(imdbId);
    const masterPath = path.join(hlsPath, 'master.m3u8');

    if (!fs.existsSync(masterPath)) {
      throw new NotFoundException('Master playlist not found - movie may still be transcoding');
    }

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(masterPath);
  }

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

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(playlistPath);
  }

  async getOutputSegment(imdbId: string, quality: string, segment: string, res: Response): Promise<void> {
    const movie = await this.findByImdbId(imdbId);
    if (!movie) {
      throw new NotFoundException('Movie not found');
    }

    const hlsPath = this.getMovieHlsPath(imdbId);
    const segmentPath = path.join(hlsPath, `output_${quality}_${segment}`);

    if (!fs.existsSync(segmentPath)) {
      throw new NotFoundException(`Segment not found: output_${quality}_${segment}`);
    }

    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(segmentPath);
  }

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

    // Determine content type based on file extension
    const contentType = filename.endsWith('.m3u8') 
      ? 'application/vnd.apple.mpegurl' 
      : 'video/mp2t';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(filePath);
  }

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

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(playlistPath);
  }

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

    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(segmentPath);
  }

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

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(thumbnailPath);
  }
}
