import {
  applyBoardOperation,
  pendingOperationRegistryReducer,
  projectOptimisticOrder,
  resolveDrop,
  EMPTY_PENDING_OPERATION_REGISTRY,
} from "../src/index";

const snapshot = {
  revision: 1,
  order: ["card-a", null, "card-c"],
};

const drop = resolveDrop({
  entityId: "card-b",
  targetId: "slot-1",
  boardOrder: snapshot.order,
  slotCount: 4,
  targetHasRect: true,
});

if (drop.operation !== "add" || drop.targetIndex === null) {
  throw new Error(`unexpected drop decision: ${drop.decision.kind}`);
}

const localResult = applyBoardOperation(snapshot.order, {
  operationId: "op-1",
  entityId: "card-b",
  action: drop.operation,
  targetIndex: drop.targetIndex,
});

let registry = pendingOperationRegistryReducer(EMPTY_PENDING_OPERATION_REGISTRY, {
  type: "enqueue",
  at: 1,
  operation: {
    operationId: "op-1",
    entityId: "card-b",
    action: drop.operation,
    targetIndex: drop.targetIndex,
    localPreviewOrder: localResult.order,
  },
});

registry = pendingOperationRegistryReducer(registry, {
  type: "optimistic-applied",
  at: 2,
  operationId: "op-1",
  localPreviewOrder: localResult.order,
});

const projected = projectOptimisticOrder({
  baseOrder: snapshot.order,
  registry,
});

console.log({
  drop,
  optimisticOrder: projected.order,
});
