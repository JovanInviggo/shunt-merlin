import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRefreshTokens1772323201000 implements MigrationInterface {
  name = 'AddRefreshTokens1772323201000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id"        uuid              NOT NULL DEFAULT gen_random_uuid(),
        "tokenHash" character varying NOT NULL,
        "subjectId" character varying NOT NULL,
        "type"      character varying NOT NULL,
        "expiresAt" TIMESTAMP         NOT NULL,
        "createdAt" TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "PK_refresh_tokens_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_refresh_tokens_tokenHash" ON "refresh_tokens" ("tokenHash")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_refresh_tokens_tokenHash"`,
    );
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
  }
}
