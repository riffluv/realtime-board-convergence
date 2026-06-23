import {
  EMPTY_PENDING_OPERATION_REGISTRY,
  checkOperationConvergence,
  pendingOperationRegistryReducer,
} from "../src/index";

function ackedOperation() {
  const queued = pendingOperationRegistryReducer(EMPTY_PENDING_OPERATION_REGISTRY, {
    type: "enqueue",
    at: 10,
    operation: {
      operationId: "op-1",
      entityId: "a",
      action: "add",
      targetIndex: 0,
    },
  });
  const sent = pendingOperationRegistryReducer(queued, {
    type: "sent",
    at: 20,
    operationId: "op-1",
  });
  const acked = pendingOperationRegistryReducer(sent, {
    type: "authoritative-result",
    at: 30,
    operationId: "op-1",
    result: {
      status: "applied",
      applied: true,
      revision: 5,
      order: ["a"],
    },
  });
  const operation = acked.operations["op-1"];
  if (!operation) throw new Error("expected operation");
  return operation;
}

describe("convergence checker", () => {
  test("blocks sent operations that have not been acknowledged", () => {
    const queued = pendingOperationRegistryReducer(EMPTY_PENDING_OPERATION_REGISTRY, {
      type: "enqueue",
      at: 10,
      operation: {
        operationId: "op-1",
        entityId: "a",
        action: "add",
        targetIndex: 0,
      },
    });
    const sent = pendingOperationRegistryReducer(queued, {
      type: "sent",
      at: 20,
      operationId: "op-1",
    });
    const operation = sent.operations["op-1"];
    if (!operation) throw new Error("expected operation");

    expect(
      checkOperationConvergence({
        operation,
        snapshot: { revision: 1, order: ["a"], trusted: true },
      })
    ).toEqual({ converged: false, reason: "operation-not-acked" });
  });

  test("accepts a trusted snapshot at or after the authoritative revision", () => {
    expect(
      checkOperationConvergence({
        operation: ackedOperation(),
        snapshot: { revision: 5, order: ["a"], trusted: true },
      })
    ).toEqual({ converged: true, evidence: "exact-signature" });
  });

  test("requires explicit trusted snapshot evidence", () => {
    expect(
      checkOperationConvergence({
        operation: ackedOperation(),
        snapshot: { revision: 5, order: ["a"] },
      })
    ).toEqual({ converged: false, reason: "untrusted-snapshot" });
  });

  test("blocks stale snapshots", () => {
    expect(
      checkOperationConvergence({
        operation: ackedOperation(),
        snapshot: { revision: 4, order: ["a"], trusted: true },
      })
    ).toEqual({ converged: false, reason: "revision-behind" });
  });

  test("blocks mismatched signatures in exact-state mode", () => {
    expect(
      checkOperationConvergence({
        operation: ackedOperation(),
        snapshot: { revision: 5, order: ["b"], trusted: true },
        evidenceMode: "exact-state",
      })
    ).toEqual({ converged: false, reason: "signature-mismatch" });
  });

  test("covers a skipped exact snapshot with a later trusted revision", () => {
    expect(
      checkOperationConvergence({
        operation: ackedOperation(),
        snapshot: { revision: 6, order: ["a", "b"], trusted: true },
      })
    ).toEqual({ converged: true, evidence: "revision-covered" });
  });

  test("uses operation-effect evidence for a same-revision board that still contains the operation effect", () => {
    expect(
      checkOperationConvergence({
        operation: ackedOperation(),
        snapshot: { revision: 5, order: ["a", "b"], trusted: true },
      })
    ).toEqual({ converged: true, evidence: "operation-effect" });
  });

  test("allows a later authoritative revision to supersede the current operation effect", () => {
    expect(
      checkOperationConvergence({
        operation: ackedOperation(),
        snapshot: { revision: 6, order: ["b", "a"], trusted: true },
      })
    ).toEqual({ converged: true, evidence: "revision-covered" });
  });
});
