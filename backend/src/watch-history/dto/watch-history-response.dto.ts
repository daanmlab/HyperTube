import { ApiProperty } from '@nestjs/swagger';

export class WatchHistoryResponseDto {
  @ApiProperty({ example: 'uuid-here' })
  id: string;

  @ApiProperty({ example: 'tt0816692' })
  imdbId: string;

  @ApiProperty({ example: 'Interstellar' })
  movieTitle: string;

  @ApiProperty({ example: 1234 })
  watchedSeconds: number;

  @ApiProperty({ example: 10144 })
  totalSeconds: number;

  @ApiProperty({ example: false })
  completed: boolean;

  @ApiProperty({ example: 12.17, description: 'Percentage watched (0-100)' })
  progressPercentage: number;

  @ApiProperty({ example: '2025-10-31T12:00:00.000Z' })
  lastWatchedAt: string;

  @ApiProperty({ example: '2025-10-31T12:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2025-10-31T12:00:00.000Z' })
  updatedAt: string;
}
