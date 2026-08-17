import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Health endpoints (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health/live returns the liveness status', async () => {
    const server = app.getHttpServer() as Server;

    await request(server)
      .get('/health/live')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('GET /health/ready returns the readiness status', async () => {
    const server = app.getHttpServer() as Server;

    await request(server)
      .get('/health/ready')
      .expect(200)
      .expect({ status: 'ready' });
  });
});
