import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Movie } from '../entities/movie.entity';
import { User } from '../entities/user.entity';
import { WatchHistory } from '../entities/watch-history.entity';
import { UpdateWatchProgressDto, WatchHistoryResponseDto } from './dto';

@Injectable()
export class WatchHistoryService {
  constructor(
    @InjectRepository(WatchHistory)
    private watchHistoryRepository: Repository<WatchHistory>,
    @InjectRepository(Movie)
    private moviesRepository: Repository<Movie>,
  ) {}

  async updateProgress(
    updateWatchProgressDto: UpdateWatchProgressDto,
    user: User,
  ): Promise<WatchHistoryResponseDto> {
    // Verify movie exists
    const movie = await this.moviesRepository.findOne({
      where: { imdbId: updateWatchProgressDto.imdbId },
    });

    if (!movie) {
      throw new NotFoundException(
        `Movie with IMDB ID ${updateWatchProgressDto.imdbId} not found`,
      );
    }

    // Find existing watch history or create new
    let watchHistory = await this.watchHistoryRepository.findOne({
      where: {
        userId: user.id,
        imdbId: updateWatchProgressDto.imdbId,
      },
      relations: ['movie'],
    });

    if (!watchHistory) {
      watchHistory = this.watchHistoryRepository.create({
        userId: user.id,
        imdbId: updateWatchProgressDto.imdbId,
        watchedSeconds: updateWatchProgressDto.watchedSeconds,
        totalSeconds: updateWatchProgressDto.totalSeconds || undefined,
        lastWatchedAt: new Date(),
        movie: movie,
      });
    } else {
      watchHistory.watchedSeconds = updateWatchProgressDto.watchedSeconds;
      if (updateWatchProgressDto.totalSeconds) {
        watchHistory.totalSeconds = updateWatchProgressDto.totalSeconds;
      }
      watchHistory.lastWatchedAt = new Date();
    }

    // Auto-mark as completed if watched > 90%
    if (
      watchHistory.totalSeconds &&
      watchHistory.watchedSeconds >= watchHistory.totalSeconds * 0.9
    ) {
      watchHistory.completed = true;
    }

    const saved = await this.watchHistoryRepository.save(watchHistory);
    return this.toResponseDto(saved);
  }

  async getUserHistory(userId: string): Promise<WatchHistoryResponseDto[]> {
    const history = await this.watchHistoryRepository.find({
      where: { userId },
      relations: ['movie'],
      order: { lastWatchedAt: 'DESC' },
    });

    return history.map((item) => this.toResponseDto(item));
  }

  async getMovieProgress(
    imdbId: string,
    user: User,
  ): Promise<WatchHistoryResponseDto | null> {
    const watchHistory = await this.watchHistoryRepository.findOne({
      where: {
        userId: user.id,
        imdbId,
      },
      relations: ['movie'],
    });

    return watchHistory ? this.toResponseDto(watchHistory) : null;
  }

  async markAsCompleted(imdbId: string, user: User): Promise<void> {
    const watchHistory = await this.watchHistoryRepository.findOne({
      where: {
        userId: user.id,
        imdbId,
      },
    });

    if (watchHistory) {
      watchHistory.completed = true;
      await this.watchHistoryRepository.save(watchHistory);
    }
  }

  private toResponseDto(watchHistory: WatchHistory): WatchHistoryResponseDto {
    const progressPercentage = watchHistory.totalSeconds
      ? Math.round(
          (watchHistory.watchedSeconds / watchHistory.totalSeconds) * 100 * 100,
        ) / 100
      : 0;

    return {
      id: watchHistory.id,
      imdbId: watchHistory.imdbId,
      movieTitle: watchHistory.movie?.title || 'Unknown',
      watchedSeconds: watchHistory.watchedSeconds,
      totalSeconds: watchHistory.totalSeconds || 0,
      completed: watchHistory.completed,
      progressPercentage,
      lastWatchedAt: watchHistory.lastWatchedAt?.toISOString() || '',
      createdAt: watchHistory.createdAt.toISOString(),
      updatedAt: watchHistory.updatedAt.toISOString(),
    };
  }
}
