import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { mkdirSync } from 'node:fs';
import { AppModule } from './app.module';
import { configureApp } from './setup';
import { uploadRoot } from './uploads/uploads.service';
import { appConfig } from './config';

async function bootstrap() {
  mkdirSync(uploadRoot(), { recursive: true });
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: true });
  app.useBodyParser('json', { limit: '2mb' });
  configureApp(app);
  await app.listen(appConfig().PORT);
}
void bootstrap();
