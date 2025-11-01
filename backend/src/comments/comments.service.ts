import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from '../entities/comment.entity';
import { Movie } from '../entities/movie.entity';
import { User } from '../entities/user.entity';
import { CommentResponseDto, CreateCommentDto, UpdateCommentDto } from './dto';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private commentsRepository: Repository<Comment>,
    @InjectRepository(Movie)
    private moviesRepository: Repository<Movie>,
  ) {}

  async create(createCommentDto: CreateCommentDto, user: User): Promise<CommentResponseDto> {
    // Verify movie exists
    const movie = await this.moviesRepository.findOne({
      where: { imdbId: createCommentDto.imdbId },
    });

    if (!movie) {
      throw new NotFoundException(`Movie with IMDB ID ${createCommentDto.imdbId} not found`);
    }

    const comment = this.commentsRepository.create({
      content: createCommentDto.content,
      imdbId: createCommentDto.imdbId,
      userId: user.id,
      user: user,
    });

    const saved = await this.commentsRepository.save(comment);
    return this.toResponseDto(saved);
  }

  async findByMovie(imdbId: string): Promise<CommentResponseDto[]> {
    const comments = await this.commentsRepository.find({
      where: { imdbId },
      order: { createdAt: 'DESC' },
      relations: ['user'],
    });

    return comments.map((comment) => this.toResponseDto(comment));
  }

  async findById(id: string): Promise<Comment> {
    const comment = await this.commentsRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!comment) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }

    return comment;
  }

  async update(
    id: string,
    updateCommentDto: UpdateCommentDto,
    user: User,
  ): Promise<CommentResponseDto> {
    const comment = await this.findById(id);

    // Verify user owns the comment
    if (comment.userId !== user.id) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    comment.content = updateCommentDto.content;
    const updated = await this.commentsRepository.save(comment);

    return this.toResponseDto(updated);
  }

  async remove(id: string, user: User): Promise<void> {
    const comment = await this.findById(id);

    // Verify user owns the comment
    if (comment.userId !== user.id) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.commentsRepository.remove(comment);
  }

  private toResponseDto(comment: Comment): CommentResponseDto {
    return {
      id: comment.id,
      content: comment.content,
      imdbId: comment.imdbId,
      user: {
        id: comment.user.id,
        username: comment.user.username,
        firstName: comment.user.firstName,
        lastName: comment.user.lastName,
        avatarUrl: comment.user.avatarUrl,
      },
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
    };
  }
}
