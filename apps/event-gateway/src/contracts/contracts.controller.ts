import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  PLAN_FINGERPRINT,
  type EventContracts,
  type PlanProperty,
} from '@growth/event-contracts';
import { ContractsService } from './contracts.service';

interface ContractSummary {
  key: string;
  owner: string;
  purpose: string;
  source: string;
  required_properties: string[];
}

interface CatalogueResponse {
  product: string;
  plan_version: number;
  plan_fingerprint: string;
  events: ContractSummary[];
}

interface ContractResponse extends ContractSummary {
  description: string;
  properties: PlanProperty[];
}

/**
 * The contract catalogue, published so a client can discover what it is allowed
 * to send instead of guessing. Read-only on purpose: the write path
 * (POST /v1/events, batching, idempotency, consent, dead-lettering) is phase 3.
 */
@Controller('v1/contracts')
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Get()
  list(): CatalogueResponse {
    const contracts = this.available();

    return {
      events: contracts.plan.events.map((event) => ({
        key: `${event.name}@${event.version}`,
        owner: event.owner,
        purpose: event.purpose,
        required_properties: event.properties
          .filter((property) => property.required)
          .map((property) => property.name),
        source: event.source,
      })),
      plan_fingerprint: PLAN_FINGERPRINT,
      plan_version: contracts.plan.version,
      product: contracts.plan.product,
    };
  }

  @Get(':name/:version')
  getOne(
    @Param('name') name: string,
    @Param('version', ParseIntPipe) version: number,
  ): ContractResponse {
    const contract = this.available().get(name, version);
    if (contract === undefined) {
      throw new NotFoundException(`No contract for ${name}@${version}`);
    }

    const { event } = contract;
    return {
      description: event.description,
      key: contract.key,
      owner: event.owner,
      properties: event.properties,
      purpose: event.purpose,
      required_properties: event.properties
        .filter((property) => property.required)
        .map((property) => property.name),
      source: event.source,
    };
  }

  private available(): EventContracts {
    const contracts = this.contracts.current;
    if (contracts === undefined) {
      throw new ServiceUnavailableException({
        error: this.contracts.error,
        status: 'contracts_unavailable',
      });
    }
    return contracts;
  }
}
