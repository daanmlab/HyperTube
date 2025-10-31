import { ApiProperty } from '@nestjs/swagger';

export class CommentUserDto {
  @ApiProperty({ example: 'uuid-here' })
  id: string;

  @ApiProperty({ example: 'john_doe' })
  username: string;

  @ApiProperty({ example: 'John' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;

  @ApiProperty({ example: 'https://example.com/avatar.jpg', required: false })
  avatarUrl?: string;
}

export class CommentResponseDto {
  @ApiProperty({ example: 'uuid-here' })
  id: string;

  @ApiProperty({ example: 'Great movie! Highly recommended.' })
  content: string;

  @ApiProperty({ example: 'tt0816692' })
  imdbId: string;

  @ApiProperty({ type: CommentUserDto })
  user: CommentUserDto;

  @ApiProperty({ example: '2025-10-31T12:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2025-10-31T12:00:00.000Z' })
  updatedAt: string;
}
