import { APP_BASE_HREF } from '@angular/common';
import { DynamicModule, Module, OnModuleInit, Provider } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import 'reflect-metadata';
import * as express from 'express';
import { CommonEngine } from '@angular/ssr/node';

import bootstrap from '../../client/src/main.server';

function getServerDistFolder(): string {
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  try {
    const metaUrl = (0, eval)('typeof import.meta !== "undefined" ? import.meta.url : undefined');
    if (metaUrl) {
      return dirname(fileURLToPath(metaUrl));
    }
  } catch {
    // ignore
  }
  return resolve(process.cwd(), 'dist/cheri/server');
}

export function setupUniversal(app: any) {
  const serverDistFolder = getServerDistFolder();
  const browserDistFolder = resolve(serverDistFolder, '../browser');
  const indexHtml = join(serverDistFolder, 'index.server.html');

  app.engine(
    'html',
    (
      _filePath: string,
      options: { req: express.Request; [key: string]: any },
      callback: (err?: Error | null, html?: string) => void,
    ) => {
      const commonEngine = new CommonEngine();
      commonEngine
        .render({
          bootstrap,
          documentFilePath: indexHtml,
          url: `${options.req.protocol}://${options.req.get('host')}${options.req.originalUrl}`,
          publicPath: browserDistFolder,
          providers: [
            {
              provide: 'serverUrl',
              useValue: `${options.req.protocol}://${options.req.get('host')}`,
            },
          ],
        })
        .then((html: string) => callback(null, html))
        .catch((err: any) => callback(err));
    },
  );

  app.set('view engine', 'html');
  app.set('views', browserDistFolder);

  app.use(
    express.static(browserDistFolder, {
      maxAge: 600,
    }),
  );
}

export const angularUniversalProviders: Provider[] = [
  {
    provide: 'UNIVERSAL_INITIALIZER',
    useFactory: (host: HttpAdapterHost & { template: string }) =>
      host &&
      host.httpAdapter &&
      setupUniversal(host.httpAdapter.getInstance()),
    inject: [HttpAdapterHost],
  },
];

@Module({
  providers: [...angularUniversalProviders],
})
export class AngularUniversalModule implements OnModuleInit {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  static forRoot(): DynamicModule {
    return {
      module: AngularUniversalModule,
    };
  }

  async onModuleInit() {
    if (!this.httpAdapterHost) {
      return;
    }
    const httpAdapter = this.httpAdapterHost.httpAdapter;
    if (!httpAdapter) {
      return;
    }
    const app = httpAdapter.getInstance();
    const serverDistFolder = getServerDistFolder();
    const templatePath = join(serverDistFolder, 'index.server.html');
    app.get(/(.*)/, (req: express.Request, res: express.Response) =>
      res.render(templatePath, {
        req,
        res,
        providers: [{ provide: APP_BASE_HREF, useValue: req.baseUrl }],
      }),
    );
  }
}
