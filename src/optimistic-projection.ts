import {
  applyBoardOperation,
  normalizeBoardOrder,
  type BoardOperationOptions,
} from "./board-operation";
import type { BoardOrder } from "./model";
import {
  isPendingOperationTerminal,
  type PendingOperation,
  type PendingOperationRegistryState,
} from "./pending-operation-registry";

export type OptimisticProjectionWarning = {
  operationId: string;
  entityId: string;
  action: PendingOperation["action"];
  reason: string;
};

export type OptimisticProjectionResult = {
  order: BoardOrder;
  appliedOperationIds: string[];
  skippedOperationIds: string[];
  warnings: OptimisticProjectionWarning[];
};

const PROJECTABLE_STATES = new Set<PendingOperation["state"]>([
  "queued",
  "optimistic-applied",
  "sent",
]);

export function selectProjectablePendingOperations(
  registry: PendingOperationRegistryState
): PendingOperation[] {
  return registry.order
    .map((id) => registry.operations[id])
    .filter(
      (operation): operation is PendingOperation =>
        operation !== undefined &&
        !isPendingOperationTerminal(operation.state) &&
        PROJECTABLE_STATES.has(operation.state)
    );
}

export function projectOptimisticOrder(input: {
  baseOrder: readonly (string | null | undefined)[];
  registry: PendingOperationRegistryState;
  options?: BoardOperationOptions;
}): OptimisticProjectionResult {
  let order = normalizeBoardOrder(input.baseOrder, input.options);
  const appliedOperationIds: string[] = [];
  const skippedOperationIds: string[] = [];
  const warnings: OptimisticProjectionWarning[] = [];

  for (const operation of selectProjectablePendingOperations(input.registry)) {
    const result = applyBoardOperation(
      order,
      {
        operationId: operation.operationId,
        entityId: operation.entityId,
        action: operation.action,
        targetIndex: operation.targetIndex,
      },
      input.options
    );
    order = result.order;
    if (result.status === "applied") {
      appliedOperationIds.push(operation.operationId);
      continue;
    }
    skippedOperationIds.push(operation.operationId);
    warnings.push({
      operationId: operation.operationId,
      entityId: operation.entityId,
      action: operation.action,
      reason: result.reason ?? result.status,
    });
  }

  return {
    order,
    appliedOperationIds,
    skippedOperationIds,
    warnings,
  };
}
