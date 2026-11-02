import type { Movement, State } from "./model";

export interface MovementDocument {
  key: string;
  id: string;
  source: string;
  date: string;
  type: Movement["type"];
  warehouses: string[];
  reasons: string[];
  lines: Movement[];
}

/** 仅可靠单据来源允许跨行归并；历史“手工登记”等描述不作为单号。 */
export function movementDocuments(state: State): MovementDocument[] {
  const sources = new Set([
    ...state.inbounds.map((row) => row.id),
    ...state.issues.map((row) => row.id),
    ...state.shipments.map((row) => row.id),
    ...(state.finishedInbounds || []).map((row) => row.id),
    ...(state.finishedOutbounds || []).map((row) => row.id),
    ...state.plans.filter((row) => row.status === "已完工").map((row) => row.id),
  ]);
  const documents = new Map<string, MovementDocument>();
  for (const line of state.movements) {
    const reliable = sources.has(line.source) || /^OUT\d+[A-Z0-9]*$/.test(line.source);
    const key = JSON.stringify([line.type, reliable ? line.source : line.id]);
    let document = documents.get(key);
    if (!document) {
      document = { key, id: reliable ? line.source : line.id, source: line.source,
        date: line.date, type: line.type, warehouses: [], reasons: [], lines: [] };
      documents.set(key, document);
    }
    document.lines.push(line);
    if (!document.warehouses.includes(line.warehouse)) document.warehouses.push(line.warehouse);
    if (!document.reasons.includes(line.reason)) document.reasons.push(line.reason);
  }
  return [...documents.values()].sort((a, b) => b.date.localeCompare(a.date));
}
