import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import Redis from 'ioredis';
import * as fs from 'node:fs';
import * as path from 'node:path';

@Injectable()
export class VideosService {
  private readonly videosDir = '/app/videos';
  private readonly redis = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT || 6379),
  });

  handleUpload(file: Express.Multer.File) {
    const job = {
      type: 'processVideo',
      inputPath: file.path,
      outputDir: path.join(this.videosDir, file.filename + '_hls'),
      transpose: 1,
      hls: true,
      segmentTime: 10,
      videoId: file.filename,
    };
    this.redis.rpush('jobs', JSON.stringify(job));
    return { filename: file.filename, path: file.path, status: 'processing' };
  }

  async listVideos() {
    try {
      const files = fs.readdirSync(this.videosDir);
      const videos = files
        .filter(file => !file.includes('.'))
        .map(videoId => {
          const hlsDir = path.join(this.videosDir, videoId + '_hls');
          const playlistPath = path.join(hlsDir, 'output.m3u8');
          const originalPath = path.join(this.videosDir, videoId);

          let status = 'error';
          let fileSize = 0;

          if (fs.existsSync(playlistPath)) {
            status = 'ready';
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

          return {
            id: videoId,
            filename: videoId,
            status,
            fileSize,
            hasHls: fs.existsSync(playlistPath),
            createdAt: fs.existsSync(originalPath)
              ? fs.statSync(originalPath).birthtime.toISOString()
              : new Date().toISOString(),
          };
        });

      return videos;
    } catch (error) {
      console.error('Error listing videos:', error);
      return [];
    }
  }

  async getHlsPlaylist(videoId: string, res: Response) {
    const playlistPath = path.join(
      this.videosDir,
      videoId + '_hls',
      'output.m3u8'
    );
    if (!fs.existsSync(playlistPath)) {
      return res.status(404).send('HLS playlist not found or still processing');
    }

    // Set CORS headers for HLS streaming
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache');

    fs.createReadStream(playlistPath).pipe(res);
  }

  async getHlsSegment(videoId: string, segment: string, res: Response) {
    const segmentPath = path.join(this.videosDir, videoId + '_hls', segment);
    if (!fs.existsSync(segmentPath)) {
      return res.status(404).send('Segment not found');
    }

    // Set CORS headers for HLS segments
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
    res.setHeader('Content-Type', 'video/MP2T');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000');

    fs.createReadStream(segmentPath).pipe(res);
  }
}
