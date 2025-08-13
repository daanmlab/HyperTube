import { ApiProperty } from '@nestjs/swagger';

export class VideoStatusResponseDto {
  @ApiProperty({
    description: 'Current processing status of the video',
    example: 'processing',
    enum: ['uploaded', 'processing', 'ready', 'error'],
  })
  status: string;

  @ApiProperty({
    description: 'Current processing progress percentage',
    example: 45,
    minimum: 0,
    maximum: 100,
  })
  progress: number;

  @ApiProperty({
    description: 'Human-readable status message',
    example: 'Processing quality 720p...',
  })
  message: string;

  @ApiProperty({
    description:
      'Whether the video is available for streaming (at least one quality ready)',
    example: true,
  })
  availableForStreaming: boolean;

  @ApiProperty({
    description: 'List of available quality levels',
    example: ['360p', '480p'],
    type: [String],
  })
  availableQualities: string[];

  @ApiProperty({
    description: 'Number of completed qualities',
    example: 2,
  })
  completedQualities: number;

  @ApiProperty({
    description: 'Total number of qualities being processed',
    example: 4,
  })
  totalQualities: number;

  @ApiProperty({
    description: 'Estimated time remaining in seconds',
    example: 120,
    required: false,
  })
  estimatedTimeRemaining?: number;

  @ApiProperty({
    description: 'Error message if status is error',
    required: false,
  })
  error?: string;
}
