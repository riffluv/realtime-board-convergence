# API Reference

This package exposes deterministic primitives for optimistic board operation
convergence. It does not render UI, send network requests, persist data, or
perform authorization.

## Board Model

### `BoardOrder`

A sparse ordered list of entity IDs and empty slots.

```ts
type BoardOrder = readonly (EntityId | null)[];
```

### `BoardSnapshot`

An authoritative board order at a monotonically increasing revision.

```ts
type BoardSnapshot = {
  revision: number;
  order: BoardOrder;
};
```

## Board Operations

### `applyBoardOperation(order, operation, options?)`

Applies an add, move, or remove operation to a normalized board order.

Use this when you need deterministic local projection or in-memory server
simulation.

```ts
const result = applyBoardOperation(["a", null], {
  operationId: "op-1",
  entityId: "b",
  action: "add",
  targetIndex: 1,
});
```

The result includes:

- `status`: `applied`, `noop`, or `rejected`
- `reason`: machine-readable reason when the operation is not applied
- `order`: the resulting normalized board order
- `finalIndex`: where the entity ended up, or `-1`
- `changedSlots`: number of changed sparse slots

### `normalizeBoardOrder(order, options?)`

Normalizes unknown, undefined, empty, or trailing sparse values into the package
board representation.

### `buildBoardOrderSignature(order, options?)`

Builds a deterministic string signature for snapshot comparison and diagnostics.

## Drop Resolution

### `resolveDrop(input)`

Converts a UI target into deterministic operation intent. Consumers can track
the raw visual target separately from the actual operation target.

```ts
const resolution = resolveDrop({
  entityId: "b",
  targetId: "slot-1",
  boardOrder: ["a", null],
  slotCount: 2,
  targetHasRect: true,
});
```

The result includes:

- `decision`: structured decision details
- `actualTargetId`: target used for the operation
- `animationTargetId`: target a UI may animate toward
- `operation`: `add`, `move`, `remove`, or `null`
- `targetIndex`: target slot index when applicable

### `resolveDropDecision(input)`

Returns only the structured decision without the derived target fields.

## Pending Operation Registry

### `pendingOperationRegistryReducer(state, event)`

Tracks the lifecycle of local operations:

- queued
- optimistic-applied
- sent
- confirmed
- rolled-back
- superseded
- rejected
- expired
- resync-required

Snapshot convergence candidates require an authoritative acknowledgement. A
plain `sent` operation is not considered converged until an authoritative result
has been observed.

### `selectActivePendingOperations(state)`

Returns all non-terminal pending operations.

### `selectSnapshotConvergenceCandidateOperations(state)`

Returns active operations that have received an authoritative acknowledgement
and can be tested against a trusted snapshot.

## Optimistic Projection

### `projectOptimisticOrder({ baseOrder, registry, options? })`

Replays projectable pending operations over the latest authoritative snapshot.
This is the main primitive for immediate local feedback.

```ts
const projection = projectOptimisticOrder({
  baseOrder: snapshot.order,
  registry,
});
```

The result includes the projected order, applied operation IDs, skipped
operation IDs, and warnings.

## Convergence Check

### `checkOperationConvergence({ operation, snapshot })`

Checks whether an acknowledged operation is represented by a trusted snapshot.

The operation is blocked when:

- it has not been acknowledged
- the snapshot is explicitly untrusted
- the snapshot revision is behind the authoritative result
- the snapshot signature differs from the authoritative result
- the target entity is missing, still present after remove, or in the wrong slot

## Operation Scheduler

### `createBoardOperationScheduler(options)`

Serializes local operation execution through a caller-provided executor.
Repeated queued moves for the same entity are coalesced.

```ts
const scheduler = createBoardOperationScheduler({
  execute: async (operation) => server.apply(operation),
});
```

The scheduler does not perform network I/O itself.

## Simulation

### `runSimulation(scenario)`

Runs deterministic virtual clients against an in-memory authoritative server.

```ts
const report = runSimulation({
  seed: 20260613,
  clientCount: 8,
  entityCount: 12,
  operationCount: 300,
  capacity: 12,
  contention: true,
});
```

Expected healthy reports have `divergence = 0` and `stuckPending = 0`.

### `AuthoritativeServer`

An in-memory server model used by examples and simulations.

### `VirtualClient`

An in-memory client model that tracks snapshots, optimistic projection, pending
operations, acknowledgements, and snapshot reconciliation.
