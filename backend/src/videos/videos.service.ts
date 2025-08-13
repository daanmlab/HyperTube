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

  async getHlsPlaylist(videoId: string, res: Response) {
    const playlistPath = path.join(
      this.videosDir,
      videoId + '_hls',
      'output.m3u8'
    );
    if (!fs.existsSync(playlistPath)) {
      return res.status(404).send('HLS playlist not found or still processing');
    }
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    fs.createReadStream(playlistPath).pipe(res);
  }

  async getHlsSegment(videoId: string, segment: string, res: Response) {
    const segmentPath = path.join(this.videosDir, videoId + '_hls', segment);
    if (!fs.existsSync(segmentPath)) {
      return res.status(404).send('Segment not found');
    }
    res.setHeader('Content-Type', 'video/MP2T');
    fs.createReadStream(segmentPath).pipe(res);
  }
}
