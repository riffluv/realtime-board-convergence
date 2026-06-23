# realtime-board-convergence

[![CI](https://github.com/riffluv/realtime-board-convergence/actions/workflows/ci.yml/badge.svg)](https://github.com/riffluv/realtime-board-convergence/actions/workflows/ci.yml)

Headless TypeScript primitives for optimistic drag/drop on
server-authoritative ordered boards.

> Core invariant: local operations may be projected immediately, but pending
> state is retired only after trusted authoritative evidence covers the
> operation.

```text
UI input
  -> deterministic operation intent
  -> pending-operation registry
  -> optimistic projection
  -> serialized executor
  -> acknowledgement + authoritative revision
  -> trusted snapshot
  -> confirm, supersede, reject, or resync
```

Try the full lifecycle:

```bash
pnpm examples:convergence
```

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
pnpm test:sim
pnpm examples:basic
pnpm examples:scheduler
```

The package is framework-agnostic and builds ESM plus TypeScript declarations.
Source-first pre-release. No npm package is available yet.

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

## Examples

Source-first examples:

- [examples/source-first-basic.ts](examples/source-first-basic.ts)
- [examples/scheduler-with-fake-server.ts](examples/scheduler-with-fake-server.ts)
- [examples/ack-snapshot-convergence.ts](examples/ack-snapshot-convergence.ts)

Run them locally:

```bash
pnpm examples:basic
pnpm examples:scheduler
pnpm examples:convergence
```

After npm publication, package consumers will import the same primitives from
the package name:

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
pnpm examples:basic
pnpm examples:scheduler
pnpm build
pnpm packcheck
```

The simulation tests intentionally include stale snapshot delivery and
same-target contention so consumers can inspect convergence behavior without a
hosted backend.

The convergence example shows the stricter lifecycle:

```text
1 enqueue + project
2 acknowledged, still pending
3 stale trusted snapshot is ignored
4 untrusted current snapshot is ignored
5 later trusted revision covers the operation
6 terminal registry state
```

## Non-Goals

- No browser framework dependency
- No database or backend integration
- No hosted demo
- No game rules or application-specific UX
- No CRDT replacement

For details, see [docs/scope-and-non-goals.md](docs/scope-and-non-goals.md).

## Docs

- [Architecture](docs/architecture.md)
- [API reference](docs/api.md)
- [Simulation report](docs/simulation-report.md)
- [Roadmap](docs/roadmap.md)
- [Scope and non-goals](docs/scope-and-non-goals.md)

## License

MIT
