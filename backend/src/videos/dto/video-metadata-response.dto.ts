import { ApiProperty } from '@nestjs/swagger';

export class VideoMetadataResponseDto {
  @ApiProperty({
    description: 'Video filename/ID',
    example: '1234567890-video.mp4',
  })
  filename: string;

  @ApiProperty({
    description: 'Original filename',
    example: 'my-video.mp4',
  })
  originalName: string;

  @ApiProperty({
    description: 'Video duration in seconds',
    example: 120.5,
  })
  duration: number;

  @ApiProperty({
    description: 'Video width in pixels',
    example: 1920,
  })
  width: number;

  @ApiProperty({
    description: 'Video height in pixels',
    example: 1080,
  })
  height: number;

  @ApiProperty({
    description: 'Video bitrate in bits per second',
    example: 5000000,
  })
  bitrate: number;

  @ApiProperty({
    description: 'Video frame rate',
    example: 30,
  })
  framerate: number;

  @ApiProperty({
    description: 'Video codec',
    example: 'h264',
  })
  codec: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 102400000,
  })
  fileSize: number;

  @ApiProperty({
    description: 'Upload timestamp',
    example: '2025-08-13T10:30:00Z',
  })
  uploadedAt: string;
}
