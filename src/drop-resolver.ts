import type { BoardOperationAction, EntityId } from "./model";

export type BoardBounds = {
  left: number;
  right: number;
  bottom: number;
};

export type BoardPoint = {
  x: number;
  y: number;
};

export type DropDecision =
  | { kind: "noop"; reason: "same-target" | "same-slot" | "unhandled" | "invalid-slot" }
  | { kind: "reject"; reason: "no-target" | "target-not-found" | "return-not-allowed" }
  | { kind: "home"; via: "target" | "fallback"; allowed: true }
  | { kind: "slot"; operation: "add" | "move"; slotIndex: number; requestedIndex: number; clamped: boolean }
  | { kind: "entity"; operation: "move"; targetIndex: number };

export type DropResolution = {
  decision: DropDecision;
  rawTargetId: string | null;
  visualTargetId: string | null;
  actualTargetId: string | null;
  animationTargetId: string | null;
  operation: BoardOperationAction | null;
  targetIndex: number | null;
};

export type DropResolverInput = {
  entityId: EntityId;
  targetId: string | null;
  rawTargetId?: string | null;
  visualTargetId?: string | null;
  isSameTarget?: boolean;
  boardOrder: readonly (string | null | undefined)[];
  pendingOrder?: readonly (string | null | undefined)[];
  slotCount: number;
  targetHasRect?: boolean;
  boardBounds?: BoardBounds | null;
  pointer?: BoardPoint | null;
  homeTargetId?: string;
  allowReturnHome?: boolean;
  slotIdPrefix?: string;
};

const DEFAULT_HOME_TARGET_ID = "home";
const DEFAULT_SLOT_ID_PREFIX = "slot-";

function parseSlotIndex(targetId: string, prefix: string): number | null {
  if (!targetId.startsWith(prefix)) return null;
  const raw = Number.parseInt(targetId.slice(prefix.length), 10);
  return Number.isFinite(raw) && raw >= 0 ? raw : null;
}

function normalizeSlotCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function isFallbackHomeDrop(params: {
  alreadyPlaced: boolean;
  isHomeTarget: boolean;
  isSlotTarget: boolean;
  boardBounds: BoardBounds | null;
  pointer: BoardPoint | null;
}): boolean {
  if (params.isHomeTarget || params.isSlotTarget || !params.alreadyPlaced) return false;
  if (!params.boardBounds || !params.pointer) return false;
  return (
    params.pointer.y >= params.boardBounds.bottom + 6 &&
    params.pointer.x >= params.boardBounds.left - 16 &&
    params.pointer.x <= params.boardBounds.right + 16
  );
}

function targetIdForDecision(params: {
  decision: DropDecision;
  targetId: string | null;
  homeTargetId: string;
  slotIdPrefix: string;
}): string | null {
  const { decision, targetId, homeTargetId, slotIdPrefix } = params;
  if (decision.kind === "slot") return `${slotIdPrefix}${decision.slotIndex}`;
  if (decision.kind === "home") return decision.via === "target" ? homeTargetId : "fallback-home";
  if (decision.kind === "entity") return targetId;
  if (decision.kind === "reject" && decision.reason === "target-not-found") return targetId;
  if (decision.kind === "noop") return targetId;
  return null;
}

