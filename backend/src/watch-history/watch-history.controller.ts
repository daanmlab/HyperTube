import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateWatchProgressDto, WatchHistoryResponseDto } from './dto';
import { WatchHistoryService } from './watch-history.service';

@ApiTags('watch-history')
@Controller('watch-history')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WatchHistoryController {
  constructor(private readonly watchHistoryService: WatchHistoryService) {}

  @Post('progress')
  @ApiOperation({ summary: 'Update watch progress for a movie' })
  @ApiResponse({
    status: 200,
    description: 'Watch progress updated successfully',
    type: WatchHistoryResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Movie not found' })
  async updateProgress(
    @Body() updateWatchProgressDto: UpdateWatchProgressDto,
    @Request() req: any,
  ): Promise<WatchHistoryResponseDto> {
    return this.watchHistoryService.updateProgress(
      updateWatchProgressDto,
      req.user,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get user watch history' })
  @ApiResponse({
    status: 200,
    description: 'Watch history retrieved successfully',
    type: [WatchHistoryResponseDto],
  })
  async getUserHistory(@Request() req: any): Promise<WatchHistoryResponseDto[]> {
    return this.watchHistoryService.getUserHistory(req.user.id);
  }

  @Get('movie/:imdbId')
  @ApiOperation({ summary: 'Get watch progress for a specific movie' })
  @ApiResponse({
    status: 200,
    description: 'Watch progress retrieved successfully',
    type: WatchHistoryResponseDto,
  })
  async getMovieProgress(
    @Param('imdbId') imdbId: string,
    @Request() req: any,
  ): Promise<WatchHistoryResponseDto | null> {
    return this.watchHistoryService.getMovieProgress(imdbId, req.user);
  }

  @Put('movie/:imdbId/complete')
  @ApiOperation({ summary: 'Mark a movie as completed' })
  @ApiResponse({ status: 200, description: 'Movie marked as completed' })
  async markAsCompleted(
    @Param('imdbId') imdbId: string,
    @Request() req: any,
  ): Promise<{ message: string }> {
    await this.watchHistoryService.markAsCompleted(imdbId, req.user);
    return { message: 'Movie marked as completed' };
  }
}
