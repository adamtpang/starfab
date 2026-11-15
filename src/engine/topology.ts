// Flow topology: which station feeds which. By default each station feeds
// the next one in the list (a straight line). A station can name a later
// station in `feeds` instead, which lets two or more streams meet at one
// station. That station is a join: it needs one part from every stream that
// feeds it before it can start a unit.
//
// Rules: the last station in the list is the only exit, and `feeds` must
// point at a station later in the list, so the flow can never loop.

import type { Station } from "../types";

export interface Topology {
  next: number[]; // index of the station each one feeds, -1 for the exit
  inputs: number[][]; // stations feeding each station
  sources: number[]; // stations with nothing feeding them
  order: number[]; // processing order inside a tick: downstream before upstream
}

export function flowTopology(stations: Station[]): Topology {
  const n = stations.length;
  const next = stations.map((s, i) => {
    if (i === n - 1) return -1;
    const target = s.feeds ? stations.findIndex((x) => x.id === s.feeds) : -1;
    return target > i ? target : i + 1;
  });
  const inputs: number[][] = stations.map(() => []);
  next.forEach((j, i) => {
    if (j >= 0) inputs[j].push(i);
  });
  const sources = inputs.flatMap((list, i) => (list.length === 0 ? [i] : []));
  // Every station feeds a later one, so walking the list backward always
  // handles a station before the stations that feed it.
  const order = stations.map((_, i) => n - 1 - i);
  return { next, inputs, sources, order };
}

export function isJoin(topology: Topology, index: number): boolean {
  return topology.inputs[index].length > 1;
}
