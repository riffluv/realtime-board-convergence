import { buildBoardOrderSignature } from "./board-operation";
import type { BoardSnapshot } from "./model";
import type { PendingOperation } from "./pending-operation-registry";

export type ConvergenceEvidence =
  | "exact-signature"
  | "revision-covered"
  | "operation-effect"
  | "noop-acknowledged";

export type ConvergenceBlockedReason =
  | "operation-not-acked"
  | "untrusted-snapshot"
  | "revision-behind"
  | "signature-mismatch"
  | "target-mismatch"
  | "entity-still-present"
  | "entity-missing";

export type ConvergenceResult =
  | { converged: true; evidence: ConvergenceEvidence }
  | { converged: false; reason: ConvergenceBlockedReason };

export type TrustedBoardSnapshot = BoardSnapshot & {
  trusted: true;
};

export type ConvergenceEvidenceMode = "revision-watermark" | "exact-state";

function hasAck(operation: PendingOperation): boolean {
  return operation.ackAt !== null;
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

function snapshotCoversLaterAuthoritativeState(
  operation: PendingOperation,
  snapshot: TrustedBoardSnapshot
): boolean {
  return (
    typeof operation.authoritativeRevision === "number" &&
    snapshot.revision > operation.authoritativeRevision
  );
}

export function checkOperationConvergence(input: {
  operation: PendingOperation;
  snapshot: BoardSnapshot & { trusted?: boolean };
  evidenceMode?: ConvergenceEvidenceMode;
}): ConvergenceResult {
  const { operation, snapshot, evidenceMode = "revision-watermark" } = input;

  if (!hasAck(operation)) return { converged: false, reason: "operation-not-acked" };
  if (snapshot.trusted !== true) return { converged: false, reason: "untrusted-snapshot" };
  const trustedSnapshot: TrustedBoardSnapshot = { ...snapshot, trusted: true };
  if (!snapshotRevisionIsCurrent(operation, trustedSnapshot)) {
    return { converged: false, reason: "revision-behind" };
  }

  const signatureMatched = matchesAuthoritativeSignature(operation, trustedSnapshot);
  if (signatureMatched && typeof operation.authoritativeOrderSignature === "string") {
    return { converged: true, evidence: "exact-signature" };
  }

  if (!signatureMatched && evidenceMode === "exact-state") {
    return { converged: false, reason: "signature-mismatch" };
  }

  if (operation.authoritativeStatus === "noop") {
    return { converged: true, evidence: "noop-acknowledged" };
  }

  if (!signatureMatched && snapshotCoversLaterAuthoritativeState(operation, trustedSnapshot)) {
    return { converged: true, evidence: "revision-covered" };
  }

  if (operation.action === "remove") {
    return snapshot.order.includes(operation.entityId)
      ? { converged: false, reason: "entity-still-present" }
      : { converged: true, evidence: "operation-effect" };
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

  return { converged: true, evidence: "operation-effect" };
}
