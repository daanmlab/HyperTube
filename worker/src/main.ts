import { exec } from 'child_process';
import * as fs from 'fs';
import Redis from 'ioredis';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

  async updateStatus(videoId: string, status: any) {
    try {
      await this.redis.set(`video_status:${videoId}`, JSON.stringify(status));
    } catch (error) {
      console.error('[TRANSCODER] Failed to update status:', error);
    }
  }

  async analyzeVideo(inputPath: string): Promise<VideoMetadata | null> {
    try {
      console.log('[TRANSCODER] Analyzing video metadata...');

      const command = `ffprobe -v quiet -print_format json -show_format -show_streams "${inputPath}"`;
      const { stdout } = await execAsync(command);
      const data = JSON.parse(stdout);

      const videoStream = data.streams.find(
        (s: any) => s.codec_type === 'video'
      );
      const audioStream = data.streams.find(
        (s: any) => s.codec_type === 'audio'
      );

      if (!videoStream) {
        throw new Error('No video stream found');
      }

      const metadata: VideoMetadata = {
        duration: parseFloat(data.format.duration) || 0,
        width: videoStream.width || 0,
        height: videoStream.height || 0,
        bitrate: parseInt(data.format.bit_rate) || 0,
        fps: eval(videoStream.r_frame_rate) || 0,
        codec: videoStream.codec_name || 'unknown',
        audioCodec: audioStream?.codec_name || 'none',
        fileSize: parseInt(data.format.size) || 0,
      };

      console.log('[TRANSCODER] Video analysis complete:', metadata);
      return metadata;
    } catch (error) {
      console.error('[TRANSCODER] Error analyzing video:', error);
      return null;
    }
  }

  async transcodeQuality(
    inputPath: string,
    outputDir: string,
    quality: QualityLevel,
    options: any,
    metadata: VideoMetadata
  ): Promise<boolean> {
    try {
      console.log(`[TRANSCODER] Transcoding ${quality.name}...`);

      // Determine if we need to scale down
      const shouldScale =
        metadata.width > quality.width || metadata.height > quality.height;
      const scaleFilter = shouldScale
        ? `-vf scale=${quality.width}:${quality.height}:force_original_aspect_ratio=decrease:force_divisible_by=2`
        : '';

      const command = [
        'ffmpeg',
        '-i',
        `"${inputPath}"`,
        '-c:v',
        options.videoCodec || 'libx264',
        '-preset',
        options.preset || 'fast',
        '-crf',
        options.crf || 23,
        '-c:a',
        options.audioCodec || 'aac',
        '-b:v',
        quality.videoBitrate,
        '-b:a',
        quality.audioBitrate,
        '-maxrate',
        quality.videoBitrate,
        '-bufsize',
        `${parseInt(quality.videoBitrate) * 2}k`,
        scaleFilter,
        '-hls_time',
        options.segmentTime || 10,
        '-hls_playlist_type',
        'vod',
        '-hls_segment_filename',
        `"${outputDir}/output${quality.suffix}_%03d.ts"`,
        '-f',
        'hls',
        `"${outputDir}/output${quality.suffix}.m3u8"`,
      ]
        .filter(Boolean)
        .join(' ');

      await execAsync(command);
      console.log(`[TRANSCODER] ${quality.name} transcoding complete`);
      return true;
    } catch (error) {
      console.error(`[TRANSCODER] Error transcoding ${quality.name}:`, error);
      return false;
    }
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
      const count = Math.min(10, Math.max(3, Math.floor(duration / 30))); // 3-10 thumbnails

      for (let i = 0; i < count; i++) {
        const timestamp = (duration / count) * i;
        const outputPath = path.join(
          thumbnailDir,
          `thumb_${i.toString().padStart(3, '0')}.png`
        );

        const command = [
          'ffmpeg',
          '-ss',
          timestamp.toString(),
          '-i',
          `"${inputPath}"`,
          '-vframes',
          '1',
          '-vf',
          'scale=320:180:force_original_aspect_ratio=decrease',
          '-y',
          `"${outputPath}"`,
        ].join(' ');

        await execAsync(command);
      }

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

      // Update status to processing
      await this.updateStatus(videoId, {
        status: 'processing',
        progress: 0,
        message: 'Starting transcoding...',
        startTime: new Date().toISOString(),
      });

      // Create output directory
      fs.mkdirSync(outputDir, { recursive: true });

      // Analyze video
      const metadata = await this.analyzeVideo(inputPath);
      if (!metadata) {
        throw new Error('Failed to analyze video');
      }

      await this.updateStatus(videoId, {
        status: 'processing',
        progress: 10,
        message: 'Video analysis complete',
        metadata,
      });

      const qualities = options.qualities || DEFAULT_QUALITIES;
      const successfulQualities: QualityLevel[] = [];

      // Transcode each quality level
      for (let i = 0; i < qualities.length; i++) {
        const quality = qualities[i];
        const progress = 10 + ((i + 1) / qualities.length) * 70; // 10-80% for transcoding

        await this.updateStatus(videoId, {
          status: 'processing',
          progress,
          message: `Transcoding ${quality.name}...`,
          metadata,
        });

        const success = await this.transcodeQuality(
          inputPath,
          outputDir,
          quality,
          options,
          metadata
        );
        if (success) {
          successfulQualities.push(quality);

          // Mark as ready after first successful quality
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
            // Update progress for additional qualities
            await this.updateStatus(videoId, {
              status: 'ready',
              progress: Math.round(10 + ((i + 1) / qualities.length) * 70),
              message: `${successfulQualities
                .map(q => q.name)
                .join(', ')} available - transcoding ${quality.name} complete`,
              metadata,
              qualities: successfulQualities.map(q => q.name),
              availableForStreaming: true,
            });
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

      // Generate thumbnails if enabled
      if (options.enableThumbnails) {
        await this.updateStatus(videoId, {
          status: 'processing',
          progress: 90,
          message: 'Generating thumbnails...',
          metadata,
        });

        await this.generateThumbnails(inputPath, outputDir, metadata);
      }

      // Final status update
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
}

// Main worker loop
async function main() {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'redis',
    port: Number(process.env.REDIS_PORT || 6379),
  });

  const transcoder = new VideoTranscoder();

  console.log('[WORKER] Video transcoding worker started');

  // Health check
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
  }, 30000); // Every 30 seconds

  // Main processing loop
  while (true) {
    try {
      const jobData = await redis.blpop('jobs', 10);

      if (jobData) {
        const [, jobJson] = jobData;
        const job = JSON.parse(jobJson);

        console.log('[WORKER] Processing job:', job.type);

        if (job.type === 'processVideo') {
          // Process transcoding job
          await transcoder.process(job);
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

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('[WORKER] Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[WORKER] Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Start the worker
main().catch(error => {
  console.error('[WORKER] Fatal error:', error);
  process.exit(1);
});
