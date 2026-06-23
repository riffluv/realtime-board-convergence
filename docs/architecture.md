# Architecture

`realtime-board-convergence` separates local interaction from authoritative
state convergence.

```text
pointer / keyboard input
        |
        v
drag intent
        |
        v
drop resolver
        |
        v
pending operation registry --> optimistic projection
        |
        v
operation scheduler
        |
        v
acknowledgement + authoritative revision
        |
        v
trusted authoritative snapshot
        |
        v
convergence checker
```

The package does not decide how snapshots are delivered. A consuming
application can use HTTP, WebSocket, WebRTC, a managed document store, a custom
backend, or an in-memory simulation.

## Design Rules

- The UI may project local feedback immediately, but convergence is decided
  only from acknowledged operations plus trusted authoritative snapshots.
- Acknowledgement is not terminal evidence. It records the server result and
  authoritative revision, then the operation remains pending until trusted
  snapshot evidence covers it.
- A trusted snapshot revision is treated as a server-history watermark in the
  default convergence mode. This lets consumers skip an intermediate exact
  snapshot without leaving a valid operation pending forever.
- Drop resolution is deterministic. A visual target, actual target, and
  animation target can be tracked separately so consumers can avoid "looks
  dropped here, actually committed there" drift.
- Pending operations are explicit state, not implicit timers. Terminal states
  are retained long enough for debugging and can be pruned later.
- Transport and persistence are outside the package. The scheduler accepts an
  executor function so consumers can adapt it to their backend.
- Simulations are part of the public API surface because convergence bugs are
  easiest to reason about when they are deterministic and repeatable.

## Module Map

| Module | Responsibility |
| --- | --- |
| `model` | Shared operation, snapshot, and identifier types |
| `board-operation` | Sparse board normalization and add/move/remove semantics |
| `drop-resolver` | UI target to operation-intent decisions |
| `pending-operation-registry` | Pending operation lifecycle reducer |
| `optimistic-projection` | Local projection over the latest snapshot |
| `convergence-checker` | Snapshot-based confirmation checks |
| `operation-scheduler` | Serialized execution and move coalescing |
| `simulation/*` | In-memory server/client convergence scenarios |

## Consumer Boundary

Consumers are expected to provide:

- pointer, keyboard, or other input handling
- rendering and animation
- server validation
- snapshot delivery
- authentication and authorization
- telemetry and product-specific error handling

The package provides deterministic primitives that can be tested without those
systems.
