import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecordingClassification1772323203000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "recording_classification_enum" AS ENUM ('not_classified', 'normal', 'abnormal', 'unclear')`,
    );
    await queryRunner.query(
      `ALTER TABLE "recordings" ADD COLUMN "classification" "recording_classification_enum" NULL DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "recordings" DROP COLUMN "classification"`,
    );
    await queryRunner.query(
      `DROP TYPE "recording_classification_enum"`,
    );
  }
}
