import { ApiProperty } from '@nestjs/swagger';

export class ParticipantLoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'a3f1c2d4e5b6...' })
  refreshToken: string;

  @ApiProperty({ example: 'participant' })
  type: string;

  @ApiProperty({ example: 'STUDY001' })
  studyId: string;
}

export class AdminLoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'a3f1c2d4e5b6...' })
  refreshToken: string;

  @ApiProperty({ example: 'admin' })
  type: string;

  @ApiProperty({ example: 'admin' })
  role: string;
}

export class TokenPairResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'b7e2d3f4a5c6...' })
  refreshToken: string;
}

export class PresignedUrlResponseDto {
  @ApiProperty({ example: 'https://bucket.s3.amazonaws.com/recordings/...' })
  uploadUrl: string;

  @ApiProperty({ example: 'recordings/STUDY001/1772323200000-uuid.webm' })
  s3Key: string;
}
