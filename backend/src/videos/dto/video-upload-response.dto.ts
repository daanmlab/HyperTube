import { ApiProperty } from '@nestjs/swagger';

export class VideoUploadResponseDto {
  @ApiProperty({
    description: 'Unique filename/ID of the uploaded video',
    example: '1234567890-video.mp4',
  })
  filename: string;

  @ApiProperty({
    description: 'File path where the video is stored',
    example: '/uploads/1234567890-video.mp4',
  })
  path: string;

  @ApiProperty({
    description: 'Initial upload status',
    example: 'uploaded',
    enum: ['uploaded', 'processing', 'ready', 'error'],
  })
  status: string;

  @ApiProperty({
    description: 'Human-readable message about the upload',
    example: 'Video uploaded successfully and queued for processing',
  })
  message: string;
}
