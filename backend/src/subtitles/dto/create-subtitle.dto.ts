import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateSubtitleDto {
  @ApiProperty({
    description: 'IMDb ID of the movie',
    example: 'tt0816692',
  })
  @IsString()
  @IsNotEmpty()
  imdbId: string;

  @ApiProperty({
    description: 'Language code (e.g., en, fr, es)',
    example: 'en',
    maxLength: 5,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5)
  language: string;

  @ApiProperty({
    description: 'File path to the subtitle file',
    example: '/subtitles/tt0816692/en.srt',
  })
  @IsString()
  @IsNotEmpty()
  filePath: string;

  @ApiProperty({
    description: 'Additional metadata (optional)',
    example: { format: 'srt', encoding: 'utf-8' },
    required: false,
  })
  metadata?: Record<string, any>;
}
