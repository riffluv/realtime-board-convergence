import { runSimulation } from "../src/index";

describe("4-client simulation", () => {
  test("converges after independent drags", () => {
    const report = runSimulation({
      seed: 42,
      clientCount: 4,
      entityCount: 8,
      operationCount: 120,
      capacity: 8,
    });

    expect(report).toMatchObject({
      divergence: 0,
      stuckPending: 0,
    });
  });
});
