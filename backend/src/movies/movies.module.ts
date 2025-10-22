import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Movie } from '../entities';
import { AriaService } from './aria/aria.service';
import { MoviesController } from './movies.controller';
import { MoviesService } from './movies.service';
import { TpbService } from './tpb/tpb.service';
import { YtsService } from './yts/yts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Movie]),
    HttpModule,
  ],
  controllers: [MoviesController],
  providers: [MoviesService, YtsService, AriaService, TpbService],
  exports: [MoviesService],
})
export class MoviesModule {}
