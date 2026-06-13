import { buildBoardOrderSignature, normalizeBoardOrder } from "../src/index";

describe("board order helpers", () => {
  test("normalizes empty slots and trims trailing gaps", () => {
    expect(normalizeBoardOrder(["a", undefined, "b", null])).toEqual(["a", null, "b"]);
  });

  test("builds stable signatures", () => {
    expect(buildBoardOrderSignature(["a", null, "b", null])).toBe("a|_|b");
  });
});
