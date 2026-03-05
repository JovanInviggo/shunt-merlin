import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Recording } from './recording.entity';
import { CreateRecordingDto } from './dto/create-recording.dto';

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
      metadata: dto.metadata ?? null,
    });
    return this.recordingRepository.save(recording);
  }

  async findOne(id: string): Promise<Recording | null> {
    return this.recordingRepository.findOne({ where: { id } });
  }

  async findAll(): Promise<Recording[]> {
    return this.recordingRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findByStudyId(studyId: string): Promise<Recording[]> {
    return this.recordingRepository.find({
      where: { studyId },
      order: { createdAt: 'DESC' },
    });
  }
}
