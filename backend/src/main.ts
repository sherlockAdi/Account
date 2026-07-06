import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  const allowedOrigins = (process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173'])
    .map((origin) => origin.trim())
    .filter(Boolean);
  const originSet = new Set(allowedOrigins);
  for (const origin of allowedOrigins) {
    try {
      const url = new URL(origin);
      if (url.hostname === 'localhost') {
        originSet.add(origin.replace('localhost', '127.0.0.1'));
      } else if (url.hostname === '127.0.0.1') {
        originSet.add(origin.replace('127.0.0.1', 'localhost'));
      }
    } catch {
      // Ignore invalid origins and let CORS reject them later.
    }
  }

  app.enableCors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin) return callback(null, true);

      try {
        const url = new URL(requestOrigin);
        const normalizedOrigin = `${url.protocol}//${url.hostname}:${url.port || (url.protocol === 'https:' ? '443' : '80')}`;
        if (originSet.has(requestOrigin) || originSet.has(normalizedOrigin)) {
          return callback(null, true);
        }
        if ((url.hostname === 'localhost' || url.hostname === '127.0.0.1') && allowedOrigins.some((origin) => {
          try {
            const allowed = new URL(origin);
            return allowed.hostname === url.hostname && allowed.port === url.port;
          } catch {
            return false;
          }
        })) {
          return callback(null, true);
        }
      } catch {
        if (originSet.has(requestOrigin)) return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin ${requestOrigin}`), false);
    },
    credentials: true,
  });
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AccountERP SaaS API')
    .setDescription('Industrial SaaS ERP API for accounting, inventory, GST, manufacturing, payroll, and marketplace modules.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
