import { Controller, Get } from '@nestjs/common';
import { HealthService, HealthStatus } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  getLiveness(): HealthStatus {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  getReadiness(): HealthStatus {
    return this.healthService.getReadiness();
  }
}
