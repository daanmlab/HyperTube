import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Movie } from './movie.entity';

@Entity('subtitles')
@Index(['imdbId', 'language'], { unique: true })
export class Subtitle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Movie, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'imdbId', referencedColumnName: 'imdbId' })
  @Index()
  movie: Movie;

  @Column()
  imdbId: string;

  @Column({ length: 5 })
  language: string; // ISO 639-1 code (en, fr, es, etc.)

  @Column()
  languageName: string; // English, French, Spanish, etc.

  @Column()
  filePath: string; // Path to .vtt file

  @Column({ nullable: true })
  downloadUrl: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    encoding?: string;
    format?: string;
    downloadCount?: number;
    rating?: number;
  };

  @CreateDateColumn()
  createdAt: Date;
}
