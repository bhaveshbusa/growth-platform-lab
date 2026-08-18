import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  HealthService,
  type LivenessStatus,
  type ReadinessStatus,
} from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  getLiveness(): LivenessStatus {
    return this.healthService.getLiveness();
  }

  /**
   * 503 when not ready, because a load balancer reads the status code, not the
   * body. Returning 200 with `"status": "not_ready"` is how instances keep
   * receiving traffic they cannot serve.
   */
  @Get('ready')
  getReadiness(): ReadinessStatus {
    const readiness = this.healthService.getReadiness();
    if (readiness.status !== 'ready') {
      throw new ServiceUnavailableException(readiness);
    }
    return readiness;
  }
}
