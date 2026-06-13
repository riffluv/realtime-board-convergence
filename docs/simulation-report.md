# Simulation Report

This project includes deterministic simulations so convergence behavior can be
reviewed without a hosted service.

## Current Scenarios

| Scenario | Clients | Entities | Operations | Contention | Expected result |
| --- | ---: | ---: | ---: | --- | --- |
| `simulation-4-clients` | 4 | 8 | 120 | mixed independent operations | `divergence = 0`, `stuckPending = 0` |
| `simulation-8-clients` | 8 | 12 | 300 | same-target contention | `divergence = 0`, `stuckPending = 0` |

Each run uses a seeded pseudo-random generator. The simulation can deliver stale
snapshots before current snapshots to verify that virtual clients ignore older
authoritative revisions and converge once the current snapshot arrives.

## Run

```bash
pnpm test:sim
```

The simulations intentionally avoid network and storage dependencies. They are a
small, reproducible model for the optimistic-operation lifecycle:

1. A virtual client creates and projects a local operation.
2. The in-memory authoritative server applies or rejects the operation.
3. Clients receive acknowledgements and snapshots in deterministic shuffled
   order.
4. Pending operations are cleared only after the trusted snapshot confirms the
   operation result.

## Extending

Good future scenarios include:

- delayed acknowledgements
- rejected operations under high contention
- batched snapshot delivery
- duplicate operation IDs
- randomized capacity changes
- long-running seeds that record minimal failing cases
