import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'STUDY001', description: 'The participant study ID' })
  @IsString()
  @MinLength(1)
  studyId: string;
}
