# HyperTube Streaming Flow Architecture

```mermaid
flowchart TD

A["User clicks 'Watch movie'"] --> A1{"Is user authenticated?"}
A1 -- No --> A2["Redirect to login / show 401"]
A1 -- Yes --> B["Backend: GET /movies/:id/stream"]

B --> C{"Transcoded MP4<br/>already cached?"}

C -- Yes --> C1["Open cached .mp4 file"]
C1 --> C2["Update last_watched_at in DB"]
C2 --> C3["Stream file via HTTP<br/>(supports Range requests)"]
C3 --> Z["User watches movie"]

C -- No --> D{"Original MKV<br/>fully downloaded?"}

D -- Yes --> D1["Use MKV file<br/>as FFmpeg input"]
D1 --> E

D -- No --> E1["Start or attach to<br/>torrent download for MKV"]

subgraph "aria2 torrent container (Docker)"
  E1 --> T1["Send JSON-RPC to aria2<br/>to add torrent/magnet"]
  T1 --> T2["aria2 downloads MKV<br/>to shared volume"]
end

T2 --> E2["Backend checks MKV on shared volume<br/>→ bytes available from start"]
E2 --> E3{"Enough data buffered<br/>for smooth start?"}
E3 -- No --> E2
E3 -- Yes --> E["Start FFmpeg with<br/>growing MKV as input"]

%% Subtitles branch
E --> S0["Check available subtitles<br/>(English + user preferred lang)"]
S0 --> S1{"Any matching subtitles?"}
S1 -- Yes --> S2["Download subtitles<br/>(e.g. .srt)"]
S2 --> S3["Convert to WebVTT if needed<br/>and store subtitle file"]
S3 --> S4["Expose subtitle URL(s)<br/>for video <track>"]
S1 -- No --> S5["No subtitles attached"]

%% Streaming and caching
E --> F["Set HTTP headers<br/>Content-Type: video/mp4"]
E --> G["Also create temp cache file<br/>e.g. movie_tmp.mp4"]

F --> H["Pipe FFmpeg stdout<br/>→ HTTP response"]
E --> I["Pipe FFmpeg stdout<br/>→ cache write stream"]

H --> J["User starts playback<br/>while transcoding continues"]
J --> Z

I --> K{"FFmpeg finished?"}
K -- No --> I
K -- Yes --> L["Close cache file<br/>rename tmp → final .mp4"]
L --> M["Update DB:<br/>transcoded_path = final .mp4,<br/>is_fully_downloaded maybe true"]

Z --> N["Update last_watched_at<br/>and mark movie as 'watched'"]

subgraph "Background cron job (daily)"
  X["Find movies with<br/>last_watched_at older than 1 month"] --> Y["Delete MKV + cached MP4 + subtitles"]
  Y --> W["Update DB paths / flags"]
end
```

## Current Implementation Status

### ✅ Already Implemented
- User authentication (JWT)
- Movie entity with status tracking
- HLS transcoding (480p, 720p, 1080p, etc.)
- aria2 download integration
- Watch history tracking
- Redis status updates
- Subtitles entity and basic service
- Cron job infrastructure (via @nestjs/schedule)

### ❌ Not Yet Implemented (TODO)
See TODO list below for details.

## Architecture Notes

### Current Approach
- Uses HLS (HTTP Live Streaming) with adaptive bitrate
- Transcodes to multiple quality levels in parallel
- Stores segments (.ts files) and playlists (.m3u8)
- Frontend uses HLS.js for playback

### Proposed Flow (from diagram)
- Direct MP4 streaming with progressive download
- Transcodes on-demand during first watch
- Caches transcoded MP4 for subsequent views
- FFmpeg piped directly to HTTP response

### Recommendation
Consider hybrid approach:
1. Keep HLS for better adaptive streaming
2. Add progressive MP4 caching for completed transcodes
3. Implement on-demand transcoding as fallback
4. Add subtitle integration to HLS workflow
