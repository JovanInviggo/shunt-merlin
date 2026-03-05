import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecordingMetadata1772323202000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "recordings" ADD COLUMN "metadata" jsonb NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "recordings" DROP COLUMN "metadata"`,
    );
  }
}
