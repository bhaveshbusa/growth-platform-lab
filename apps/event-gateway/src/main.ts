import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.enableShutdownHooks();

  const configuredPort = process.env.EVENT_GATEWAY_PORT;
  const port = configuredPort === undefined ? 3000 : Number(configuredPort);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(
      `EVENT_GATEWAY_PORT must be an integer between 1 and 65535; received "${configuredPort}"`,
    );
  }

  await app.listen(port);
}

void bootstrap();
