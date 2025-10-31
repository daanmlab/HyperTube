import { ApiProperty } from '@nestjs/swagger';

export class MovieResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  imdbId: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ required: false })
  originalTitle?: string;

  @ApiProperty({ required: false })
  summary?: string;

  @ApiProperty({ required: false })
  year?: number;

  @ApiProperty({ required: false })
  rating?: number;

  @ApiProperty({ required: false })
  runtime?: number;

  @ApiProperty({ type: [String], required: false })
  genres?: string[];

  @ApiProperty({ required: false })
  director?: string;

  @ApiProperty({ type: [String], required: false })
  cast?: string[];

  @ApiProperty({ required: false })
  posterUrl?: string;

  @ApiProperty({ required: false })
  backdropUrl?: string;

  @ApiProperty({ type: [String], required: false })
  thumbnails?: string[];

  @ApiProperty({ required: false })
  language?: string;

  @ApiProperty({ required: false })
  isDownloaded: boolean;

  @ApiProperty({ required: false })
  downloadProgress?: number;

  @ApiProperty({ required: false })
  viewCount: number;

  @ApiProperty({ type: [String], required: false })
  availableSubtitles?: string[];

  @ApiProperty({ required: false })
  hasWatched?: boolean;

  @ApiProperty()
  createdAt: Date;
}

export class MovieDetailResponseDto extends MovieResponseDto {
  @ApiProperty({ type: [Object], required: false })
  torrents?: {
    quality: string;
    type: string;
    magnetUrl: string;
    size: string;
    seeds: number;
    peers: number;
  }[];

  @ApiProperty({ required: false })
  downloadPath?: string;

  @ApiProperty({ required: false })
  lastWatchedAt?: Date;

  @ApiProperty({ required: false })
  watchedSeconds?: number;

  @ApiProperty({ required: false })
  totalSeconds?: number;

  @ApiProperty()
  commentCount: number;
}

export class MovieListResponseDto {
  @ApiProperty({ type: [MovieResponseDto] })
  movies: MovieResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
