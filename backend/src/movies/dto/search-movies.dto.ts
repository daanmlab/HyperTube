import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SearchMoviesDto {
  @ApiProperty({ description: 'Search query term', required: false })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiProperty({ description: 'Genre filter', required: false })
  @IsOptional()
  @IsString()
  genre?: string;

  @ApiProperty({ description: 'Minimum IMDb rating', required: false, minimum: 0, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  minRating?: number;

  @ApiProperty({ description: 'Production year', required: false })
  @IsOptional()
  @IsInt()
  year?: number;

  @ApiProperty({
    description: 'Sort by field',
    required: false,
    enum: ['title', 'year', 'rating', 'trending'],
  })
  @IsOptional()
  @IsString()
  sortBy?: 'title' | 'year' | 'rating' | 'trending';

  @ApiProperty({
    description: 'Sort order',
    required: false,
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsString()
  order?: 'asc' | 'desc';

  @ApiProperty({ description: 'Page number', required: false, default: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({
    description: 'Items per page',
    required: false,
    default: 20,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
