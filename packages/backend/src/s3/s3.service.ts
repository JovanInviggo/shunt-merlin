import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3 } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger = new Logger(S3Service.name);

  constructor(private config: ConfigService) {}

  private readonly bucketName = this.config.getOrThrow('S3_STORAGE_BUCKET_NAME');

  private readonly s3Client = new S3({
    region: this.config.getOrThrow('S3_STORAGE_REGION'),
    endpoint: this.config.get('S3_STORAGE_ENDPOINT'), // set for non-AWS providers (e.g. Scaleway)
    forcePathStyle: !!this.config.get('S3_STORAGE_ENDPOINT'), // required by most S3-compatible APIs
    credentials: {
      accessKeyId: this.config.getOrThrow('S3_STORAGE_ACCESS_KEY'),
      secretAccessKey: this.config.getOrThrow('S3_STORAGE_SECRET_KEY'),
    },
  });

  async onModuleInit(): Promise<void> {
    try {
      await this.s3Client.send(
        new HeadBucketCommand({
          Bucket: this.bucketName,
        }),
      );
      this.logger.log(`S3 connectivity OK for bucket ${this.bucketName}`);
    } catch (error) {
      this.logger.error(
        `S3 connectivity check FAILED for bucket ${this.bucketName}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  async getPresignedUploadUrl(
    studyId: string,
    filename: string,
  ): Promise<{ uploadUrl: string; s3Key: string }> {
    const s3Key = `recordings/${studyId}/${filename}`;
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
    });
    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 10,
    });
    return { uploadUrl, s3Key };
  }

  async getPresignedDownloadUrl(s3Key: string): Promise<{ downloadUrl: string }> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
    });
    const downloadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 900, // 15 minutes
    });
    return { downloadUrl };
  }
}
