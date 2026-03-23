import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('HTTP');
  app.use((req: { method: string; url: string }, _res: unknown, next: () => void) => {
    logger.log(`${req.method} ${req.url.split('?')[0]}`);
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    // Requests with no Origin header (native mobile apps, curl, Postman) are
    // always allowed — CORS is a browser-only enforcement mechanism.
    // Browser requests must come from one of the ALLOWED_ORIGINS addresses.
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin '${origin}' not allowed by CORS policy`));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Shunt Wizard API')
      .setDescription(
        'Backend API for the Shunt Wizard study platform.\n\n' +
          '**Auth:** All protected endpoints require a Bearer JWT access token.\n' +
          'Obtain one via `POST /auth/login` (participant) or `POST /auth/admin/login` (admin).\n' +
          'Access tokens expire in 15 minutes — use `POST /auth/refresh` to rotate.',
      )
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Swagger docs available at: http://localhost:${port}/api/docs`);
  }
}
bootstrap();
