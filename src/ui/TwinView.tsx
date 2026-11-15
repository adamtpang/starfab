import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { fmtInt } from "../lib/format";
import type { MachineState, Plant, ShiftPattern, SimResult } from "../types";

// The floor twin: every line and station of the simulated shift as a small
// isometric floor, replayed as a time-lapse. Machine outlines take the color
// of their simulated state. Kit motion on the conveyors is an illustration
// of flow, not a unit-accurate replay.

type Theme = "vacuum" | "studio";

interface Palette {
  lit: boolean; // studio uses soft lighting, vacuum is a flat drawing
  floor: number;
  floorEdge: number;
  rail: number;
  kit: number;
  label: string;
  labelDim: string;
  edge: Record<MachineState, number>;
  body: Record<MachineState, number>;
}

const PALETTES: Record<Theme, Palette> = {
  vacuum: {
    lit: false,
    floor: 0x071226,
    floorEdge: 0x2f7391,
    rail: 0x1d2a4d,
    kit: 0xffffff,
    label: "#a9c1f5",
    labelDim: "#7f9ad8",
    edge: { busy: 0x6fe0ff, blocked: 0xc7b3ff, down: 0xff5c6c, idle: 0x2f7391 },
    body: { busy: 0x0a2233, blocked: 0x1c1838, down: 0x33121a, idle: 0x0a1626 },
  },
  studio: {
    lit: true,
    floor: 0xf3f3f1,
    floorEdge: 0xb9c0c9,
    rail: 0xcfd4da,
    kit: 0x14607c,
    label: "#3a4250",
    labelDim: "#636c7a",
    edge: { busy: 0x5b6672, blocked: 0x6541d1, down: 0xcf2c3c, idle: 0xa9b2bd },
    body: { busy: 0xffffff, blocked: 0xd9cffa, down: 0xf5b9bf, idle: 0xe2e5e9 },
  },
};

const DX = 5; // spacing between stations along a line
const DZ = 4.6; // spacing between lines
const SPEEDS = [0.25, 1, 4];
const MINUTES_PER_SECOND = 60; // 1x plays one simulated hour per second

interface MachineRef {
  line: number;
  station: number;
  edges: THREE.LineBasicMaterial;
  fill: THREE.MeshBasicMaterial | THREE.MeshLambertMaterial;
  kit: THREE.Mesh | null; // kit travelling to the next station
  x: number;
  z: number;
}

