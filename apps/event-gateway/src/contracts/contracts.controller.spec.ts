import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventContracts, fingerprintPlan } from '@growth/event-contracts';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';

describe('ContractsController', () => {
  const service = {
    current: undefined as EventContracts | undefined,
    error: undefined as string | undefined,
    planFingerprint: undefined as string | undefined,
  };

  let controller: ContractsController;

  beforeEach(async () => {
    service.current = EventContracts.fromPlan();
    service.error = undefined;
    service.planFingerprint = fingerprintPlan(service.current.plan);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContractsController],
      providers: [{ provide: ContractsService, useValue: service }],
    }).compile();

    controller = module.get<ContractsController>(ContractsController);
  });

  it('publishes every planned event so a client can discover what it may send', () => {
    const catalogue = controller.list();

    expect(catalogue.product).toBe('lingostreak');
    expect(catalogue.plan_fingerprint).toMatch(/^sha256:/);
    expect(catalogue.events).toContainEqual({
      key: 'subscription_started@1',
      owner: 'monetisation',
      purpose: 'product_analytics',
      required_properties: ['plan', 'price_minor_units', 'currency'],
      source: 'server',
    });
  });

  it('publishes the fingerprint of the plan this process compiled', () => {
    expect(controller.list().plan_fingerprint).toBe(
      fingerprintPlan(EventContracts.fromPlan().plan),
    );
  });

  it('returns one contract with its full property list', () => {
    const contract = controller.getOne('lesson_completed', 1);

    expect(contract.key).toBe('lesson_completed@1');
    expect(contract.properties.map((property) => property.name)).toEqual([
      'lesson_id',
      'score',
      'duration_seconds',
    ]);
  });

  it('404s for an event the plan does not describe', () => {
    expect(() => controller.getOne('lesson_abandoned', 1)).toThrow(
      NotFoundException,
    );
    expect(() => controller.getOne('lesson_completed', 2)).toThrow(
      NotFoundException,
    );
  });

  it('503s rather than publishing an empty catalogue when contracts are missing', () => {
    service.current = undefined;
    service.error = 'tracking plan: events must be a non-empty list';

    expect(() => controller.list()).toThrow(ServiceUnavailableException);
  });
});
