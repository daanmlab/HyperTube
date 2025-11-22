import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('subtitles')
@Index(['imdbId', 'language'], { unique: true })
export class Subtitle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  imdbId: string;

  @Column({ length: 5 })
  language: string; // ISO 639-1 code (en, fr, es, etc.)

  @Column()
  languageName: string; // English, French, Spanish, etc.

  @Column()
  filePath: string;

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
