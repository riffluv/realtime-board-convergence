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

`0.1.0` is planned as a small pre-1.0 core. APIs may change while the
simulation model and public boundaries are finalized.

## Non-Goals

- No browser framework dependency
- No database or backend integration
- No hosted demo
- No game rules or application-specific UX
- No CRDT replacement

For details, see [docs/non-goals-and-ip-boundary.md](docs/non-goals-and-ip-boundary.md).

## Planned Core Concepts

- `BoardOrder`
- `DragIntent`
- `DropResolution`
- `PendingOperation`
- `OptimisticProjection`
- `BoardOperationScheduler`
- `ConvergenceResult`
- `TraceEvent`

## Planned Commands

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm test:sim
pnpm build
```

## License

MIT
