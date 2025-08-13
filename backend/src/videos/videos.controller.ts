import {
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { VideosService } from './videos.service';

@ApiTags('Videos')
@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a video file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Video upload accepted and processing started.',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      dest: '/app/videos', // Shared volume path
    })
  )
  uploadVideo(@UploadedFile() file: Express.Multer.File) {
    return this.videosService.handleUpload(file);
  }

  @Get()
  @ApiOperation({ summary: 'List all uploaded videos' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of all videos with their processing status.',
  })
  async listVideos() {
    return this.videosService.listVideos();
  }

  @Public()
  @Get(':videoId/hls.m3u8')
  @ApiOperation({ summary: 'Get HLS playlist for processed video' })
  @ApiParam({ name: 'videoId', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Returns HLS playlist (.m3u8) for video.',
  })
  async getHlsPlaylist(
    @Param('videoId') videoId: string,
    @Res() res: Response
  ) {
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
    @Res() res: Response
  ) {
    return this.videosService.getHlsSegment(videoId, segment, res);
  }
}
