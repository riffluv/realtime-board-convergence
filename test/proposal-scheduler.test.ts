import { createBoardOperationScheduler } from "../src/index";

describe("board operation scheduler", () => {
  test("executes operations in queue order", async () => {
    const seen: string[] = [];
    const scheduler = createBoardOperationScheduler({
      autoStart: false,
      execute: (operation) => {
        seen.push(operation.operationId);
        return {
          status: "applied",
          applied: true,
          operationId: operation.operationId,
        };
      },
    });

    const first = scheduler.enqueue({ operationId: "op-1", entityId: "a", action: "add" });
    const second = scheduler.enqueue({ operationId: "op-2", entityId: "b", action: "add" });
    await scheduler.flushAll();

    await expect(first).resolves.toMatchObject({ status: "applied", operationId: "op-1" });
    await expect(second).resolves.toMatchObject({ status: "applied", operationId: "op-2" });
    expect(seen).toEqual(["op-1", "op-2"]);
  });

  test("coalesces queued moves for the same entity", async () => {
    const seen: string[] = [];
    const scheduler = createBoardOperationScheduler({
      autoStart: false,
      execute: (operation) => {
        seen.push(operation.operationId);
        return {
          status: "applied",
          applied: true,
          operationId: operation.operationId,
        };
      },
    });

    const oldMove = scheduler.enqueue({
      operationId: "op-1",
      entityId: "a",
      action: "move",
      targetIndex: 1,
    });
    const newMove = scheduler.enqueue({
      operationId: "op-2",
      entityId: "a",
      action: "move",
      targetIndex: 2,
    });
    await scheduler.flushAll();

    await expect(oldMove).resolves.toMatchObject({
      status: "stale",
      reason: "coalesced-by-newer-move",
      clientCoalesced: true,
    });
    await expect(newMove).resolves.toMatchObject({ status: "applied", operationId: "op-2" });
    expect(seen).toEqual(["op-2"]);
  });

  test("does not coalesce moves for different entities", async () => {
    const seen: string[] = [];
    const scheduler = createBoardOperationScheduler({
      autoStart: false,
      execute: (operation) => {
        seen.push(operation.operationId);
        return {
          status: "applied",
          applied: true,
          operationId: operation.operationId,
        };
      },
    });

    scheduler.enqueue({ operationId: "op-1", entityId: "a", action: "move", targetIndex: 1 });
    scheduler.enqueue({ operationId: "op-2", entityId: "b", action: "move", targetIndex: 2 });
    await scheduler.flushAll();

    expect(seen).toEqual(["op-1", "op-2"]);
  });
});
