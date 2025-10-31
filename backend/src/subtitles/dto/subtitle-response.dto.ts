import { ApiProperty } from '@nestjs/swagger';

export class SubtitleResponseDto {
  @ApiProperty({
    description: 'Subtitle ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'IMDb ID of the movie',
    example: 'tt0816692',
  })
  imdbId: string;

  @ApiProperty({
    description: 'Language code',
    example: 'en',
  })
  language: string;

  @ApiProperty({
    description: 'File path to the subtitle file',
    example: '/subtitles/tt0816692/en.srt',
  })
  filePath: string;

  @ApiProperty({
    description: 'Additional metadata',
    example: { format: 'srt', encoding: 'utf-8' },
    required: false,
  })
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2025-10-31T12:00:00Z',
  })
  createdAt: Date;
}
