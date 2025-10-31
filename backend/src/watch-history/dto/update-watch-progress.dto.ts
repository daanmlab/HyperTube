import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class UpdateWatchProgressDto {
  @ApiProperty({
    description: 'IMDB ID of the movie',
    example: 'tt0816692',
  })
  @IsString()
  @IsNotEmpty()
  imdbId: string;

  @ApiProperty({
    description: 'Current watch position in seconds',
    example: 1234,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  watchedSeconds: number;

  @ApiProperty({
    description: 'Total duration in seconds',
    example: 10144,
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  totalSeconds?: number;
}
