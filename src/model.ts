export type ClientId = string;
export type EntityId = string;
export type OperationId = string;
export type SnapshotRevision = number;

export type BoardOrder = readonly (EntityId | null)[];

export type BoardSnapshot = {
  revision: SnapshotRevision;
  order: BoardOrder;
};

export type BoardOperationAction = "add" | "move" | "remove";

export type BoardOperation = {
  operationId: OperationId;
  entityId: EntityId;
  action: BoardOperationAction;
  targetIndex?: number | null;
  clientId?: ClientId;
  baseRevision?: SnapshotRevision;
};

export type TraceEvent = {
  name: string;
  at: number;
  data?: Record<string, string | number | boolean | null>;
};
