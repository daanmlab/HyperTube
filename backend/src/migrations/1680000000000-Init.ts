import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1680000000000 implements MigrationInterface {
  name = 'Init1680000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS example (id SERIAL PRIMARY KEY, name VARCHAR NOT NULL);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE example`);
  }
}
