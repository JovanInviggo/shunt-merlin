import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RecordingClassification } from '../recording-classification.enum';

export class UpdateRecordingDto {
  @ApiPropertyOptional({
    enum: RecordingClassification,
    nullable: true,
    description: 'Classification of the recording. Pass null to reset.',
    example: RecordingClassification.NORMAL,
  })
  @IsOptional()
  @IsEnum(RecordingClassification)
  classification?: RecordingClassification | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Doctor note for this recording. Pass null to clear.',
    example: 'Abnormal flow detected in left shunt at 2:14.',
  })
  @IsOptional()
  @IsString()
  note?: string | null;
}
