import {
  applyBoardOperation,
  buildBoardOrderSignature,
  normalizeBoardOrder,
} from "../src/index";

describe("board operation helpers", () => {
  test("normalizes empty slots and trims trailing gaps", () => {
    expect(normalizeBoardOrder(["a", undefined, "b", null])).toEqual(["a", null, "b"]);
  });

  test("builds stable signatures", () => {
    expect(buildBoardOrderSignature(["a", null, "b", null])).toBe("a|_|b");
  });

  test("adds an entity to the first open slot", () => {
    const result = applyBoardOperation(["a", null], {
      operationId: "op-1",
      action: "add",
      entityId: "b",
    });

    expect(result).toMatchObject({
      status: "applied",
      order: ["a", "b"],
      finalIndex: 1,
    });
  });

  test("rejects add beyond capacity", () => {
    const result = applyBoardOperation(["a", "b"], {
      operationId: "op-1",
      action: "add",
      entityId: "c",
    }, { capacity: 2 });

    expect(result).toMatchObject({
      status: "rejected",
      reason: "capacity-exceeded",
      order: ["a", "b"],
    });
  });

  test("swaps occupied slots when moving", () => {
    const result = applyBoardOperation(["a", "b", "c"], {
      operationId: "op-1",
      action: "move",
      entityId: "a",
      targetIndex: 2,
    });

    expect(result).toMatchObject({
      status: "applied",
      order: ["c", "b", "a"],
      finalIndex: 2,
    });
  });

  test("removes an entity and normalizes trailing gaps", () => {
    const result = applyBoardOperation(["a", "b"], {
      operationId: "op-1",
      action: "remove",
      entityId: "b",
    });

    expect(result).toMatchObject({
      status: "applied",
      order: ["a"],
      finalIndex: -1,
    });
  });
});
