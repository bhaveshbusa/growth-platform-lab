import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { EventContracts, fingerprintPlan } from '@growth/event-contracts';

export type ContractsStatus = 'ok' | 'failed';

/**
 * Holds the contracts compiled from the tracking plan at startup.
 *
 * Compilation failure does not crash the process: the gateway stays live and
 * reports itself unready, so a rollout stops at this instance instead of
 * replacing a working fleet with one that has no contract at all.
 */
@Injectable()
export class ContractsService implements OnModuleInit {
  private readonly logger = new Logger(ContractsService.name);
  private contracts?: EventContracts;
  private fingerprint?: string;
  private failure?: string;

  onModuleInit(): void {
    this.load();
  }

  load(): void {
    try {
      this.contracts = EventContracts.fromPlan();
      this.fingerprint = fingerprintPlan(this.contracts.plan);
      this.failure = undefined;
      this.logger.log(
        `Compiled ${this.contracts.size} event contract(s) from tracking plan version ${this.contracts.plan.version}`,
      );
    } catch (error) {
      this.contracts = undefined;
      this.fingerprint = undefined;
      this.failure = (error as Error).message;
      this.logger.error(`Could not compile event contracts: ${this.failure}`);
    }
  }

  get status(): ContractsStatus {
    return this.contracts === undefined ? 'failed' : 'ok';
  }

  /** Why compilation failed, for the readiness payload and the logs. */
  get error(): string | undefined {
    return this.failure;
  }

  /** The compiled contracts, or undefined while the plan cannot be compiled. */
  get current(): EventContracts | undefined {
    return this.contracts;
  }

  /**
   * Fingerprint of the plan this process actually compiled, not of the plan the
   * generated types were built from: the two differ whenever the deployed plan
   * is not the one in the working tree, which is exactly when it matters.
   */
  get planFingerprint(): string | undefined {
    return this.fingerprint;
  }
}
