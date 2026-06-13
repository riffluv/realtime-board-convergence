import { buildBoardOrderSignature } from "./board-operation";
import type { BoardSnapshot } from "./model";
import type { PendingOperation } from "./pending-operation-registry";

export type ConvergenceBlockedReason =
  | "operation-not-acked"
  | "untrusted-snapshot"
  | "revision-behind"
  | "signature-mismatch"
  | "target-mismatch"
  | "entity-still-present"
  | "entity-missing";

export type ConvergenceResult =
  | { converged: true }
  | { converged: false; reason: ConvergenceBlockedReason };

export type TrustedBoardSnapshot = BoardSnapshot & {
  trusted?: boolean;
};

function hasAck(operation: PendingOperation): boolean {
  return operation.ackAt !== null || operation.state === "sent";
}

function snapshotRevisionIsCurrent(operation: PendingOperation, snapshot: TrustedBoardSnapshot): boolean {
  return (
    typeof operation.authoritativeRevision !== "number" ||
    snapshot.revision >= operation.authoritativeRevision
  );
}

function matchesAuthoritativeSignature(
  operation: PendingOperation,
  snapshot: TrustedBoardSnapshot
): boolean {
  if (typeof operation.authoritativeOrderSignature !== "string") return true;
  return buildBoardOrderSignature(snapshot.order) === operation.authoritativeOrderSignature;
}

export function checkOperationConvergence(input: {
  operation: PendingOperation;
  snapshot: TrustedBoardSnapshot;
}): ConvergenceResult {
  const { operation, snapshot } = input;

  if (!hasAck(operation)) return { converged: false, reason: "operation-not-acked" };
  if (snapshot.trusted === false) return { converged: false, reason: "untrusted-snapshot" };
  if (!snapshotRevisionIsCurrent(operation, snapshot)) {
    return { converged: false, reason: "revision-behind" };
  }
  if (!matchesAuthoritativeSignature(operation, snapshot)) {
    return { converged: false, reason: "signature-mismatch" };
  }

  if (operation.action === "remove") {
    return snapshot.order.includes(operation.entityId)
      ? { converged: false, reason: "entity-still-present" }
      : { converged: true };
  }

  if (!snapshot.order.includes(operation.entityId)) {
    return { converged: false, reason: "entity-missing" };
  }
  if (
    typeof operation.targetIndex === "number" &&
    snapshot.order[operation.targetIndex] !== operation.entityId
  ) {
    return { converged: false, reason: "target-mismatch" };
  }

  return { converged: true };
}
