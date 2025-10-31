import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Movie } from './movie.entity';
import { User } from './user.entity';

@Entity('watch_history')
@Index(['userId', 'imdbId'], { unique: true })
export class WatchHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  @Index()
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Movie, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'imdbId', referencedColumnName: 'imdbId' })
  @Index()
  movie: Movie;

  @Column()
  imdbId: string;

  @Column({ type: 'int', default: 0 })
  watchedSeconds: number;

  @Column({ type: 'int', nullable: true })
  totalSeconds: number;

  @Column({ default: false })
  completed: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastWatchedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
