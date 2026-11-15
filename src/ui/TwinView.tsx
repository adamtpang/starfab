import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { flowTopology } from "../engine/topology";
import { fmtInt } from "../lib/format";
import type { MachineState, Plant, ShiftPattern, SimResult } from "../types";
import { VISIT_OUTCOME } from "../types";

// The floor twin: every line and station of the simulated shift as a small
// 3D floor. Each small box on the floor is one simulated unit, placed from
// the simulator's own record of where that unit was at that second. Machine
// outlines and stack lights take the color of the station's simulated state.
// The glide between stations, the workers and the moving machine parts are
// illustration: in the model a transfer takes no time.

type Theme = "vacuum" | "studio";

interface Palette {
  floor: number;
  ground: number;
  floorEdge: number;
  aisle: number;
  rail: number;
  kit: number;
  worker: number;
  label: string;
  labelDim: string;
  sky: number;
  bounce: number;
  skyPower: number;
  sun: number;
  sunPower: number;
  edge: Record<MachineState, number>;
  body: Record<MachineState, number>;
}

const PALETTES: Record<Theme, Palette> = {
  vacuum: {
    floor: 0x0b1a33,
    ground: 0x05070d,
    floorEdge: 0x2f7391,
    aisle: 0x1f4a66,
    rail: 0x1b2f52,
    kit: 0xffffff,
    worker: 0x8fb6d9,
    label: "#a9c1f5",
    labelDim: "#7f9ad8",
    sky: 0xa8d8ff,
    bounce: 0x0a1226,
    skyPower: 1.5,
    sun: 0xcfe6ff,
    sunPower: 2.4,
    edge: { busy: 0x6fe0ff, blocked: 0xc7b3ff, down: 0xff5c6c, idle: 0x2f7391 },
    body: { busy: 0x1c4662, blocked: 0x3a3170, down: 0x6a2530, idle: 0x16304a },
  },
  studio: {
    floor: 0xf3f3f1,
    ground: 0xe1e4e8,
    floorEdge: 0xb9c0c9,
    aisle: 0xd3d8de,
    rail: 0xcfd4da,
    kit: 0x14607c,
    worker: 0x3a4250,
    label: "#3a4250",
    labelDim: "#636c7a",
    sky: 0xffffff,
    bounce: 0xc9ced6,
    skyPower: 1.7,
    sun: 0xffffff,
    sunPower: 2.3,
    edge: { busy: 0x5b6672, blocked: 0x6541d1, down: 0xcf2c3c, idle: 0xa9b2bd },
    body: { busy: 0xffffff, blocked: 0xd9cffa, down: 0xf5b9bf, idle: 0xe6e9ed },
  },
};

const DX = 5; // spacing between columns of stations
const DZ = 4.6; // depth of one line
const ROW = 2.9; // spacing between stations that share a column
const RAIL = 1.55; // the conveyor runs just in front of each station
const GLIDE = 3; // simulated seconds a unit takes to glide onto a station
const SPEEDS = [10, 30, 300, 3600]; // simulated seconds per second of playback
const DEFAULT_SPEED = 30;
type View = "floor" | "line" | "plan";
const VIEWS: { id: View; label: string }[] = [
  { id: "floor", label: "Whole floor" },
  { id: "line", label: "Line 1" },
  { id: "plan", label: "Plan" },
];

type Mover = { axis: "x" | "y"; amplitude: number; rate: number };
interface Part {
  size: [number, number, number];
  at: [number, number, number];
  round?: boolean; // drawn as a cylinder lying along x
  upright?: boolean; // drawn as a cylinder standing up
  mover?: Mover;
}

type Shape =
  | "racks"
  | "bench"
  | "press"
  | "gantry"
  | "chamber"
  | "packout"
  | "towers"
  | "scanner"
  | "cluster"
  | "beamline"
  | "molder";

const FALLBACK: Shape[] = ["racks", "bench", "press", "gantry", "chamber", "packout"];

// Pick a shape from what the station is called, so the same kind of work
// looks the same in every hall. Unknown names fall back by position.
function shapeFor(name: string, index: number): Shape {
  const n = name.toLowerCase();
  if (/kit|rack|receiv|stock/.test(n)) return "racks";
  if (/lith|expos/.test(n)) return "scanner";
  if (/depos|furnace|cure|oven/.test(n)) return "towers";
  if (/etch|clean|wash/.test(n)) return "cluster";
  if (/implant|anneal|beam/.test(n)) return "beamline";
  if (/mold|cast|form/.test(n)) return "molder";
  if (/electr|board|solder/.test(n)) return "bench";
  if (/mech|press|stamp|machin/.test(n)) return "press";
  if (/integr|join|fasten|assembl|weld/.test(n)) return "gantry";
  if (/test|inspect|proof/.test(n)) return "chamber";
  if (/pack|ship/.test(n)) return "packout";
  return FALLBACK[index % FALLBACK.length];
}

