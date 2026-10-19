declare const Express: any;

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppSSRModule } from './app-ssr.module';
import { Logger } from '@nestjs/common';
import { setAppDB } from './setAppDB';

import { fork } from 'child_process';
import { join } from 'path';
import * as net from 'net';

async function bootstrap() {
  const logger = new Logger('boostrap');

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
    const adminPath = join(process.cwd(), 'server', 'admin-server.js');
    fork(adminPath, [], { stdio: 'inherit' });
  }

  const app = await NestFactory.create<NestExpressApplication>(AppSSRModule);

  setAppDB(app);

  const port = Number(process.env.PORT || 4000);
  await app.listen(port, '0.0.0.0');
  logger.log('App listening on port ' + port);
}

bootstrap().catch((err) => console.error(err));
