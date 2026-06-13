# realtime-board-convergence

Pure TypeScript primitives for optimistic realtime drag/drop boards that
converge to server-authoritative snapshots.

## Why This Exists

Collaborative board interfaces often need immediate local drag feedback while
the final board state remains authoritative on a server. This package focuses
on the coordination layer between those two requirements:

- deterministic drag/drop intent resolution
- optimistic local projection
- pending operation lifecycle tracking
- queueing and coalescing of local operations
- convergence checks against authoritative snapshots
- deterministic multi-client simulations

It does not provide rendering, networking, authentication, storage, or a hosted
demo. Bring your own UI and server snapshot source.

## Status

Pre-1.0. The core modules are implemented and covered by unit tests plus
deterministic 4-client and 8-client simulations. APIs may change while the
public package boundary is finalized.

## Use From Source

```bash
git clone https://github.com/riffluv/realtime-board-convergence.git
cd realtime-board-convergence
pnpm install
pnpm test
```

The package is framework-agnostic and builds ESM plus TypeScript declarations.
It is not published to npm yet.

## Core Modules

- `applyBoardOperation` applies add/move/remove operations to sparse board
  orders.
- `resolveDrop` converts UI drop targets into deterministic operation intent.
- `pendingOperationRegistryReducer` tracks queued, sent, confirmed, rejected,
  superseded, and resync-required operations.
- `projectOptimisticOrder` replays active pending operations over an
  authoritative snapshot for immediate local feedback.
- `checkOperationConvergence` decides whether an acknowledged operation is
  actually represented by a trusted snapshot.
- `createBoardOperationScheduler` serializes local operations and coalesces
  repeated moves for the same entity.
- `runSimulation` exercises the model with deterministic virtual clients and
  an in-memory authoritative server.

## Example

```ts
import {
  applyBoardOperation,
  createBoardOperationScheduler,
  runSimulation,
} from "@riffluv/realtime-board-convergence";

const result = applyBoardOperation(["card-a", null], {
  operationId: "op-1",
  entityId: "card-b",
  action: "add",
  targetIndex: 1,
});

console.log(result.order); // ["card-a", "card-b"]

const scheduler = createBoardOperationScheduler({
  execute: async (operation) => ({
    status: "applied",
    applied: true,
    operationId: operation.operationId,
    order: result.order,
    revision: 1,
  }),
});

await scheduler.enqueue({
  operationId: "op-2",
  entityId: "card-a",
  action: "move",
  targetIndex: 1,
});

const report = runSimulation({
  seed: 20260613,
  clientCount: 8,
  entityCount: 12,
  operationCount: 300,
  capacity: 12,
  contention: true,
});

console.log(report.divergence, report.stuckPending); // 0 0
```

## Validation

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm test:sim
pnpm build
```

The simulation tests intentionally include stale snapshot delivery and
same-target contention so consumers can inspect convergence behavior without a
hosted backend.

## Non-Goals

- No browser framework dependency
- No database or backend integration
- No hosted demo
- No game rules or application-specific UX
- No CRDT replacement

For details, see [docs/non-goals-and-ip-boundary.md](docs/non-goals-and-ip-boundary.md).

## Docs

- [Architecture](docs/architecture.md)
- [Simulation report](docs/simulation-report.md)
- [Roadmap](docs/roadmap.md)
- [Non-goals and public boundary](docs/non-goals-and-ip-boundary.md)

## License

MIT
