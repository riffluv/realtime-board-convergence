import {
  EMPTY_PENDING_OPERATION_REGISTRY,
  pendingOperationRegistryReducer,
  selectActivePendingOperations,
  selectSnapshotConvergenceCandidateOperations,
} from "../src/index";

describe("pending operation registry", () => {
  const enqueue = (operationId = "op-1") =>
    pendingOperationRegistryReducer(EMPTY_PENDING_OPERATION_REGISTRY, {
      type: "enqueue",
      at: 10,
      operation: {
        operationId,
        dragSessionId: "drag-1",
        entityId: "a",
        action: "add",
        targetIndex: 0,
      },
    });

  test("enqueues an operation and keeps insertion order", () => {
    const state = enqueue();

    expect(state.order).toEqual(["op-1"]);
    expect(state.operations["op-1"]).toMatchObject({
      operationId: "op-1",
      dragSessionId: "drag-1",
      entityId: "a",
      action: "add",
      targetIndex: 0,
      state: "queued",
      createdAt: 10,
      updatedAt: 10,
    });
  });

  test("tracks optimistic, sent, authoritative ack, and snapshot confirmation", () => {
    const optimistic = pendingOperationRegistryReducer(enqueue(), {
      type: "optimistic-applied",
      at: 20,
      operationId: "op-1",
      localPreviewOrder: ["a"],
    });
    expect(optimistic.operations["op-1"]?.state).toBe("optimistic-applied");
    expect(optimistic.operations["op-1"]?.localPreviewOrder).toEqual(["a"]);

    const sent = pendingOperationRegistryReducer(optimistic, {
      type: "sent",
      at: 30,
      operationId: "op-1",
    });
    expect(sent.operations["op-1"]?.state).toBe("sent");
    expect(sent.operations["op-1"]?.sentAt).toBe(30);

    const acked = pendingOperationRegistryReducer(sent, {
      type: "authoritative-result",
      at: 40,
      operationId: "op-1",
      result: {
        status: "applied",
        applied: true,
        revision: 5,
        order: ["a"],
      },
    });
    expect(acked.operations["op-1"]).toMatchObject({
      state: "sent",
      ackAt: 40,
      authoritativeStatus: "applied",
      authoritativeRevision: 5,
      authoritativeOrderSignature: "a",
    });

    const confirmed = pendingOperationRegistryReducer(acked, {
      type: "snapshot-matched",
      at: 50,
      operationId: "op-1",
    });
    expect(confirmed.operations["op-1"]?.state).toBe("confirmed");
    expect(selectActivePendingOperations(confirmed)).toEqual([]);
  });

  test("keeps noop ack pending until a snapshot confirms convergence", () => {
    const sent = pendingOperationRegistryReducer(enqueue(), {
      type: "sent",
      at: 20,
      operationId: "op-1",
    });
    const acked = pendingOperationRegistryReducer(sent, {
      type: "authoritative-result",
      at: 30,
      operationId: "op-1",
      result: {
        status: "noop",
        applied: false,
        reason: "already-present",
        order: ["a"],
      },
    });

    expect(acked.operations["op-1"]?.state).toBe("sent");
    expect(selectSnapshotConvergenceCandidateOperations(acked).map((op) => op.operationId)).toEqual([
      "op-1",
    ]);
  });

  test("classifies duplicate and stale authoritative results as superseded", () => {
    const duplicate = pendingOperationRegistryReducer(enqueue(), {
      type: "authoritative-result",
      at: 20,
      operationId: "op-1",
      result: {
        status: "duplicate",
        applied: false,
        reason: "duplicate-operation",
      },
    });
    expect(duplicate.operations["op-1"]?.state).toBe("superseded");

    const stale = pendingOperationRegistryReducer(enqueue("op-2"), {
      type: "authoritative-result",
      at: 20,
      operationId: "op-2",
      result: {
        status: "stale",
        applied: false,
        reason: "stale-operation",
      },
    });
    expect(stale.operations["op-2"]?.state).toBe("superseded");
  });

  test("marks active operations as resync-required for global resync", () => {
    const first = enqueue("op-1");
    const second = pendingOperationRegistryReducer(first, {
      type: "enqueue",
      at: 11,
      operation: {
        operationId: "op-2",
        entityId: "b",
        action: "move",
        targetIndex: 1,
      },
    });
    const confirmed = pendingOperationRegistryReducer(second, {
      type: "snapshot-matched",
      at: 20,
      operationId: "op-1",
    });
    const resync = pendingOperationRegistryReducer(confirmed, {
      type: "resync-required",
      at: 30,
      reason: "visibility-resume",
    });

    expect(resync.operations["op-1"]?.state).toBe("confirmed");
    expect(resync.operations["op-2"]?.state).toBe("resync-required");
  });

  test("does not mutate terminal operations", () => {
    const rolledBack = pendingOperationRegistryReducer(enqueue(), {
      type: "rollback",
      at: 20,
      operationId: "op-1",
      reason: "slot-occupied",
    });
    const next = pendingOperationRegistryReducer(rolledBack, {
      type: "sent",
      at: 30,
      operationId: "op-1",
    });

    expect(next).toBe(rolledBack);
    expect(next.operations["op-1"]?.state).toBe("rolled-back");
  });
});
