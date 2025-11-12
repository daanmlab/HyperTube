# HyperTube Streaming Implementation TODO

This document outlines the tasks required to implement the streaming flow described in [STREAMING_FLOW.md](./STREAMING_FLOW.md).

## Status Overview

- **Current Architecture**: HLS-based streaming with pre-transcoding
- **Target Architecture**: Progressive MP4 streaming with on-demand transcoding
- **Recommended**: Hybrid approach supporting both methods

---

## Phase 1: Authentication & Basic Streaming Endpoint

### ✅ Already Complete
- JWT authentication infrastructure
- User entity and auth guards
- Watch history tracking

### 🔨 TODO

#### 1.1 Add Stream Endpoint with Authentication
**Priority**: HIGH  
**File**: `backend/src/movies/movies.controller.ts`

```typescript
@Get(':imdbId/stream')
// Remove @Public() - require authentication
@UseGuards(JwtAuthGuard)
async streamMovie(
  @Param('imdbId') imdbId: string,
  @Req() req: Request,
  @Res() res: Response
) {
  // Check if cached MP4 exists
  // If yes: serve with Range support
  // If no: check if MKV is downloaded
  // Start on-demand transcoding if needed
}
```

**Dependencies**: None  
**Estimated Time**: 2-3 hours

---

## Phase 2: Progressive Download Detection

### 🔨 TODO

#### 2.1 Implement Download Status Detection
**Priority**: HIGH  
**File**: `backend/src/movies/aria/aria.service.ts`

Add method to check if download is:
- Complete (100%)
- In progress (with byte range available)
- Not started

```typescript
async getDownloadStatus(gid: string): Promise<{
  status: 'complete' | 'downloading' | 'paused' | 'error';
  completedLength: number;
  totalLength: number;
  downloadSpeed: number;
  files: Array<{ path: string; completedLength: number }>;
}>;
```

**Dependencies**: Existing aria2 RPC client  
**Estimated Time**: 1-2 hours

#### 2.2 Add Buffer Check for In-Progress Downloads
**Priority**: MEDIUM  
**File**: `backend/src/movies/movies.service.ts`

```typescript
async isDownloadReadyForStreaming(
  imdbId: string,
  minBufferBytes: number = 50 * 1024 * 1024 // 50MB default
): Promise<boolean> {
  // Check aria2 status
  // Verify file exists on disk
  // Check if minBufferBytes are available from start
  return boolean;
}
```

**Dependencies**: Task 2.1  
**Estimated Time**: 2 hours

---

## Phase 3: On-Demand Transcoding

### 🔨 TODO

#### 3.1 Modify Transcoding Trigger
**Priority**: HIGH  
**Files**: 
- `backend/src/movies/movies.service.ts`
- `worker/src/main.ts`

**Current**: Worker automatically transcodes after download completes  
**Target**: Transcode only when user requests stream

Changes needed:
1. Add flag in movie entity: `autoTranscode` (default: false)
2. Modify worker to only transcode if `autoTranscode` is true
3. Add method to manually trigger transcoding from stream endpoint

```typescript
async triggerTranscoding(imdbId: string): Promise<void> {
  const movie = await this.findByImdbId(imdbId);
  // Push transcoding job to Redis queue
  await this.redis.lpush('jobs', JSON.stringify({
    type: 'processVideo',
    inputPath: movie.downloadPath,
    outputDir: `/app/videos/${imdbId}_hls`,
    videoId: imdbId,
  }));
}
```

**Dependencies**: Phase 1  
**Estimated Time**: 3-4 hours

#### 3.2 Implement Streaming During Transcoding
**Priority**: MEDIUM  
**File**: `worker/src/main.ts`

Currently FFmpeg outputs to file. Need to:
1. Create HTTP streaming endpoint in backend
2. Pipe FFmpeg stdout to HTTP response
3. Simultaneously write to cache file

```typescript
// In transcoder
const ffmpegProcess = ffmpeg(inputPath)
  .format('mp4')
  .pipe();

// Split stream using PassThrough
const passThrough1 = new PassThrough(); // to HTTP
const passThrough2 = new PassThrough(); // to cache file

ffmpegProcess.pipe(passThrough1);
ffmpegProcess.pipe(passThrough2);
```

**Dependencies**: Task 3.1  
**Estimated Time**: 4-5 hours

---

## Phase 4: HTTP Range Request Support

### 🔨 TODO

#### 4.1 Add Range Header Support
**Priority**: HIGH  
**File**: `backend/src/movies/movies.controller.ts`

```typescript
@Get(':imdbId/stream')
async streamMovie(@Headers('range') range: string) {
  const filePath = await this.getVideoPath(imdbId);
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    
    const stream = fs.createReadStream(filePath, { start, end });
    
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': 'video/mp4',
    });
    
    stream.pipe(res);
  } else {
    // Full file streaming
  }
}
```

**Dependencies**: Phase 1  
**Estimated Time**: 2-3 hours

---

## Phase 5: Subtitle Integration

### ✅ Already Complete
- Subtitle entity
- Basic subtitle service

### 🔨 TODO

