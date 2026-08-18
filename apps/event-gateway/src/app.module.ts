import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ContractsModule } from './contracts/contracts.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ cache: true, isGlobal: true }),
    ContractsModule,
    HealthModule,
  ],
})
export class AppModule {}
