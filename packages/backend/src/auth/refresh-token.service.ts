import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { RefreshToken } from './refresh-token.entity';

@Injectable()
export class RefreshTokenService {
  private static readonly EXPIRY_DAYS = 30;

  constructor(
    @InjectRepository(RefreshToken)
    private readonly repo: Repository<RefreshToken>,
  ) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Issue a new refresh token, persist its hash, return the raw token. */
  async generate(
    subjectId: string,
    type: 'admin' | 'participant',
  ): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + RefreshTokenService.EXPIRY_DAYS);

    await this.repo.save(
      this.repo.create({ tokenHash: this.hash(rawToken), subjectId, type, expiresAt }),
    );

    return rawToken;
  }

  /**
   * Validate a refresh token, delete it (single-use rotation), and return a
   * new raw token alongside the subject info.
   * Returns null if the token is unknown or expired.
   */
  async consume(rawToken: string): Promise<{
    subjectId: string;
    type: 'admin' | 'participant';
    newRawToken: string;
  } | null> {
    const record = await this.repo.findOne({
      where: { tokenHash: this.hash(rawToken) },
    });

    if (!record) return null;

    // Always delete — expired tokens should not remain in the table.
    await this.repo.delete(record.id);

    if (record.expiresAt < new Date()) return null;

    const newRawToken = await this.generate(record.subjectId, record.type);
    return { subjectId: record.subjectId, type: record.type, newRawToken };
  }

  /** Revoke a refresh token immediately (logout). */
  async revoke(rawToken: string): Promise<void> {
    await this.repo.delete({ tokenHash: this.hash(rawToken) });
  }
}
