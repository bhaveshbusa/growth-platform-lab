import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ContractsService } from '../contracts/contracts.service';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  const contracts = {
    error: undefined as string | undefined,
    status: 'ok' as 'ok' | 'failed',
  };

  let controller: HealthController;

  beforeEach(async () => {
    contracts.error = undefined;
    contracts.status = 'ok';

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        { provide: ContractsService, useValue: contracts },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('reports the application as live', () => {
    expect(controller.getLiveness()).toEqual({ status: 'ok' });
  });

  it('reports readiness with the checks it actually performed', () => {
    expect(controller.getReadiness()).toEqual({
      checks: { event_contracts: 'ok' },
      status: 'ready',
    });
  });

  it('is live but not ready when the tracking plan will not compile', () => {
    contracts.status = 'failed';
    contracts.error =
      'event lesson_started: version must be a positive integer';

    expect(controller.getLiveness()).toEqual({ status: 'ok' });
    expect(() => controller.getReadiness()).toThrow(
      ServiceUnavailableException,
    );
  });

  it('says why it is not ready', () => {
    contracts.status = 'failed';
    contracts.error = 'no such file';

    try {
      controller.getReadiness();
      throw new Error('expected readiness to fail');
    } catch (error) {
      expect((error as ServiceUnavailableException).getResponse()).toEqual({
        checks: { event_contracts: 'failed' },
        error: 'no such file',
        status: 'not_ready',
      });
    }
  });
});
