import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as https from 'https';
import { Movie } from '../entities';
import { AriaService } from './aria/aria.service';
import { MoviesController } from './movies.controller';
import { MoviesService } from './movies.service';
import { TpbService } from './tpb/tpb.service';
import { YtsService } from './yts/yts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Movie]),
    HttpModule.register({
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        Connection: 'keep-alive',
      },
    }),
  ],
  controllers: [MoviesController],
  providers: [MoviesService, YtsService, AriaService, TpbService],
  exports: [MoviesService],
})
export class MoviesModule {}
