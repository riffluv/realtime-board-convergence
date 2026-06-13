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
  return acked.operations["op-1"]!;
}

describe("convergence checker", () => {
  test("accepts a trusted snapshot at or after the authoritative revision", () => {
    expect(
      checkOperationConvergence({
        operation: ackedOperation(),
        snapshot: { revision: 5, order: ["a"], trusted: true },
      })
    ).toEqual({ converged: true });
  });

  test("blocks stale snapshots", () => {
    expect(
      checkOperationConvergence({
        operation: ackedOperation(),
        snapshot: { revision: 4, order: ["a"], trusted: true },
      })
    ).toEqual({ converged: false, reason: "revision-behind" });
  });

  test("blocks mismatched signatures", () => {
    expect(
      checkOperationConvergence({
        operation: ackedOperation(),
        snapshot: { revision: 5, order: ["b"], trusted: true },
      })
    ).toEqual({ converged: false, reason: "signature-mismatch" });
  });
});
