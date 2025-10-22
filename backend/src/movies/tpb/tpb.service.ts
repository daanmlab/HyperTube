import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';

// Using ThePirateBay API proxy
const TPB_API_URL = 'https://apibay.org';

interface TPBTorrent {
  id: string;
  name: string;
  info_hash: string;
  leechers: string;
  seeders: string;
  num_files: string;
  size: string;
  username: string;
  added: string;
  status: string;
  category: string;
  imdb?: string;
}

@Injectable()
export class TpbService {
  private readonly logger = new Logger(TpbService.name);

  constructor(private readonly http: HttpService) {}

  private buildMagnet = (hash: string, title: string) =>
    `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(title)}` +
    `&tr=udp://tracker.opentrackr.org:1337/announce` +
    `&tr=udp://open.stealth.si:80/announce` +
    `&tr=udp://tracker.torrent.eu.org:451/announce` +
    `&tr=udp://tracker.bittor.pw:1337/announce` +
    `&tr=udp://public.popcorn-tracker.org:6969/announce` +
    `&tr=udp://tracker.dler.org:6969/announce` +
    `&tr=udp://exodus.desync.com:6969/announce` +
    `&tr=udp://open.demonii.com:1337/announce`;

  /**
   * Search TPB for torrents
   * @param query Search query
   * @returns Array of torrents with seeders
   */
  async search(query: string): Promise<any[]> {
    try {
      const { data } = await lastValueFrom(
        this.http.get<TPBTorrent[]>(`${TPB_API_URL}/q.php`, {
          params: {
            q: query,
            cat: '200,201,202,207', // Video categories
          },
        })
      );

      if (!Array.isArray(data) || data.length === 0) {
        return [];
      }

      // Filter only torrents with seeders and return formatted results
      return data
        .filter(t => parseInt(t.seeders) > 0)
        .map(torrent => ({
          name: torrent.name,
          hash: torrent.info_hash,
          magnet: this.buildMagnet(torrent.info_hash, torrent.name),
          seeders: parseInt(torrent.seeders),
          leechers: parseInt(torrent.leechers),
          size: parseInt(torrent.size),
          added: new Date(parseInt(torrent.added) * 1000).toISOString(),
          source: 'tpb',
        }))
        .sort((a, b) => b.seeders - a.seeders) // Sort by seeders descending
        .slice(0, 10); // Return top 10
    } catch (err: any) {
      this.logger.error(`TPB search error: ${err?.message || err}`);
      return [];
    }
  }

  /**
   * Search for a specific movie by IMDb ID
   */
  async searchByImdb(imdbId: string): Promise<any[]> {
    try {
      // Try searching with IMDb ID
      const results = await this.search(imdbId);
      if (results.length > 0) {
        return results;
      }

      // If no results, return empty
      return [];
    } catch (err: any) {
      this.logger.error(`TPB IMDb search error: ${err?.message || err}`);
      return [];
    }
  }

  /**
   * Get best quality torrent for a movie
   */
  async getBestTorrent(movieTitle: string, year?: number): Promise<any | null> {
    try {
      const searchQuery = year ? `${movieTitle} ${year}` : movieTitle;
      const results = await this.search(searchQuery);

      if (results.length === 0) {
        return null;
      }

      // Filter for 1080p or 720p
      const hdResults = results.filter(
        r =>
          r.name.toLowerCase().includes('1080p') ||
          r.name.toLowerCase().includes('720p')
      );

      // Return the one with most seeders
      return hdResults.length > 0 ? hdResults[0] : results[0];
    } catch (err: any) {
      this.logger.error(`TPB best torrent error: ${err?.message || err}`);
      return null;
    }
  }
}
