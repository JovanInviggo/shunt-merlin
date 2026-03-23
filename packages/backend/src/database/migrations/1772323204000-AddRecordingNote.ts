import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecordingNote1772323204000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "recordings" ADD COLUMN "note" text NULL DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "recordings" DROP COLUMN "note"`,
    );
  }
}
