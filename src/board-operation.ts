import type { BoardOperation, BoardOrder, EntityId } from "./model";

export type BoardOperationReason =
  | "already-present"
  | "already-absent"
  | "same-slot"
  | "slot-occupied"
  | "target-not-found"
  | "invalid-target"
  | "capacity-exceeded";

export type BoardOperationResult = {
  status: "applied" | "noop" | "rejected";
  reason?: BoardOperationReason;
  order: BoardOrder;
  finalIndex: number;
  changedSlots: number;
};

export type BoardOperationOptions = {
  capacity?: number;
};

function isEntityId(value: unknown): value is EntityId {
  return typeof value === "string" && value.length > 0;
}

function capacityLimit(options?: BoardOperationOptions): number | null {
  if (!options || typeof options.capacity !== "number") return null;
  if (!Number.isFinite(options.capacity)) return null;
  const capacity = Math.floor(options.capacity);
  return capacity > 0 ? capacity : 0;
}

function normalizedTargetIndex(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const index = Math.floor(value);
  return index >= 0 ? index : null;
}

export function normalizeBoardOrder(
  order: readonly (string | null | undefined)[],
  options?: BoardOperationOptions
): BoardOrder {
  const capacity = capacityLimit(options);
  const source = capacity === null ? order : order.slice(0, capacity);
  const normalized = source.map((value) => (isEntityId(value) ? value : null));
  while (normalized.length > 0 && normalized[normalized.length - 1] === null) {
    normalized.pop();
  }
  return normalized;
}

export function buildBoardOrderSignature(
  order: readonly (string | null | undefined)[],
  options?: BoardOperationOptions
): string {
  return normalizeBoardOrder(order, options)
    .map((value) => value ?? "_")
    .join("|");
}

export function countChangedSlots(
  before: readonly (string | null | undefined)[],
  after: readonly (string | null | undefined)[]
): number {
  const length = Math.max(before.length, after.length);
  let changed = 0;
  for (let index = 0; index < length; index += 1) {
    const beforeValue = index < before.length ? before[index] ?? null : null;
    const afterValue = index < after.length ? after[index] ?? null : null;
    if (beforeValue !== afterValue) changed += 1;
  }
  return changed;
}

function result(input: {
  status: BoardOperationResult["status"];
  reason?: BoardOperationReason;
  before: readonly (string | null | undefined)[];
  order: BoardOrder;
  entityId: EntityId;
}): BoardOperationResult {
  return {
    status: input.status,
    ...(input.reason ? { reason: input.reason } : {}),
    order: input.order,
    finalIndex: input.order.indexOf(input.entityId),
    changedSlots: countChangedSlots(input.before, input.order),
  };
}

function firstOpenIndex(order: readonly (string | null)[], capacity: number | null): number {
  const limit = capacity ?? Math.max(order.length + 1, 1);
  for (let index = 0; index < limit; index += 1) {
    if (!isEntityId(order[index])) return index;
  }
  return limit;
}

function canAddressIndex(index: number, capacity: number | null): boolean {
  return capacity === null || index < capacity;
}

function applyAdd(
  current: BoardOrder,
  operation: BoardOperation,
  capacity: number | null
): BoardOperationResult {
  const targetIndex = normalizedTargetIndex(operation.targetIndex);
  if (current.includes(operation.entityId)) {
    return result({
      status: "noop",
      reason: "already-present",
      before: current,
      order: current,
      entityId: operation.entityId,
    });
  }

  const index = targetIndex ?? firstOpenIndex(current, capacity);
  if (!canAddressIndex(index, capacity)) {
    return result({
      status: "rejected",
      reason: "capacity-exceeded",
      before: current,
      order: current,
      entityId: operation.entityId,
    });
  }
  if (targetIndex !== null && isEntityId(current[index])) {
    return result({
      status: "noop",
      reason: "slot-occupied",
      before: current,
      order: current,
      entityId: operation.entityId,
    });
  }

  const next = current.slice();
  if (index >= next.length) next.length = index + 1;
  for (let cursor = 0; cursor < next.length; cursor += 1) {
    if (next[cursor] === undefined) next[cursor] = null;
  }
  next[index] = operation.entityId;
  const order = normalizeBoardOrder(next, capacity === null ? undefined : { capacity });
  return result({ status: "applied", before: current, order, entityId: operation.entityId });
}

function applyMove(
  current: BoardOrder,
  operation: BoardOperation,
  capacity: number | null
): BoardOperationResult {
  const targetIndex = normalizedTargetIndex(operation.targetIndex);
  if (targetIndex === null) {
    return result({
      status: "rejected",
      reason: "invalid-target",
      before: current,
      order: current,
      entityId: operation.entityId,
    });
  }
  if (!canAddressIndex(targetIndex, capacity)) {
    return result({
      status: "rejected",
      reason: "capacity-exceeded",
      before: current,
      order: current,
      entityId: operation.entityId,
    });
  }

  const fromIndex = current.indexOf(operation.entityId);
  if (fromIndex < 0) {
    return result({
      status: "noop",
      reason: "target-not-found",
      before: current,
      order: current,
      entityId: operation.entityId,
    });
  }
  if (fromIndex === targetIndex) {
    return result({
      status: "noop",
      reason: "same-slot",
      before: current,
      order: current,
      entityId: operation.entityId,
    });
  }

  const next = current.slice();
  const targetEntity = next[targetIndex];
  if (isEntityId(targetEntity)) {
    next[targetIndex] = operation.entityId;
    next[fromIndex] = targetEntity;
  } else {
    next[fromIndex] = null;
    if (targetIndex >= next.length) next.length = targetIndex + 1;
    next[targetIndex] = operation.entityId;
  }

  const order = normalizeBoardOrder(next, capacity === null ? undefined : { capacity });
  return result({ status: "applied", before: current, order, entityId: operation.entityId });
}

function applyRemove(current: BoardOrder, operation: BoardOperation): BoardOperationResult {
  const fromIndex = current.indexOf(operation.entityId);
  if (fromIndex < 0) {
    return result({
      status: "noop",
      reason: "already-absent",
      before: current,
      order: current,
      entityId: operation.entityId,
    });
  }

  const next = current.slice();
  next[fromIndex] = null;
  const order = normalizeBoardOrder(next);
  return result({ status: "applied", before: current, order, entityId: operation.entityId });
}

export function applyBoardOperation(
  order: readonly (string | null | undefined)[],
  operation: BoardOperation,
  options?: BoardOperationOptions
): BoardOperationResult {
  const capacity = capacityLimit(options);
  const current = normalizeBoardOrder(order, capacity === null ? undefined : { capacity });
  if (operation.action === "add") return applyAdd(current, operation, capacity);
  if (operation.action === "move") return applyMove(current, operation, capacity);
  return applyRemove(current, operation);
}
