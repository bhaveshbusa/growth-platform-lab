import { Module } from '@nestjs/common';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';

@Module({
  controllers: [ContractsController],
  exports: [ContractsService],
  providers: [ContractsService],
})
export class ContractsModule {}
