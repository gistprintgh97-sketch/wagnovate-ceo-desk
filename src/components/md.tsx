import type { ReactNode } from "react";

function inline(text: string): ReactNode[] {
  return text.split("**").map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>));
}

/** Tiny, safe renderer for the summary text: "###" headings, "- " bullets, **bold**. No HTML is ever injected. */
export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = (k: number) => {
    if (bullets.length) {
      out.push(<ul key={`u${k}`} className="my-1 list-disc space-y-1 pl-5 text-sm">{bullets.map((b, i) => <li key={i}>{inline(b)}</li>)}</ul>);
      bullets = [];
    }
  };
  lines.forEach((l, i) => {
    const line = l.trimEnd();
    if (!line.trim()) { flush(i); return; }
    if (line.startsWith("### ")) { flush(i); out.push(<h3 key={i} className="mb-1 mt-4 text-sm font-semibold text-accent">{line.slice(4)}</h3>); }
    else if (line.startsWith("- ")) bullets.push(line.slice(2));
    else { flush(i); out.push(<p key={i} className="my-1 text-sm leading-relaxed">{inline(line)}</p>); }
  });
  flush(lines.length);
  return <div>{out}</div>;
}