// A handful of primitives per shape, so each kind of work reads differently.
// Sizes are [width, height, depth], positions are centers.
function stationParts(shape: Shape): Part[] {
  const cabinet: Part = { size: [0.5, 1.1, 0.5], at: [-1.75, 0.55, -0.7] };
  switch (shape) {
    case "racks": // shelving full of parts
      return [
        ...[-0.9, 0, 0.9].map((z): Part => ({ size: [2.2, 1.5, 0.55], at: [0, 0.75, z] })),
        ...[-0.9, 0, 0.9].map((z): Part => ({ size: [2.3, 0.08, 0.62], at: [0, 1.56, z] })),
      ];
    case "bench": // bench with a hood and a moving head
      return [
        { size: [2.6, 0.8, 1.8], at: [0, 0.4, 0] },
        { size: [2.0, 0.5, 1.2], at: [0, 1.45, 0] },
        { size: [0.15, 0.6, 0.15], at: [-0.9, 1.0, 0] },
        { size: [0.15, 0.6, 0.15], at: [0.9, 1.0, 0] },
        { size: [0.9, 0.12, 0.6], at: [0, 0.86, 0.3], mover: { axis: "x", amplitude: 0.5, rate: 2.2 } },
        cabinet,
      ];
    case "press": // press with a moving head
      return [
        { size: [2.4, 0.9, 2.0], at: [0, 0.45, 0] },
        { size: [0.9, 2.2, 0.9], at: [-0.5, 2.0, -0.3] },
        { size: [1.4, 0.3, 1.2], at: [0.2, 2.6, -0.1] },
        { size: [0.9, 0.5, 0.9], at: [0.45, 1.75, 0.1], mover: { axis: "y", amplitude: 0.4, rate: 3.2 } },
        cabinet,
      ];
    case "gantry": // gantry over a table, with a moving carriage
      return [
        { size: [2.4, 0.6, 1.8], at: [0, 0.3, 0] },
        { size: [0.25, 2.4, 0.25], at: [-1.2, 1.2, -1.0] },
        { size: [0.25, 2.4, 0.25], at: [1.2, 1.2, -1.0] },
        { size: [0.25, 2.4, 0.25], at: [-1.2, 1.2, 1.0] },
        { size: [0.25, 2.4, 0.25], at: [1.2, 1.2, 1.0] },
        { size: [2.9, 0.3, 2.5], at: [0, 2.55, 0] },
        { size: [0.5, 0.6, 0.5], at: [0, 2.1, 0], mover: { axis: "x", amplitude: 0.8, rate: 1.6 } },
      ];
    case "chamber": // closed test chamber on a base
      return [
        { size: [2.6, 0.5, 2.2], at: [0, 0.25, 0] },
        { size: [2.4, 1.7, 1.7], at: [0, 1.35, 0], round: true },
        { size: [0.8, 0.4, 0.8], at: [0, 2.4, 0] },
        cabinet,
      ];
    case "packout": // table, stacked cartons and a board
      return [
        { size: [2.6, 0.5, 1.8], at: [0, 0.25, 0] },
        { size: [0.8, 0.7, 0.8], at: [-0.7, 0.85, 0] },
        { size: [0.8, 0.7, 0.8], at: [0.3, 0.85, 0.2] },
        { size: [0.8, 0.7, 0.8], at: [-0.2, 1.55, 0.1] },
        { size: [0.12, 1.2, 1.6], at: [1.25, 1.1, 0] },
      ];
    case "towers": // a row of tall furnace tubes on a plinth
      return [
        { size: [2.8, 0.4, 2.0], at: [0, 0.2, 0] },
        ...[-0.9, 0, 0.9].map((x): Part => ({ size: [0.7, 2.6, 0.7], at: [x, 1.7, -0.2], upright: true })),
        { size: [2.8, 0.25, 0.5], at: [0, 3.05, -0.2] },
        cabinet,
      ];
    case "scanner": // big sealed enclosure with a lens barrel and a loader
      return [
        { size: [2.8, 2.3, 2.2], at: [0, 1.15, -0.1] },
        { size: [0.9, 0.9, 0.9], at: [0, 2.75, -0.1], upright: true },
        { size: [1.0, 1.1, 0.7], at: [0.6, 0.55, 1.25] },
        { size: [0.9, 0.1, 0.5], at: [-0.7, 1.0, 1.2], mover: { axis: "x", amplitude: 0.3, rate: 1.8 } },
      ];
    case "cluster": // a round hub with process modules around it
      return [
        { size: [1.3, 1.1, 1.3], at: [0, 0.55, 0], upright: true },
        { size: [0.9, 1.5, 0.9], at: [-1.15, 0.75, 0] },
        { size: [0.9, 1.5, 0.9], at: [1.15, 0.75, 0] },
        { size: [0.9, 1.5, 0.9], at: [0, 0.75, -1.15] },
        { size: [0.5, 0.5, 0.5], at: [0, 1.4, 0], upright: true, mover: { axis: "y", amplitude: 0.25, rate: 2.6 } },
      ];
    case "beamline": // a long, low beam tube between two end stations
      return [
        { size: [1.0, 1.7, 1.6], at: [-1.1, 0.85, 0] },
        { size: [2.0, 0.5, 0.5], at: [0.4, 1.0, 0], round: true },
        { size: [0.9, 1.2, 1.2], at: [1.35, 0.6, 0] },
        { size: [2.6, 0.2, 1.6], at: [0.1, 0.1, 0] },
      ];
    default: // molder: a long barrel, a hopper and a clamp that moves
      return [
        { size: [2.8, 0.7, 1.3], at: [0, 0.35, 0] },
        { size: [1.6, 0.55, 0.55], at: [-0.5, 1.05, 0], round: true },
        { size: [0.55, 0.7, 0.55], at: [-0.9, 1.65, 0], upright: true },
        { size: [0.9, 1.1, 1.2], at: [0.95, 1.25, 0] },
        { size: [0.25, 0.9, 1.0], at: [0.35, 1.2, 0], mover: { axis: "x", amplitude: 0.15, rate: 3.0 } },
        cabinet,
      ];
  }
}

