import { Module } from '@nestjs/common';
import { ContractsModule } from '../contracts/contracts.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  controllers: [HealthController],
  imports: [ContractsModule],
  providers: [HealthService],
})
export class HealthModule {}
