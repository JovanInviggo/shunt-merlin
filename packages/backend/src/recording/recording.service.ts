import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Recording } from './recording.entity';
import { CreateRecordingDto } from './dto/create-recording.dto';
import { UpdateRecordingDto } from './dto/update-recording.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';

export interface PaginatedRecordings {
  data: Recording[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class RecordingService {
  constructor(
    @InjectRepository(Recording)
    private readonly recordingRepository: Repository<Recording>,
  ) {}

  async create(studyId: string, dto: CreateRecordingDto): Promise<Recording> {
    const recording = this.recordingRepository.create({
      studyId,
      s3Key: dto.s3Key,
      metadata: dto.metadata,
    });
    return this.recordingRepository.save(recording);
  }

  async findOne(id: string): Promise<Recording | null> {
    return this.recordingRepository.findOne({ where: { id } });
  }

  async findAll(pagination: PaginationQueryDto): Promise<PaginatedRecordings> {
    const { page, limit } = pagination;
    const [data, total] = await this.recordingRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async update(id: string, dto: UpdateRecordingDto): Promise<Recording | null> {
    await this.recordingRepository.update(id, dto);
    return this.findOne(id);
  }

  async findByStudyId(
    studyId: string,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedRecordings> {
    const { page, limit } = pagination;
    const [data, total] = await this.recordingRepository.findAndCount({
      where: { studyId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
