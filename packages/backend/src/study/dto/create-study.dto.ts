import { IsString, IsBoolean, IsOptional, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStudyDto {
  @ApiProperty({ example: 'STUDY004', description: 'Unique study identifier' })
  @IsString()
  @MinLength(1)
  studyId: string;

  @ApiProperty({ example: true, required: false, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
