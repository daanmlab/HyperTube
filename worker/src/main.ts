import axios from 'axios';
import type { FfprobeData } from 'fluent-ffmpeg';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import Redis from 'ioredis';
import * as path from 'path';
import { promisify } from 'util';
import { MovieDownloadMonitor } from './movie-monitor';

const execAsync = promisify(require('child_process').exec);

interface QualityLevel {
  name: string;
  width: number;
  height: number;
  videoBitrate: string;
  audioBitrate: string;
  suffix: string;
}

interface TranscodingJob {
  type: string;
  inputPath: string;
  outputDir: string;
  videoId: string;
  options?: {
    qualities?: QualityLevel[];
    segmentTime?: number;
    transpose?: number;
    audioCodec?: string;
    videoCodec?: string;
    preset?: string;
    crf?: number;
    enableThumbnails?: boolean;
    enablePreview?: boolean;
    parallelTranscoding?: boolean; // Enable parallel quality transcoding
    maxParallelJobs?: number; // Max number of qualities to transcode simultaneously
  };
}

interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  bitrate: number;
  fps: number;
  codec: string;
  audioCodec: string;
  fileSize: number;
}

const DEFAULT_QUALITIES: QualityLevel[] = [
  {
    name: '360p',
    width: 640,
    height: 360,
    videoBitrate: '800k',
    audioBitrate: '96k',
    suffix: '_360p',
  },
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
  {
    name: '1080p',
    width: 1920,
    height: 1080,
    videoBitrate: '5000k',
    audioBitrate: '192k',
    suffix: '_1080p',
  },
];

