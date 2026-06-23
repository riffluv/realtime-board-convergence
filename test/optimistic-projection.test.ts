import {
  EMPTY_PENDING_OPERATION_REGISTRY,
  pendingOperationRegistryReducer,
  projectOptimisticOrder,
} from "../src/index";

describe("optimistic projection", () => {
  test("applies queued operations over the authoritative base order", () => {
    const registry = pendingOperationRegistryReducer(EMPTY_PENDING_OPERATION_REGISTRY, {
      type: "enqueue",
      at: 10,
      operation: {
        operationId: "op-1",
        entityId: "b",
        action: "add",
        targetIndex: 1,
      },
    });

    expect(
      projectOptimisticOrder({
        baseOrder: ["a", null],
        registry,
      })
    ).toMatchObject({
      order: ["a", "b"],
      appliedOperationIds: ["op-1"],
      skippedOperationIds: [],
    });
  });

  test("skips terminal operations", () => {
    const queued = pendingOperationRegistryReducer(EMPTY_PENDING_OPERATION_REGISTRY, {
      type: "enqueue",
      at: 10,
      operation: {
        operationId: "op-1",
        entityId: "b",
        action: "add",
        targetIndex: 1,
      },
    });
    const acked = pendingOperationRegistryReducer(queued, {
      type: "authoritative-result",
      at: 20,
      operationId: "op-1",
      result: {
        status: "applied",
        applied: true,
        revision: 1,
        order: ["a", "b"],
      },
    });
    const confirmed = pendingOperationRegistryReducer(acked, {
      type: "snapshot-matched",
      at: 30,
      operationId: "op-1",
    });

    expect(projectOptimisticOrder({ baseOrder: ["a"], registry: confirmed }).order).toEqual(["a"]);
  });

  test("reports a warning when an optimistic operation cannot be applied", () => {
    const registry = pendingOperationRegistryReducer(EMPTY_PENDING_OPERATION_REGISTRY, {
      type: "enqueue",
      at: 10,
      operation: {
        operationId: "op-1",
        entityId: "b",
        action: "add",
        targetIndex: 0,
      },
    });

    expect(projectOptimisticOrder({ baseOrder: ["a"], registry })).toMatchObject({
      order: ["a"],
      appliedOperationIds: [],
      skippedOperationIds: ["op-1"],
      warnings: [{ operationId: "op-1", reason: "slot-occupied" }],
    });
  });
});
