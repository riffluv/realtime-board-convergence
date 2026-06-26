import { createOperationAuthorityRuntime, type OperationAuthorityContext } from "../src/index";

const context = (overrides: Partial<OperationAuthorityContext> = {}): OperationAuthorityContext => ({
  allowed: true,
  scopeKey: "board-1|revision-1|editing",
  leaseId: 1,
  ...overrides,
});

describe("operation authority runtime", () => {
  test("does not capture when the context is not allowed", () => {
    const authority = createOperationAuthorityRuntime();

    expect(authority.capture(context({ allowed: false }))).toBeNull();
    expect(authority.getLease()).toBeNull();
  });

  test("activates only the pending fence under the matching scope and lease", () => {
    const authority = createOperationAuthorityRuntime();
    const start = context();
    const fence = authority.capture(start);

    expect(authority.activate(fence, context({ scopeKey: "other" }))).toBeNull();
    expect(authority.getLease()).toBeNull();
    expect(authority.activate(fence, start)).toBeNull();

    const freshFence = authority.capture(start);
    const token = authority.activate(freshFence, start);

    expect(token).toBe(freshFence);
    expect(authority.isActive(token)).toBe(true);
    expect(authority.getLease()).toEqual({
      tokenId: 2,
      scopeKey: start.scopeKey,
      leaseId: start.leaseId,
    });
  });

  test("authorizes and consumes an active token exactly once", () => {
    const authority = createOperationAuthorityRuntime();
    const start = context();
    const token = authority.activate(authority.capture(start), start);

    expect(authority.authorizeAndConsume(token, start)).toEqual(start);
    expect(authority.getLease()).toBeNull();
    expect(authority.isActive(token)).toBe(false);
    expect(authority.authorizeAndConsume(token, start)).toBeNull();
  });

  test("consumes and rejects stale scope or stale lease at authorization time", () => {
    const authority = createOperationAuthorityRuntime();
    const start = context();
    const staleScopeToken = authority.activate(authority.capture(start), start);

    expect(authority.authorizeAndConsume(staleScopeToken, context({ scopeKey: "other" }))).toBeNull();
    expect(authority.isActive(staleScopeToken)).toBe(false);

    const staleLeaseToken = authority.activate(authority.capture(start), start);

    expect(authority.authorizeAndConsume(staleLeaseToken, context({ leaseId: 2 }))).toBeNull();
    expect(authority.getLease()).toBeNull();
  });

  test("rebases only the active token within the same scope", () => {
    const authority = createOperationAuthorityRuntime();
    const start = context();
    const token = authority.activate(authority.capture(start), start);

    expect(authority.rebase(token, context({ scopeKey: "other", leaseId: 2 }))).toBeNull();
    expect(authority.rebase(token, context({ leaseId: 2 }))).toEqual(context({ leaseId: 2 }));
    expect(authority.getLease()).toMatchObject({ leaseId: 2 });
    expect(authority.authorizeAndConsume(token, context({ leaseId: 2 }))).toEqual(
      context({ leaseId: 2 })
    );
  });

  test("revokes pending and active tokens independently", () => {
    const authority = createOperationAuthorityRuntime();
    const start = context();
    const pendingFence = authority.capture(start);

    authority.revoke(pendingFence);
    expect(authority.activate(pendingFence, start)).toBeNull();

    const token = authority.activate(authority.capture(start), start);
    authority.revoke(token);

    expect(authority.isActive(token)).toBe(false);
    expect(authority.getLease()).toBeNull();
    expect(authority.authorizeAndConsume(token, start)).toBeNull();
  });

  test("invalidates pending and active tokens by generation", () => {
    const authority = createOperationAuthorityRuntime();
    const start = context();
    const pendingFence = authority.capture(start);

    authority.invalidate();
    expect(authority.activate(pendingFence, start)).toBeNull();

    const token = authority.activate(authority.capture(start), start);
    authority.invalidate();

    expect(authority.isActive(token)).toBe(false);
    expect(authority.authorizeAndConsume(token, start)).toBeNull();
    expect(authority.getLease()).toBeNull();
  });
});
