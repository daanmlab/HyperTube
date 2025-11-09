import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import srtToVtt from 'srt-webvtt';
import { Repository } from 'typeorm';
import { Subtitle } from '../entities/subtitle.entity';
import { CreateSubtitleDto } from './dto/create-subtitle.dto';
import { SubtitleResponseDto } from './dto/subtitle-response.dto';

interface OpenSubtitlesSearchResult {
  id: string;
  attributes: {
    subtitle_id: string;
    language: string;
    download_count: number;
    ratings: number;
    from_trusted: boolean;
    files: Array<{
      file_id: number;
      file_name: string;
    }>;
    uploader: {
      name: string;
    };
  };
}

@Injectable()
export class SubtitlesService {
  private readonly logger = new Logger(SubtitlesService.name);
  private readonly subtitlesDir = '/app/subtitles';
  private readonly apiKey = process.env.OPENSUBTITLE_KEY;
  private readonly apiBaseUrl = 'https://api.opensubtitles.com/api/v1';

  constructor(
    @InjectRepository(Subtitle)
    private subtitleRepository: Repository<Subtitle>,
  ) {
    // Create subtitles directory if it doesn't exist
    if (!fs.existsSync(this.subtitlesDir)) {
      fs.mkdirSync(this.subtitlesDir, { recursive: true });
    }

    if (!this.apiKey) {
      this.logger.warn(
        'OPENSUBTITLE_KEY not set. Subtitle search will not work. Get your API key from https://www.opensubtitles.com/en/consumers',
      );
    } else {
      this.logger.log('OpenSubtitles API initialized with API key');
    }
  }

