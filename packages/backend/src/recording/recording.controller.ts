import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { RecordingService } from './recording.service';
import { S3Service } from '../s3/s3.service';
import { CreateRecordingDto } from './dto/create-recording.dto';
import { UpdateRecordingDto } from './dto/update-recording.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: { type: 'admin' | 'participant'; studyId?: string };
}

@ApiTags('recordings')
@ApiBearerAuth('access-token')
@Controller('recordings')
@UseGuards(JwtAuthGuard)
export class RecordingController {
  constructor(
    private readonly recordingService: RecordingService,
    private readonly s3Service: S3Service,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List recordings (paginated)',
    description:
      'Admins receive all recordings. Participants receive only their own. ' +
      'Default page size is 10, max 100.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: '{ data, total, page, limit, totalPages }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  async findAll(
    @Request() req: AuthenticatedRequest,
    @Query() pagination: PaginationQueryDto,
  ) {
    const { type, studyId } = req.user;
    if (type === 'admin') {
      return this.recordingService.findAll(pagination);
    }
    return this.recordingService.findByStudyId(studyId ?? '', pagination);
  }

  @Get(':id/download-url')
  @ApiOperation({
    summary: 'Get a presigned S3 download URL for a recording',
    description:
      'Returns a short-lived presigned GET URL to download the audio file directly from S3. Expires in 15 minutes. ' +
      'Admins can download any recording. Participants can only download their own.',
  })
  @ApiParam({ name: 'id', description: 'Recording UUID' })
  @ApiResponse({ status: 200, description: '{ downloadUrl: string }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Participants can only download their own recordings' })
  @ApiResponse({ status: 404, description: 'Recording not found' })
  async getDownloadUrl(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const recording = await this.recordingService.findOne(id);
    if (!recording) {
      throw new NotFoundException(`Recording ${id} not found`);
    }
    const { type, studyId } = req.user;
    if (type === 'participant' && recording.studyId !== studyId) {
      throw new ForbiddenException('Participants can only download their own recordings');
    }
    return this.s3Service.getPresignedDownloadUrl(recording.s3Key);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a recording (admin only)',
    description: 'Partially updates a recording. Currently supports: classification.',
  })
  @ApiParam({ name: 'id', description: 'Recording UUID' })
  @ApiResponse({ status: 200, description: 'Updated recording' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Admin token required' })
  @ApiResponse({ status: 404, description: 'Recording not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRecordingDto,
    @Request() req: AuthenticatedRequest,
  ) {
    if (req.user.type !== 'admin') {
      throw new ForbiddenException('Only admins can update recordings');
    }
    const recording = await this.recordingService.update(id, dto);
    if (!recording) {
      throw new NotFoundException(`Recording ${id} not found`);
    }
    return recording;
  }

  @Post()
  @ApiOperation({
    summary: 'Register a recording after S3 upload (participant only)',
    description:
      'Call this after successfully uploading the audio file to S3 using the presigned URL. ' +
      'The studyId is taken from the access token — do not include it in the body.',
  })
  @ApiResponse({ status: 201, description: 'Recording registered' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Participant token required' })
  async create(
    @Body() dto: CreateRecordingDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const { studyId } = req.user;
    if (req.user.type !== 'participant' || !studyId) {
      throw new ForbiddenException('Only participants can create recordings');
    }
    return this.recordingService.create(studyId, dto);
  }
}
