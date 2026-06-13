import {
  applyBoardOperation,
  buildBoardOrderSignature,
  type BoardOperationOptions,
} from "../board-operation";
import type { BoardOperation, BoardSnapshot } from "../model";
import type { AuthoritativeOperationResult } from "../pending-operation-registry";

export class AuthoritativeServer {
  private revision = 0;
  private order: BoardSnapshot["order"];
  private readonly options?: BoardOperationOptions;

  constructor(input: { order?: BoardSnapshot["order"]; options?: BoardOperationOptions } = {}) {
    this.order = input.order ?? [];
    this.options = input.options;
  }

  snapshot(): BoardSnapshot {
    return {
      revision: this.revision,
      order: this.order,
    };
  }

  signature(): string {
    return buildBoardOrderSignature(this.order);
  }

  apply(operation: BoardOperation): AuthoritativeOperationResult {
    const result = applyBoardOperation(this.order, operation, this.options);
    if (result.status === "applied") {
      this.revision += 1;
      this.order = result.order;
    }
    return {
      status: result.status === "applied" ? "applied" : result.status,
      applied: result.status === "applied",
      ...(result.reason ? { reason: result.reason } : {}),
      revision: this.revision,
      order: this.order,
      operationId: operation.operationId,
      clientId: operation.clientId ?? null,
    };
  }
}
