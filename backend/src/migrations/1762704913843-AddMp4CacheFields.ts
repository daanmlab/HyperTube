import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMp4CacheFields1762704913843 implements MigrationInterface {
    name = 'AddMp4CacheFields1762704913843'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "movies" ADD "transcodedPath" character varying`);
        await queryRunner.query(`ALTER TABLE "movies" ADD "isFullyTranscoded" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "movies" ADD "cacheCreatedAt" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "movies" DROP COLUMN "cacheCreatedAt"`);
        await queryRunner.query(`ALTER TABLE "movies" DROP COLUMN "isFullyTranscoded"`);
        await queryRunner.query(`ALTER TABLE "movies" DROP COLUMN "transcodedPath"`);
    }

}
