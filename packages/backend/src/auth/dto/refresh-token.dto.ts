import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({
    example: 'a3f1c2d4e5b6...',
    description: 'The refresh token returned by login or a previous refresh call',
  })
  @IsString()
  @MinLength(1)
  refreshToken: string;
}
