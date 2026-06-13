import { buildBoardOrderSignature } from "../board-operation";
import { checkOperationConvergence } from "../convergence-checker";
import type { BoardOperation, BoardSnapshot, ClientId } from "../model";
import {
  EMPTY_PENDING_OPERATION_REGISTRY,
  pendingOperationRegistryReducer,
  selectActivePendingOperations,
  selectSnapshotConvergenceCandidateOperations,
  type AuthoritativeOperationResult,
  type PendingOperationRegistryState,
} from "../pending-operation-registry";
import { projectOptimisticOrder } from "../optimistic-projection";

export class VirtualClient {
  readonly clientId: ClientId;
  private localSeq = 0;
  private snapshotState: BoardSnapshot;
  private registryState: PendingOperationRegistryState = EMPTY_PENDING_OPERATION_REGISTRY;

  constructor(input: { clientId: ClientId; snapshot: BoardSnapshot }) {
    this.clientId = input.clientId;
    this.snapshotState = input.snapshot;
  }

  snapshot(): BoardSnapshot {
    return this.snapshotState;
  }

  registry(): PendingOperationRegistryState {
    return this.registryState;
  }

  activePendingCount(): number {
    return selectActivePendingOperations(this.registryState).length;
  }

  signature(): string {
    return buildBoardOrderSignature(this.snapshotState.order);
  }

  optimisticSignature(): string {
    return buildBoardOrderSignature(
      projectOptimisticOrder({
        baseOrder: this.snapshotState.order,
        registry: this.registryState,
      }).order
    );
  }

  createOperation(input: Omit<BoardOperation, "operationId" | "clientId" | "baseRevision">): BoardOperation {
    this.localSeq += 1;
    return {
      ...input,
      operationId: `${this.clientId}-${this.localSeq}`,
      clientId: this.clientId,
      baseRevision: this.snapshotState.revision,
    };
  }

  enqueue(operation: BoardOperation): void {
    this.registryState = pendingOperationRegistryReducer(this.registryState, {
      type: "enqueue",
      at: this.localSeq,
      operation: {
        operationId: operation.operationId,
        entityId: operation.entityId,
        action: operation.action,
        targetIndex: operation.targetIndex ?? null,
      },
    });
    const preview = projectOptimisticOrder({
      baseOrder: this.snapshotState.order,
      registry: this.registryState,
    }).order;
    this.registryState = pendingOperationRegistryReducer(this.registryState, {
      type: "optimistic-applied",
      at: this.localSeq,
      operationId: operation.operationId,
      localPreviewOrder: preview,
    });
  }

  receiveResult(result: AuthoritativeOperationResult): void {
    const operationId = result.operationId ?? "";
    if (!operationId) return;
    this.registryState = pendingOperationRegistryReducer(this.registryState, {
      type: "sent",
      at: this.localSeq,
      operationId,
    });
    this.registryState = pendingOperationRegistryReducer(this.registryState, {
      type: "authoritative-result",
      at: this.localSeq,
      operationId,
      result,
    });
  }

  receiveSnapshot(snapshot: BoardSnapshot): void {
    if (snapshot.revision < this.snapshotState.revision) return;
    this.snapshotState = snapshot;
    for (const operation of selectSnapshotConvergenceCandidateOperations(this.registryState)) {
      const convergence = checkOperationConvergence({
        operation,
        snapshot: { ...snapshot, trusted: true },
      });
      if (!convergence.converged) continue;
      this.registryState = pendingOperationRegistryReducer(this.registryState, {
        type: "snapshot-matched",
        at: this.localSeq,
        operationId: operation.operationId,
      });
    }
  }
}
