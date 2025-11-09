import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import * as fs from 'fs';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSubtitleDto } from './dto/create-subtitle.dto';
import { SubtitleResponseDto } from './dto/subtitle-response.dto';
import { SubtitlesService } from './subtitles.service';

@ApiTags('subtitles')
@Controller('subtitles')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SubtitlesController {
  constructor(private readonly subtitlesService: SubtitlesService) {}

  /**
   * List available subtitles for a movie
   */
  @Get(':imdbId')
  @Public()
  @ApiOperation({ summary: 'List available subtitles for a movie' })
  @ApiResponse({
    status: 200,
    description: 'List of available subtitles',
  })
  async listSubtitles(@Param('imdbId') imdbId: string) {
    const subtitles = await this.subtitlesService.listByMovie(imdbId);

    return {
      imdbId,
      count: subtitles.length,
      subtitles: subtitles.map((s) => ({
        language: s.language,
        languageName: s.languageName,
        url: `/api/subtitles/${imdbId}/${s.language}`,
      })),
    };
  }

  /**
   * Serve subtitle file in WebVTT format
   */
  @Get(':imdbId/:language')
  @Public()
  @ApiOperation({ summary: 'Get subtitle file for a movie in specific language' })
  @ApiResponse({
    status: 200,
    description: 'WebVTT subtitle file',
  })
  @ApiResponse({
    status: 404,
    description: 'Subtitle not found',
  })
  async getSubtitleFile(
    @Param('imdbId') imdbId: string,
    @Param('language') language: string,
    @Res() res: Response,
  ) {
    const subtitle = await this.subtitlesService.getByMovieAndLanguage(imdbId, language);

    if (!subtitle || !fs.existsSync(subtitle.filePath)) {
      throw new HttpException('Subtitle not found', HttpStatus.NOT_FOUND);
    }

    res.setHeader('Content-Type', 'text/vtt');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    res.sendFile(subtitle.filePath);
  }

  /**
   * Search and download subtitles from OpenSubtitles
   */
  @Post(':imdbId/search')
  @Public()
  @ApiOperation({ summary: 'Search and download subtitles for a movie' })
  @ApiResponse({
    status: 200,
    description: 'Subtitles searched and downloaded',
  })
  async searchSubtitles(
    @Param('imdbId') imdbId: string,
    @Body() body?: { languages?: string[] },
  ) {
    const languages = body?.languages || ['en'];
    const subtitles = await this.subtitlesService.searchAndDownload(imdbId, languages);

    return {
      message: `Found ${subtitles.length} subtitle(s)`,
      count: subtitles.length,
      subtitles: subtitles.map((s) => ({
        language: s.language,
        languageName: s.languageName,
        url: `/api/subtitles/${imdbId}/${s.language}`,
      })),
    };
  }

  @Post()
  @ApiOperation({ summary: 'Upload subtitle for a movie' })
  @ApiResponse({
    status: 201,
    description: 'Subtitle created successfully',
    type: SubtitleResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Subtitle already exists for this language',
  })
  async create(@Body() createSubtitleDto: CreateSubtitleDto): Promise<SubtitleResponseDto> {
    return this.subtitlesService.create(createSubtitleDto);
  }

  @Get('movie/:imdbId')
  @ApiOperation({ summary: 'Get all subtitles for a movie' })
  @ApiResponse({
    status: 200,
    description: 'List of subtitles',
    type: [SubtitleResponseDto],
  })
  async findByMovie(@Param('imdbId') imdbId: string): Promise<SubtitleResponseDto[]> {
    return this.subtitlesService.findByMovie(imdbId);
  }

  @Get('movie/:imdbId/:language')
  @ApiOperation({ summary: 'Get subtitle for a movie in specific language' })
  @ApiResponse({
    status: 200,
    description: 'Subtitle details',
    type: SubtitleResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Subtitle not found',
  })
  async findByMovieAndLanguage(
    @Param('imdbId') imdbId: string,
    @Param('language') language: string,
  ): Promise<SubtitleResponseDto> {
    return this.subtitlesService.findByMovieAndLanguage(imdbId, language);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a subtitle' })
  @ApiResponse({
    status: 200,
    description: 'Subtitle deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Subtitle not found',
  })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    await this.subtitlesService.remove(id);
    return { message: 'Subtitle deleted successfully' };
  }
}
