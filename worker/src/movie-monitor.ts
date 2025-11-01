import axios from 'axios';
import * as fs from 'fs';
import Redis from 'ioredis';
import * as path from 'path';

interface AriaDownload {
  gid: string;
  status: string;
  totalLength: string;
  completedLength: string;
  downloadSpeed: string;
  files: Array<{
    index: string;
    path: string;
    length: string;
    completedLength: string;
    selected: string;
  }>;
  dir: string;
  infoHash?: string;
}

interface Movie {
  imdbId: string;
  title: string;
  ariaGid: string;
  status: string;
  downloadPath?: string;
  videoPath?: string;
  selectedQuality: string;
  totalSize: number;
  downloadedSize: number;
  downloadProgress: number;
  transcodeProgress: number;
}

export class MovieDownloadMonitor {
  private readonly aria2Url = 'http://aria2:6800/jsonrpc';
  private readonly rpcSecret = 'token:superlongrandomtoken';
  private readonly backendUrl = 'http://api:3000';
  private readonly videoDir = '/app/videos';
  private monitoringInterval: NodeJS.Timeout | null = null;
  private activeTranscodings = new Set<string>();
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'redis',
      port: Number(process.env.REDIS_PORT || 6379),
    });
    this.startMonitoring();
  }

  private async callAria2(
    method: string,
    params: unknown[] = []
  ): Promise<unknown> {
    try {
      const response = await axios.post(this.aria2Url, {
        jsonrpc: '2.0',
        id: Date.now(),
        method: `aria2.${method}`,
        params: [this.rpcSecret, ...params],
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      return response.data.result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Aria2 ${method} error:`, message);
      throw error;
    }
  }

  private async getMovieByAriaGid(gid: string): Promise<Movie | null> {
    try {
      const response = await axios.get(`${this.backendUrl}/movies/library`);
      const movies: Movie[] = response.data;
      return movies.find(movie => movie.ariaGid === gid) || null;
    } catch (error) {
      console.error('Error fetching movies from backend:', error);
      return null;
    }
  }

  private async updateMovieProgress(
    imdbId: string,
    updates: {
      downloadedSize?: number;
      totalSize?: number;
      downloadPath?: string;
      status?: string;
      videoPath?: string;
      transcodeProgress?: number;
    }
  ): Promise<void> {
    try {
      if (
        updates.downloadedSize !== undefined ||
        updates.totalSize !== undefined ||
        updates.downloadPath ||
        updates.status
      ) {
        const params = new URLSearchParams({ imdbId });
        if (updates.downloadedSize !== undefined)
          params.append('downloadedSize', updates.downloadedSize.toString());
        if (updates.totalSize !== undefined)
          params.append('totalSize', updates.totalSize.toString());
        if (updates.downloadPath)
          params.append('downloadPath', updates.downloadPath);
        if (updates.status) params.append('status', updates.status);

        await axios.post(
          `${this.backendUrl}/movies/update-progress?${params.toString()}`
        );
      }

      if (updates.videoPath) {
        const params = new URLSearchParams({
          imdbId,
          videoPath: updates.videoPath,
        });
        await axios.post(
          `${this.backendUrl}/movies/update-video-path?${params.toString()}`
        );
      }

      if (updates.transcodeProgress !== undefined) {
        const params = new URLSearchParams({
          imdbId,
          progress: updates.transcodeProgress.toString(),
        });
        await axios.post(
          `${
            this.backendUrl
          }/movies/update-transcode-progress?${params.toString()}`
        );
      }

      console.log(`Updated movie ${imdbId} progress:`, updates);
    } catch (error) {
      console.error(`Error updating movie ${imdbId}:`, error);
    }
  }

  private async findVideoFile(
    downloadPath: string,
    files?: Array<{ path: string; length: string }>,
    movieTitle?: string
  ): Promise<string | null> {
    try {
      const videoExtensions = [
        '.mkv',
        '.mp4',
        '.avi',
        '.mov',
        '.wmv',
        '.flv',
        '.webm',
      ];

      if (files && files.length > 0) {
        for (const file of files) {
          const ext = path.extname(file.path).toLowerCase();
          if (videoExtensions.includes(ext)) {
            const fileSize = parseInt(file.length);
            if (
              fileSize > 10 * 1024 * 1024 &&
              file.path.startsWith(downloadPath) &&
              fs.existsSync(file.path)
            ) {
              console.log(`[MONITOR] Found video via Aria2: ${file.path}`);
              return file.path;
            }
          }
        }
      }

      if (movieTitle && fs.existsSync(downloadPath)) {
        const subdirs = fs.readdirSync(downloadPath).filter(item => {
          const itemPath = path.join(downloadPath, item);
          return fs.statSync(itemPath).isDirectory();
        });

        const normalizedTitle = movieTitle
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');

        const matchingDir = subdirs.find(dir => {
          const normalizedDir = dir.toLowerCase().replace(/[^a-z0-9]/g, '');
          return (
            (normalizedDir.includes(normalizedTitle) &&
              normalizedTitle.length >= 10) ||
            (normalizedTitle.includes(normalizedDir) &&
              normalizedDir.length >= 10)
          );
        });

        if (matchingDir) {
          const targetDir = path.join(downloadPath, matchingDir);
          const videoFile = await this.findVideoInDirectory(
            targetDir,
            videoExtensions
          );
          if (videoFile) {
            console.log(`[MONITOR] Found video in directory: ${videoFile}`);
            return videoFile;
          }
        }
      }

      console.error(
        `[MONITOR] Could not find video file for "${movieTitle}" in ${downloadPath}`
      );
      return null;
    } catch (error) {
      console.error('Error finding video file:', error);
      return null;
    }
  }

  private async findVideoInDirectory(
    dir: string,
    videoExtensions: string[]
  ): Promise<string | null> {
    const allFiles = await this.getAllFiles(dir);
    for (const file of allFiles) {
      const ext = path.extname(file).toLowerCase();
      if (videoExtensions.includes(ext)) {
        const stats = fs.statSync(file);
        // Only consider files larger than 10MB as actual video files
        if (stats.size > 10 * 1024 * 1024) {
          return file;
        }
      }
    }
    return null;
  }

  private async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    if (!fs.existsSync(dir)) {
      return files;
    }

    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        files.push(...(await this.getAllFiles(fullPath)));
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  private async startProgressiveTranscoding(
    movie: Movie,
    videoFilePath: string
  ): Promise<void> {
    try {
      if (this.activeTranscodings.has(movie.imdbId)) {
        console.log(
          `Transcoding already active for ${movie.title}, skipping...`
        );
        return;
      }

      if (this.activeTranscodings.has(movie.imdbId)) {
        console.log(
          `${movie.title} has an active transcoding job, skipping...`
        );
        return;
      }

      if (movie.status === 'ready') {
        console.log(`${movie.title} is already ready, skipping transcoding...`);
        return;
      }

      if (
        movie.status === 'transcoding' &&
        parseInt(movie.transcodeProgress.toString()) > 0 &&
        parseInt(movie.transcodeProgress.toString()) < 100
      ) {
        console.log(
          `${movie.title} shows transcoding progress (${movie.transcodeProgress}%) but no active job - restarting transcoding...`
        );
      }

      console.log(`Starting progressive transcoding for ${movie.title}`);
      this.activeTranscodings.add(movie.imdbId);

      const outputDir = path.join(this.videoDir, `${movie.imdbId}_hls`);
      fs.mkdirSync(outputDir, { recursive: true });

      const transcodingJob = {
        type: 'hls',
        inputPath: videoFilePath,
        outputDir,
        videoId: movie.imdbId,
        options: {
          segmentTime: 4,
          enableThumbnails: true,
          qualities: [
            {
              name: '480p',
              width: 854,
              height: 480,
              videoBitrate: '1400k',
              audioBitrate: '128k',
              suffix: '_480p',
            },
            {
              name: '720p',
              width: 1280,
              height: 720,
              videoBitrate: '2800k',
              audioBitrate: '192k',
              suffix: '_720p',
            },
          ],
        },
      };

      console.log('Transcoding job created:', transcodingJob);

      await this.updateMovieProgress(movie.imdbId, {
        status: 'transcoding',
        videoPath: videoFilePath,
        transcodeProgress: 1,
      });

      await this.submitTranscodingJob(movie.imdbId, videoFilePath, outputDir);
    } catch (error) {
      console.error(`Error starting transcoding for ${movie.title}:`, error);
      this.activeTranscodings.delete(movie.imdbId);
    }
  }

  private async submitTranscodingJob(
    videoId: string,
    inputPath: string,
    outputDir: string
  ): Promise<void> {
    try {
      console.log(`Submitting real transcoding job for ${videoId}`);

      const transcodingJob = {
        type: 'processVideo',
        inputPath: inputPath,
        outputDir: outputDir,
        videoId: videoId,
        options: {
          segmentTime: 10, // Increased to 10 seconds for faster transcoding with fewer segments
          enableThumbnails: true,
          preset: 'ultrafast', // Ultrafast preset for maximum speed (5-10x faster than veryfast)
          crf: 30, // Higher CRF for faster encoding (slight quality reduction)
          hardwareAccel: true, // Try to use hardware acceleration if available
          qualities: [
            {
              name: '480p',
              width: 854,
              height: 480,
              videoBitrate: '1000k', // Reduced bitrate for faster encoding
              audioBitrate: '96k', // Reduced audio bitrate for faster encoding
              suffix: '_480p',
            },
            {
              name: '720p',
              width: 1280,
              height: 720,
              videoBitrate: '2000k', // Reduced bitrate for faster encoding
              audioBitrate: '128k', // Reduced audio bitrate for faster encoding
              suffix: '_720p',
            },
          ],
        },
      };

      // Submit job to Redis queue
      await this.redis.rpush('jobs', JSON.stringify(transcodingJob));
      console.log(`✅ Real transcoding job submitted for ${videoId}`);

      // Start monitoring progress
      this.monitorTranscodingProgress(videoId);
    } catch (error) {
      console.error(`Error submitting transcoding job for ${videoId}:`, error);
      this.activeTranscodings.delete(videoId);
    }
  }

  private async checkTranscodingComplete(videoId: string): Promise<boolean> {
    try {
      const hlsDir = path.join(this.videoDir, `${videoId}_hls`);
      const masterPath = path.join(hlsDir, 'master.m3u8');

      if (!fs.existsSync(masterPath)) {
        return false;
      }

      const playlists = ['output_480p.m3u8', 'output_720p.m3u8'];
      for (const playlist of playlists) {
        const playlistPath = path.join(hlsDir, playlist);
        if (fs.existsSync(playlistPath)) {
          const content = fs.readFileSync(playlistPath, 'utf-8');
          if (!content.includes('#EXT-X-ENDLIST')) {
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      console.error(
        `Error checking transcoding completion for ${videoId}:`,
        error
      );
      return false;
    }
  }

  private async monitorTranscodingProgress(videoId: string): Promise<void> {
    try {
      console.log(`Starting progress monitoring for ${videoId}`);

      const interval = setInterval(async () => {
        try {
          const isComplete = await this.checkTranscodingComplete(videoId);
          if (isComplete) {
            clearInterval(interval);
            await this.updateMovieProgress(videoId, {
              status: 'ready',
              transcodeProgress: 100,
            });
            this.activeTranscodings.delete(videoId);
            console.log(
              `✅ Transcoding complete for ${videoId} (verified by file check)`
            );
            return;
          }

          const statusJson = await this.redis.get(`video_status:${videoId}`);
          if (statusJson) {
            const status = JSON.parse(statusJson);
            console.log(
              `Transcoding progress for ${videoId}: ${status.progress}% - ${status.message}`
            );

            await this.updateMovieProgress(videoId, {
              transcodeProgress: status.progress,
            });

            if (status.status === 'ready' && status.progress === 100) {
              clearInterval(interval);
              await this.updateMovieProgress(videoId, {
                status: 'ready',
                transcodeProgress: 100,
              });
              this.activeTranscodings.delete(videoId);
              console.log(`✅ Real transcoding complete for ${videoId}`);
            } else if (status.status === 'error') {
              clearInterval(interval);
              await this.updateMovieProgress(videoId, {
                status: 'error',
                transcodeProgress: 0,
              });
              this.activeTranscodings.delete(videoId);
              console.log(
                `❌ Transcoding failed for ${videoId}: ${status.message}`
              );
            }
          }
        } catch (error) {
          console.error(`Error monitoring progress for ${videoId}:`, error);
        }
      }, 5000);
    } catch (error) {
      console.error(
        `Error starting progress monitoring for ${videoId}:`,
        error
      );
    }
  }

  private async checkForMissedCompletions(): Promise<void> {
    try {
      const response = await axios.get(`${this.backendUrl}/movies/library`);
      const movies: Movie[] = response.data;

      for (const movie of movies) {
        if (movie.status === 'downloading' && movie.videoPath) {
          const videoPath = movie.videoPath;

          console.log(
            `[MISSED] Checking if ${movie.title} is actually complete at: ${videoPath}`
          );

          if (fs.existsSync(videoPath)) {
            const stats = fs.statSync(videoPath);
            const fileSize = stats.size;
            const expectedSize = parseInt((movie.totalSize || '0').toString());

            console.log(
              `[MISSED] File size: ${fileSize}, Expected: ${expectedSize}`
            );

            if (expectedSize > 0 && fileSize >= expectedSize * 0.99) {
              console.log(
                `[MISSED] ${movie.title} appears to be complete! Starting transcoding...`
              );

              await this.updateMovieProgress(movie.imdbId, {
                status: 'transcoding',
                downloadedSize: fileSize,
                videoPath: videoPath,
              });

              await this.startProgressiveTranscoding(movie, videoPath);
            } else if (fileSize > 100 * 1024 * 1024) {
              console.log(
                `[MISSED] ${movie.title} has substantial content (${fileSize} bytes), starting progressive transcoding...`
              );

              await this.updateMovieProgress(movie.imdbId, {
                status: 'transcoding',
                downloadedSize: fileSize,
                videoPath: videoPath,
              });

              await this.startProgressiveTranscoding(movie, videoPath);
            }
          } else {
            // Try to find the video file in the download directory
            const downloadDir = movie.downloadPath || '/downloads';
            const videoFile = await this.findVideoFile(downloadDir);

            if (videoFile) {
              console.log(
                `[MISSED] Found video file for ${movie.title}: ${videoFile}`
              );
              const stats = fs.statSync(videoFile);

              await this.updateMovieProgress(movie.imdbId, {
                status: 'transcoding',
                downloadedSize: stats.size,
                videoPath: videoFile,
              });

              await this.startProgressiveTranscoding(movie, videoFile);
            }
          }
        }
      }
    } catch (error) {
      console.error('[MISSED] Error checking for missed completions:', error);
    }
  }

  private async checkForCompletedTranscoding(): Promise<void> {
    try {
      const response = await axios.get(`${this.backendUrl}/movies/library`);
      const movies = response.data;

      for (const movie of movies) {
        if (movie.status === 'transcoding') {
          const videoId = movie.imdbId;
          const isComplete = await this.checkTranscodingComplete(videoId);

          if (isComplete) {
            console.log(
              `[COMPLETION] ${movie.title} transcoding is complete, updating status...`
            );
            await this.updateMovieProgress(videoId, {
              status: 'ready',
              transcodeProgress: 100,
            });
          }
        }
      }
    } catch (error) {
      console.error(
        '[COMPLETION] Error checking for completed transcoding:',
        error
      );
    }
  }

  private async monitorDownloads(): Promise<void> {
    try {
      console.log('[MONITOR] Starting download check...');

      await this.checkForMissedCompletions();

      await this.checkForCompletedTranscoding();

      const activeDownloads = (await this.callAria2(
        'tellActive'
      )) as AriaDownload[];
      console.log(`[MONITOR] Found ${activeDownloads.length} active downloads`);

      for (const download of activeDownloads) {
        const movie = await this.getMovieByAriaGid(download.gid);
        if (!movie) {
          console.log(`[MONITOR] No movie found for GID: ${download.gid}`);
          continue;
        }

        const totalSize = parseInt(download.totalLength);
        const downloadedSize = parseInt(download.completedLength);
        const progress = totalSize > 0 ? (downloadedSize / totalSize) * 100 : 0;

        console.log(
          `Movie: ${movie.title}, Progress: ${progress.toFixed(2)}%, Speed: ${
            download.downloadSpeed
          }`
        );

        // Update download progress
        await this.updateMovieProgress(movie.imdbId, {
          downloadedSize,
          totalSize,
          downloadPath: download.dir,
        });

        // Check if we have enough data to start transcoding (e.g., 5% or minimum 100MB)
        const minSizeForTranscoding = Math.min(
          totalSize * 0.05,
          100 * 1024 * 1024
        );

        if (
          downloadedSize >= minSizeForTranscoding &&
          movie.status === 'downloading'
        ) {
          const videoFile = await this.findVideoFile(
            download.dir,
            download.files,
            movie.title
          );
          if (videoFile && fs.existsSync(videoFile)) {
            const videoStats = fs.statSync(videoFile);
            if (videoStats.size >= minSizeForTranscoding) {
              await this.startProgressiveTranscoding(movie, videoFile);
            }
          }
        }
      }

      const completedDownloads = (await this.callAria2(
        'tellStopped',
        [0, 10]
      )) as AriaDownload[];
      console.log(
        `[MONITOR] Found ${completedDownloads.length} completed downloads`
      );

      for (const download of completedDownloads) {
        console.log(
          `[MONITOR] Checking download: GID=${download.gid}, Status=${download.status}`
        );

        if (download.status === 'complete') {
          const movie = await this.getMovieByAriaGid(download.gid);
          if (!movie) {
            console.log(
              `[MONITOR] No movie found for completed GID: ${download.gid}`
            );
            continue;
          }

          console.log(`[MONITOR] Processing completed movie: ${movie.title}`);

          const videoFile = await this.findVideoFile(
            download.dir,
            download.files,
            movie.title
          );
          if (videoFile) {
            const actualFileSize = fs.existsSync(videoFile)
              ? fs.statSync(videoFile).size
              : parseInt(download.totalLength);

            if (movie.status !== 'ready') {
              await this.updateMovieProgress(movie.imdbId, {
                status: 'transcoding',
                downloadedSize: actualFileSize,
                videoPath: videoFile,
              });

              await this.startProgressiveTranscoding(movie, videoFile);
            } else {
              if (movie.videoPath !== videoFile) {
                await this.updateMovieProgress(movie.imdbId, {
                  videoPath: videoFile,
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('[MONITOR] Error monitoring downloads:', error);
    }
  }

  public startMonitoring(): void {
    console.log('Starting movie download monitoring...');

    // Monitor every 10 seconds
    this.monitoringInterval = setInterval(() => {
      this.monitorDownloads();
    }, 10000);

    // Initial run
    this.monitorDownloads();
  }

  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }
}
