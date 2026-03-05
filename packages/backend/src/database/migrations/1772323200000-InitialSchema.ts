import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1772323200000 implements MigrationInterface {
  name = 'InitialSchema1772323200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."users_role_enum" AS ENUM('admin', 'user')
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"        uuid                       NOT NULL DEFAULT gen_random_uuid(),
        "email"     character varying          NOT NULL,
        "password"  character varying          NOT NULL,
        "role"      "public"."users_role_enum" NOT NULL DEFAULT 'user',
        "createdAt" TIMESTAMP                  NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP                  NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email"  UNIQUE ("email"),
        CONSTRAINT "PK_users_id"     PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "studies" (
        "id"        uuid              NOT NULL DEFAULT gen_random_uuid(),
        "studyId"   character varying NOT NULL,
        "isActive"  boolean           NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP         NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_studies_studyId" UNIQUE ("studyId"),
        CONSTRAINT "PK_studies_id"      PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "recordings" (
        "id"        uuid              NOT NULL DEFAULT gen_random_uuid(),
        "studyId"   character varying NOT NULL,
        "s3Key"     character varying NOT NULL,
        "createdAt" TIMESTAMP         NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recordings_id" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "recordings"`);
    await queryRunner.query(`DROP TABLE "studies"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
  }
}
