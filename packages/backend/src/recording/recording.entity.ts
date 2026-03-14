import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Study } from '../study/study.entity';
import { RecordingClassification } from './recording-classification.enum';

@Entity('recordings')
export class Recording {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  studyId: string;

  @Column()
  s3Key: string;

  @Column({ type: 'jsonb' })
  metadata: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: RecordingClassification,
    nullable: true,
    default: null,
  })
  classification: RecordingClassification | null;

  @Column({ type: 'text', nullable: true, default: null })
  note: string | null;

  @ManyToOne(() => Study)
  @JoinColumn({ name: 'studyId', referencedColumnName: 'studyId' })
  study: Study;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
