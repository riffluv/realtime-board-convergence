import type { BoardOperation } from "./model";
import type { AuthoritativeOperationResult } from "./pending-operation-registry";

export type BoardOperationExecutor = (
  operation: BoardOperation
) => AuthoritativeOperationResult | Promise<AuthoritativeOperationResult>;

export type BoardOperationSchedulerOptions = {
  execute: BoardOperationExecutor;
  flushDelayMs?: number;
  autoStart?: boolean;
};

export type BoardOperationScheduler = {
  enqueue(operation: BoardOperation): Promise<AuthoritativeOperationResult>;
  flushNext(): Promise<void>;
  flushAll(): Promise<void>;
  pendingCount(): number;
  isRunning(): boolean;
  clear(reason?: string): void;
};

type ScheduledJob = {
  operation: BoardOperation;
  resolve: (value: AuthoritativeOperationResult) => void;
  reject: (reason: unknown) => void;
};

function supersededResult(operation: BoardOperation, reason: string): AuthoritativeOperationResult {
  return {
    status: "stale",
    applied: false,
    reason,
    operationId: operation.operationId,
    clientId: operation.clientId ?? null,
    clientCoalesced: true,
  };
}

export function createBoardOperationScheduler(
  options: BoardOperationSchedulerOptions
): BoardOperationScheduler {
  const flushDelayMs = Math.max(0, Math.floor(options.flushDelayMs ?? 12));
  const autoStart = options.autoStart !== false;
  const queue: ScheduledJob[] = [];
  let running = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = () => {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
  };

  const schedule = () => {
    if (!autoStart || running || timer || queue.length === 0) return;
    timer = setTimeout(() => {
      timer = null;
      void scheduler.flushNext();
    }, flushDelayMs);
  };

  const coalesceQueuedMove = (incoming: BoardOperation): void => {
    if (incoming.action !== "move") return;
    for (let index = queue.length - 1; index >= 0; index -= 1) {
      const job = queue[index];
      if (!job) continue;
      if (job.operation.action !== "move" || job.operation.entityId !== incoming.entityId) {
        break;
      }
      queue.splice(index, 1);
      job.resolve(supersededResult(job.operation, "coalesced-by-newer-move"));
    }
  };

  const scheduler: BoardOperationScheduler = {
    enqueue(operation) {
      coalesceQueuedMove(operation);
      const promise = new Promise<AuthoritativeOperationResult>((resolve, reject) => {
        queue.push({ operation, resolve, reject });
      });
      schedule();
      return promise;
    },

    async flushNext() {
      if (running) return;
      clearTimer();
      const job = queue.shift();
      if (!job) return;
      running = true;
      try {
        const result = await options.execute(job.operation);
        job.resolve(result);
      } catch (error) {
        job.reject(error);
      } finally {
        running = false;
        schedule();
      }
    },

    async flushAll() {
      while (queue.length > 0 || running) {
        if (!running) {
          await scheduler.flushNext();
          continue;
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    },

    pendingCount() {
      return queue.length + (running ? 1 : 0);
    },

    isRunning() {
      return running;
    },

    clear(reason = "scheduler-cleared") {
      clearTimer();
      while (queue.length > 0) {
        const job = queue.shift();
        if (!job) continue;
        job.resolve(supersededResult(job.operation, reason));
      }
    },
  };

  return scheduler;
}
