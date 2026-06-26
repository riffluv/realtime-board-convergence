import {
  EMPTY_PENDING_OPERATION_REGISTRY,
  applyBoardOperation,
  checkOperationConvergence,
  pendingOperationRegistryReducer,
  projectOptimisticOrder,
  selectActivePendingOperations,
  type BoardSnapshot,
  type PendingOperationRegistryState,
} from "../src/index";

function activePendingIds(registry: PendingOperationRegistryState): string[] {
  return selectActivePendingOperations(registry).map((operation) => operation.operationId);
}

function logStep(label: string, data: Record<string, unknown>): void {
  console.log(label, JSON.stringify(data));
}

const baseSnapshot: BoardSnapshot = {
  revision: 4,
  order: ["card-a", null],
};

const operation = {
  operationId: "client-1-1",
  entityId: "card-b",
  action: "add" as const,
  targetIndex: 1,
  baseRevision: baseSnapshot.revision,
};

const localResult = applyBoardOperation(baseSnapshot.order, operation);
let registry = pendingOperationRegistryReducer(EMPTY_PENDING_OPERATION_REGISTRY, {
  type: "enqueue",
  at: 1,
  operation: {
    operationId: operation.operationId,
    entityId: operation.entityId,
    action: operation.action,
    targetIndex: operation.targetIndex,
    localPreviewOrder: localResult.order,
  },
});

registry = pendingOperationRegistryReducer(registry, {
  type: "optimistic-applied",
  at: 2,
  operationId: operation.operationId,
  localPreviewOrder: localResult.order,
});

logStep("1 enqueue + project", {
  projectedOrder: projectOptimisticOrder({ baseOrder: baseSnapshot.order, registry }).order,
  pending: activePendingIds(registry),
});

registry = pendingOperationRegistryReducer(registry, {
  type: "sent",
  at: 3,
  operationId: operation.operationId,
});

registry = pendingOperationRegistryReducer(registry, {
  type: "authoritative-result",
  at: 4,
  operationId: operation.operationId,
  result: {
    status: "applied",
    applied: true,
    revision: 5,
    order: localResult.order,
    operationId: operation.operationId,
  },
});

const acknowledged = registry.operations[operation.operationId];
if (!acknowledged) throw new Error("expected acknowledged operation");

logStep("2 acknowledged, still pending", {
  authoritativeRevision: acknowledged.authoritativeRevision,
  pending: activePendingIds(registry),
});

const staleCheck = checkOperationConvergence({
  operation: acknowledged,
  snapshot: { revision: 4, order: localResult.order, trusted: true },
});
logStep("3 stale trusted snapshot is ignored", staleCheck);

const untrustedCheck = checkOperationConvergence({
  operation: acknowledged,
  snapshot: { revision: 5, order: localResult.order, trusted: false },
});
logStep("4 untrusted current snapshot is ignored", untrustedCheck);

const laterTrustedSnapshot = {
  revision: 6,
  order: ["card-a", "card-b", "card-c"],
  trusted: true,
} as const;

const coveredCheck = checkOperationConvergence({
  operation: acknowledged,
  snapshot: laterTrustedSnapshot,
});
logStep("5 later trusted revision covers the operation", coveredCheck);

if (coveredCheck.converged) {
  registry = pendingOperationRegistryReducer(registry, {
    type: "snapshot-matched",
    at: 5,
    operationId: operation.operationId,
  });
}

logStep("6 terminal registry state", {
  pending: activePendingIds(registry),
  state: registry.operations[operation.operationId]?.state,
  snapshotReconciledAt: registry.operations[operation.operationId]?.snapshotReconciledAt,
});
