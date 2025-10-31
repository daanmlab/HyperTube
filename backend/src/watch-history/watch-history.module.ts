import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Movie } from '../entities/movie.entity';
import { WatchHistory } from '../entities/watch-history.entity';
import { WatchHistoryController } from './watch-history.controller';
import { WatchHistoryService } from './watch-history.service';

@Module({
  imports: [TypeOrmModule.forFeature([WatchHistory, Movie])],
  controllers: [WatchHistoryController],
  providers: [WatchHistoryService],
  exports: [WatchHistoryService],
})
export class WatchHistoryModule {}