class VideoTranscoder {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'redis',
      port: Number(process.env.REDIS_PORT || 6379),
    });
  }

  async updateStatus(videoId: string, status: Record<string, unknown>) {
    try {
      await this.redis.set(`video_status:${videoId}`, JSON.stringify(status));
    } catch (error) {
      console.error('[TRANSCODER] Failed to update status:', error);
    }
  }

  async analyzeVideo(inputPath: string): Promise<VideoMetadata | null> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata: FfprobeData) => {
        if (err) {
          const errorMsg = err.message || String(err);
          if (errorMsg.includes('moov atom not found')) {
            reject(
              new Error(
                'Video file is corrupted: MP4 metadata (moov atom) not found. The download may be incomplete.'
              )
            );
          } else if (errorMsg.includes('Invalid data')) {
            reject(
              new Error(
                'Video file contains invalid data. The file may be corrupted or incomplete.'
              )
            );
          } else if (errorMsg.includes('No such file')) {
            reject(new Error(`Video file not found: ${inputPath}`));
          } else {
            reject(new Error(`Failed to analyze video: ${errorMsg}`));
          }
          return;
        }

        const videoStream = metadata.streams.find(
          s => s.codec_type === 'video'
        );
        const audioStream = metadata.streams.find(
          s => s.codec_type === 'audio'
        );

        if (!videoStream) {
          reject(
            new Error(
              'No video stream found in file - file may be corrupted or is not a valid video'
            )
          );
          return;
        }

        let fps = 0;
        if (videoStream.r_frame_rate) {
          const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
          fps = den ? num / den : 0;
        }

        const result: VideoMetadata = {
          duration:
            typeof metadata.format.duration === 'string'
              ? parseFloat(metadata.format.duration)
              : metadata.format.duration || 0,
          width: videoStream.width || 0,
          height: videoStream.height || 0,
          bitrate:
            typeof metadata.format.bit_rate === 'string'
              ? parseInt(metadata.format.bit_rate)
              : metadata.format.bit_rate || 0,
          fps,
          codec: videoStream.codec_name || 'unknown',
          audioCodec: audioStream?.codec_name || 'none',
          fileSize:
            typeof metadata.format.size === 'string'
              ? parseInt(metadata.format.size)
              : metadata.format.size || 0,
        };

        console.log('[TRANSCODER] Video analysis complete:', result);
        resolve(result);
      });
    });
  }

  async transcodeQuality(
    inputPath: string,
    outputDir: string,
    quality: QualityLevel,
    options: Record<string, unknown>,
    metadata: VideoMetadata,
    videoId: string,
    qualityIndex: number,
    totalQualities: number
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      console.log(`[TRANSCODER] Transcoding ${quality.name}...`);

      const segmentTime = (options.segmentTime as number) || 10;
      const expectedSegments = Math.ceil(metadata.duration / segmentTime);

      const shouldScale =
        metadata.width > quality.width || metadata.height > quality.height;

      const useHardwareAccel = options.hardwareAccel !== false;
      let videoCodec = (options.videoCodec as string) || 'libx264';
      let useVAAPI = false;

      if (useHardwareAccel && !options.videoCodec) {
        try {
          if (fs.existsSync('/dev/dri/renderD128')) {
            videoCodec = 'h264_vaapi';
            useVAAPI = true;
            console.log('[TRANSCODER] Using VAAPI hardware acceleration');
          }
        } catch {
          console.log(
            '[TRANSCODER] Hardware acceleration not available, using optimized software encoding'
          );
        }
      }

      const outputPath = path.join(outputDir, `output${quality.suffix}.m3u8`);
      const segmentPath = path.join(
        outputDir,
        `output${quality.suffix}_%03d.ts`
      );

      let command = ffmpeg(inputPath);

      // Add threading optimizations for faster encoding
      command = command
        .outputOptions(['-threads 0']) // Use all available CPU cores
        .inputOptions(['-threads 0']); // Use all cores for decoding too

      // Add VAAPI hardware acceleration if available
      if (useVAAPI) {
        command = command
          .inputOptions(['-vaapi_device /dev/dri/renderD128'])
          .outputOptions(['-vf format=nv12,hwupload']);
      }

      // Video codec and settings
      command = command.videoCodec(videoCodec);

      if (videoCodec === 'libx264') {
        command = command
          .addOption('-preset', (options.preset as string) || 'veryfast')
          .addOption('-crf', ((options.crf as number) || 28).toString())
          .addOption('-tune', 'fastdecode')
          .addOption('-profile:v', 'main')
          .addOption('-level', '4.0')
          .addOption('-pix_fmt', 'yuv420p');
      } else if (useVAAPI) {
        command = command.addOption('-qp', '28');
      }

      // Video bitrate and scaling
      command = command.videoBitrate(quality.videoBitrate);

      if (shouldScale && !useVAAPI) {
        command = command.size(`${quality.width}x${quality.height}`);
      } else if (shouldScale && useVAAPI) {
        command = command.outputOptions([
          `-vf scale_vaapi=w=${quality.width}:h=${quality.height}`,
        ]);
      }

      command = command
        .audioCodec((options.audioCodec as string) || 'aac')
        .audioBitrate(quality.audioBitrate)
        .audioChannels(2)
        .audioFrequency(44100);

      command = command
        .outputOptions([
          `-hls_time ${segmentTime}`,
          '-hls_playlist_type event',
          `-hls_segment_filename ${segmentPath}`,
          '-hls_flags independent_segments+append_list',
          '-f hls',
          '-movflags +faststart',
        ])
        .output(outputPath);

      // Monitor segment creation for progress updates
      const progressInterval = setInterval(async () => {
        try {
          const pattern = path.join(outputDir, `output${quality.suffix}_*.ts`);
          const { stdout } = await execAsync(
            `ls -1 ${pattern} 2>/dev/null | wc -l`
          );
          const currentSegments = parseInt(stdout.trim()) || 0;

          if (currentSegments > 0 && expectedSegments > 0) {
            const qualityProgressPortion = 70 / totalQualities;
            const baseProgress = 10 + qualityIndex * qualityProgressPortion;
            const currentQualityProgress =
              (currentSegments / expectedSegments) * qualityProgressPortion;
            const totalProgress = Math.min(
              80,
              Math.round(baseProgress + currentQualityProgress)
            );

            await this.updateStatus(videoId, {
              status: 'processing',
              progress: totalProgress,
              message: `Transcoding ${quality.name}... (${currentSegments}/${expectedSegments} segments)`,
              metadata,
            });
          }
        } catch {}
      }, 5000);

      command.on('progress', progress => {
        if (progress.percent) {
          console.log(
            `[TRANSCODER] ${quality.name}: ${Math.round(progress.percent)}%`
          );
        }
      });

      command.on('end', () => {
        clearInterval(progressInterval);
        console.log(`[TRANSCODER] ${quality.name} transcoding complete`);
        resolve(true);
      });

      command.on('error', err => {
        clearInterval(progressInterval);
        console.error(`[TRANSCODER] Error transcoding ${quality.name}:`, err);
        reject(err);
      });

      command.run();
    });
  }

  async generateMasterPlaylist(
    outputDir: string,
    qualities: QualityLevel[]
  ): Promise<void> {
    try {
      console.log('[TRANSCODER] Generating master playlist...');

      let masterPlaylist = '#EXTM3U\n#EXT-X-VERSION:3\n\n';

      for (const quality of qualities) {
        const playlistPath = path.join(
          outputDir,
          `output${quality.suffix}.m3u8`
        );
        if (fs.existsSync(playlistPath)) {
          const bandwidth =
            parseInt(quality.videoBitrate) * 1000 +
            parseInt(quality.audioBitrate) * 1000;
          masterPlaylist += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${quality.width}x${quality.height}\n`;
          masterPlaylist += `output${quality.suffix}.m3u8\n\n`;
        }
      }

      // Fallback to default playlist if available
      const defaultPlaylist = path.join(outputDir, 'output.m3u8');
      if (fs.existsSync(defaultPlaylist)) {
        masterPlaylist += `#EXT-X-STREAM-INF:BANDWIDTH=1000000\noutput.m3u8\n`;
      }

      const masterPath = path.join(outputDir, 'master.m3u8');
      fs.writeFileSync(masterPath, masterPlaylist);
      console.log('[TRANSCODER] Master playlist generated');
    } catch (error) {
      console.error('[TRANSCODER] Error generating master playlist:', error);
    }
  }

  async generateThumbnails(
    inputPath: string,
    outputDir: string,
    metadata: VideoMetadata
  ): Promise<void> {
    try {
      console.log('[TRANSCODER] Generating thumbnails...');

      const thumbnailDir = path.join(outputDir, 'thumbnails');
      fs.mkdirSync(thumbnailDir, { recursive: true });

      const duration = metadata.duration;
      const count = Math.min(10, Math.max(3, Math.floor(duration / 30)));

      const promises = [];

      for (let i = 0; i < count; i++) {
        const timestamp = (duration / count) * i;
        const outputPath = path.join(
          thumbnailDir,
          `thumb_${i.toString().padStart(3, '0')}.png`
        );

        const promise = new Promise<void>((resolve, reject) => {
          ffmpeg(inputPath)
            .seekInput(timestamp)
            .outputOptions([
              '-vframes 1',
              '-vf scale=320:180:force_original_aspect_ratio=decrease',
            ])
            .output(outputPath)
            .on('end', () => resolve())
            .on('error', err => reject(err))
            .run();
        });

        promises.push(promise);
      }

      await Promise.all(promises);
      console.log(`[TRANSCODER] Generated ${count} thumbnails`);
    } catch (error) {
      console.error('[TRANSCODER] Error generating thumbnails:', error);
    }
  }

  async process(job: TranscodingJob): Promise<void> {
    const { inputPath, outputDir, videoId, options = {} } = job;

    try {
      console.log(
        `[TRANSCODER] Starting transcoding job for video: ${videoId}`
      );
      console.log(`[TRANSCODER] Input file: ${inputPath}`);

      await this.updateStatus(videoId, {
        status: 'processing',
        progress: 0,
        message: 'Starting transcoding...',
        startTime: new Date().toISOString(),
      });

      // Validate input file exists before proceeding
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Input video file not found: ${inputPath}`);
      }

      try {
        fs.accessSync(inputPath, fs.constants.R_OK);
      } catch {
        throw new Error(`Input video file is not readable: ${inputPath}`);
      }

      const stats = fs.statSync(inputPath);
      if (stats.size === 0) {
        throw new Error(`Input video file is empty: ${inputPath}`);
      }

      console.log(`[TRANSCODER] Input file validated: ${stats.size} bytes`);

      fs.mkdirSync(outputDir, { recursive: true });

      // Analyze video
      console.log(`[TRANSCODER] Analyzing video: ${inputPath}`);
      const metadata = await this.analyzeVideo(inputPath);
      if (!metadata) {
        throw new Error('Failed to analyze video - metadata is null');
      }

      // Validate metadata
      if (!metadata.duration || metadata.duration <= 0) {
        throw new Error(
          `Invalid video duration: ${metadata.duration}s - file may be corrupted`
        );
      }
      if (!metadata.width || !metadata.height) {
        throw new Error('Invalid video dimensions - file may be corrupted');
      }

      const metadataPath = path.join(outputDir, 'metadata.json');
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      console.log(`[TRANSCODER] Metadata saved to ${metadataPath}`);

      await this.updateStatus(videoId, {
        status: 'processing',
        progress: 10,
        message: 'Video analysis complete',
        metadata,
      });

      const qualities = options.qualities || DEFAULT_QUALITIES;
      const successfulQualities: QualityLevel[] = [];

      // Enable parallel transcoding (transcode multiple qualities at once)
      const parallelTranscoding = options.parallelTranscoding !== false; // Default to true
      const maxParallelJobs = (options.maxParallelJobs as number) || 2; // Default to 2 parallel jobs

      if (parallelTranscoding) {
        console.log(
          `[TRANSCODER] Starting parallel transcoding (up to ${maxParallelJobs} qualities at once)`
        );

        await this.updateStatus(videoId, {
          status: 'processing',
          progress: 10,
          message: `Starting parallel transcoding of ${qualities.length} qualities...`,
          metadata,
        });

        // Reorder qualities: lowest + highest first, then work toward middle
        // Example: [480p, 720p, 1080p, 2160p] becomes [480p, 2160p, 720p, 1080p]
        const reorderedQualities: QualityLevel[] = [];
        let left = 0;
        let right = qualities.length - 1;
        let pickFromLeft = true;

        while (left <= right) {
          if (pickFromLeft) {
            reorderedQualities.push(qualities[left]);
            left++;
          } else {
            reorderedQualities.push(qualities[right]);
            right--;
          }
          pickFromLeft = !pickFromLeft;
        }

        console.log(
          `[TRANSCODER] Quality order: ${reorderedQualities
            .map(q => q.name)
            .join(' → ')}`
        );

        // Process qualities in batches
        for (let i = 0; i < reorderedQualities.length; i += maxParallelJobs) {
          const batch = reorderedQualities.slice(i, i + maxParallelJobs);
          const batchPromises = batch.map(quality => {
            const qualityIndex = qualities.indexOf(quality); // Use original index for progress calc
            console.log(
              `[TRANSCODER] Starting ${quality.name} (parallel batch ${
                Math.floor(i / maxParallelJobs) + 1
              })`
            );
            return this.transcodeQuality(
              inputPath,
              outputDir,
              quality,
              options,
              metadata,
              videoId,
              qualityIndex,
              qualities.length
            )
              .then(success => ({ quality, success }))
              .catch(err => {
                console.error(
                  `[TRANSCODER] Error transcoding ${quality.name}:`,
                  err
                );
                return { quality, success: false };
              });
          });

          // Wait for all qualities in this batch to complete
          const batchResults = await Promise.all(batchPromises);

          // Collect successful qualities
          for (const { quality, success } of batchResults) {
            if (success) {
              successfulQualities.push(quality);
              console.log(
                `[TRANSCODER] ${quality.name} completed successfully (${successfulQualities.length}/${qualities.length})`
              );

              // Update status with newly available quality
              await this.updateStatus(videoId, {
                status: 'ready',
                progress: Math.round(
                  10 + (successfulQualities.length / qualities.length) * 70
                ),
                message: `${successfulQualities
                  .map(q => q.name)
                  .join(', ')} available${
                  successfulQualities.length < qualities.length
                    ? ' - transcoding remaining qualities...'
                    : ''
                }`,
                metadata,
                qualities: successfulQualities.map(q => q.name),
                availableForStreaming: true,
              });

              if (successfulQualities.length === 1) {
                console.log(
                  `[TRANSCODER] Video ${videoId} is now ready for streaming with ${quality.name}`
                );
              }
            }
          }
        }
      } else {
        // Sequential transcoding (original behavior)
        console.log('[TRANSCODER] Starting sequential transcoding');

        for (let i = 0; i < qualities.length; i++) {
          const quality = qualities[i];

          await this.updateStatus(videoId, {
            status: 'processing',
            progress: 10 + (i / qualities.length) * 70,
            message: `Starting ${quality.name} transcoding...`,
            metadata,
          });

          const success = await this.transcodeQuality(
            inputPath,
            outputDir,
            quality,
            options,
            metadata,
            videoId,
            i,
            qualities.length
          );
          if (success) {
            successfulQualities.push(quality);

            if (successfulQualities.length === 1) {
              await this.updateStatus(videoId, {
                status: 'ready',
                progress: Math.round(10 + ((i + 1) / qualities.length) * 70),
                message: `${quality.name} ready - continuing with other qualities...`,
                metadata,
                qualities: successfulQualities.map(q => q.name),
                availableForStreaming: true,
              });
              console.log(
                `[TRANSCODER] Video ${videoId} is now ready for streaming with ${quality.name}`
              );
            } else {
              await this.updateStatus(videoId, {
                status: 'ready',
                progress: Math.round(10 + ((i + 1) / qualities.length) * 70),
                message: `${successfulQualities
                  .map(q => q.name)
                  .join(', ')} available - transcoding ${
                  quality.name
                } complete`,
                metadata,
                qualities: successfulQualities.map(q => q.name),
                availableForStreaming: true,
              });
            }
          }
        }
      }

      // Generate master playlist
      await this.updateStatus(videoId, {
        status: 'processing',
        progress: 85,
        message: 'Generating master playlist...',
        metadata,
      });

      await this.generateMasterPlaylist(outputDir, successfulQualities);

      if (options.enableThumbnails) {
        await this.updateStatus(videoId, {
          status: 'processing',
          progress: 90,
          message: 'Generating thumbnails...',
          metadata,
        });

        await this.generateThumbnails(inputPath, outputDir, metadata);
      }

      await this.updateStatus(videoId, {
        status: 'ready',
        progress: 100,
        message: 'Transcoding completed successfully',
        metadata,
        qualities: successfulQualities.map(q => q.name),
        completedAt: new Date().toISOString(),
      });

      console.log(`[TRANSCODER] Transcoding completed for video: ${videoId}`);
    } catch (error) {
      console.error(`[TRANSCODER] Error processing video ${videoId}:`, error);

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      await this.updateStatus(videoId, {
        status: 'error',
        progress: 0,
        message: `Transcoding failed: ${errorMessage}`,
        error: errorMessage,
        failedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Process video for MP4 streaming (simplified, faster transcoding)
   */
  async processVideoMP4(job: {
    type: string;
    inputPath: string;
    outputPath: string;
    finalPath: string;
    videoId: string;
  }): Promise<void> {
    const { inputPath, outputPath, finalPath, videoId } = job;

    try {
      console.log(`[TRANSCODER] Starting MP4 transcoding: ${videoId}`);
      console.log(`[TRANSCODER] Input: ${inputPath}`);
      console.log(`[TRANSCODER] Output: ${outputPath}`);

      await this.updateStatus(videoId, {
        status: 'processing',
        progress: 0,
        message: 'Starting MP4 transcoding...',
        startTime: new Date().toISOString(),
      });

      // Validate input file
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Input file not found: ${inputPath}`);
      }

      const stats = fs.statSync(inputPath);
      if (stats.size === 0) {
        throw new Error(`Input file is empty: ${inputPath}`);
      }

      console.log(`[TRANSCODER] Input file validated: ${stats.size} bytes`);

      // Transcode to MP4
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .videoCodec('libx264')
          .audioCodec('aac')
          .addOption('-preset', 'veryfast') // Speed over quality for speed-to-market
          .addOption('-crf', '23') // Good quality
          .addOption('-movflags', '+faststart') // Web streaming optimization
          .addOption('-pix_fmt', 'yuv420p') // Browser compatibility
          .size('1280x720') // Single quality: 720p
          .videoBitrate('2500k')
          .audioBitrate('192k')
          .audioChannels(2)
          .audioFrequency(44100)
          .format('mp4')
          .output(outputPath)
          .on('start', commandLine => {
            console.log(`[TRANSCODER] FFmpeg command: ${commandLine}`);
          })
          .on('progress', async progress => {
            if (progress.percent) {
              const roundedProgress = Math.round(progress.percent);
              console.log(`[TRANSCODER] Progress: ${roundedProgress}%`);

              await this.updateStatus(videoId, {
                status: 'processing',
                progress: roundedProgress,
                message: `Transcoding: ${roundedProgress}%`,
                timemark: progress.timemark,
              });
            }
          })
          .on('end', () => {
            console.log(`[TRANSCODER] FFmpeg transcode complete`);
            resolve();
          })
          .on('error', err => {
            console.error(`[TRANSCODER] FFmpeg error:`, err);
            reject(err);
          })
          .run();
      });

      // Rename temp file to final
      console.log(`[TRANSCODER] Renaming ${outputPath} to ${finalPath}`);
      fs.renameSync(outputPath, finalPath);

      // Update backend with cache info
      const backendUrl = process.env.BACKEND_URL || 'http://api:3000';
      console.log(`[TRANSCODER] Updating backend cache info`);

      await axios.post(`${backendUrl}/movies/update-cache`, {
        imdbId: videoId,
        transcodedPath: finalPath,
        isFullyTranscoded: true,
      });

      await this.updateStatus(videoId, {
        status: 'complete',
        progress: 100,
        message: 'MP4 transcoding complete',
        completedAt: new Date().toISOString(),
      });

      console.log(`[TRANSCODER] ✅ MP4 transcoding completed for: ${videoId}`);
    } catch (error) {
      console.error(
        `[TRANSCODER] ❌ Error processing MP4 for ${videoId}:`,
        error
      );

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      // Clean up temp file if it exists
      if (fs.existsSync(outputPath)) {
        try {
          fs.unlinkSync(outputPath);
          console.log(`[TRANSCODER] Cleaned up temp file: ${outputPath}`);
        } catch (cleanupError) {
          console.error(
            `[TRANSCODER] Failed to clean up temp file:`,
            cleanupError
          );
        }
      }

      await this.updateStatus(videoId, {
        status: 'error',
        progress: 0,
        message: `MP4 transcoding failed: ${errorMessage}`,
        error: errorMessage,
        failedAt: new Date().toISOString(),
      });

      // Update backend with error
      try {
        const backendUrl = process.env.BACKEND_URL || 'http://api:3000';
        await axios.post(`${backendUrl}/movies/update-progress`, null, {
          params: {
            imdbId: videoId,
            status: 'error',
          },
        });
      } catch (backendError) {
        console.error(
          `[TRANSCODER] Failed to update backend with error:`,
          backendError
        );
      }
    }
  }
}

