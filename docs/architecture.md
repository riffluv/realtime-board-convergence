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
authoritative snapshot
        |
        v
convergence checker
```

The package does not decide how snapshots are delivered. A consuming
application can use HTTP, WebSocket, WebRTC, a managed document store, a custom
backend, or an in-memory simulation.
