import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('reports the application as live', () => {
    expect(controller.getLiveness()).toEqual({ status: 'ok' });
  });

  it('reports the application as ready', () => {
    expect(controller.getReadiness()).toEqual({ status: 'ready' });
  });
});
