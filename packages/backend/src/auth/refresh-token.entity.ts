import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // SHA-256 of the raw token sent to the client — never store the raw value.
  @Index()
  @Column()
  tokenHash: string;

  // user.id for admin tokens, study.id for participant tokens.
  @Column()
  subjectId: string;

  @Column()
  type: 'admin' | 'participant';

  @Column()
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
