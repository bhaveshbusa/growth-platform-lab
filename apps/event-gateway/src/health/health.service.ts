import { Injectable } from '@nestjs/common';

export interface HealthStatus {
  status: 'ok' | 'ready';
}

@Injectable()
export class HealthService {
  getLiveness(): HealthStatus {
    return { status: 'ok' };
  }

  getReadiness(): HealthStatus {
    return { status: 'ready' };
  }
}
