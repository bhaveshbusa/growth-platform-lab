import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';

interface Catalogue {
  product: string;
  plan_version: number;
  plan_fingerprint: string;
  events: { key: string; source: string }[];
}

describe('Contract catalogue (e2e)', () => {
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

  const server = (): Server => app.getHttpServer() as Server;

  it('GET /v1/contracts lists the planned events', async () => {
    const response = await request(server()).get('/v1/contracts').expect(200);
    const catalogue = response.body as Catalogue;

    expect(catalogue.product).toBe('lingostreak');
    expect(catalogue.plan_fingerprint).toMatch(/^sha256:/);
    expect(catalogue.events.map((event) => event.key)).toContain(
      'page_viewed@1',
    );
    expect(
      catalogue.events.find((event) => event.key === 'subscription_started@1')
        ?.source,
    ).toBe('server');
  });

  it('GET /v1/contracts/:name/:version describes one contract', async () => {
    await request(server()).get('/v1/contracts/signup_started/1').expect(200);
  });

  it('GET /v1/contracts/:name/:version 404s for an unplanned event', async () => {
    await request(server()).get('/v1/contracts/lesson_abandoned/1').expect(404);
  });

  it('rejects a non-numeric version rather than guessing', async () => {
    await request(server())
      .get('/v1/contracts/signup_started/latest')
      .expect(400);
  });
});