#### 5.1 Integrate OpenSubtitles API
**Priority**: MEDIUM  
**File**: `backend/src/subtitles/subtitles.service.ts`

Install: `npm install opensubtitles-api`

```typescript
import OpenSubtitles from 'opensubtitles-api';

async searchSubtitles(
  imdbId: string, 
  languages: string[] = ['en']
): Promise<SubtitleSearchResult[]> {
  const OS = new OpenSubtitles({
    useragent: 'HyperTube v1.0',
  });
  
  return await OS.search({
    imdbid: imdbId,
    sublanguageid: languages.join(','),
  });
}
```

**Dependencies**: None  
**Estimated Time**: 2-3 hours

#### 5.2 Add Subtitle Download Method
**Priority**: MEDIUM  
**File**: `backend/src/subtitles/subtitles.service.ts`

```typescript
async downloadSubtitle(
  subtitleUrl: string,
  imdbId: string,
  language: string
): Promise<string> {
  // Download subtitle file
  // Save to /app/subtitles/{imdbId}_{language}.srt
  // Create database record
  // Return file path
}
```

**Dependencies**: Task 5.1  
**Estimated Time**: 1-2 hours

#### 5.3 Implement SRT to WebVTT Conversion
**Priority**: MEDIUM  
**File**: `backend/src/subtitles/subtitles.service.ts`

Install: `npm install srt-webvtt`

```typescript
import srtToVtt from 'srt-webvtt';

async convertToWebVTT(srtPath: string): Promise<string> {
  const vttPath = srtPath.replace('.srt', '.vtt');
  await srtToVtt(srtPath, vttPath);
  return vttPath;
}
```

**Dependencies**: Task 5.2  
**Estimated Time**: 1 hour

#### 5.4 Create Subtitle Endpoints
**Priority**: MEDIUM  
**File**: `backend/src/subtitles/subtitles.controller.ts`

```typescript
@Get(':imdbId/available')
async getAvailableSubtitles(@Param('imdbId') imdbId: string) {
  // Return list of available subtitle languages
}

@Get(':imdbId/:language')
async getSubtitle(
  @Param('imdbId') imdbId: string,
  @Param('language') language: string,
  @Res() res: Response
) {
  // Serve .vtt file
  res.setHeader('Content-Type', 'text/vtt');
  res.sendFile(vttPath);
}

@Post(':imdbId/search')
async searchAndDownload(
  @Param('imdbId') imdbId: string,
  @Body('languages') languages: string[]
) {
  // Search, download, convert, and store subtitles
}
```

**Dependencies**: Tasks 5.1-5.3  
**Estimated Time**: 2 hours

---

## Phase 6: Database Schema Updates

### 🔨 TODO

#### 6.1 Update Movie Entity
**Priority**: HIGH  
**File**: `backend/src/entities/movie.entity.ts`

Add fields:
```typescript
@Column({ nullable: true })
transcodedPath?: string; // Path to cached MP4

@Column({ default: false })
isFullyTranscoded: boolean;

@Column({ type: 'timestamp', nullable: true })
cacheCreatedAt?: Date;

@Column({ default: false })
autoTranscode: boolean;
```

**Dependencies**: None  
**Estimated Time**: 30 minutes

#### 6.2 Create Migration
**Priority**: HIGH  
**Command**: `npm run migration:generate -- AddTranscodedPathToMovie`

**Dependencies**: Task 6.1  
**Estimated Time**: 30 minutes

#### 6.3 Add User Language Preference
**Priority**: LOW  
**File**: `backend/src/entities/user.entity.ts`

```typescript
@Column({ default: 'en' })
preferredSubtitleLanguage: string;
```

**Dependencies**: None  
**Estimated Time**: 30 minutes

---

## Phase 7: MP4 Cache Management

### 🔨 TODO

#### 7.1 Implement Cache Finalization
**Priority**: HIGH  
**File**: `worker/src/main.ts`

After transcoding completes:
```typescript
// Rename temp file
fs.renameSync(
  `/app/videos/${videoId}_temp.mp4`,
  `/app/videos/${videoId}.mp4`
);

// Update database
await axios.post(`${backendUrl}/movies/update-cache`, {
  imdbId: videoId,
  transcodedPath: `/app/videos/${videoId}.mp4`,
  isFullyTranscoded: true,
  cacheCreatedAt: new Date().toISOString(),
});
```

**Dependencies**: Phase 6  
**Estimated Time**: 1-2 hours

#### 7.2 Add Cache API Endpoint
**Priority**: MEDIUM  
**File**: `backend/src/movies/movies.controller.ts`

```typescript
@Post('update-cache')
async updateCache(
  @Body() updateCacheDto: UpdateCacheDto
): Promise<MessageResponseDto> {
  await this.moviesService.updateCache(updateCacheDto);
  return { message: 'Cache updated successfully' };
}
```

**Dependencies**: Task 7.1  
**Estimated Time**: 1 hour

---

## Phase 8: Cleanup Cron Job

### 🔨 TODO

#### 8.1 Create Monthly Cleanup Job
**Priority**: MEDIUM  
**File**: `backend/src/movies/movies.service.ts`

