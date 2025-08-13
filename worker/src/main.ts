import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT || 6379),
});

import { exec } from 'node:child_process';
import fs from 'node:fs';
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

  console.log(`🎬 Processing video: ${jobData.videoId}`);
  console.log(`📁 Input: ${inputPath}`);
  console.log(`📁 Output: ${outputDir}`);

  // Check if input file exists
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Input file does not exist: ${inputPath}`);
    return;
  }

  // Create output directory if it doesn't exist
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`📁 Created output directory: ${outputDir}`);
    }
  } catch (error) {
    console.error(`❌ Failed to create output directory: ${outputDir}`, error);
    return;
  }

  if (jobData.hls) {
    // Generate HLS output (m3u8 playlist + ts segments)
    const playlistPath = path.join(outputDir, 'output.m3u8');

    // FFmpeg command for HLS with transpose and better error handling
    const cmd = `ffmpeg -y -i "${inputPath}" -vf "transpose=${transpose}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -hls_time ${segmentTime} -hls_list_size 0 -hls_segment_filename "${path.join(
      outputDir,
      'segment_%03d.ts'
    )}" -f hls "${playlistPath}"`;
    console.log('🔄 Running FFmpeg HLS:', cmd);

    exec(cmd, (err: Error | null, stdout: string, stderr: string) => {
      if (err) {
        console.error('❌ FFmpeg HLS error:', err);
        console.error('❌ FFmpeg stderr:', stderr);
        console.error('❌ FFmpeg stdout:', stdout);

        // Try to clean up partial files
        try {
          if (fs.existsSync(playlistPath)) {
            fs.unlinkSync(playlistPath);
          }
          // Remove any partial segment files
          const files = fs.readdirSync(outputDir);
          files.forEach(file => {
            if (file.endsWith('.ts')) {
              fs.unlinkSync(path.join(outputDir, file));
            }
          });
        } catch (cleanupError) {
          console.error('Failed to cleanup partial files:', cleanupError);
        }

        return;
      }
      console.log('✅ FFmpeg HLS completed for video:', jobData.videoId);
      console.log('📊 FFmpeg output:', stdout);
      if (stderr) {
        console.log('⚠️  FFmpeg stderr:', stderr);
      }

      // Verify output files were created
      if (fs.existsSync(playlistPath)) {
        const segmentFiles = fs
          .readdirSync(outputDir)
          .filter(f => f.endsWith('.ts'));
        console.log(`✅ Created playlist and ${segmentFiles.length} segments`);
      } else {
        console.error('❌ Playlist file was not created');
      }
    });
  } else {
    // Original segmented MP4 output
    const outputPattern = path.join(outputDir, 'segment_%03d.mp4');
    const cmd = `ffmpeg -y -i "${inputPath}" -vf "transpose=${transpose}" -c:v libx264 -c:a copy -f segment -segment_time ${segmentTime} "${outputPattern}"`;
    console.log('🔄 Running FFmpeg:', cmd);

    exec(cmd, (err: Error | null, stdout: string, stderr: string) => {
      if (err) {
        console.error('❌ FFmpeg error:', err);
        console.error('❌ FFmpeg stderr:', stderr);
        return;
      }
      console.log('✅ FFmpeg output:', stdout);
      if (stderr) {
        console.log('⚠️  FFmpeg stderr:', stderr);
      }
    });
  }
}

console.log('🔄 Worker started, waiting for jobs...');

setInterval(async () => {
  try {
    const job = await redis.lpop('jobs');
    if (job) {
      console.log('📥 Received job:', job);
      let jobData: ProcessVideoJob;
      try {
        jobData = JSON.parse(job);
      } catch (e) {
        console.error('❌ Invalid job data:', job, e);
        return;
      }
      if (jobData.type === 'processVideo') {
        processVideoTask(jobData);
      } else {
        console.log('❓ Unknown job type:', jobData.type);
      }
    }
  } catch (error) {
    console.error('❌ Error processing job queue:', error);
  }
}, 1000);
