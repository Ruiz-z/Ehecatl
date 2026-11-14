import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HealthModule } from '../src/modules/health/health.module.js';

describe('GET /health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [HealthModule] }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => { await app?.close(); });

  it('responds with status ok and HTTP 200', async () => {
    await request(app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok' });
  });
});
