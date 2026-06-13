import { resolveDrop, resolveDropDecision } from "../src/index";

describe("drop resolver", () => {
  const base = {
    entityId: "a",
    targetId: null as string | null,
    boardOrder: [] as (string | null)[],
    pendingOrder: [] as (string | null)[],
    slotCount: 4,
    targetHasRect: true,
    homeTargetId: "home",
  };

  test("returns add intent for an open slot", () => {
    expect(
      resolveDrop({
        ...base,
        targetId: "slot-2",
      })
    ).toMatchObject({
      operation: "add",
      targetIndex: 2,
      animationTargetId: "slot-2",
      decision: { kind: "slot", operation: "add", slotIndex: 2 },
    });
  });

  test("ignores malformed slot targets", () => {
    expect(
      resolveDropDecision({
        ...base,
        targetId: "slot-1abc",
      })
    ).toEqual({ kind: "noop", reason: "invalid-slot" });
  });

  test("does not resolve slot targets when there are no addressable slots", () => {
    expect(
      resolveDropDecision({
        ...base,
        targetId: "slot-0",
        slotCount: 0,
      })
    ).toEqual({ kind: "noop", reason: "invalid-slot" });
  });

  test("returns move intent for an entity already on the board", () => {
    expect(
      resolveDrop({
        ...base,
        targetId: "slot-3",
        boardOrder: ["a", null, "b"],
      })
    ).toMatchObject({
      operation: "move",
      targetIndex: 3,
      decision: { kind: "slot", operation: "move", slotIndex: 3 },
    });
  });

  test("maps entity target to its slot animation target", () => {
    expect(
      resolveDrop({
        ...base,
        entityId: "a",
        targetId: "c",
        boardOrder: ["a", null, "c"],
      })
    ).toMatchObject({
      actualTargetId: "c",
      animationTargetId: "slot-2",
      operation: "move",
      targetIndex: 2,
      decision: { kind: "entity", operation: "move", targetIndex: 2 },
    });
  });

  test("allows fallback return below the board", () => {
    expect(
      resolveDropDecision({
        ...base,
        boardOrder: ["a"],
        boardBounds: { left: 100, right: 300, bottom: 400 },
        pointer: { x: 160, y: 408 },
      })
    ).toEqual({ kind: "home", via: "fallback", allowed: true });
  });

  test("does not resolve fallback return outside board width", () => {
    expect(
      resolveDropDecision({
        ...base,
        boardOrder: ["a"],
        boardBounds: { left: 100, right: 300, bottom: 400 },
        pointer: { x: 40, y: 408 },
      })
    ).toEqual({ kind: "reject", reason: "no-target" });
  });

  test("rejects return home when the entity is not placed", () => {
    expect(
      resolveDropDecision({
        ...base,
        targetId: "home",
      })
    ).toEqual({ kind: "reject", reason: "return-not-allowed" });
  });
});
