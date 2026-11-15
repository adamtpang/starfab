import type { ReactNode } from "react";

// A lettered drawing detail: caption bar on top, content below.
export function Detail({
  letter,
  title,
  note,
  span,
  children,
}: {
  letter: string;
  title: string;
  note?: ReactNode;
  span?: "wide" | "full";
  children: ReactNode;
}) {
  const id = `detail-${letter.toLowerCase()}`;
  return (
    <section className={span ? `detail detail-${span}` : "detail"} aria-labelledby={id}>
      <h2 id={id}>
        <span className="detail-letter">DETAIL {letter}</span>
        <span className="detail-title">{title}</span>
        {note && <span className="detail-note">{note}</span>}
      </h2>
      <div className="detail-body">{children}</div>
    </section>
  );
}