function floorLabel(text: string, width: number, color: string): THREE.Mesh {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.font = '500 34px "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace';
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    ctx.fillText(text, 4, 34);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, width / 8),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function clock(shift: ShiftPattern, seconds: number): string {
  const [h, m] = shift.startClock.split(":").map(Number);
  const total = h * 3600 + m * 60 + Math.floor(seconds);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(Math.floor(total / 3600) % 24)}:${two(Math.floor(total / 60) % 60)}:${two(total % 60)}`;
}

// Largest k with xs[rows[k]] <= value, or -1.
function lastAtOrBefore(rows: number[], xs: number[], value: number): number {
  let lo = 0;
  let hi = rows.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (xs[rows[mid]] <= value) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

// Rows of the trace grouped for fast lookup at one moment in time.
interface TraceIndex {
  byMachine: number[][][][]; // [line][station][machine] -> visit rows, in time order
  byBuffer: number[][][]; // [line][station] -> wait rows, in time order
}

function indexTrace(sim: SimResult, plant: Plant): TraceIndex {
  const lines = plant.parallelLines;
  const byMachine = Array.from({ length: lines }, () =>
    plant.stations.map((s) => Array.from({ length: s.parallelUnits }, () => [] as number[])),
  );
  const byBuffer = Array.from({ length: lines }, () => plant.stations.map(() => [] as number[]));
  const trace = sim.trace;
  if (trace) {
    const v = trace.visits;
    for (let k = 0; k < v.unit.length; k++) byMachine[v.line[k]]?.[v.station[k]]?.[v.machine[k]]?.push(k);
    const w = trace.waits;
    for (let k = 0; k < w.unit.length; k++) byBuffer[w.line[k]]?.[w.afterStation[k]]?.push(k);
  }
  return { byMachine, byBuffer };
}

interface StationRef {
  line: number;
  station: number;
  edges: THREE.LineBasicMaterial;
  fill: THREE.MeshStandardMaterial;
  lamp: THREE.MeshBasicMaterial;
  movers: { mesh: THREE.Mesh; base: number; mover: Mover }[];
  worker: THREE.Object3D | null;
}

export default function TwinView({
  plant,
  sim,
  shift,
  theme,
}: {
  plant: Plant;
  sim: SimResult;
  shift: ShiftPattern;
  theme: Theme;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const simRef = useRef(sim);
  simRef.current = sim;
  const secondsRef = useRef(0);
  const playingRef = useRef(true);
  const speedRef = useRef(DEFAULT_SPEED);
  const viewRef = useRef<(view: View) => void>(() => {});

  const [seconds, setSeconds] = useState(0);
  const [playing, setPlaying] = useState(
    () => !(typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches),
  );
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [basisOpen, setBasisOpen] = useState(false);
  const [unitsShown, setUnitsShown] = useState(0);
  playingRef.current = playing;
  speedRef.current = speed;

  const lines = plant.parallelLines;
  const stationCount = plant.stations.length;
  const layoutKey = plant.stations
    .map((s) => `${s.id}:${s.name}:${s.feeds ?? ""}:${s.parallelUnits}:${s.operators}`)
    .join("|");
  const bufferCapacity = sim.buffers.capacity;

  const traceIndex = useMemo(() => indexTrace(sim, plant), [sim, plant]);
  const indexRef = useRef(traceIndex);
  indexRef.current = traceIndex;

  // Running totals at each minute, for the counters.
  const totals = useMemo(() => {
    const cumulative = (xs: number[]) => {
      let sum = 0;
      return xs.map((x) => (sum += x));
    };
    return {
      started: cumulative(sim.flowByMinute.started),
      good: cumulative(sim.flowByMinute.good),
      scrap: cumulative(sim.flowByMinute.scrap),
    };
  }, [sim]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const C = PALETTES[theme];

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.minZoom = 0.6;
    controls.maxZoom = 5;
    controls.zoomToCursor = true;

    // Lay stations out by how far they are from the exit. Stations at the
    // same distance (two sub-lines feeding one join) share a column and sit
    // side by side across the line.
    const topology = flowTopology(plant.stations);
    const depth: number[] = new Array(stationCount).fill(0);
    for (let i = stationCount - 2; i >= 0; i--) depth[i] = depth[topology.next[i]] + 1;
    const columns = Math.max(...depth) + 1;
    const column = depth.map((d) => columns - 1 - d);
    const peersOf = (i: number) => column.flatMap((c, k) => (c === column[i] ? [k] : []));
    const maxRows = Math.max(...column.map((_, i) => peersOf(i).length));
    const lineDepth = DZ + (maxRows - 1) * ROW;
    const rowOffset = (i: number) => {
      const peers = peersOf(i);
      return (peers.indexOf(i) - (peers.length - 1) / 2) * ROW;
    };
    const stationX = (i: number) => (column[i] - (columns - 1) / 2) * DX;
    const lineZ = (l: number) => (l - (lines - 1) / 2) * lineDepth;
    const stationZ = (l: number, i: number) => lineZ(l) + rowOffset(i);

    const floorW = columns * DX + 6;
    const floorD = lines * lineDepth + 4.5;
    const viewWidth = (floorW + floorD) * 0.74 + 2;

    // Light: a soft sky fill plus one sun that casts shadows.
    scene.add(new THREE.HemisphereLight(C.sky, C.bounce, C.skyPower));
    const sun = new THREE.DirectionalLight(C.sun, C.sunPower);
    sun.position.set(floorW * 0.35, 46, floorD * 0.2 + 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const reach = Math.max(floorW, floorD) * 0.75 + 4;
    sun.shadow.camera.left = -reach;
    sun.shadow.camera.right = reach;
    sun.shadow.camera.top = reach;
    sun.shadow.camera.bottom = -reach;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 140;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    scene.add(sun);

    // Camera presets: the whole floor, a close look at line 1, or straight
    // down like a plan drawing.
    const setView = (view: View) => {
      const z = view === "line" ? lineZ(0) + 0.6 : 0.6;
      controls.target.set(0, 0.5, z);
      if (view === "plan") camera.position.set(0, 90, z + 0.01);
      else camera.position.set(60, 52, 60 + z);
      camera.zoom = view === "line" ? Math.min(3, Math.max(1.4, lines * 0.7)) : 1;
      camera.updateProjectionMatrix();
      controls.update();
    };
    viewRef.current = setView;

    const disposables: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(item: T): T => {
      disposables.push(item);
      return item;
    };
    const solid = (color: number) =>
      track(
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.86,
          metalness: 0.04,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1,
        }),
      );
    const outlined = (
      part: Part,
      fill: THREE.Material,
      edge: THREE.Material,
      parent: THREE.Object3D,
    ) => {
      const [w, h, d] = part.size;
      const geometry = track(
        part.round
          ? new THREE.CylinderGeometry(h / 2, h / 2, w, 20)
          : part.upright
            ? new THREE.CylinderGeometry(w / 2, w / 2, h, 20)
            : new THREE.BoxGeometry(w, h, d),
      );
      const mesh = new THREE.Mesh(geometry, fill);
      mesh.position.set(...part.at);
      if (part.round) mesh.rotation.z = Math.PI / 2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.add(new THREE.LineSegments(track(new THREE.EdgesGeometry(geometry, 30)), edge));
      parent.add(mesh);
      return mesh;
    };

    // Ground under the slab, then the slab, then aisle lines between lines.
    const ground = new THREE.Mesh(
      track(new THREE.PlaneGeometry(floorW * 4, floorD * 4)),
      track(new THREE.MeshStandardMaterial({ color: C.ground, roughness: 1, transparent: true, opacity: 0.55 })),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.42;
    ground.receiveShadow = true;
    scene.add(ground);

    const floorEdge = track(new THREE.LineBasicMaterial({ color: C.floorEdge }));
    const slab = outlined({ size: [floorW, 0.4, floorD], at: [0, -0.2, 0] }, solid(C.floor), floorEdge, scene);
    slab.castShadow = false;
    const aisleFill = track(new THREE.MeshBasicMaterial({ color: C.aisle }));
    for (let l = 0; l <= lines; l++) {
      const stripe = new THREE.Mesh(track(new THREE.PlaneGeometry(floorW - 2.4, 0.09)), aisleFill);
      stripe.rotation.x = -Math.PI / 2;
      const edge = l === 0 ? 0.35 : l === lines ? -0.35 : 0;
      stripe.position.set(0, 0.012, (l - lines / 2) * lineDepth + edge);
      scene.add(stripe);
    }

    const railFill = solid(C.rail);
    const railEdge = track(new THREE.LineBasicMaterial({ color: C.edge.idle }));
    const workerFill = solid(C.worker);
    const workerBody = track(new THREE.BoxGeometry(0.3, 0.62, 0.22));
    const workerHead = track(new THREE.SphereGeometry(0.14, 12, 10));
    const lampGeometry = track(new THREE.CylinderGeometry(0.11, 0.11, 0.34, 12));
    const poleGeometry = track(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 8));

    const stationRefs: StationRef[] = [];
    for (let l = 0; l < lines; l++) {
      for (let i = 0; i < stationCount; i++) {
        const x = stationX(i);
        const z = stationZ(l, i);
        const edges = track(new THREE.LineBasicMaterial({ color: C.edge.idle }));
        const fill = solid(C.body.idle);
        const group = new THREE.Group();
        group.position.set(x, 0, z - 0.3);
        const movers: StationRef["movers"] = [];
        for (const part of stationParts(shapeFor(plant.stations[i].name, i))) {
          const mesh = outlined(part, fill, edges, group);
          if (part.mover) {
            movers.push({ mesh, base: part.mover.axis === "x" ? part.at[0] : part.at[1], mover: part.mover });
          }
        }
        // Stack light: a pole with a lamp that shows the station's state.
        const lamp = track(new THREE.MeshBasicMaterial({ color: C.edge.idle }));
        const pole = new THREE.Mesh(poleGeometry, railFill);
        pole.position.set(1.75, 0.75, -0.75);
        const bulb = new THREE.Mesh(lampGeometry, lamp);
        bulb.position.set(1.75, 1.67, -0.75);
        group.add(pole, bulb);
        scene.add(group);

        // One operator per station, standing at the front corner.
        let worker: THREE.Object3D | null = null;
        if (plant.stations[i].operators > 0) {
          worker = new THREE.Group();
          const body = new THREE.Mesh(workerBody, workerFill);
          body.position.y = 0.36;
          body.castShadow = true;
          const head = new THREE.Mesh(workerHead, workerFill);
          head.position.y = 0.83;
          head.castShadow = true;
          worker.add(body, head);
          worker.position.set(x - 1.75, 0, z + 0.85);
          scene.add(worker);
        }

        const target = topology.next[i];
        if (target >= 0) {
          // Conveyor from this station to the one it feeds.
          const toX = stationX(target);
          const toZ = stationZ(l, target);
          const rail = outlined(
            { size: [Math.hypot(toX - x, toZ - z), 0.12, 0.5], at: [(x + toX) / 2, 0.06, (z + toZ) / 2 + RAIL] },
            railFill,
            railEdge,
            scene,
          );
          rail.rotation.y = -Math.atan2(toZ - z, toX - x);
          rail.castShadow = false;
        }
        stationRefs.push({ line: l, station: i, edges, fill, lamp, movers, worker });
      }
      const label = floorLabel(`LINE ${l + 1}`, 3.2, C.labelDim);
      label.position.set(-floorW / 2 + 2.0, 0.02, lineZ(l) + lineDepth / 2 - 0.1);
      scene.add(label);
      disposables.push((label.material as THREE.MeshBasicMaterial).map as THREE.Texture);
      disposables.push(label.material as THREE.Material, label.geometry);
    }
    plant.stations.forEach((s, i) => {
      const peers = peersOf(i);
      const label = floorLabel(`${s.id} ${s.name.toUpperCase()}`, 4.4, C.label);
      // Stations that share a column stack their labels.
      label.position.set(stationX(i) + 0.2, 0.02, floorD / 2 - 0.7 - 0.6 * (peers.length - 1 - peers.indexOf(i)));
      scene.add(label);
      disposables.push((label.material as THREE.MeshBasicMaterial).map as THREE.Texture);
      disposables.push(label.material as THREE.Material, label.geometry);
    });

    // A tugger cart running along the back aisle. Illustration only.
    const cart = new THREE.Group();
    const cartBody = new THREE.Mesh(track(new THREE.BoxGeometry(1.1, 0.4, 0.6)), workerFill);
    cartBody.position.y = 0.32;
    cartBody.castShadow = true;
    const cartLoad = new THREE.Mesh(track(new THREE.BoxGeometry(0.5, 0.35, 0.45)), railFill);
    cartLoad.position.set(-0.2, 0.7, 0);
    cartLoad.castShadow = true;
    cart.add(cartBody, cartLoad);
    cart.position.set(0, 0, -floorD / 2 + 0.9);
    scene.add(cart);
    const cartReach = floorW / 2 - 2;

    // Units: one instanced box per simulated unit on the floor right now.
    const machineTotal = plant.stations.reduce((n, s) => n + s.parallelUnits, 0);
    const maxUnits = lines * (machineTotal * 2 + (stationCount - 1) * Math.max(1, bufferCapacity)) + 8;
    const unitMesh = new THREE.InstancedMesh(
      track(new THREE.BoxGeometry(0.36, 0.26, 0.36)),
      track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })),
      maxUnits,
    );
    unitMesh.castShadow = true;
    unitMesh.frustumCulled = false;
    unitMesh.count = 0;
    scene.add(unitMesh);
    disposables.push(unitMesh);
    const pose = new THREE.Object3D();
    const tint = new THREE.Color();
    const kitColor = new THREE.Color(C.kit);
    const heldColor = new THREE.Color(C.edge.blocked);
    const scrapColor = new THREE.Color(C.edge.down);

    // Where machine m of a station holds its unit: a small grid on the rail.
    const padSlot = (l: number, i: number, m: number): [number, number] => {
      const n = plant.stations[i].parallelUnits;
      const cols = Math.min(n, 6);
      return [
        stationX(i) + ((m % cols) - (cols - 1) / 2) * 0.46,
        stationZ(l, i) + RAIL + Math.floor(m / cols) * 0.46,
      ];
    };
    // Where a unit glides in from: the station that feeds this one, or a
    // point just before a station that starts units.
    const origin = (l: number, i: number): [number, number] => {
      const from = topology.inputs[i][0];
      if (from === undefined) return [stationX(i) - 2.4, stationZ(l, i) + RAIL];
      return [stationX(from), stationZ(l, from) + RAIL];
    };

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      // Fit the floor to whichever side is tighter.
      const viewHeight = (floorW + floorD) * 0.36 + 5;
      const halfW = Math.max(viewWidth, viewHeight * (w / h)) / 2;
      camera.left = -halfW;
      camera.right = halfW;
      camera.top = halfW * (h / w);
      camera.bottom = -halfW * (h / w);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    setView("floor");

    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    io.observe(mount);

    let frame = 0;
    let last = performance.now();
    let lastReport = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!visible) return;

      const current = simRef.current;
      const total = current.scheduledSeconds;
      if (playingRef.current && total > 0) {
        secondsRef.current = (secondsRef.current + dt * speedRef.current) % total;
      }
      const T = Math.min(Math.max(0, secondsRef.current), Math.max(0, total - 0.001));
      const binSeconds = current.stateTimeline.binSeconds;
      const bin = Math.floor(T / binSeconds);
      const wall = now / 1000;

      for (const ref of stationRefs) {
        const station = plant.stations[ref.station];
        const state: MachineState = current.stateTimelines[ref.line]?.rows[station.id]?.[bin] ?? "idle";
        ref.edges.color.setHex(C.edge[state]);
        ref.fill.color.setHex(C.body[state]);
        ref.lamp.color.setHex(C.edge[state]);
        const working = state === "busy" && playingRef.current;
        for (const m of ref.movers) {
          const offset = working ? Math.sin(wall * m.mover.rate + ref.line + ref.station) * m.mover.amplitude : 0;
          if (m.mover.axis === "x") m.mesh.position.x = m.base + offset;
          else m.mesh.position.y = m.base - Math.abs(offset);
        }
        if (ref.worker) ref.worker.rotation.y = working ? Math.sin(wall * 1.4 + ref.station * 2) * 0.5 : 0;
      }

      if (playingRef.current) cart.position.x = Math.sin(wall * 0.35) * cartReach;

      // Place every unit that is on the floor at second T.
      let n = 0;
      const put = (x: number, y: number, z: number, color: THREE.Color) => {
        if (n >= maxUnits) return;
        pose.position.set(x, y, z);
        pose.updateMatrix();
        unitMesh.setMatrixAt(n, pose.matrix);
        unitMesh.setColorAt(n, tint.copy(color));
        n++;
      };
      const trace = current.trace;
      const index = indexRef.current;
      if (trace) {
        const v = trace.visits;
        const w = trace.waits;
        for (let l = 0; l < lines; l++) {
          for (let i = 0; i < stationCount; i++) {
            const perMachine = index.byMachine[l]?.[i] ?? [];
            for (let m = 0; m < perMachine.length; m++) {
              const rows = perMachine[m];
              const at = lastAtOrBefore(rows, v.enter, T);
              if (at < 0) continue;
              const row = rows[at];
              const [px, pz] = padSlot(l, i, m);
              const leave = v.leave[row];
              if (leave < 0 || leave > T) {
                // On the machine now. Glide in over the first few seconds.
                const f = Math.min(1, (T - v.enter[row]) / GLIDE);
                const [ox, oz] = origin(l, i);
                const held = v.done[row] >= 0 && T >= v.done[row];
                put(ox + (px - ox) * f, 0.3, oz + (pz - oz) * f, held ? heldColor : kitColor);
              } else if (v.outcome[row] === VISIT_OUTCOME.exit && T < leave + GLIDE) {
                // A good unit leaving the last station.
                put(px + ((T - leave) / GLIDE) * 2.6, 0.3, pz, kitColor);
              } else if (v.outcome[row] === VISIT_OUTCOME.scrap && T < leave + GLIDE) {
                // A scrapped unit, set aside in red before it is removed.
                put(px, 0.3, pz + 0.6 + ((T - leave) / GLIDE) * 0.5, scrapColor);
              }
            }
            const waits = index.byBuffer[l]?.[i] ?? [];
            const target = topology.next[i];
            if (waits.length === 0 || target < 0) continue;
            const lastIn = lastAtOrBefore(waits, w.from, T);
            const sx = stationX(i);
            const sz = stationZ(l, i) + RAIL;
            const ex = stationX(target);
            const ez = stationZ(l, target) + RAIL;
            let waiting = 0;
            // The buffer is first in first out, so the units in it at T are
            // a run of rows ending at lastIn.
            for (let k = lastIn; k >= 0; k--) {
              const row = waits[k];
              if (w.to[row] >= 0 && w.to[row] <= T) break;
              waiting++;
            }
            for (let s = 0; s < waiting; s++) {
              const f = 0.3 + ((waiting - 1 - s + 0.5) * 0.45) / Math.max(1, bufferCapacity);
              put(sx + (ex - sx) * f, 0.3, sz + (ez - sz) * f, kitColor);
            }
          }
        }
      }
      unitMesh.count = n;
      unitMesh.instanceMatrix.needsUpdate = true;
      if (unitMesh.instanceColor) unitMesh.instanceColor.needsUpdate = true;

      controls.update();
      renderer.render(scene, camera);
      if (now - lastReport > 120) {
        lastReport = now;
        setSeconds(secondsRef.current);
        setUnitsShown(n);
      }
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      io.disconnect();
      controls.dispose();
      for (const item of disposables) item.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
    // The scene is rebuilt only when the floor layout, buffer size or theme
    // changes. Everything else is read fresh each frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, stationCount, layoutKey, theme, bufferCapacity]);

  const totalSeconds = sim.scheduledSeconds;
  const now = Math.min(Math.max(0, seconds), Math.max(0, totalSeconds - 1));
  const bin = Math.min(Math.max(0, totals.good.length - 1), Math.floor(now / 60));
  // Counts up to this second: whole minutes before it, plus the share of
  // the current minute that has played.
  const soFar = (running: number[], perMinute: number[]) =>
    (bin > 0 ? running[bin - 1] : 0) + (perMinute[bin] ?? 0) * ((now % 60) / 60);
  const good = soFar(totals.good, sim.flowByMinute.good);
  const scrap = soFar(totals.scrap, sim.flowByMinute.scrap);
  const plannedSoFar = sim.analytical.plantDemandPerHour * (now / 3600);
  const bottleneck = plant.stations.find((s) => s.id === sim.bottleneckStationId);
  const unitNoun = plant.hall?.unitNounPlural ?? "units";

  return (
    <section className="twin" aria-label="Floor twin of the simulated shift">
      <div className="twin-canvas" ref={mountRef} aria-hidden="true" />

      <div className="twin-chip twin-tl">
        <span className="cell-label">FLOOR TWIN / CREW {shift.crew} / REPLAY</span>
        <b className="twin-clock">{clock(shift, now)}</b>
        <span className="twin-sub">
          {lines} {lines === 1 ? "line" : "lines"}, {stationCount} stations
          {bottleneck ? `, bottleneck ${bottleneck.id} ${bottleneck.name}` : ""}
        </span>
      </div>

      <div className="twin-tr">
        <button
          type="button"
          className="crew-btn"
          onClick={() => setPlaying((p) => !p)}
          aria-pressed={playing}
        >
          {playing ? "Pause" : "Play"}
        </button>
        <div className="twin-speeds" role="group" aria-label="Playback speed, simulated seconds per second">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              className={s === speed ? "crew-btn active" : "crew-btn"}
              aria-pressed={s === speed}
              onClick={() => setSpeed(s)}
            >
              {s}x
            </button>
          ))}
        </div>
        <div className="twin-speeds" role="group" aria-label="Camera view">
          {VIEWS.map((view) => (
            <button key={view.id} type="button" className="crew-btn" onClick={() => viewRef.current(view.id)}>
              {view.label}
            </button>
          ))}
        </div>
      </div>

      <div className="twin-chip twin-bl">
        <div>
          <b>{fmtInt(good)}</b>
          <span className="cell-label">GOOD</span>
        </div>
        <div>
          <b>{fmtInt(plannedSoFar)}</b>
          <span className="cell-label">PLAN BY NOW</span>
        </div>
        <div>
          <b>{fmtInt(scrap)}</b>
          <span className="cell-label">SCRAP</span>
        </div>
        <div>
          <b>{fmtInt(unitsShown)}</b>
          <span className="cell-label">ON FLOOR</span>
        </div>
      </div>

      <div className="twin-bc">
        <label className="cell-label" htmlFor="twin-scrub">
          SHIFT TIME
        </label>
        <input
          id="twin-scrub"
          type="range"
          min={0}
          max={Math.max(0, totalSeconds - 60)}
          step={60}
          value={Math.floor(now / 60) * 60}
          onChange={(e) => {
            secondsRef.current = Number(e.target.value);
            setSeconds(secondsRef.current);
            setPlaying(false);
          }}
        />
        <div className="legend" aria-hidden="true">
          <span>
            <i className="sw sw-edge-busy" /> running
          </span>
          <span>
            <i className="sw sw-edge-blocked" /> blocked
          </span>
          <span>
            <i className="sw sw-edge-down" /> down
          </span>
          <span>
            <i className="sw sw-edge-idle" /> idle or starved
          </span>
        </div>
      </div>

      <div className={basisOpen ? "twin-chip twin-br open" : "twin-chip twin-br"}>
        <button
          type="button"
          className="twin-basis-toggle"
          aria-expanded={basisOpen}
          onClick={() => setBasisOpen((o) => !o)}
        >
          Model basis
        </button>
        {basisOpen && (
          <div className="twin-basis">
            <p>
              The {plant.hall?.label.toLowerCase() ?? "hall"} is fictional, not a model of any real
              plant. Material flow is deterministic and seeded. Every small box is one simulated{" "}
              {plant.hall?.unitNoun ?? "unit"}, placed from the simulator's own record of where it
              was at that second. A violet box is finished and waiting for room downstream. A red
              box was scrapped.
            </p>
            <p>
              Playback speed is simulated seconds per second: 30x suits watching single {unitNoun},
              3600x plays one hour each second. Machine outlines and stack lights show each
              station's state, one minute per step.
            </p>
            <p>
              Cycle times, yields, downtime and buffer sizes are planning assumptions, not measured
              performance. In the model a transfer takes no time, so the short glide between
              stations is an illustration, as are the workers, the cart, the moving machine parts, the
              station shapes and the floor spacing.
            </p>
            <p>Unofficial fan or learning project, not affiliated with SpaceX.</p>
          </div>
        )}
      </div>
    </section>
  );
}
