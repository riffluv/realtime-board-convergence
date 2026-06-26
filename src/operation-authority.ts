export type OperationAuthorityContext = {
  allowed: boolean;
  scopeKey: string;
  leaseId: number;
};

export type OperationAuthorityLease = {
  tokenId: number;
  scopeKey: string;
  leaseId: number;
} | null;

export type OperationStartFence = {
  readonly __operationStartFence: unique symbol;
};

export type OperationAuthorityToken = OperationStartFence;

type InternalOperationAuthorityToken = OperationAuthorityToken & {
  tokenId: number;
  scopeKey: string;
  contextLeaseId: number;
  revocationGeneration: number;
};

export type OperationAuthorityRuntime = {
  capture(context: OperationAuthorityContext): OperationStartFence | null;
  activate(
    fence: OperationStartFence | null,
    context: OperationAuthorityContext
  ): OperationAuthorityToken | null;
  rebase(
    token: OperationAuthorityToken | null,
    context: OperationAuthorityContext
  ): OperationAuthorityContext | null;
  authorizeAndConsume(
    token: OperationAuthorityToken | null,
    context: OperationAuthorityContext
  ): OperationAuthorityContext | null;
  isActive(token: OperationAuthorityToken | null): boolean;
  revoke(token: OperationAuthorityToken | null): void;
  invalidate(): void;
  getLease(): OperationAuthorityLease;
};

function asInternalToken(
  token: OperationAuthorityToken | null
): InternalOperationAuthorityToken | null {
  return token as InternalOperationAuthorityToken | null;
}

function contextMatchesToken(
  token: InternalOperationAuthorityToken,
  context: OperationAuthorityContext,
  revocationGeneration: number
): boolean {
  return (
    context.allowed &&
    token.revocationGeneration === revocationGeneration &&
    token.scopeKey === context.scopeKey &&
    token.contextLeaseId === context.leaseId
  );
}

export function createOperationAuthorityRuntime(): OperationAuthorityRuntime {
  let lease: OperationAuthorityLease = null;
  let nextTokenId = 0;
  let revocationGeneration = 0;
  let pendingToken: InternalOperationAuthorityToken | null = null;
  let activeToken: InternalOperationAuthorityToken | null = null;

  const clearActive = () => {
    activeToken = null;
    lease = null;
  };

  const capture = (context: OperationAuthorityContext): OperationStartFence | null => {
    if (!context.allowed) return null;
    nextTokenId += 1;
    const token = {
      tokenId: nextTokenId,
      scopeKey: context.scopeKey,
      contextLeaseId: context.leaseId,
      revocationGeneration,
    } as InternalOperationAuthorityToken;
    pendingToken = token;
    return token;
  };

  const activate = (
    fence: OperationStartFence | null,
    context: OperationAuthorityContext
  ): OperationAuthorityToken | null => {
    const internalFence = asInternalToken(fence);
    const matches =
      internalFence !== null &&
      pendingToken !== null &&
      internalFence === pendingToken &&
      activeToken === null &&
      contextMatchesToken(internalFence, context, revocationGeneration);

    if (!matches) {
      if (internalFence !== null && internalFence === pendingToken) {
        pendingToken = null;
      }
      return null;
    }

    pendingToken = null;
    activeToken = internalFence;
    lease = {
      tokenId: internalFence.tokenId,
      scopeKey: internalFence.scopeKey,
      leaseId: internalFence.contextLeaseId,
    };
    return internalFence;
  };

  const authorizeAndConsume = (
    token: OperationAuthorityToken | null,
    context: OperationAuthorityContext
  ): OperationAuthorityContext | null => {
    const internalToken = asInternalToken(token);
    if (internalToken === null || activeToken === null || internalToken !== activeToken) {
      return null;
    }

    const authorized = contextMatchesToken(internalToken, context, revocationGeneration);
    clearActive();
    return authorized ? context : null;
  };

  const rebase = (
    token: OperationAuthorityToken | null,
    context: OperationAuthorityContext
  ): OperationAuthorityContext | null => {
    const internalToken = asInternalToken(token);
    if (internalToken === null || activeToken === null || internalToken !== activeToken) {
      return null;
    }

    const renewable =
      context.allowed &&
      internalToken.revocationGeneration === revocationGeneration &&
      internalToken.scopeKey === context.scopeKey;
    if (!renewable) return null;

    internalToken.contextLeaseId = context.leaseId;
    lease = {
      tokenId: internalToken.tokenId,
      scopeKey: internalToken.scopeKey,
      leaseId: context.leaseId,
    };
    return context;
  };

  const isActive = (token: OperationAuthorityToken | null): boolean => {
    const internalToken = asInternalToken(token);
    return internalToken !== null && activeToken === internalToken;
  };

  const revoke = (token: OperationAuthorityToken | null): void => {
    const internalToken = asInternalToken(token);
    if (internalToken === null) return;
    if (pendingToken === internalToken) pendingToken = null;
    if (activeToken === internalToken) clearActive();
  };

  const invalidate = (): void => {
    revocationGeneration += 1;
    pendingToken = null;
    clearActive();
  };

  return {
    capture,
    activate,
    rebase,
    authorizeAndConsume,
    isActive,
    revoke,
    invalidate,
    getLease: () => lease,
  };
}
