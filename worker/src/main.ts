import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT || 6379),
});

import { exec } from 'node:child_process';
import path from 'node:path';

// Transpose and segment video using FFmpeg
interface ProcessVideoJob {
  type: 'processVideo';
  inputPath: string;
  outputDir?: string;
  transpose?: number;
  segmentTime?: number;
  hls?: boolean;
  videoId?: string;
}

function processVideoTask(jobData: ProcessVideoJob) {
  const inputPath = jobData.inputPath;
  const outputDir = jobData.outputDir || path.dirname(inputPath);
  const transpose = jobData.transpose ?? 1; // 1=90° clockwise
  const segmentTime = jobData.segmentTime ?? 10; // seconds

  if (jobData.hls) {
    // Generate HLS output (m3u8 playlist + ts segments)
    const playlistPath = path.join(outputDir, 'output.m3u8');
    const segmentPattern = path.join(outputDir, 'segment_%03d.ts');

    // FFmpeg command for HLS with transpose
    const cmd = `ffmpeg -y -i "${inputPath}" -vf "transpose=${transpose}" -c:v libx264 -c:a aac -hls_time ${segmentTime} -hls_list_size 0 -f hls "${playlistPath}"`;
    console.log('Running FFmpeg HLS:', cmd);

    exec(cmd, (err: Error | null, stdout: string, stderr: string) => {
      if (err) {
        console.error('FFmpeg HLS error:', err);
        return;
      }
      console.log('FFmpeg HLS completed for video:', jobData.videoId);
      console.log('FFmpeg output:', stdout);
      console.log('FFmpeg stderr:', stderr);
    });
  } else {
    // Original segmented MP4 output
    const outputPattern = path.join(outputDir, 'segment_%03d.mp4');
    const cmd = `ffmpeg -y -i "${inputPath}" -vf "transpose=${transpose}" -c:v libx264 -c:a copy -f segment -segment_time ${segmentTime} "${outputPattern}"`;
    console.log('Running FFmpeg:', cmd);

    exec(cmd, (err: Error | null, stdout: string, stderr: string) => {
      if (err) {
        console.error('FFmpeg error:', err);
        return;
      }
      console.log('FFmpeg output:', stdout);
      console.log('FFmpeg stderr:', stderr);
    });
  }
}

setInterval(async () => {
  const job = await redis.lpop('jobs');
  if (job) {
    console.log('Processing job', job);
    let jobData: ProcessVideoJob;
    try {
      jobData = JSON.parse(job);
    } catch (e) {
      console.error('Invalid job data:', job);
      return;
    }
    if (jobData.type === 'processVideo') {
      processVideoTask(jobData);
    } else {
      console.log('Unknown job type:', jobData.type);
    }
  }
}, 1000);
