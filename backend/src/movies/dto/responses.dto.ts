import { ApiProperty } from '@nestjs/swagger';
import { MovieDto } from './movie.dto';

export class StartDownloadResponseDto {
  @ApiProperty({ example: 'Download started' })
  message: string;

  @ApiProperty({ example: 'tt0816692' })
  imdbId: string;

  @ApiProperty({ example: '720p' })
  quality: string;

  @ApiProperty({ example: 'aria2_result_gid' })
  ariaResult: string;

  @ApiProperty({ type: MovieDto })
  movieRecord: Partial<MovieDto>;
}

export class MessageResponseDto {
  @ApiProperty({ example: 'Success' })
  message: string;
}

export class SearchResponseDto {
  @ApiProperty({ required: false })
  data?: any;
}

export class DeleteResponseDto {
  @ApiProperty({ example: 'Movie deleted successfully' })
  message: string;
}