export function resolveDropDecision(input: DropResolverInput): DropDecision {
  const boardOrder = input.boardOrder;
  const pendingOrder = input.pendingOrder ?? [];
  const homeTargetId = input.homeTargetId ?? DEFAULT_HOME_TARGET_ID;
  const slotIdPrefix = input.slotIdPrefix ?? DEFAULT_SLOT_ID_PREFIX;
  const targetId = input.targetId;

  const alreadyAuthoritative = boardOrder.includes(input.entityId);
  const alreadyPending = !alreadyAuthoritative && pendingOrder.includes(input.entityId);
  const alreadyPlaced = alreadyAuthoritative || alreadyPending;
  const requestedSlotIndex = targetId ? parseSlotIndex(targetId, slotIdPrefix) : null;
  const isSlotTarget = requestedSlotIndex !== null;
  const isHomeTarget = targetId === homeTargetId;
  const fallbackHome = isFallbackHomeDrop({
    alreadyPlaced,
    isHomeTarget,
    isSlotTarget,
    boardBounds: input.boardBounds ?? null,
    pointer: input.pointer ?? null,
  });

  if (isHomeTarget || fallbackHome) {
    if (!alreadyPlaced || input.allowReturnHome === false) {
      return { kind: "reject", reason: "return-not-allowed" };
    }
    return { kind: "home", via: isHomeTarget ? "target" : "fallback", allowed: true };
  }

  if (targetId === null) return { kind: "reject", reason: "no-target" };
  if (input.isSameTarget === true) return { kind: "noop", reason: "same-target" };

  if (targetId.startsWith(slotIdPrefix)) {
    if (requestedSlotIndex === null) return { kind: "noop", reason: "invalid-slot" };
    if (input.targetHasRect === false) return { kind: "noop", reason: "unhandled" };
    const slotCount = normalizeSlotCount(input.slotCount);
    const maxSlot = Math.max(0, slotCount - 1);
    const slotIndex = Math.min(requestedSlotIndex, maxSlot);
    const existingIndex = boardOrder.indexOf(input.entityId);
    const pendingIndex = pendingOrder.indexOf(input.entityId);
    if (existingIndex === slotIndex || (existingIndex < 0 && pendingIndex === slotIndex)) {
      return { kind: "noop", reason: "same-slot" };
    }
    return {
      kind: "slot",
      operation: alreadyAuthoritative ? "move" : "add",
      slotIndex,
      requestedIndex: requestedSlotIndex,
      clamped: slotIndex !== requestedSlotIndex,
    };
  }

  if (!alreadyAuthoritative) return { kind: "noop", reason: "unhandled" };

  const targetIndex = boardOrder.findIndex((value) => value === targetId);
  if (targetIndex < 0) return { kind: "reject", reason: "target-not-found" };
  return { kind: "entity", operation: "move", targetIndex };
}

export function resolveDrop(input: DropResolverInput): DropResolution {
  const decision = resolveDropDecision(input);
  const homeTargetId = input.homeTargetId ?? DEFAULT_HOME_TARGET_ID;
  const slotIdPrefix = input.slotIdPrefix ?? DEFAULT_SLOT_ID_PREFIX;
  const actualTargetId = targetIdForDecision({
    decision,
    targetId: input.targetId,
    homeTargetId,
    slotIdPrefix,
  });

  if (decision.kind === "slot") {
    return {
      decision,
      rawTargetId: input.rawTargetId ?? input.targetId,
      visualTargetId: input.visualTargetId ?? null,
      actualTargetId,
      animationTargetId: actualTargetId,
      operation: decision.operation,
      targetIndex: decision.slotIndex,
    };
  }

  if (decision.kind === "entity") {
    return {
      decision,
      rawTargetId: input.rawTargetId ?? input.targetId,
      visualTargetId: input.visualTargetId ?? null,
      actualTargetId,
      animationTargetId: `${slotIdPrefix}${decision.targetIndex}`,
      operation: "move",
      targetIndex: decision.targetIndex,
    };
  }

  if (decision.kind === "home" && decision.allowed) {
    return {
      decision,
      rawTargetId: input.rawTargetId ?? input.targetId,
      visualTargetId: input.visualTargetId ?? null,
      actualTargetId,
      animationTargetId: actualTargetId,
      operation: "remove",
      targetIndex: null,
    };
  }

  return {
    decision,
    rawTargetId: input.rawTargetId ?? input.targetId,
    visualTargetId: input.visualTargetId ?? null,
    actualTargetId,
    animationTargetId: null,
    operation: null,
    targetIndex: null,
  };
}
