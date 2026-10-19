import { NestExpressApplication } from '@nestjs/platform-express';
import session from 'express-session';
import mongoose from 'mongoose';
import MongoStore from 'connect-mongo';
import passport from 'passport';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import compression from 'compression';
import { json, urlencoded } from 'body-parser';
import { join } from 'path';
import * as fs from 'fs';

export const setAppDB = (app: NestExpressApplication): void => {
  const uploadsDir = join(process.cwd(), 'server', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.useStaticAssets(uploadsDir, {
    prefix: '/uploads/',
  });

  app.use(compression());
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb' }));
  app.use(cookieParser());

  // Parse ORIGIN – hỗ trợ nhiều origin phân cách bằng dấu phẩy
  // Ví dụ: ORIGIN="https://cheri-three.vercel.app,http://localhost:3000"
  const allowedOrigins: string[] = [
    'http://localhost:3000',
    'http://localhost:4200',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:4200',
  ];
  if (process.env.ORIGIN) {
    process.env.ORIGIN.split(',').forEach((o) => {
      const trimmed = o.trim();
      if (trimmed && !allowedOrigins.includes(trimmed)) {
        allowedOrigins.push(trimmed);
      }
    });
  }

  app.use(
    cors({
      credentials: true,
      origin: (requestOrigin, callback) => {
        if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
          callback(null, true);
        } else {
          // Cho phép tất cả các origin khác (mở rộng nếu cần, hoặc đổi thành false để chặt)
          callback(null, true);
        }
      },
    }),
  );

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('Thiếu cấu hình biến môi trường bắt buộc: MONGO_URI');
  }

  const cookieKey = process.env.COOKIE_KEY;
  if (!cookieKey) {
    throw new Error('Thiếu cấu hình biến môi trường bắt buộc: COOKIE_KEY');
  }

  const clientP: any = mongoose
    .connect(mongoUri, {})
    .then((m) => m.connection.getClient());

  app.use(
    session({
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        secure: false,
        sameSite: 'lax',
      },
      secret: process.env.COOKIE_KEY,
      resave: true,
      saveUninitialized: false,
      store: MongoStore.create({
        clientPromise: clientP,
        collectionName: 'session',
      }),
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());
};
