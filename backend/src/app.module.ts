import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { CommentsModule } from './comments/comments.module';
import { AppDataSource } from './data-source';
import { MoviesModule } from './movies/movies.module';
import { SubtitlesModule } from './subtitles/subtitles.module';
import { UsersModule } from './users/users.module';
import { VideosModule } from './videos/videos.module';
import { WatchHistoryModule } from './watch-history/watch-history.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(AppDataSource.options),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    VideosModule,
    MoviesModule,
    CommentsModule,
    WatchHistoryModule,
    SubtitlesModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
