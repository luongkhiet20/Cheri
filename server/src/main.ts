import * as dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e: any) {
  console.warn('Could not set custom DNS servers:', e?.message);
}

import * as dotenv from 'dotenv';
import { resolve, join } from 'path';
import { existsSync } from 'fs';

// Xác định vị trí file .env dựa trên cấu trúc thực tế của dự án
const envCandidates = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '..', '.env'),
  resolve(__dirname, '..', '..', '.env'),
  resolve(__dirname, '..', '.env'),
];
const envPath = envCandidates.find((candidate) => existsSync(candidate)) || resolve(process.cwd(), '.env');
const envExists = existsSync(envPath);
dotenv.config({ path: envPath });

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { setAppDB } from './setAppDB';

import { fork } from 'child_process';
import * as net from 'net';

async function bootstrap() {
  const logger = new Logger('bootstrap');

  // Chẩn đoán an toàn cấu hình môi trường
  logger.log(`[Config] Env file path: ${envPath} (exists: ${envExists})`);
  const fbAppId = process.env.FACEBOOK_APP_ID || process.env.FACEBOOK_CLIENT_ID;
  if (fbAppId) {
    logger.log(`[Config] FACEBOOK_APP_ID loaded successfully (length: ${fbAppId.length})`);
  } else {
    logger.warn(`[Config] FACEBOOK_APP_ID is missing or not loaded from ${envPath}`);
  }
  const fbAppSecret = process.env.FACEBOOK_APP_SECRET || process.env.FACEBOOK_CLIENT_SECRET;
  if (fbAppSecret) {
    logger.log(`[Config] FACEBOOK_APP_SECRET loaded successfully (length: ${fbAppSecret.length})`);
  } else {
    logger.warn(`[Config] FACEBOOK_APP_SECRET is missing or not loaded from ${envPath}`);
  }

  const adminPort = Number(process.env.ADMIN_PORT || process.env.PORT_ADMIN || 5000);
  const checkPort = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const tester = net.createServer();
      tester.once('error', (err: any) => {
        resolve(err.code === 'EADDRINUSE');
      });
      tester.once('listening', () => {
        tester.close(() => resolve(false));
      });
      tester.listen(port);
    });
  };

  const isRunning = await checkPort(adminPort);
  if (!isRunning) {
    logger.log(`Auto-starting Admin Server on port ${adminPort}...`);
    const adminCandidates = [
      join(process.cwd(), 'server', 'admin-server.js'),
      join(process.cwd(), 'admin-server.js'),
      resolve(__dirname, '..', 'admin-server.js'),
    ];
    const adminPath = adminCandidates.find((candidate) => existsSync(candidate)) || join(process.cwd(), 'server', 'admin-server.js');
    fork(adminPath, [], { stdio: 'inherit' });
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  setAppDB(app);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log('App listening on port ' + port);
}

bootstrap();