import {
    Controller,
    Delete,
    Get,
    Param,
    Res,
} from '@nestjs/common';
import {
    ApiOperation,
    ApiParam,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { VideoStatusResponseDto } from './dto/video-status-response.dto';
import { VideosService } from './videos.service';

@ApiTags('Videos')
@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Get(':videoId/status')
  @ApiOperation({ summary: 'Get video processing status' })
  @ApiParam({ name: 'videoId', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Returns video processing status and progress.',
    type: VideoStatusResponseDto,
  })
  async getVideoStatus(@Param('videoId') videoId: string): Promise<VideoStatusResponseDto> {
    return this.videosService.getVideoStatus(videoId);
  }

  @Get(':videoId/metadata')
  @ApiOperation({ summary: 'Get video metadata' })
  @ApiParam({ name: 'videoId', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Returns video metadata (duration, resolution, etc.).',
  })
  async getVideoMetadata(@Param('videoId') videoId: string) {
    return this.videosService.getVideoMetadata(videoId);
  }

  @Public()
  @Get(':videoId/master.m3u8')
  @ApiOperation({ summary: 'Get master HLS playlist for adaptive streaming' })
  @ApiParam({ name: 'videoId', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Returns master HLS playlist for adaptive bitrate streaming.',
  })
  async getMasterPlaylist(@Param('videoId') videoId: string, @Res() res: Response) {
    return this.videosService.getMasterPlaylist(videoId, res);
  }

  @Public()
  @Get(':videoId/quality/:quality')
  @ApiOperation({ summary: 'Get quality-specific HLS playlist' })
  @ApiParam({ name: 'videoId', type: 'string' })
  @ApiParam({
    name: 'quality',
    type: 'string',
    description: '360p, 480p, 720p, or 1080p',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns HLS playlist for specific quality level.',
  })
  async getQualityPlaylist(
    @Param('videoId') videoId: string,
    @Param('quality') quality: string,
    @Res() res: Response,
  ) {
    return this.videosService.getQualityPlaylist(videoId, quality, res);
  }

  @Public()
  @Get(':videoId/hls.m3u8')
  @ApiOperation({ summary: 'Get HLS playlist for processed video' })
  @ApiParam({ name: 'videoId', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Returns HLS playlist (.m3u8) for video.',
  })
  async getHlsPlaylist(@Param('videoId') videoId: string, @Res() res: Response) {
    return this.videosService.getHlsPlaylist(videoId, res);
  }

  @Public()
  @Get(':videoId/:segment')
  @ApiOperation({ summary: 'Get HLS segment for processed video' })
  @ApiParam({ name: 'videoId', type: 'string' })
  @ApiParam({ name: 'segment', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Returns HLS segment (.ts) for video.',
  })
  async getHlsSegment(
    @Param('videoId') videoId: string,
    @Param('segment') segment: string,
    @Res() res: Response,
  ) {
    return this.videosService.getHlsSegment(videoId, segment, res);
  }

  @Public()
  @Get(':videoId/thumbnails')
  @ApiOperation({ summary: 'List available thumbnails for video' })
  @ApiParam({ name: 'videoId', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of available thumbnail IDs.',
  })
  async listThumbnails(@Param('videoId') videoId: string) {
    return this.videosService.listThumbnails(videoId);
  }

  @Public()
  @Get(':videoId/thumbnail/:thumbnailId')
  @ApiOperation({ summary: 'Get video thumbnail image' })
  @ApiParam({ name: 'videoId', type: 'string' })
  @ApiParam({ name: 'thumbnailId', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Returns thumbnail image (PNG).',
  })
  async getThumbnail(
    @Param('videoId') videoId: string,
    @Param('thumbnailId') thumbnailId: string,
    @Res() res: Response,
  ) {
    return this.videosService.getThumbnail(videoId, thumbnailId, res);
  }

  @Delete(':videoId')
  @ApiOperation({ summary: 'Delete video and all associated files' })
  @ApiParam({ name: 'videoId', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Video deleted successfully.',
  })
  async deleteVideo(@Param('videoId') videoId: string) {
    return this.videosService.deleteVideo(videoId);
  }

  @Get('worker/health')
  @ApiOperation({ summary: 'Get worker health status' })
  @ApiResponse({
    status: 200,
    description: 'Returns worker health and status information.',
  })
  async getWorkerHealth() {
    return this.videosService.getWorkerHealth();
  }
}
