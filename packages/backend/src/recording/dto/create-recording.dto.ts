import { IsString, MinLength, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRecordingDto {
  // studyId is intentionally omitted — it is taken from the authenticated
  // participant's JWT token, never trusted from the request body.
  @ApiProperty({
    example: 'recordings/STUDY001/1772323200000-uuid.webm',
    description: 'The S3 key returned by GET /s3/presigned-upload-url',
  })
  @IsString()
  @MinLength(1)
  s3Key: string;

  @ApiProperty({
    description: 'Arbitrary JSON metadata about the recording (e.g. device info, duration, session context)',
    example: { duration: 142, deviceModel: 'iPhone 15', appVersion: '1.0.0' },
  })
  @IsObject()
  metadata: Record<string, unknown>;
}
