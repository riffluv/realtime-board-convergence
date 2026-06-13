import {
  AuthoritativeServer,
  createBoardOperationScheduler,
  runSimulation,
} from "../src/index";

const server = new AuthoritativeServer({
  options: { capacity: 4 },
});

const scheduler = createBoardOperationScheduler({
  flushDelayMs: 0,
  execute: async (operation) => server.apply(operation),
});

const first = await scheduler.enqueue({
  operationId: "client-1-1",
  clientId: "client-1",
  entityId: "card-a",
  action: "add",
  targetIndex: 0,
  baseRevision: server.snapshot().revision,
});

const second = await scheduler.enqueue({
  operationId: "client-2-1",
  clientId: "client-2",
  entityId: "card-b",
  action: "add",
  targetIndex: 1,
  baseRevision: server.snapshot().revision,
});

const report = runSimulation({
  seed: 20260613,
  clientCount: 8,
  entityCount: 12,
  operationCount: 300,
  capacity: 12,
  contention: true,
});

console.log({
  first,
  second,
  finalSnapshot: server.snapshot(),
  simulation: report,
});
