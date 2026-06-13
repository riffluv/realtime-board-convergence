import { buildBoardOrderSignature } from "../board-operation";
import type { BoardOperationAction, BoardSnapshot } from "../model";
import { AuthoritativeServer } from "./authoritative-server";
import { VirtualClient } from "./virtual-client";

export type SimulationScenario = {
  seed: number;
  clientCount: number;
  entityCount: number;
  operationCount: number;
  capacity: number;
  contention?: boolean;
};

export type SimulationReport = {
  seed: number;
  clientCount: number;
  entityCount: number;
  operationCount: number;
  divergence: number;
  stuckPending: number;
  finalSignature: string;
};

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function randomInt(random: () => number, maxExclusive: number): number {
  return Math.floor(random() * Math.max(1, maxExclusive));
}

function shuffledIndexes(random: () => number, length: number): number[] {
  const indexes = Array.from({ length }, (_, index) => index);
  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(random, index + 1);
    const value = indexes[index];
    const swapValue = indexes[swapIndex];
    if (value === undefined || swapValue === undefined) continue;
    indexes[index] = swapValue;
    indexes[swapIndex] = value;
  }
  return indexes;
}

function chooseAction(snapshot: BoardSnapshot, entityId: string, random: () => number): BoardOperationAction {
  const isPlaced = snapshot.order.includes(entityId);
  if (!isPlaced) return "add";
  const roll = random();
  if (roll < 0.78) return "move";
  return "remove";
}

function deliverSnapshotToAll(
  clients: VirtualClient[],
  snapshot: BoardSnapshot,
  random: () => number
): void {
  for (const index of shuffledIndexes(random, clients.length)) {
    const client = clients[index];
    if (client) client.receiveSnapshot(snapshot);
  }
}

export function runSimulation(scenario: SimulationScenario): SimulationReport {
  const random = createRandom(scenario.seed);
  const server = new AuthoritativeServer({ options: { capacity: scenario.capacity } });
  const clients = Array.from({ length: scenario.clientCount }, (_, index) =>
    new VirtualClient({ clientId: `client-${index + 1}`, snapshot: server.snapshot() })
  );

  for (let step = 0; step < scenario.operationCount; step += 1) {
    const client = clients[randomInt(random, clients.length)];
    if (!client) continue;
    const entityIndex = scenario.contention
      ? randomInt(random, Math.max(2, Math.ceil(scenario.entityCount / 2)))
      : randomInt(random, scenario.entityCount);
    const entityId = `entity-${entityIndex + 1}`;
    const action = chooseAction(server.snapshot(), entityId, random);
    const targetIndex = action === "remove" ? null : randomInt(random, scenario.capacity);
    const operation = client.createOperation({
      entityId,
      action,
      targetIndex,
    });
    client.enqueue(operation);
    const result = server.apply(operation);
    client.receiveResult(result);

    if (random() < 0.2) {
      deliverSnapshotToAll(clients, { revision: Math.max(0, result.revision ?? 0) - 1, order: [] }, random);
    }
    deliverSnapshotToAll(clients, server.snapshot(), random);
  }

  deliverSnapshotToAll(clients, server.snapshot(), random);
  const finalSignature = server.signature();
  const divergence = clients.filter((client) => client.signature() !== finalSignature).length;
  const stuckPending = clients.reduce((total, client) => total + client.activePendingCount(), 0);

  return {
    seed: scenario.seed,
    clientCount: scenario.clientCount,
    entityCount: scenario.entityCount,
    operationCount: scenario.operationCount,
    divergence,
    stuckPending,
    finalSignature: finalSignature || buildBoardOrderSignature(server.snapshot().order),
  };
}
