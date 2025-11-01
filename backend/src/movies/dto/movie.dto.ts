import { ApiProperty } from '@nestjs/swagger';

export class MovieDto {
  @ApiProperty({ example: 'tt0816692' })
  imdbId: string;

  @ApiProperty({ example: 'Interstellar' })
  title: string;

  @ApiProperty({ example: 2014 })
  year: number;

  @ApiProperty({ required: false })
  synopsis?: string;

  @ApiProperty({ required: false })
  runtime?: number;

  @ApiProperty({ required: false, isArray: true, type: String })
  genres?: string[];

  @ApiProperty({ required: false })
  imageUrl?: string;

  @ApiProperty({ required: false })
  rating?: string;

  @ApiProperty({ required: false })
  trailerUrl?: string;

  @ApiProperty({
    enum: ['downloading', 'transcoding', 'ready', 'error'],
    example: 'ready',
  })
  status: 'downloading' | 'transcoding' | 'ready' | 'error';

  @ApiProperty({
    required: false,
    example: true,
    description: 'Whether the movie can be streamed (enough segments buffered)',
  })
  canStream?: boolean;

  @ApiProperty({ required: false })
  ariaGid?: string;

  @ApiProperty({ required: false })
  magnetUrl?: string;

  @ApiProperty({ required: false })
  selectedQuality?: string;

  @ApiProperty({ required: false })
  totalSize?: string;

  @ApiProperty({ required: false })
  downloadedSize?: string;

  @ApiProperty({ required: false })
  downloadProgress?: string;

  @ApiProperty({ required: false })
  downloadPath?: string;

  @ApiProperty({ required: false })
  videoPath?: string;

  @ApiProperty({ required: false })
  transcodeProgress?: string;

  @ApiProperty({ required: false, example: '480p' })
  currentQuality?: string;

  @ApiProperty({ required: false, example: '6' })
  currentQualityProgress?: string;

  @ApiProperty({ required: false, isArray: true, type: String })
  availableQualities?: string[];

  @ApiProperty({ required: false })
  metadata?: any;

  @ApiProperty({ required: false })
  errorMessage?: string;

  @ApiProperty({ required: false })
  lastWatchedAt?: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}
