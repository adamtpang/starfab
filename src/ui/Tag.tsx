import type { ReactNode } from "react";

// Small provenance marks. Every seed number on screen carries one.
export function Assumption({ id }: { id: string }) {
  return (
    <span className="tag tag-assumption" title={`Seed value is an assumption (${id}), not plant data`}>
      ASSUMPTION {id}
    </span>
  );
}

export function Sourced({ children }: { children: ReactNode }) {
  return <span className="tag tag-sourced">{children}</span>;
}

export function Derived({ children = "derived" }: { children?: ReactNode }) {
  return <span className="tag tag-derived">{children}</span>;
}

export function ModelOutput() {
  return <span className="tag tag-derived">model output</span>;
}