```typescript
@Cron(CronExpression.EVERY_DAY_AT_3AM)
async cleanupOldMovies(): Promise<void> {
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const oldMovies = await this.movieRepository
    .createQueryBuilder('movie')
    .where('movie.lastWatchedAt < :date', { date: oneMonthAgo })
    .getMany();

  for (const movie of oldMovies) {
    await this.deleteMovieFiles(movie);
  }
}
```

**Dependencies**: None  
**Estimated Time**: 2 hours

#### 8.2 Implement File Cleanup
**Priority**: MEDIUM  
**File**: `backend/src/movies/movies.service.ts`

```typescript
async deleteMovieFiles(movie: Movie): Promise<void> {
  const filesToDelete = [
    movie.downloadPath,      // MKV
    movie.transcodedPath,    // MP4
    movie.videoPath,         // HLS directory
    `/app/subtitles/${movie.imdbId}_*.vtt`, // Subtitles
  ];

  for (const filePath of filesToDelete) {
    if (filePath && fs.existsSync(filePath)) {
      if (fs.lstatSync(filePath).isDirectory()) {
        fs.rmSync(filePath, { recursive: true });
      } else {
        fs.unlinkSync(filePath);
      }
    }
  }

  // Update database
  movie.downloadPath = null;
  movie.transcodedPath = null;
  movie.videoPath = null;
  await this.movieRepository.save(movie);
}
```

**Dependencies**: Task 8.1  
**Estimated Time**: 1-2 hours

---

## Phase 9: Frontend Integration

### 🔨 TODO

#### 9.1 Update Video Player Component
**Priority**: MEDIUM  
**File**: `frontend/src/components/VideoPlayer.tsx`

Add support for:
1. Direct MP4 URLs with Range requests
2. Subtitle tracks
3. Fallback to HLS if MP4 not available

```typescript
<video controls>
  <source src={`/api/movies/${imdbId}/stream`} type="video/mp4" />
  <track
    kind="subtitles"
    src={`/api/subtitles/${imdbId}/en`}
    srcLang="en"
    label="English"
  />
</video>
```

**Dependencies**: Phase 4, Phase 5  
**Estimated Time**: 3-4 hours

#### 9.2 Add Subtitle Selection UI
**Priority**: LOW  
**File**: `frontend/src/components/VideoPlayer.tsx`

```typescript
const [availableSubtitles, setAvailableSubtitles] = useState([]);

useEffect(() => {
  fetch(`/api/subtitles/${imdbId}/available`)
    .then(res => res.json())
    .then(setAvailableSubtitles);
}, [imdbId]);
```

**Dependencies**: Task 9.1  
**Estimated Time**: 2 hours

---

## Phase 10: Testing & Optimization

### 🔨 TODO

#### 10.1 Test Progressive Streaming
**Priority**: HIGH  

Test scenarios:
- ✅ Stream with complete download
- ✅ Stream with partial download (50% complete)
- ✅ Seeking forward/backward in video
- ✅ Multiple concurrent streams
- ✅ Cache creation after first watch

**Dependencies**: All previous phases  
**Estimated Time**: 4-6 hours

#### 10.2 Performance Optimization
**Priority**: MEDIUM  

Optimize:
- FFmpeg transcoding settings (preset, CRF)
- Buffer sizes for streaming
- Redis queue processing
- Database query performance

**Dependencies**: Task 10.1  
**Estimated Time**: 2-4 hours

#### 10.3 Error Handling
**Priority**: HIGH  

Add comprehensive error handling for:
- Network interruptions during download
- FFmpeg crashes during transcoding
- Disk space issues
- Corrupted video files

**Dependencies**: All phases  
**Estimated Time**: 3-4 hours

---

## Summary

### Total Estimated Time
- **Phase 1-3**: 11-14 hours (Core streaming functionality)
- **Phase 4-5**: 8-11 hours (Range requests & subtitles)
- **Phase 6-7**: 4-6 hours (Database & caching)
- **Phase 8**: 3-4 hours (Cleanup)
- **Phase 9**: 5-6 hours (Frontend)
- **Phase 10**: 9-14 hours (Testing & optimization)

**Total**: 40-55 hours

### Critical Path
1. Phase 1: Stream endpoint (required for all)
2. Phase 3: On-demand transcoding (core feature)
3. Phase 4: Range support (essential for seeking)
4. Phase 10: Testing (ensure stability)

### Optional Features (Can be deferred)
- Phase 5: Subtitles
- Phase 8: Cleanup cron job
- Task 9.2: Subtitle selection UI

---

## Architecture Decision: Hybrid Approach

**Recommendation**: Support both streaming methods:

### HLS (Current)
✅ Adaptive bitrate  
✅ Better mobile support  
✅ Industry standard  
❌ More complex  
❌ Higher latency  

### Progressive MP4 (New)
✅ Simpler implementation  
✅ Lower latency  
✅ Better seek performance  
❌ Fixed bitrate  
❌ Less adaptive  

### Implementation Strategy
1. Keep HLS for completed transcodes
2. Add progressive MP4 for on-demand streaming
3. Frontend auto-selects based on availability
4. Cache transcoded MP4 after HLS completes

This provides best of both worlds!
