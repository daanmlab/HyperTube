import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export enum MovieStatus {
  REQUESTED = 'requested',
  DOWNLOADING = 'downloading',
  DOWNLOAD_COMPLETE = 'download_complete',
  TRANSCODING = 'transcoding',
  READY = 'ready',
  ERROR = 'error',
}

export enum TorrentQuality {
  Q_720p = '720p',
  Q_1080p = '1080p',
  Q_2160p = '2160p',
  Q_3D = '3D',
}

@Entity('movies')
export class Movie {
  @PrimaryColumn({ name: 'imdbId' })
  imdbId: string;

  @Column()
  title: string;

  @Column()
  year: number;

  @Column({ type: 'text', nullable: true })
  synopsis?: string;

  @Column({ nullable: true })
  runtime?: number;

  @Column({ type: 'text', nullable: true })
  genres?: string;

  @Column({ nullable: true })
  imageUrl?: string;

  @Column({ type: 'decimal', precision: 3, scale: 1, nullable: true })
  rating?: number;

  @Column({ nullable: true })
  trailerUrl?: string;

  @Column({
    type: 'enum',
    enum: MovieStatus,
    default: MovieStatus.REQUESTED,
  })
  status: MovieStatus;

  @Column({ nullable: true })
  ariaGid?: string;

  @Column({ nullable: true })
  magnetUrl?: string;

  @Column({
    type: 'enum',
    enum: TorrentQuality,
    nullable: true,
  })
  selectedQuality?: TorrentQuality;

  @Column({ type: 'bigint', nullable: true })
  totalSize?: number;

  @Column({ type: 'bigint', default: 0 })
  downloadedSize: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  downloadProgress: number;

  @Column({ nullable: true })
  downloadPath?: string;

  @Column({ nullable: true })
  videoPath?: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  transcodeProgress: number;

  @Column({ type: 'text', nullable: true })
  availableQualities?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: any;

  @Column({ nullable: true })
  errorMessage?: string;

  @Column({ type: 'timestamp', nullable: true })
  lastWatchedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
