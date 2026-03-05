import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Study } from './study.entity';
import { CreateStudyDto } from './dto/create-study.dto';

@Injectable()
export class StudyService {
  constructor(
    @InjectRepository(Study)
    private readonly studyRepository: Repository<Study>,
  ) {}

  async findByStudyId(studyId: string): Promise<Study | null> {
    return this.studyRepository.findOne({ where: { studyId } });
  }

  async findById(id: string): Promise<Study | null> {
    return this.studyRepository.findOne({ where: { id } });
  }

  async findAll(): Promise<Study[]> {
    return this.studyRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async create(dto: CreateStudyDto): Promise<Study> {
    const existing = await this.findByStudyId(dto.studyId);
    if (existing) {
      throw new ConflictException(
        `Study with ID "${dto.studyId}" already exists`,
      );
    }

    const study = this.studyRepository.create({
      studyId: dto.studyId,
      isActive: dto.isActive ?? true,
    });
    return this.studyRepository.save(study);
  }
}