  async create(createSubtitleDto: CreateSubtitleDto): Promise<SubtitleResponseDto> {
    // Check if subtitle already exists for this movie and language
    const existing = await this.subtitleRepository.findOne({
      where: {
        imdbId: createSubtitleDto.imdbId,
        language: createSubtitleDto.language,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Subtitle for language ${createSubtitleDto.language} already exists for this movie`,
      );
    }

    const subtitle = this.subtitleRepository.create(createSubtitleDto);
    const saved = await this.subtitleRepository.save(subtitle);
    return this.toResponseDto(saved);
  }

  async findByMovie(imdbId: string): Promise<SubtitleResponseDto[]> {
    const subtitles = await this.subtitleRepository.find({
      where: { imdbId },
      order: { language: 'ASC' },
    });
    return subtitles.map((subtitle) => this.toResponseDto(subtitle));
  }

  async findByMovieAndLanguage(imdbId: string, language: string): Promise<SubtitleResponseDto> {
    const subtitle = await this.subtitleRepository.findOne({
      where: { imdbId, language },
    });

    if (!subtitle) {
      throw new NotFoundException(`Subtitle not found for language ${language}`);
    }

    return this.toResponseDto(subtitle);
  }

  async remove(id: string): Promise<void> {
    const subtitle = await this.subtitleRepository.findOne({ where: { id } });

    if (!subtitle) {
      throw new NotFoundException('Subtitle not found');
    }

    await this.subtitleRepository.remove(subtitle);
  }

  /**
   * Search and download subtitles from OpenSubtitles REST API v1
   */
  async searchAndDownload(imdbId: string, languages: string[] = ['en']): Promise<Subtitle[]> {
    this.logger.log(`Searching subtitles for ${imdbId}, languages: ${languages.join(', ')}`);

    if (!this.apiKey) {
      this.logger.error('OpenSubtitles API key not configured');
      return [];
    }

    const subtitles: Subtitle[] = [];

    for (const lang of languages) {
      try {
        const subtitle = await this.searchAndDownloadForLanguage(imdbId, lang);
        if (subtitle) {
          subtitles.push(subtitle);
          this.logger.log(`✅ Downloaded subtitle for ${imdbId} in ${lang}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to download subtitle for ${imdbId} in ${lang}: ${errorMessage}`);
      }
    }

    return subtitles;
  }

  /**
   * Search and download subtitle for a specific language
   */
  private async searchAndDownloadForLanguage(
    imdbId: string,
    language: string,
  ): Promise<Subtitle | null> {
    try {
      // Check if subtitle already exists
      const existing = await this.subtitleRepository.findOne({
        where: { imdbId, language },
      });

      if (existing) {
        this.logger.log(`Subtitle already exists for ${imdbId} in ${language}`);
        return existing;
      }

      // Search for subtitles using the new API
      const numericId = imdbId.replace('tt', '');
      const searchUrl = `${this.apiBaseUrl}/subtitles`;

      this.logger.log(`Searching OpenSubtitles for IMDB ${numericId}, language: ${language}`);

      const searchResponse = await axios.get<{ data: OpenSubtitlesSearchResult[] }>(searchUrl, {
        params: {
          imdb_id: numericId,
          languages: language,
          order_by: 'download_count', // Get most popular first
        },
        headers: {
          'Api-Key': this.apiKey,
          'Content-Type': 'application/json',
          'User-Agent': 'HyperTube v1.0',
        },
      });

      if (!searchResponse.data.data || searchResponse.data.data.length === 0) {
        this.logger.warn(`No subtitles found for ${imdbId} in ${language}`);
        return null;
      }

      // Get the first (best) result
      const bestResult = searchResponse.data.data[0];
      const fileId = bestResult.attributes.files[0]?.file_id;

      if (!fileId) {
        this.logger.warn(`No file ID found for subtitle ${bestResult.id}`);
        return null;
      }

      // Download the subtitle
      const downloadUrl = `${this.apiBaseUrl}/download`;
      const downloadResponse = await axios.post<{ link: string; file_name: string }>(
        downloadUrl,
        {
          file_id: fileId,
        },
        {
          headers: {
            'Api-Key': this.apiKey,
            'Content-Type': 'application/json',
            'User-Agent': 'HyperTube v1.0',
          },
        },
      );

      const downloadLink = downloadResponse.data.link;
      this.logger.log(`Downloading subtitle from: ${downloadLink}`);

      // Download and convert the subtitle file
      const srtPath = path.join(this.subtitlesDir, `${imdbId}_${language}.srt`);
      const vttPath = path.join(this.subtitlesDir, `${imdbId}_${language}.vtt`);

      const fileResponse = await axios.get(downloadLink, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });

      fs.writeFileSync(srtPath, fileResponse.data);
      this.logger.log(`SRT saved to: ${srtPath}`);

      // Convert to WebVTT
      const vttContent = await srtToVtt(new Blob([fs.readFileSync(srtPath)]));
      fs.writeFileSync(vttPath, vttContent);
      this.logger.log(`Converted to WebVTT: ${vttPath}`);

      // Save to database
      const subtitle = this.subtitleRepository.create({
        imdbId,
        language,
        languageName: this.getLanguageName(language),
        filePath: vttPath,
        downloadUrl: downloadLink,
        metadata: {
          format: 'webvtt',
          downloadCount: bestResult.attributes.download_count,
          encoding: 'utf-8',
          rating: bestResult.attributes.ratings || 0,
        },
      });

      await this.subtitleRepository.save(subtitle);

      // Cleanup SRT file
      try {
        fs.unlinkSync(srtPath);
      } catch {
        this.logger.warn(`Failed to cleanup SRT file: ${srtPath}`);
      }

      return subtitle;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`OpenSubtitles API error for ${language}: ${errorMessage}`);
      
      if (axios.isAxiosError(error) && error.response) {
        this.logger.error(`Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`);
      }
      
      return null;
    }
  }

  /**
   * Get language name from language code
   */
  private getLanguageName(code: string): string {
    const languageNames: Record<string, string> = {
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      it: 'Italian',
      pt: 'Portuguese',
      ru: 'Russian',
      ja: 'Japanese',
      ko: 'Korean',
      zh: 'Chinese',
      ar: 'Arabic',
      nl: 'Dutch',
      pl: 'Polish',
      tr: 'Turkish',
      sv: 'Swedish',
      da: 'Danish',
      no: 'Norwegian',
      fi: 'Finnish',
    };

    return languageNames[code] || code.toUpperCase();
  }

  /**
   * Download and convert a subtitle from SRT to WebVTT
   */
  /**
   * Get subtitle by IMDB ID and language
   */
  async getByMovieAndLanguage(imdbId: string, language: string): Promise<Subtitle | null> {
    return this.subtitleRepository.findOne({
      where: { imdbId, language },
    });
  }

  /**
   * List all subtitles for a movie
   */
  async listByMovie(imdbId: string): Promise<Subtitle[]> {
    return this.subtitleRepository.find({
      where: { imdbId },
      order: { language: 'ASC' },
    });
  }

  private toResponseDto(subtitle: Subtitle): SubtitleResponseDto {
    return {
      id: subtitle.id,
      imdbId: subtitle.imdbId,
      language: subtitle.language,
      filePath: subtitle.filePath,
      metadata: subtitle.metadata,
      createdAt: subtitle.createdAt,
    };
  }
}
