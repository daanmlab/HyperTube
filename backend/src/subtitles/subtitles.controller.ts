import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
