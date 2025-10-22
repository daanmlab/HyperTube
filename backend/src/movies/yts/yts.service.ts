import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';

const BASE_URL = 'https://yts.am/api/v2';

type YtsMovie = {
  imdb_code: string;
  title: string;
  year: number;
  synopsis?: string;
  summary?: string;
  description_full?: string;
  runtime?: number;
  genres?: string[];
  large_cover_image?: string;
  medium_cover_image?: string;
  small_cover_image?: string;
  rating?: number;
  language?: string;
  yt_trailer_code?: string | null;
  torrents?: Array<{
    quality: string;
    size_bytes: number;
    hash: string;
  }>;
};

@Injectable()
export class YtsService {
  private readonly logger = new Logger(YtsService.name);

  constructor(private readonly http: HttpService) {}

  // helpers
  private mapMovie = (movie: YtsMovie) => ({
    imdb_id: movie.imdb_code,
    title: movie.title,
    year: movie.year,
    synopsis: movie.synopsis || movie.summary || movie.description_full,
    runtime: movie.runtime,
    genres: Array.isArray(movie.genres) ? movie.genres : undefined,
    image:
      movie.large_cover_image ||
      movie.medium_cover_image ||
      movie.small_cover_image,
    rating: movie.rating,
  });

  private buildMagnet = (hash: string, title: string) =>
    `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(title)}` +
    `&tr=udp://glotorrents.pw:6969/announce` +
    `&tr=udp://tracker.opentrackr.org:1337/announce` +
    `&tr=udp://torrent.gresille.org:80/announce` +
    `&tr=udp://tracker.openbittorrent.com:80` +
    `&tr=udp://tracker.coppersurfer.tk:6969` +
    `&tr=udp://tracker.leechers-paradise.org:6969` +
    `&tr=udp://p4p.arenabg.com:1337` +
    `&tr=udp://open.demonii.com:1337/announce`;

  async search(keywords: string, page: number) {
    try {
      const params = {
        page,
        limit: 50,
        sort_by: 'year',
        order_by: 'desc',
        query_term: encodeURI(keywords),
      };
      console.log('YTS search params:', params);
      const { data } = await lastValueFrom(
        this.http.get(`${BASE_URL}/list_movies.json`, { params })
      );
      console.log('YTS search response:', data);
      const movies: YtsMovie[] | undefined = data?.data?.movies;
      if (!movies) return [];

      return movies.map(m => ({ ...this.mapMovie(m), api: 'yts' }));
    } catch (err: any) {
      this.logger.error(err?.message || err);
      return null;
    }
  }

  /**
   * @params {number} page - page number
   * @ret {array} 0..n mapped movies
   * @onerror {null}
   */
  async suggestions(page: number) {
    try {
      const params = {
        page,
        limit: 15,
        sort_by: 'download_count',
        order_by: 'desc',
      };

      const { data } = await lastValueFrom(
        this.http.get(`${BASE_URL}/list_movies.json`, { params })
      );

      const movies: YtsMovie[] | undefined = data?.data?.movies;
      if (!movies) return [];

      return movies.map(this.mapMovie);
    } catch (err: any) {
      this.logger.error(err?.message || err);
      return null;
    }
  }

  async suggestionsByGenre(genre: string) {
    try {
      let params: any = {
        page: 1,
        limit: 10,
        sort_by: 'download_count',
        order_by: 'desc',
        genre,
      };

      let { data } = await lastValueFrom(
        this.http.get(`${BASE_URL}/list_movies.json`, { params })
      );

      let movies: YtsMovie[] | undefined = data?.data?.movies;
      if (!movies) return [];

      if (movies.length !== 10) {
        params = {
          page: 1,
          limit: 10,
          sort_by: 'download_count',
          order_by: 'desc',
        };
        ({ data } = await lastValueFrom(
          this.http.get(`${BASE_URL}/list_movies.json`, { params })
        ));
        movies = data?.data?.movies;
      }

      return (movies || []).map(this.mapMovie);
    } catch (err: any) {
      this.logger.error(err?.message || err);
      return null;
    }
  }

  async details(imdbId: string): Promise<
    | (Omit<YtsMovie, 'torrents'> & {
        torrents: Array<{
          language: string | null;
          resolution: string;
          file_size: number;
          size: number;
          magnet: string;
        }>;
      } & { trailer?: string | null; api?: string })
    | null
  > {
    try {
      const params = { page: 1, limit: 1, query_term: imdbId };

      const { data } = await lastValueFrom(
        this.http.get(`${BASE_URL}/list_movies.json`, { params })
      );

      if ((data?.data?.movie_count ?? 0) < 1) return null;

      const movie: YtsMovie = data.data.movies[0];

      const torrents =
        movie.torrents?.map(t => ({
          language: movie.language?.toLowerCase() || null,
          resolution: t.quality,
          file_size: t.size_bytes,
          size: t.size_bytes,
          magnet: this.buildMagnet(t.hash, movie.title),
        })) || [];

      return {
        ...this.mapMovie({
          ...movie,
          genres: Array.isArray(movie.genres) ? movie.genres : undefined,
        }),
        imdb_code: movie.imdb_code,
        trailer: movie.yt_trailer_code
          ? `https://www.youtube.com/watch?v=${movie.yt_trailer_code}`
          : null,
        torrents,
        api: 'yts',
      };
    } catch (err: any) {
      this.logger.error(err?.message || err);
      return null;
    }
  }
}