let monitor: MovieDownloadMonitor | null = null;

async function shutdown() {
  console.log('[WORKER] Shutting down gracefully...');
  if (monitor) {
    monitor.stopMonitoring();
  }
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function restartIncompleteTranscodingJobs() {
  console.log('[WORKER] Checking for incomplete transcoding jobs...');

  try {
    const backendUrl = process.env.BACKEND_URL || 'http://api:3000';

    const response = await axios.get(`${backendUrl}/movies/library`);
    const movies = response.data || [];

    interface MovieData {
      status: string;
      transcodeProgress?: string;
      imdbId: string;
      videoPath?: string;
      title: string;
    }

    const incompleteTranscodings = (movies as MovieData[]).filter(
      movie =>
        movie.status === 'transcoding' &&
        movie.transcodeProgress !== undefined &&
        parseFloat(movie.transcodeProgress) < 100
    );

    if (incompleteTranscodings.length === 0) {
      console.log('[WORKER] No incomplete transcoding jobs found');
      return;
    }

    console.log(
      `[WORKER] Found ${incompleteTranscodings.length} incomplete transcoding job(s), restarting...`
    );

    for (const movie of incompleteTranscodings) {
      try {
        console.log(
          `[WORKER] Restarting transcoding for: ${movie.title} (${movie.imdbId})`
        );

        await axios.post(
          `${backendUrl}/movies/update-transcode-progress`,
          null,
          {
            params: {
              imdbId: movie.imdbId,
              progress: '0',
            },
          }
        );

        if (movie.videoPath && fs.existsSync(movie.videoPath)) {
          const hlsDir = path.join('/app/videos', `${movie.imdbId}_hls`);
          if (fs.existsSync(hlsDir)) {
            console.log(`[WORKER] Cleaning up old HLS segments in ${hlsDir}`);
            try {
              const files = fs.readdirSync(hlsDir);
              for (const file of files) {
                if (
                  file.endsWith('.ts') ||
                  file.endsWith('.m3u8') ||
                  file.endsWith('.vtt')
                ) {
                  fs.unlinkSync(path.join(hlsDir, file));
                }
              }
              console.log(`[WORKER] Cleaned up ${files.length} old files`);
            } catch (cleanupError) {
              console.error(
                `[WORKER] Error cleaning up old segments:`,
                cleanupError
              );
            }
          }

          await axios.post(`${backendUrl}/movies/update-progress`, null, {
            params: {
              imdbId: movie.imdbId,
              status: 'transcoding',
            },
          });

          console.log(`[WORKER] ✅ Restarted transcoding for ${movie.title}`);
        } else {
          console.log(
            `[WORKER] ⚠️ Video file not found for ${movie.title}, setting status to error`
          );
          await axios.post(`${backendUrl}/movies/update-progress`, null, {
            params: {
              imdbId: movie.imdbId,
              status: 'error',
            },
          });
        }
      } catch (error) {
        console.error(
          `[WORKER] Failed to restart transcoding for ${movie.title}:`,
          error
        );
      }
    }

    console.log('[WORKER] Finished restarting incomplete transcoding jobs');
  } catch (error) {
    console.error(
      '[WORKER] Error checking for incomplete transcoding jobs:',
      error
    );
  }
}

async function main() {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'redis',
    port: Number(process.env.REDIS_PORT || 6379),
  });

  const transcoder = new VideoTranscoder();
  monitor = new MovieDownloadMonitor();

  console.log('[WORKER] Video transcoding worker started');

  await restartIncompleteTranscodingJobs();

  monitor.startMonitoring();
  console.log('[WORKER] Movie download monitor started');

  setInterval(async () => {
    try {
      await redis.set(
        'worker_health',
        JSON.stringify({
          status: 'healthy',
          lastSeen: new Date().toISOString(),
          version: '2.0.0',
        })
      );
    } catch (error) {
      console.error('[WORKER] Health check failed:', error);
    }
  }, 30000);

  while (true) {
    try {
      const jobData = await redis.blpop('jobs', 10);

      if (jobData) {
        const [, jobJson] = jobData;
        const job = JSON.parse(jobJson);

        console.log('[WORKER] Processing job:', job.type);

        if (job.type === 'processVideo') {
          await transcoder.process(job);
        } else if (job.type === 'processVideoMP4') {
          await transcoder.processVideoMP4(job);
        } else {
          console.log('[WORKER] Unknown job type:', job.type);
        }
      }
    } catch (error) {
      console.error('[WORKER] Error in main loop:', error);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retrying
    }
  }
}

main().catch(error => {
  console.error('[WORKER] Fatal error:', error);
  process.exit(1);
});
