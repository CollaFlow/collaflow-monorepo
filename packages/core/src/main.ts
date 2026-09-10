import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import path from 'node:path';
import fs from 'node:fs';
import { AppModule } from './app.module';
import { createCollabServer } from './collab/collab.server';

export async function bootstrap(): Promise<{
  app: NestFastifyApplication;
  collabPort: number;
}> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  const config = app.get(ConfigService);
  const httpPort = config.get<number>('HTTP_PORT', 4000);
  const collabPort = config.get<number>('COLLAB_PORT', 1234);
  const staticPath = path.resolve(config.get<string>('STATIC_PATH', './public'));
  if (!fs.existsSync(staticPath)) {
    fs.mkdirSync(staticPath, { recursive: true });
  }

  await app.register(import('@fastify/static'), {
    root: staticPath,
    prefix: '/',
  });

  await app.listen(httpPort, '0.0.0.0');

  const collabServer = createCollabServer();
  collabServer.listen(collabPort, () => {
    console.log(`CollaFlow collaboration server listening on port ${collabPort}`);
  });

  return { app, collabPort };
}
