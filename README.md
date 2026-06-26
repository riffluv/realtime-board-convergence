# realtime-board-convergence

[![CI](https://github.com/riffluv/realtime-board-convergence/actions/workflows/ci.yml/badge.svg)](https://github.com/riffluv/realtime-board-convergence/actions/workflows/ci.yml)

Headless TypeScript primitives for optimistic board drag/drop that converges to
trusted server snapshots.

`realtime-board-convergence` helps realtime board UIs separate fast local drag
feedback from server-authoritative state. It provides deterministic drop intent
resolution, a pending-operation registry, optimistic projection over the latest
snapshot, serialized operation scheduling, scope/lease authority guards, and
convergence checks that keep operations pending until trusted snapshot evidence
covers them.

> Core invariant: local operations may be projected immediately, but pending
> state is retired only after trusted authoritative evidence covers the
> operation.

```text
UI input
  -> deterministic operation intent
  -> operation authority guard
  -> pending-operation registry
  -> optimistic projection
  -> serialized executor
  -> acknowledgement + authoritative revision
  -> trusted snapshot
  -> confirm, supersede, reject, or resync
```

## What You Get

- **Project locally, confirm from snapshots**: render optimistic board state
  immediately, but retire pending operations only after trusted evidence.
- **Deterministic operation intent**: convert drag/drop targets into add, move,
  remove, noop, or reject decisions.
- **Explicit pending lifecycle**: track queued, optimistic, sent, acknowledged,
  confirmed, rejected, superseded, and resync-required operations.
- **Scope/lease authority guard**: reject stale local work before it can enqueue
  an operation.
- **Framework-agnostic boundary**: no React, DOM, transport, storage, auth,
  backend, or game-rule dependency.
- **Deterministic simulations**: seeded 4-client and 8-client convergence
  scenarios with stale snapshots and contention.

Try the full trusted-snapshot lifecycle:

```bash
pnpm examples:convergence
```

## Use From Source

```bash
git clone https://github.com/riffluv/realtime-board-convergence.git
cd realtime-board-convergence
pnpm install
pnpm test
pnpm test:sim
pnpm examples:basic
pnpm examples:scheduler
pnpm examples:guard
pnpm examples:convergence
```

The package is framework-agnostic and builds ESM plus TypeScript declarations.
Source-first pre-release. No npm package is available yet.

## Core Modules

- `applyBoardOperation` applies add/move/remove operations to sparse board
  orders.
- `resolveDrop` converts UI drop targets into deterministic operation intent.
- `createOperationAuthorityRuntime` guards local operations with a single-use
  scope/lease token.
- `pendingOperationRegistryReducer` tracks queued, sent, confirmed, rejected,
  superseded, and resync-required operations.
- `projectOptimisticOrder` replays active pending operations over an
  authoritative snapshot for immediate local feedback.
- `checkOperationConvergence` decides whether an acknowledged operation is
  actually represented by a trusted snapshot.
- `createBoardOperationScheduler` serializes local operations and coalesces
  repeated moves for the same entity.
- `runSimulation` exercises the model with deterministic virtual clients and an
  in-memory authoritative server.

## Examples

Source-first examples:

- [examples/basic-optimistic-projection.ts](examples/basic-optimistic-projection.ts)
- [examples/serialized-scheduler-fake-server.ts](examples/serialized-scheduler-fake-server.ts)
- [examples/scoped-operation-guard.ts](examples/scoped-operation-guard.ts)
- [examples/trusted-snapshot-convergence.ts](examples/trusted-snapshot-convergence.ts)

Run them locally:

```bash
pnpm examples:basic
pnpm examples:scheduler
pnpm examples:guard
pnpm examples:convergence
```

The convergence example shows the stricter lifecycle:

```text
1 enqueue + project
2 acknowledged, still pending
3 stale trusted snapshot is ignored
4 untrusted current snapshot is ignored
5 later trusted revision covers the operation
6 terminal registry state
```

After npm publication, package consumers will import the same primitives from
the package name:

```ts
import {
  applyBoardOperation,
  createBoardOperationScheduler,
  createOperationAuthorityRuntime,
  runSimulation,
} from "@riffluv/realtime-board-convergence";

const authority = createOperationAuthorityRuntime();
const context = { allowed: true, scopeKey: "board-a|revision-1", leaseId: 1 };
const token = authority.activate(authority.capture(context), context);

if (authority.authorizeAndConsume(token, context)) {
  const result = applyBoardOperation(["card-a", null], {
    operationId: "op-1",
    entityId: "card-b",
    action: "add",
    targetIndex: 1,
  });

  console.log(result.order); // ["card-a", "card-b"]
}

const scheduler = createBoardOperationScheduler({
  execute: async (operation) => ({
    status: "applied",
    applied: true,
    operationId: operation.operationId,
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
pnpm examples:guard
pnpm examples:convergence
pnpm build
pnpm packcheck
```

The simulation tests intentionally include stale snapshot delivery and
same-target contention so consumers can inspect convergence behavior without a
hosted backend.

## Status

Pre-1.0. The core modules are implemented and covered by unit tests plus
deterministic 4-client and 8-client simulations. APIs may change while the
public package boundary is finalized.

## Non-Goals

- No browser framework dependency
- No database or backend integration
- No hosted demo
- No game rules or product-specific UX
- No CRDT replacement

For details, see [docs/scope-and-non-goals.md](docs/scope-and-non-goals.md).

## Docs

- [Architecture](docs/architecture.md)
- [API reference](docs/api.md)
- [Simulations](docs/simulations.md)
- [Roadmap](docs/roadmap.md)
- [Scope and non-goals](docs/scope-and-non-goals.md)

## License

MIT
