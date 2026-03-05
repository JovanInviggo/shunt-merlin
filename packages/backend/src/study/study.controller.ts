import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { StudyService } from './study.service';
import { CreateStudyDto } from './dto/create-study.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../user/user-role.enum';

@ApiTags('study')
@ApiBearerAuth('access-token')
@Controller('study')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudyController {
  constructor(private readonly studyService: StudyService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all studies (admin only)' })
  @ApiResponse({ status: 200, description: 'Array of study objects' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  async findAll() {
    return this.studyService.findAll();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new study (admin only)' })
  @ApiResponse({ status: 201, description: 'Study created' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  @ApiResponse({ status: 409, description: 'Study ID already exists' })
  async create(@Body() dto: CreateStudyDto) {
    return this.studyService.create(dto);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get a single study by its UUID (admin only)' })
  @ApiParam({ name: 'id', description: 'Study UUID (not the studyId string)' })
  @ApiResponse({ status: 200, description: 'Study object' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  @ApiResponse({ status: 404, description: 'Study not found' })
  async findById(@Param('id') id: string) {
    const study = await this.studyService.findById(id);
    if (!study) {
      throw new NotFoundException(`Study with ID "${id}" not found`);
    }
    return study;
  }
}
