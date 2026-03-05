import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { User } from '../user/user.entity';
import { Study } from '../study/study.entity';
import { Recording } from '../recording/recording.entity';
import { RefreshToken } from '../auth/refresh-token.entity';

dotenv.config();

/**
 * Standalone DataSource used by the TypeORM CLI (migration:generate,
 * migration:run, migration:revert, migration:show).
 *
 * Usage:
 *   npm run migration:generate -- src/database/migrations/MyMigrationName
 *   npm run migration:run
 *   npm run migration:revert
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USER ?? 'postgres',
  password: process.env.DATABASE_PASSWORD ?? 'password',
  database: process.env.DATABASE_NAME ?? 'shunt_wizzard',
  entities: [User, Study, Recording, RefreshToken],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});
