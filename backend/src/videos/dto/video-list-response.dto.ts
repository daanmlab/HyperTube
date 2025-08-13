import { ApiProperty } from '@nestjs/swagger';

export class VideoListItemDto {
  @ApiProperty({
    description: 'Video filename/ID',
    example: '1234567890-video.mp4',
  })
  id: string;

  @ApiProperty({
    description: 'Original filename',
    example: 'my-video.mp4',
  })
  originalName: string;

  @ApiProperty({
    description: 'Current processing status',
    example: 'ready',
    enum: ['uploaded', 'processing', 'ready', 'error'],
  })
  status: string;

  @ApiProperty({
    description: 'Whether video is available for streaming',
    example: true,
  })
  availableForStreaming: boolean;

  @ApiProperty({
    description: 'Available quality levels',
    example: ['360p', '480p', '720p'],
    type: [String],
  })
  availableQualities: string[];

  @ApiProperty({
    description: 'Video duration in seconds',
    example: 120.5,
    required: false,
  })
  duration?: number;

  @ApiProperty({
    description: 'Upload timestamp',
    example: '2025-08-13T10:30:00Z',
  })
  uploadedAt: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 102400000,
  })
  fileSize: number;
}

export class VideoListResponseDto {
  @ApiProperty({
    description: 'List of videos',
    type: [VideoListItemDto],
  })
  videos: VideoListItemDto[];

  @ApiProperty({
    description: 'Total number of videos',
    example: 25,
  })
  total: number;
}
