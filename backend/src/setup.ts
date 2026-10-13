import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { uploadRoot } from './uploads/uploads.service';
import { appConfig } from './config';

/** Shared by main.ts and the e2e tests so both run the same middleware. */
export function configureApp(app: INestApplication) {
  const express = app as NestExpressApplication;
  express.set('trust proxy', appConfig().TRUST_PROXY);
  express.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-origin' } }));
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  express.useStaticAssets(uploadRoot(), {
    prefix: '/uploads/',
    maxAge: '30d',
    immutable: true,
    index: false,
    dotfiles: 'deny',
    fallthrough: false,
  });
  app.enableShutdownHooks();
}
