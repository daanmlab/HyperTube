import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMoviesTable1754840200000 implements MigrationInterface {
  name = 'CreateMoviesTable1754840200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create status enum
    await queryRunner.query(
      `CREATE TYPE "public"."movies_status_enum" AS ENUM('requested', 'downloading', 'transcoding', 'ready', 'error')`,
    );

    // Create selected quality enum
    await queryRunner.query(
      `CREATE TYPE "public"."movies_selectedquality_enum" AS ENUM('480p', '720p', '1080p', '2160p')`,
    );

    // Create movies table
    await queryRunner.query(
      `CREATE TABLE "movies" (
        "imdbId" character varying NOT NULL,
        "title" character varying NOT NULL,
        "year" integer NOT NULL,
        "synopsis" text,
        "runtime" integer,
        "genres" text,
        "imageUrl" character varying,
        "rating" numeric(3,1),
        "trailerUrl" character varying,
        "status" "public"."movies_status_enum" NOT NULL DEFAULT 'requested',
        "ariaGid" character varying,
        "magnetUrl" character varying,
        "selectedQuality" "public"."movies_selectedquality_enum",
        "totalSize" bigint,
        "downloadedSize" bigint NOT NULL DEFAULT '0',
        "downloadProgress" numeric(5,2) NOT NULL DEFAULT '0',
        "downloadPath" character varying,
        "videoPath" character varying,
        "transcodeProgress" numeric(5,2) NOT NULL DEFAULT '0',
        "availableQualities" text,
        "metadata" jsonb,
        "errorMessage" character varying,
        "lastWatchedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_f70c2f095f2da3ff2c839ad7fb5" PRIMARY KEY ("imdbId")
      )`,
    );

    // Create indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_4888bedf1b2027a53c32863124" ON "movies" ("imdbId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3f13ae7758853c8e398278ee14" ON "movies" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_3f13ae7758853c8e398278ee14"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4888bedf1b2027a53c32863124"`);
    await queryRunner.query(`DROP TABLE "movies"`);
    await queryRunner.query(`DROP TYPE "public"."movies_selectedquality_enum"`);
    await queryRunner.query(`DROP TYPE "public"."movies_status_enum"`);
  }
}
