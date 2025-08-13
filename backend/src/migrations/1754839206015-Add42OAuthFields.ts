import { MigrationInterface, QueryRunner } from 'typeorm';

export class Add42OAuthFields1754839206015 implements MigrationInterface {
  name = 'Add42OAuthFields1754839206015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_users_email"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_users_username"`
    );

    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "fortyTwoId" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "fortyTwoLogin" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatarUrl" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "oauthData" json`
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP`
    );

    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL`
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_fe0bb3f6520ee0469504521e71" ON "users" ("username")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cbdbf3bb750590e03bd70539d8" ON "users" ("fortyTwoId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cbdbf3bb750590e03bd70539d8"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fe0bb3f6520ee0469504521e71"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "password" SET NOT NULL`
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "lastLoginAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "oauthData"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatarUrl"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "fortyTwoLogin"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "fortyTwoId"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_users_username" ON "users" ("username") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_email" ON "users" ("email") `
    );
  }
}
