import { Injectable } from '@nestjs/common';
import {
  ContractsService,
  type ContractsStatus,
} from '../contracts/contracts.service';

export interface LivenessStatus {
  status: 'ok';
}

export interface ReadinessStatus {
  status: 'ready' | 'not_ready';
  checks: {
    event_contracts: ContractsStatus;
  };
  /** Present only when a check failed, so a ready payload stays boring. */
  error?: string;
}

@Injectable()
export class HealthService {
  constructor(private readonly contracts: ContractsService) {}

  /** Live means "this process can answer"; it deliberately checks nothing else. */
  getLiveness(): LivenessStatus {
    return { status: 'ok' };
  }

  /**
   * Ready means "this instance can do its job". Without contracts the gateway
   * cannot tell a planned event from a typo, so it is not ready — a collector
   * that accepts anything is a data quality incident with good uptime.
   */
  getReadiness(): ReadinessStatus {
    const event_contracts = this.contracts.status;
    const readiness: ReadinessStatus = {
      checks: { event_contracts },
      status: event_contracts === 'ok' ? 'ready' : 'not_ready',
    };

    const error = this.contracts.error;
    return error === undefined ? readiness : { ...readiness, error };
  }
}
