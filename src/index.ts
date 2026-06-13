export type ClientId = string;
export type EntityId = string;
export type OperationId = string;
export type SnapshotRevision = number;

export type BoardOrder = readonly (EntityId | null)[];

export type DragIntent =
  | { kind: "add"; entityId: EntityId; targetIndex: number }
  | { kind: "move"; entityId: EntityId; targetIndex: number }
  | { kind: "remove"; entityId: EntityId }
  | { kind: "noop"; reason: string }
  | { kind: "reject"; reason: string };

export type ConvergenceResult =
  | { converged: true }
  | { converged: false; reason: "revision-behind" | "order-mismatch" | "pending-operations" };

export function normalizeBoardOrder(order: readonly (string | null | undefined)[]): BoardOrder {
  const normalized = order.map((value) =>
    typeof value === "string" && value.length > 0 ? value : null
  );
  while (normalized.length > 0 && normalized[normalized.length - 1] === null) {
    normalized.pop();
  }
  return normalized;
}

export function buildBoardOrderSignature(order: readonly (string | null | undefined)[]): string {
  return normalizeBoardOrder(order)
    .map((value) => value ?? "_")
    .join("|");
}
