import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import Redis from 'ioredis';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { VideoStatusResponseDto } from './dto/video-status-response.dto';
import { VideoUploadResponseDto } from './dto/video-upload-response.dto';

interface TranscodingOptions {
  qualities?: string[];
  segmentTime?: number;
  transpose?: number;
  audioCodec?: 'aac' | 'mp3' | 'copy';
  videoCodec?: 'libx264' | 'libx265' | 'copy';
  preset?:
    | 'ultrafast'
    | 'superfast'
    | 'veryfast'
    | 'faster'
    | 'fast'
    | 'medium'
    | 'slow'
    | 'slower'
    | 'veryslow';
  crf?: number;
  enableThumbnails?: boolean;
  enablePreview?: boolean;
}

interface QualityLevel {
  name: string;
  width: number;
  height: number;
  videoBitrate: string;
  audioBitrate: string;
  suffix: string;
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

@Injectable()
export class VideosService {
  private readonly videosDir = '/app/videos';
  private readonly redis = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT || 6379),
  });

  handleUpload(file: Express.Multer.File, options?: TranscodingOptions): VideoUploadResponseDto {
    // Enhanced job with transcoding options
    const enhancedJob = {
      type: 'processVideo',
      inputPath: file.path,
      outputDir: path.join(this.videosDir, file.filename + '_hls'),
      videoId: file.filename,
      options: {
        qualities: DEFAULT_QUALITIES,
        segmentTime: 10,
        transpose: 1,
        audioCodec: 'aac',
        videoCodec: 'libx264',
        preset: 'fast',
        crf: 23,
        enableThumbnails: true,
        enablePreview: false,
        ...options,
      },
    };

    this.redis.rpush('jobs', JSON.stringify(enhancedJob));

    return {
      filename: file.filename,
      path: file.path,
      status: 'uploaded',
      message: 'Video uploaded successfully and queued for processing',
    };
  }

  async getVideoStatus(videoId: string): Promise<VideoStatusResponseDto> {
    try {
      const statusJson = await this.redis.get(`video_status:${videoId}`);
      if (statusJson) {
        const parsed = JSON.parse(statusJson);
        // Ensure the parsed data matches our DTO structure
        return {
          status: parsed.status || 'processing',
          progress: parsed.progress || 0,
          message: parsed.message || 'Processing video...',
          availableForStreaming: parsed.availableForStreaming || false,
          availableQualities: parsed.availableQualities || [],
          completedQualities: parsed.completedQualities || 0,
          totalQualities: parsed.totalQualities || 4,
          estimatedTimeRemaining: parsed.estimatedTimeRemaining,
          error: parsed.error,
        };
      }

      // Fallback to file system check
      const hlsDir = path.join(this.videosDir, videoId + '_hls');
      const playlistPath = path.join(hlsDir, 'output.m3u8');
      const originalPath = path.join(this.videosDir, videoId);

      if (fs.existsSync(playlistPath)) {
        return {
          status: 'ready',
          progress: 100,
          message: 'Video ready for streaming',
          availableForStreaming: true,
          availableQualities: ['360p', '480p', '720p', '1080p'],
          completedQualities: 4,
          totalQualities: 4,
        };
      } else if (fs.existsSync(originalPath)) {
        return {
          status: 'processing',
          progress: 0,
          message: 'Video being processed',
          availableForStreaming: false,
          availableQualities: [],
          completedQualities: 0,
          totalQualities: 4,
        };
      } else {
        return {
          status: 'error',
          progress: 0,
          message: 'Video not found',
          availableForStreaming: false,
          availableQualities: [],
          completedQualities: 0,
          totalQualities: 4,
          error: 'Video file not found',
        };
      }
    } catch (error) {
      console.error('Error getting video status:', error);
      return {
        status: 'error',
        progress: 0,
        message: 'Failed to get video status',
        availableForStreaming: false,
        availableQualities: [],
        completedQualities: 0,
        totalQualities: 4,
        error: 'Internal server error',
      };
    }
  }

  async listVideos() {
    try {
      const files = fs.readdirSync(this.videosDir);
      const videos = files
        .filter((file) => !file.includes('.') && !file.endsWith('_hls'))
        .map(async (videoId) => {
          const hlsDir = path.join(this.videosDir, videoId + '_hls');
          const playlistPath = path.join(hlsDir, 'output.m3u8');
          const masterPlaylistPath = path.join(hlsDir, 'master.m3u8');
          const originalPath = path.join(this.videosDir, videoId);

          let status = 'error';
          let fileSize = 0;
          let availableQualities: string[] = [];

          DEFAULT_QUALITIES.forEach((quality) => {
            const qualityPlaylist = path.join(hlsDir, `output${quality.suffix}.m3u8`);
            if (fs.existsSync(qualityPlaylist)) {
              availableQualities.push(quality.name);
            }
          });

          if (availableQualities.length > 0) {
            status = 'ready'; // Ready to play if ANY quality is available
          } else if (fs.existsSync(originalPath)) {
            status = 'processing';
          }

          try {
            if (fs.existsSync(originalPath)) {
              fileSize = fs.statSync(originalPath).size;
            }
          } catch (e) {
            // Ignore stat errors
          }

          let enhancedStatus = null;
          try {
            const statusJson = await this.redis.get(`video_status:${videoId}`);
            if (statusJson) {
              enhancedStatus = JSON.parse(statusJson);
            }
          } catch (e) {
            // Ignore Redis errors
          }

          return {
            id: videoId,
            filename: videoId,
            status,
            fileSize,
            hasHls: fs.existsSync(playlistPath),
            hasMasterPlaylist: fs.existsSync(masterPlaylistPath),
            availableQualities,
            hasThumbnails: fs.existsSync(path.join(hlsDir, 'thumbnails')),
            createdAt: fs.existsSync(originalPath)
              ? fs.statSync(originalPath).birthtime.toISOString()
              : new Date().toISOString(),
            enhancedStatus,
          };
        });

      return Promise.all(videos);
    } catch (error) {
      console.error('Error listing videos:', error);
      return [];
    }
  }

  async getHlsPlaylist(videoId: string, res: Response) {
    // Simply forward to master playlist since it works correctly
    return this.getMasterPlaylist(videoId, res);
  }

  async getMasterPlaylist(videoId: string, res: Response) {
    const hlsDir = path.join(this.videosDir, videoId + '_hls');
    const masterPlaylistPath = path.join(hlsDir, 'master.m3u8');

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache');

    let masterPlaylist = '#EXTM3U\n#EXT-X-VERSION:3\n\n';
    let hasAnyQuality = false;

    for (const quality of DEFAULT_QUALITIES) {
      const qualityPlaylist = path.join(hlsDir, `output${quality.suffix}.m3u8`);
      if (fs.existsSync(qualityPlaylist)) {
        const bandwidth =
          parseInt(quality.videoBitrate) * 1000 + parseInt(quality.audioBitrate) * 1000;
        masterPlaylist += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${quality.width}x${quality.height},NAME="${quality.name}"\n`;
        masterPlaylist += `quality/${quality.name}\n\n`;
        hasAnyQuality = true;
      }
    }

    // Fallback to regular playlist if no qualities available yet
    if (!hasAnyQuality) {
      const regularPlaylist = path.join(hlsDir, 'output.m3u8');
      if (fs.existsSync(regularPlaylist)) {
        masterPlaylist += `#EXT-X-STREAM-INF:BANDWIDTH=1000000\nhls.m3u8\n`;
        hasAnyQuality = true;
      }
    }

    if (!hasAnyQuality) {
      return res.status(404).send('No video streams available yet');
    }

    res.send(masterPlaylist);
  }

  async getQualityPlaylist(videoId: string, quality: string, res: Response) {
    const qualityMap: Record<string, string> = {
      '360p': '_360p',
      '480p': '_480p',
      '720p': '_720p',
      '1080p': '_1080p',
    };

    const suffix = qualityMap[quality];
    if (!suffix) {
      return res.status(400).send('Invalid quality specified');
    }

    const playlistPath = path.join(this.videosDir, videoId + '_hls', `output${suffix}.m3u8`);

    if (!fs.existsSync(playlistPath)) {
      return res.status(404).send('Quality playlist not found');
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache');

    const playlistContent = fs.readFileSync(playlistPath, 'utf8');
    const modifiedPlaylist = playlistContent.replace(/^(output_\w+\.ts)$/gm, '../$1');

    res.send(modifiedPlaylist);
  }

  async getHlsSegment(videoId: string, segment: string, res: Response) {
    console.log('getHlsSegment called with videoId:', videoId, 'segment:', segment);

    // Special case: if segment is hls.m3u8, redirect to the HLS playlist method
    if (segment === 'hls.m3u8') {
      console.log('Redirecting hls.m3u8 request to getHlsPlaylist method');
      return this.getHlsPlaylist(videoId, res);
    }

    const segmentPath = path.join(this.videosDir, videoId + '_hls', segment);
    console.log('segmentPath:', segmentPath);
    console.log('segment exists:', fs.existsSync(segmentPath));

    if (!fs.existsSync(segmentPath)) {
      return res.status(404).send('Segment not found');
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
    res.setHeader('Content-Type', 'video/MP2T');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000');

    fs.createReadStream(segmentPath).pipe(res);
  }

  async getThumbnail(videoId: string, thumbnailId: string, res: Response) {
    const thumbnailPath = path.join(
      this.videosDir,
      videoId + '_hls',
      'thumbnails',
      `thumb_${thumbnailId}.png`,
    );

    if (!fs.existsSync(thumbnailPath)) {
      return res.status(404).send('Thumbnail not found');
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours

    fs.createReadStream(thumbnailPath).pipe(res);
  }

  async listThumbnails(videoId: string) {
    const thumbnailDir = path.join(this.videosDir, videoId + '_hls', 'thumbnails');

    if (!fs.existsSync(thumbnailDir)) {
      return [];
    }

    try {
      const files = fs.readdirSync(thumbnailDir);
      return files
        .filter((file) => file.endsWith('.png'))
        .map((file) => {
          const match = file.match(/thumb_(\d+)\.png/);
          return match ? parseInt(match[1]) : null;
        })
        .filter((id) => id !== null)
        .sort((a, b) => a - b);
    } catch (error) {
      console.error('Error listing thumbnails:', error);
      return [];
    }
  }

  async getVideoMetadata(videoId: string) {
    try {
      const statusJson = await this.redis.get(`video_status:${videoId}`);
      if (statusJson) {
        const status = JSON.parse(statusJson);
        return status.metadata || null;
      }
      return null;
    } catch (error) {
      console.error('Error getting video metadata:', error);
      return null;
    }
  }

  async deleteVideo(videoId: string) {
    try {
      const originalPath = path.join(this.videosDir, videoId);
      const hlsDir = path.join(this.videosDir, videoId + '_hls');

      if (fs.existsSync(originalPath)) {
        fs.unlinkSync(originalPath);
      }

      if (fs.existsSync(hlsDir)) {
        fs.rmSync(hlsDir, { recursive: true, force: true });
      }

      await this.redis.del(`video_status:${videoId}`);

      return { success: true, message: 'Video deleted successfully' };
    } catch (error) {
      console.error('Error deleting video:', error);
      return { success: false, message: 'Failed to delete video' };
    }
  }

  async getWorkerHealth() {
    try {
      const healthJson = await this.redis.get('worker_health');
      if (healthJson) {
        return JSON.parse(healthJson);
      }
      return {
        status: 'unknown',
        message: 'Worker health status not available',
      };
    } catch (error) {
      console.error('Error getting worker health:', error);
      return { status: 'error', message: 'Failed to get worker health' };
    }
  }
}
