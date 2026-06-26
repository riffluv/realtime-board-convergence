# Simulations

This project includes deterministic simulations so convergence behavior can be
reviewed without a hosted service.

## Current Scenarios

| Scenario | Clients | Entities | Operations | Stressor | Expected result |
| --- | ---: | ---: | ---: | --- | --- |
| `simulation-4-clients` | 4 | 8 | 120 | mixed independent operations | `divergence = 0`, `stuckPending = 0` |
| `simulation-8-clients` | 8 | 12 | 300 | same-target contention | `divergence = 0`, `stuckPending = 0` |
| `simulation-adversarial` | focused | focused | focused | ack ordering, rejection, duplicate/stale results, batched snapshots | terminal registry states and no stuck pending |

Each run uses deterministic inputs. The random multi-client simulations can
deliver stale snapshots before current snapshots to verify that virtual clients
ignore older authoritative revisions and converge once the current snapshot
arrives.

## Run

```bash
pnpm test:sim
```

The simulations intentionally avoid network and storage dependencies. They are a
small, reproducible model for the optimistic-operation lifecycle:

1. A virtual client creates and projects a local operation.
2. The in-memory authoritative server applies, rejects, or supersedes the
   operation.
3. Clients receive acknowledgements and snapshots in deterministic order.
4. Pending operations are cleared only after trusted snapshot evidence confirms
   the operation result, or after a terminal authoritative result rejects or
   supersedes it.

## Adversarial Coverage

The focused adversarial scenarios protect these boundaries:

- a trusted snapshot before acknowledgement does not retire pending work;
- rejected operations settle without waiting for matching board state;
- duplicate and stale authoritative results become terminal superseded states;
- batched final snapshots can confirm acknowledged operations without
  delivering every intermediate snapshot.

## Extending

Good future scenarios include:

- delayed acknowledgements with interleaved local operations;
- randomized rejected operations under high contention;
- capacity shrink/expansion;
- long-running seeds that record minimal failing cases.
