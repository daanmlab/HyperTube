import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subtitle } from '../entities/subtitle.entity';
import { CreateSubtitleDto } from './dto/create-subtitle.dto';
import { SubtitleResponseDto } from './dto/subtitle-response.dto';

@Injectable()
export class SubtitlesService {
  constructor(
    @InjectRepository(Subtitle)
    private subtitleRepository: Repository<Subtitle>,
  ) {}

  async create(
    createSubtitleDto: CreateSubtitleDto,
  ): Promise<SubtitleResponseDto> {
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

  async findByMovieAndLanguage(
    imdbId: string,
    language: string,
  ): Promise<SubtitleResponseDto> {
    const subtitle = await this.subtitleRepository.findOne({
      where: { imdbId, language },
    });

    if (!subtitle) {
      throw new NotFoundException(
        `Subtitle not found for language ${language}`,
      );
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
