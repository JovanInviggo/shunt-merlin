import * as bcrypt from 'bcrypt';
import { User } from '../../user/user.entity';
import { UserRole } from '../../user/user-role.enum';
import { Study } from '../../study/study.entity';
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

  console.log('Seeding complete!');
  await AppDataSource.destroy();
}

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
