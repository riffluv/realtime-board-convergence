import { runSimulation } from "../src/index";

describe("8-client simulation", () => {
  test("converges under same-target contention", () => {
    const report = runSimulation({
      seed: 20260613,
      clientCount: 8,
      entityCount: 12,
      operationCount: 300,
      capacity: 12,
      contention: true,
    });

    expect(report).toMatchObject({
      divergence: 0,
      stuckPending: 0,
    });
  });
});
