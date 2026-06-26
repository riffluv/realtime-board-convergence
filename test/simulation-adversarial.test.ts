import {
  AuthoritativeServer,
  VirtualClient,
  type AuthoritativeOperationResult,
} from "../src/index";

describe("adversarial simulation scenarios", () => {
  test("does not retire a pending operation from a snapshot before acknowledgement", () => {
    const server = new AuthoritativeServer({ order: ["a", null], options: { capacity: 2 } });
    const client = new VirtualClient({ clientId: "client-1", snapshot: server.snapshot() });
    const operation = client.createOperation({
      entityId: "b",
      action: "add",
      targetIndex: 1,
    });

    client.enqueue(operation);
    const result = server.apply(operation);
    client.receiveSnapshot(server.snapshot());

    expect(client.activePendingCount()).toBe(1);

    client.receiveResult(result);
    client.receiveSnapshot(server.snapshot());

    expect(client.activePendingCount()).toBe(0);
    expect(client.signature()).toBe(server.signature());
  });

  test("settles rejected operations without waiting for matching board state", () => {
    const server = new AuthoritativeServer({ order: ["a"], options: { capacity: 1 } });
    const client = new VirtualClient({ clientId: "client-1", snapshot: server.snapshot() });
    const operation = client.createOperation({
      entityId: "b",
      action: "add",
      targetIndex: 1,
    });

    client.enqueue(operation);
    client.receiveResult(server.apply(operation));
    client.receiveSnapshot(server.snapshot());

    expect(client.activePendingCount()).toBe(0);
    expect(client.registry().operations[operation.operationId]?.state).toBe("rejected");
    expect(client.signature()).toBe(server.signature());
  });

  test.each<AuthoritativeOperationResult["status"]>(["duplicate", "stale"])(
    "settles %s authoritative results as superseded",
    (status) => {
      const server = new AuthoritativeServer({ order: ["a"], options: { capacity: 2 } });
      const client = new VirtualClient({ clientId: "client-1", snapshot: server.snapshot() });
      const operation = client.createOperation({
        entityId: "a",
        action: "move",
        targetIndex: 0,
      });

      client.enqueue(operation);
      client.receiveResult({
        status,
        applied: false,
        reason: `${status}-operation`,
        operationId: operation.operationId,
      });
      client.receiveSnapshot(server.snapshot());

      expect(client.activePendingCount()).toBe(0);
      expect(client.registry().operations[operation.operationId]?.state).toBe("superseded");
    }
  );

  test("converges when acknowledgements arrive before a batched final snapshot", () => {
    const server = new AuthoritativeServer({
      order: ["a", null, null],
      options: { capacity: 3 },
    });
    const first = new VirtualClient({ clientId: "client-1", snapshot: server.snapshot() });
    const second = new VirtualClient({ clientId: "client-2", snapshot: server.snapshot() });

    const firstOperation = first.createOperation({
      entityId: "b",
      action: "add",
      targetIndex: 1,
    });
    const secondOperation = second.createOperation({
      entityId: "c",
      action: "add",
      targetIndex: 2,
    });

    first.enqueue(firstOperation);
    second.enqueue(secondOperation);
    first.receiveResult(server.apply(firstOperation));
    second.receiveResult(server.apply(secondOperation));

    const finalSnapshot = server.snapshot();
    first.receiveSnapshot(finalSnapshot);
    second.receiveSnapshot(finalSnapshot);

    expect(first.signature()).toBe(server.signature());
    expect(second.signature()).toBe(server.signature());
    expect(first.activePendingCount()).toBe(0);
    expect(second.activePendingCount()).toBe(0);
  });
});
