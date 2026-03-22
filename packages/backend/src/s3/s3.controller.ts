import {
  Controller,
  Get,
  Req,
  Query,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { S3Service } from './s3.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PresignedUrlResponseDto } from '../auth/dto/auth-response.dto';

interface AuthenticatedRequest extends Request {
  user: { type: 'admin' | 'participant'; studyId?: string };
}

@ApiTags('s3')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('s3')
export class S3Controller {
  constructor(private readonly s3Service: S3Service) {}

  @Get('/presigned-upload-url')
  @ApiOperation({
    summary: 'Get a presigned S3 URL for audio upload (participant only)',
    description:
      'Returns a short-lived presigned PUT URL and the S3 key to use when uploading. ' +
      'After the upload completes, call POST /recordings with the returned s3Key.',
  })
  @ApiQuery({
    name: 'filename',
    required: true,
    description: 'Original filename of the recording (e.g. session-2024-01-01.webm)',
    example: 'session-2024-01-01.webm',
  })
  @ApiResponse({ status: 200, type: PresignedUrlResponseDto })
  @ApiResponse({ status: 400, description: 'filename query parameter is required' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Participant token required' })
  async getPresignedUploadUrl(
    @Req() request: AuthenticatedRequest,
    @Query('filename') filename: string,
  ) {
    if (!request.user.studyId) {
      throw new ForbiddenException('Only participants can request upload URLs');
    }
    if (!filename) {
      throw new BadRequestException('filename query parameter is required');
    }
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);

    return this.s3Service.getPresignedUploadUrl(request.user.studyId, safeName);
  }
}
