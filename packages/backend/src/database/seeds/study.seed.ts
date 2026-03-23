import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { User } from '../../user/user.entity';
import { UserRole } from '../../user/user-role.enum';
import { Study } from '../../study/study.entity';
import { Recording } from '../../recording/recording.entity';
import { RecordingClassification } from '../../recording/recording-classification.enum';
import { AppDataSource } from '../data-source';

async function seed() {
  console.log('Connecting to database...');
  await AppDataSource.initialize();

  console.log('Running pending migrations...');
  await AppDataSource.runMigrations();

  console.log('Seeding database...');

  const userRepository = AppDataSource.getRepository(User);
  const studyRepository = AppDataSource.getRepository(Study);

  // Create admin user
  const existingAdmin = await userRepository.findOne({
    where: { email: 'admin@example.com' },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('changeme', 10);
    const admin = userRepository.create({
      email: 'admin@example.com',
      password: hashedPassword,
      role: UserRole.ADMIN,
    });
    await userRepository.save(admin);
    console.log('Created admin user: admin@example.com');
  } else {
    console.log('Admin user already exists');
  }

  // Create sample study IDs
  const sampleStudyIds = ['STUDY001', 'STUDY002', 'STUDY003', 'TEST123'];

  for (const studyId of sampleStudyIds) {
    const existing = await studyRepository.findOne({ where: { studyId } });
    if (!existing) {
      const study = studyRepository.create({
        studyId,
        isActive: true,
      });
      await studyRepository.save(study);
      console.log(`Created study: ${studyId}`);
    } else {
      console.log(`Study ${studyId} already exists`);
    }
  }

  // Seed recordings for STUDY001 spread over the last 6 weeks
  const recordingRepository = AppDataSource.getRepository(Recording);
  const existingRecordings = await recordingRepository.count({ where: { studyId: 'STUDY001' } });

  if (existingRecordings === 0) {
    const now = new Date();
    const devices = ['iPhone 15', 'iPhone 14 Pro', 'Samsung Galaxy S24'];
    const appVersions = ['1.0.0', '1.0.1'];
    const classifications = [
      RecordingClassification.NORMAL,
      RecordingClassification.ABNORMAL,
      RecordingClassification.UNCLEAR,
      RecordingClassification.NOT_CLASSIFIED,
      null,
    ];
    const notes = [
      'Mild turbulence detected near shunt valve.',
      'Clear signal, no anomalies.',
      'Signal slightly degraded, recommend re-recording.',
      null,
      null,
    ];

    // ~4 recordings per week for 6 weeks = 24 recordings
    const recordings: Partial<Recording>[] = [];
    for (let week = 0; week < 6; week++) {
      for (let day = 0; day < 4; day++) {
        const daysAgo = week * 7 + day * 1 + Math.floor(Math.random() * 2);
        const createdAt = new Date(now);
        createdAt.setDate(createdAt.getDate() - daysAgo);
        createdAt.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60));

        const timestamp = createdAt.getTime();
        const uuid = randomUUID();
        const device = devices[Math.floor(Math.random() * devices.length)];

        recordings.push({
          studyId: 'STUDY001',
          s3Key: `recordings/STUDY001/${timestamp}-${uuid}.webm`,
          metadata: {
            duration: 60 + Math.floor(Math.random() * 180),
            deviceModel: device,
            appVersion: appVersions[Math.floor(Math.random() * appVersions.length)],
            os: device.startsWith('iPhone') ? 'iOS 17' : 'Android 14',
          },
          classification: classifications[Math.floor(Math.random() * classifications.length)],
          note: notes[Math.floor(Math.random() * notes.length)],
          createdAt,
        });
      }
    }

    await recordingRepository.save(recordings as Recording[]);
    console.log(`Created ${recordings.length} recordings for STUDY001`);
  } else {
    console.log(`STUDY001 already has ${existingRecordings} recordings, skipping`);
  }

  console.log('Seeding complete!');
  await AppDataSource.destroy();
}

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
