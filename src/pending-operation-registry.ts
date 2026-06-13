import { buildBoardOrderSignature, normalizeBoardOrder } from "./board-operation";
import type { BoardOperationAction, BoardOrder, EntityId, OperationId } from "./model";

export type AuthoritativeResultStatus =
  | "applied"
  | "noop"
  | "duplicate"
  | "stale"
  | "conflict"
  | "rejected"
  | "resync-required";

export type AuthoritativeOperationResult = {
  status: AuthoritativeResultStatus;
  applied: boolean;
  reason?: string;
  revision?: number;
  order?: readonly (string | null | undefined)[];
  clientId?: string | null;
  clientSeq?: number | null;
  operationId?: OperationId | null;
  clientCoalesced?: boolean;
};

export type PendingOperationState =
  | "queued"
  | "optimistic-applied"
  | "sent"
  | "confirmed"
  | "rolled-back"
  | "superseded"
  | "rejected"
  | "expired"
  | "resync-required";

export type PendingOperation = {
  operationId: OperationId;
  dragSessionId: string | null;
  entityId: EntityId;
  action: BoardOperationAction;
  targetIndex: number | null;
  localPreviewOrder: BoardOrder;
  createdAt: number;
  updatedAt: number;
  sentAt: number | null;
  ackAt: number | null;
  snapshotReconciledAt: number | null;
  state: PendingOperationState;
  reason?: string;
  authoritativeStatus?: AuthoritativeResultStatus;
  authoritativeReason?: string;
  authoritativeRevision?: number;
  authoritativeOrderSignature?: string;
  authoritativeOrder?: BoardOrder;
  clientId?: string | null;
  clientSeq?: number | null;
  supersededBy?: OperationId | null;
};

export type PendingOperationDraft = {
  operationId: OperationId;
  dragSessionId?: string | null;
  entityId: EntityId;
  action: BoardOperationAction;
  targetIndex?: number | null;
  localPreviewOrder?: readonly (string | null | undefined)[];
};

export type PendingOperationRegistryState = {
  order: OperationId[];
  operations: Record<OperationId, PendingOperation>;
};

export type PendingOperationRegistryEvent =
  | { type: "reset"; at: number; reason: string }
  | { type: "enqueue"; at: number; operation: PendingOperationDraft }
  | {
      type: "optimistic-applied";
      at: number;
      operationId: OperationId;
      localPreviewOrder: readonly (string | null | undefined)[];
    }
  | { type: "sent"; at: number; operationId: OperationId }
  | {
      type: "authoritative-result";
      at: number;
      operationId: OperationId;
      result: AuthoritativeOperationResult;
    }
  | { type: "snapshot-matched"; at: number; operationId: OperationId }
  | { type: "rollback"; at: number; operationId: OperationId; reason: string }
  | {
      type: "supersede";
      at: number;
      operationId: OperationId;
      supersededBy?: OperationId | null;
      reason?: string;
    }
  | { type: "expire"; at: number; operationId: OperationId; reason?: string }
  | { type: "resync-required"; at: number; operationId?: OperationId; reason: string }
  | { type: "prune-terminal"; at: number; maxTerminalOperations: number; maxTerminalAgeMs: number };

export const EMPTY_PENDING_OPERATION_REGISTRY: PendingOperationRegistryState = {
  order: [],
  operations: {},
};

const TERMINAL_STATES = new Set<PendingOperationState>([
  "confirmed",
  "rolled-back",
  "superseded",
  "rejected",
  "expired",
  "resync-required",
]);

export function isPendingOperationTerminal(state: PendingOperationState): boolean {
  return TERMINAL_STATES.has(state);
}

export function createPendingOperation(
  draft: PendingOperationDraft,
  at: number
): PendingOperation {
  return {
    operationId: draft.operationId,
    dragSessionId: draft.dragSessionId ?? null,
    entityId: draft.entityId,
    action: draft.action,
    targetIndex: typeof draft.targetIndex === "number" ? Math.floor(draft.targetIndex) : null,
    localPreviewOrder: draft.localPreviewOrder ? normalizeBoardOrder(draft.localPreviewOrder) : [],
    createdAt: at,
    updatedAt: at,
    sentAt: null,
    ackAt: null,
    snapshotReconciledAt: null,
    state: "queued",
  };
}

function stateFromAuthoritativeResult(result: AuthoritativeOperationResult): PendingOperationState {
  if (result.status === "duplicate" || result.status === "stale") return "superseded";
  if (result.status === "applied") return "sent";
  if (result.status === "conflict" || result.status === "rejected") return "rejected";
  if (result.status === "resync-required") return "resync-required";
  if (result.status === "noop") return "sent";
  return "rejected";
}

function updateOperation(
  state: PendingOperationRegistryState,
  operationId: OperationId,
  updater: (operation: PendingOperation) => PendingOperation
): PendingOperationRegistryState {
  const current = state.operations[operationId];
  if (!current || isPendingOperationTerminal(current.state)) return state;
  const next = updater(current);
  if (next === current) return state;
  return {
    order: state.order,
    operations: {
      ...state.operations,
      [operationId]: next,
    },
  };
}

function applyGlobalResync(
  state: PendingOperationRegistryState,
  event: Extract<PendingOperationRegistryEvent, { type: "resync-required" }>
): PendingOperationRegistryState {
  let changed = false;
  const operations: Record<OperationId, PendingOperation> = {};
  for (const id of state.order) {
    const operation = state.operations[id];
    if (!operation) continue;
    if (isPendingOperationTerminal(operation.state)) {
      operations[id] = operation;
      continue;
    }
    changed = true;
    operations[id] = {
      ...operation,
      state: "resync-required",
      reason: event.reason,
      updatedAt: event.at,
    };
  }
  return changed ? { order: state.order, operations } : state;
}

