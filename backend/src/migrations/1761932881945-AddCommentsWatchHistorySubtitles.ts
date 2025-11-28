import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommentsWatchHistorySubtitles1761932881945
  implements MigrationInterface
{
  name = 'AddCommentsWatchHistorySubtitles1761932881945';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_4888bedf1b2027a53c32863124"`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_3f13ae7758853c8e398278ee14"`
    );
    await queryRunner.query(
      `CREATE TABLE "comments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "content" text NOT NULL, "userId" uuid NOT NULL, "imdbId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8bf68bc960f2b69e818bdb90dcb" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7e8d7c49f218ebb14314fdb374" ON "comments" ("userId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_10be931ad1a27b712ff6140388" ON "comments" ("imdbId") `
    );
    await queryRunner.query(
      `CREATE TABLE "watch_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "imdbId" character varying NOT NULL, "watchedSeconds" integer NOT NULL DEFAULT '0', "totalSeconds" integer, "completed" boolean NOT NULL DEFAULT false, "lastWatchedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4a7d6381618ede4bcde39b5a708" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f287ef6180d95d3bdae3916c96" ON "watch_history" ("userId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_380abb1bde1b1c59cc40cb75c8" ON "watch_history" ("imdbId") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_bafb5b65b5bf6f6637727ceeda" ON "watch_history" ("userId", "imdbId") `
    );
    await queryRunner.query(
      `CREATE TABLE "subtitles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "imdbId" character varying NOT NULL, "language" character varying(5) NOT NULL, "languageName" character varying NOT NULL, "filePath" character varying NOT NULL, "downloadUrl" character varying, "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9ac397e12396227e34ba97af99e" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_aee32dd5178d33bb7f6d8e29b3" ON "subtitles" ("imdbId") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_74f170af675c59b0ea5c5188be" ON "subtitles" ("imdbId", "language") `
    );
    await queryRunner.query(
      `ALTER TABLE "comments" ADD CONSTRAINT "FK_7e8d7c49f218ebb14314fdb3749" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "watch_history" ADD CONSTRAINT "FK_f287ef6180d95d3bdae3916c968" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subtitles" DROP CONSTRAINT "FK_aee32dd5178d33bb7f6d8e29b31"`
    );
    await queryRunner.query(
      `ALTER TABLE "watch_history" DROP CONSTRAINT "FK_380abb1bde1b1c59cc40cb75c83"`
    );
    await queryRunner.query(
      `ALTER TABLE "watch_history" DROP CONSTRAINT "FK_f287ef6180d95d3bdae3916c968"`
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_10be931ad1a27b712ff61403882"`
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_7e8d7c49f218ebb14314fdb3749"`
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_74f170af675c59b0ea5c5188be"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_aee32dd5178d33bb7f6d8e29b3"`
    );
    await queryRunner.query(`DROP TABLE "subtitles"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bafb5b65b5bf6f6637727ceeda"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_380abb1bde1b1c59cc40cb75c8"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f287ef6180d95d3bdae3916c96"`
    );
    await queryRunner.query(`DROP TABLE "watch_history"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_10be931ad1a27b712ff6140388"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7e8d7c49f218ebb14314fdb374"`
    );
    await queryRunner.query(`DROP TABLE "comments"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_3f13ae7758853c8e398278ee14" ON "movies" ("status") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4888bedf1b2027a53c32863124" ON "movies" ("imdbId") `
    );
  }
}
