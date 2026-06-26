import {
  applyBoardOperation,
  createOperationAuthorityRuntime,
  type BoardOperation,
  type OperationAuthorityContext,
} from "../src/index";

function logStep(label: string, data: Record<string, unknown>): void {
  console.log(label, JSON.stringify(data));
}

let context: OperationAuthorityContext = {
  allowed: true,
  scopeKey: "board-a|revision-7|editing",
  leaseId: 1,
};

const authority = createOperationAuthorityRuntime();
const fence = authority.capture(context);
const token = authority.activate(fence, context);

const operation: BoardOperation = {
  operationId: "client-1-1",
  entityId: "card-b",
  action: "add",
  targetIndex: 1,
  baseRevision: 7,
};

logStep("1 operation admitted", {
  active: authority.isActive(token),
  lease: authority.getLease(),
});

context = {
  ...context,
  leaseId: 2,
};

logStep("2 stale lease rejected", {
  authorized: authority.authorizeAndConsume(token, context) !== null,
  active: authority.isActive(token),
});

const freshFence = authority.capture(context);
const freshToken = authority.activate(freshFence, context);
const authorized = authority.authorizeAndConsume(freshToken, context);

if (authorized) {
  const result = applyBoardOperation(["card-a", null], operation);
  logStep("3 fresh lease applies operation", {
    status: result.status,
    order: result.order,
  });
}

logStep("4 token consumed", {
  active: authority.isActive(freshToken),
  lease: authority.getLease(),
});