function pruneTerminalOperations(
  state: PendingOperationRegistryState,
  event: Extract<PendingOperationRegistryEvent, { type: "prune-terminal" }>
): PendingOperationRegistryState {
  const maxTerminalOperations = Math.max(0, Math.floor(event.maxTerminalOperations));
  const maxTerminalAgeMs = Math.max(0, Math.floor(event.maxTerminalAgeMs));
  const terminalIds = state.order.filter((id) => {
    const operation = state.operations[id];
    return operation ? isPendingOperationTerminal(operation.state) : false;
  });
  const keepRecent = new Set(
    maxTerminalOperations > 0 ? terminalIds.slice(-maxTerminalOperations) : []
  );

  let changed = false;
  const order: OperationId[] = [];
  const operations: Record<OperationId, PendingOperation> = {};
  for (const id of state.order) {
    const operation = state.operations[id];
    if (!operation) {
      changed = true;
      continue;
    }
    if (!isPendingOperationTerminal(operation.state)) {
      order.push(id);
      operations[id] = operation;
      continue;
    }
    const ageMs = Math.max(0, event.at - operation.updatedAt);
    if (keepRecent.has(id) || ageMs <= maxTerminalAgeMs) {
      order.push(id);
      operations[id] = operation;
      continue;
    }
    changed = true;
  }
  return changed ? { order, operations } : state;
}

export function pendingOperationRegistryReducer(
  state: PendingOperationRegistryState,
  event: PendingOperationRegistryEvent
): PendingOperationRegistryState {
  if (event.type === "reset") {
    return state.order.length > 0 ? EMPTY_PENDING_OPERATION_REGISTRY : state;
  }
  if (event.type === "enqueue") {
    if (state.operations[event.operation.operationId]) return state;
    return {
      order: [...state.order, event.operation.operationId],
      operations: {
        ...state.operations,
        [event.operation.operationId]: createPendingOperation(event.operation, event.at),
      },
    };
  }
  if (event.type === "resync-required" && !event.operationId) {
    return applyGlobalResync(state, event);
  }
  if (event.type === "prune-terminal") {
    return pruneTerminalOperations(state, event);
  }

  const operationId =
    "operationId" in event && typeof event.operationId === "string" ? event.operationId : "";

  switch (event.type) {
    case "optimistic-applied":
      return updateOperation(state, operationId, (operation) => ({
        ...operation,
        state: "optimistic-applied",
        localPreviewOrder: normalizeBoardOrder(event.localPreviewOrder),
        updatedAt: event.at,
      }));
    case "sent":
      return updateOperation(state, operationId, (operation) => ({
        ...operation,
        state: "sent",
        sentAt: event.at,
        updatedAt: event.at,
      }));
    case "authoritative-result":
      return updateOperation(state, operationId, (operation) => {
        const authoritativeOrder = event.result.order ? normalizeBoardOrder(event.result.order) : undefined;
        return {
          ...operation,
          state: stateFromAuthoritativeResult(event.result),
          ackAt: event.at,
          updatedAt: event.at,
          authoritativeStatus: event.result.status,
          ...(event.result.reason ? { authoritativeReason: event.result.reason } : {}),
          ...(typeof event.result.revision === "number"
            ? { authoritativeRevision: Math.floor(event.result.revision) }
            : {}),
          ...(authoritativeOrder ? { authoritativeOrder } : {}),
          ...(authoritativeOrder
            ? { authoritativeOrderSignature: buildBoardOrderSignature(authoritativeOrder) }
            : {}),
          clientId: event.result.clientId ?? null,
          clientSeq:
            typeof event.result.clientSeq === "number" && Number.isFinite(event.result.clientSeq)
              ? Math.floor(event.result.clientSeq)
              : null,
          reason: event.result.reason ?? event.result.status,
        };
      });
    case "snapshot-matched":
      return updateOperation(state, operationId, (operation) => ({
        ...operation,
        state: "confirmed",
        snapshotReconciledAt: event.at,
        updatedAt: event.at,
      }));
    case "rollback":
      return updateOperation(state, operationId, (operation) => ({
        ...operation,
        state: "rolled-back",
        reason: event.reason,
        updatedAt: event.at,
      }));
    case "supersede":
      return updateOperation(state, operationId, (operation) => ({
        ...operation,
        state: "superseded",
        reason: event.reason ?? "superseded",
        supersededBy: event.supersededBy ?? null,
        updatedAt: event.at,
      }));
    case "expire":
      return updateOperation(state, operationId, (operation) => ({
        ...operation,
        state: "expired",
        reason: event.reason ?? "expired",
        updatedAt: event.at,
      }));
    case "resync-required":
      return updateOperation(state, operationId, (operation) => ({
        ...operation,
        state: "resync-required",
        reason: event.reason,
        updatedAt: event.at,
      }));
    default:
      return state;
  }
}

export function selectActivePendingOperations(
  state: PendingOperationRegistryState
): PendingOperation[] {
  return state.order
    .map((id) => state.operations[id])
    .filter((operation): operation is PendingOperation =>
      Boolean(operation) && !isPendingOperationTerminal(operation.state)
    );
}

export function selectSnapshotConvergenceCandidateOperations(
  state: PendingOperationRegistryState
): PendingOperation[] {
  return selectActivePendingOperations(state).filter(
    (operation) => operation.state === "sent" || operation.ackAt !== null
  );
}