// A few primitives per station, so each one reads as a different kind of
// work. Sizes are [width, height, depth] and positions are box centers.
function stationParts(index: number): { size: [number, number, number]; at: [number, number, number] }[] {
  switch (index % 6) {
    case 0: // kitting: three racks
      return [-0.9, 0, 0.9].map((z) => ({ size: [2.2, 1.5, 0.55], at: [0, 0.75, z] }));
    case 1: // electronics: bench and hood
      return [
        { size: [2.6, 0.8, 1.8], at: [0, 0.4, 0] },
        { size: [2.0, 0.5, 1.2], at: [0, 1.45, 0] },
        { size: [0.15, 0.6, 0.15], at: [-0.9, 1.0, 0] },
        { size: [0.15, 0.6, 0.15], at: [0.9, 1.0, 0] },
      ];
    case 2: // mechanical assembly: press with a tall column
      return [
        { size: [2.4, 0.9, 2.0], at: [0, 0.45, 0] },
        { size: [0.9, 2.2, 0.9], at: [-0.5, 2.0, -0.3] },
        { size: [1.4, 0.3, 1.2], at: [0.2, 2.6, -0.1] },
      ];
    case 3: // integration: gantry over a table
      return [
        { size: [2.4, 0.6, 1.8], at: [0, 0.3, 0] },
        { size: [0.25, 2.4, 0.25], at: [-1.2, 1.2, -1.0] },
        { size: [0.25, 2.4, 0.25], at: [1.2, 1.2, -1.0] },
        { size: [0.25, 2.4, 0.25], at: [-1.2, 1.2, 1.0] },
        { size: [0.25, 2.4, 0.25], at: [1.2, 1.2, 1.0] },
        { size: [2.9, 0.3, 2.5], at: [0, 2.55, 0] },
      ];
    case 4: // test: closed chamber
      return [
        { size: [2.6, 2.0, 2.2], at: [0, 1.0, 0] },
        { size: [0.8, 0.5, 0.8], at: [0, 2.25, 0] },
      ];
    default: // pack-out: table and stacked cartons
      return [
        { size: [2.6, 0.5, 1.8], at: [0, 0.25, 0] },
        { size: [0.8, 0.7, 0.8], at: [-0.7, 0.85, 0] },
        { size: [0.8, 0.7, 0.8], at: [0.3, 0.85, 0.2] },
        { size: [0.8, 0.7, 0.8], at: [-0.2, 1.55, 0.1] },
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

function clock(shift: ShiftPattern, minute: number): string {
  const [h, m] = shift.startClock.split(":").map(Number);
  const total = h * 60 + m + Math.floor(minute);
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
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
  const minuteRef = useRef(0);
  const playingRef = useRef(true);
  const speedRef = useRef(1);
  const resetViewRef = useRef<() => void>(() => {});

  const [minute, setMinute] = useState(0);
  const [playing, setPlaying] = useState(
    () => !(typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches),
  );
  const [speed, setSpeed] = useState(1);
  const [basisOpen, setBasisOpen] = useState(false);
  playingRef.current = playing;
  speedRef.current = speed;

  const lines = plant.parallelLines;
  const stationCount = plant.stations.length;
  const stationKey = plant.stations.map((s) => `${s.id}:${s.name}`).join("|");
  const totalMinutes = sim.flowByMinute.good.length;

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

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const C = PALETTES[theme];
    const solid = (color: number) => {
      const options = { color, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };
      return C.lit ? new THREE.MeshLambertMaterial(options) : new THREE.MeshBasicMaterial(options);
    };
    if (C.lit) {
      scene.add(new THREE.HemisphereLight(0xffffff, 0xc9ced6, 1.9));
      const sun = new THREE.DirectionalLight(0xffffff, 1.6);
      sun.position.set(20, 40, 10);
      scene.add(sun);
    }
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.minZoom = 0.6;
    controls.maxZoom = 4;
    controls.zoomToCursor = true;

    const floorW = stationCount * DX + 5;
    const floorD = lines * DZ + 4.5;
    const viewWidth = (floorW + floorD) * 0.74 + 2;

    const resetView = () => {
      camera.position.set(60, 52, 60);
      camera.zoom = 1;
      controls.target.set(0, 0.5, 0.6);
      controls.update();
      camera.updateProjectionMatrix();
    };
    resetViewRef.current = resetView;

    const disposables: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(item: T): T => {
      disposables.push(item);
      return item;
    };
    const outlined = (
      size: [number, number, number],
      at: [number, number, number],
      fill: THREE.Material,
      edge: THREE.Material,
      parent: THREE.Object3D,
    ) => {
      const geometry = track(new THREE.BoxGeometry(...size));
      const mesh = new THREE.Mesh(geometry, fill);
      mesh.position.set(...at);
      const outline = new THREE.LineSegments(track(new THREE.EdgesGeometry(geometry)), edge);
      mesh.add(outline);
      parent.add(mesh);
      return mesh;
    };

    // Floor slab.
    const floorFill = track(solid(C.floor));
    const floorEdge = track(new THREE.LineBasicMaterial({ color: C.floorEdge }));
    outlined([floorW, 0.4, floorD], [0, -0.2, 0], floorFill, floorEdge, scene);

    const railFill = track(solid(C.rail));
    const railEdge = track(new THREE.LineBasicMaterial({ color: C.edge.idle }));
    const kitFill = track(solid(C.kit));
    const kitGeometry = track(new THREE.BoxGeometry(0.42, 0.3, 0.42));

    const machines: MachineRef[] = [];
    const stationX = (i: number) => (i - (stationCount - 1) / 2) * DX;
    const lineZ = (l: number) => (l - (lines - 1) / 2) * DZ;

    for (let l = 0; l < lines; l++) {
      const z = lineZ(l);
      // Conveyor rail under the whole line.
      outlined([stationCount * DX - 1.2, 0.12, 0.5], [0, 0.06, z + 1.55], railFill, railEdge, scene);
      for (let i = 0; i < stationCount; i++) {
        const x = stationX(i);
        const edges = track(new THREE.LineBasicMaterial({ color: C.edge.idle }));
        const bodyFill = track(solid(C.body.idle));
        const group = new THREE.Group();
        group.position.set(x, 0, z - 0.3);
        for (const part of stationParts(i)) outlined(part.size, part.at, bodyFill, edges, group);
        scene.add(group);
        let kit: THREE.Mesh | null = null;
        if (i < stationCount - 1) {
          kit = new THREE.Mesh(kitGeometry, kitFill);
          kit.position.set(x, 0.3, z + 1.55);
          kit.visible = false;
          scene.add(kit);
        }
        machines.push({ line: l, station: i, edges, fill: bodyFill, kit, x, z });
      }
      const label = floorLabel(`LINE ${l + 1}`, 3.2, C.labelDim);
      label.position.set(-floorW / 2 + 2.0, 0.02, z + 2.25);
      scene.add(label);
      disposables.push((label.material as THREE.MeshBasicMaterial).map as THREE.Texture);
      disposables.push(label.material as THREE.Material, label.geometry);
    }
    plant.stations.forEach((s, i) => {
      const label = floorLabel(`${s.id} ${s.name.toUpperCase()}`, 4.4, C.label);
      label.position.set(stationX(i) + 0.2, 0.02, floorD / 2 - 0.7);
      scene.add(label);
      disposables.push((label.material as THREE.MeshBasicMaterial).map as THREE.Texture);
      disposables.push(label.material as THREE.Material, label.geometry);
    });

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
    resetView();

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
      const bins = current.flowByMinute.good.length;
      if (playingRef.current && bins > 0) {
        minuteRef.current = (minuteRef.current + dt * MINUTES_PER_SECOND * speedRef.current) % bins;
      }
      const bin = Math.min(bins - 1, Math.max(0, Math.floor(minuteRef.current)));
      const phase = (now / 1000) % 1.2 / 1.2;

      for (const m of machines) {
        const station = plant.stations[m.station];
        const row = current.stateTimelines[m.line]?.rows[station.id];
        const state: MachineState = row?.[bin] ?? "idle";
        m.edges.color.setHex(C.edge[state]);
        m.fill.color.setHex(C.body[state]);
        if (m.kit) {
          m.kit.visible = state === "busy";
          m.kit.position.x = m.x + phase * DX;
        }
      }

      controls.update();
      renderer.render(scene, camera);
      if (now - lastReport > 120) {
        lastReport = now;
        setMinute(minuteRef.current);
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
    // The scene is rebuilt only when the floor layout or the theme changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, stationCount, stationKey, theme]);

  const bin = Math.min(Math.max(0, totalMinutes - 1), Math.max(0, Math.floor(minute)));
  const good = totals.good[bin] ?? 0;
  const scrap = totals.scrap[bin] ?? 0;
  const wip = (totals.started[bin] ?? 0) - good - scrap;
  const plannedSoFar = sim.analytical.plantDemandPerHour * ((bin + 1) / 60);
  const bottleneck = plant.stations.find((s) => s.id === sim.bottleneckStationId);

  return (
    <section className="twin" aria-label="Floor twin of the simulated shift">
      <div className="twin-canvas" ref={mountRef} aria-hidden="true" />

      <div className="twin-chip twin-tl">
        <span className="cell-label">
          FLOOR TWIN / CREW {shift.crew} / TIME-LAPSE
        </span>
        <b className="twin-clock">{clock(shift, bin)}</b>
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
        <div className="twin-speeds" role="group" aria-label="Playback speed">
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
        <button type="button" className="crew-btn" onClick={() => resetViewRef.current()}>
          Reset view
        </button>
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
          <b>{fmtInt(wip)}</b>
          <span className="cell-label">WIP</span>
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
          max={Math.max(0, totalMinutes - 1)}
          step={1}
          value={bin}
          onChange={(e) => {
            minuteRef.current = Number(e.target.value);
            setMinute(minuteRef.current);
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
              A fictional teaching line, not a model of any real plant. Material flow is
              deterministic and seeded. Machine outlines show the simulated state of each
              station, one minute per step. At 1x, one second of playback is one simulated hour.
            </p>
            <p>
              Cycle times, yields, downtime and buffer sizes are planning assumptions, not
              measured performance. Kits moving on the conveyors illustrate flow and are not a
              unit-by-unit replay. Station shapes and floor spacing are illustrative.
            </p>
            <p>Unofficial fan or learning project, not affiliated with SpaceX.</p>
          </div>
        )}
      </div>
    </section>
  );
}
