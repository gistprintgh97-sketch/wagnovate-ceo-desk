"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";
import { ghs } from "@/lib/money";
import { useReducedMotion, useThemeColors } from "@/lib/use-theme-colors";

export type GlobeCustomer = { id: string; name: string; location: string; place: string; lat: number; lng: number; status: string; outstanding: number; paid: number };
type Hub = { name: string; lat: number; lng: number };
const RAD = Math.PI / 180;

/** Dotted land points (lat, lng) built once from the world-atlas land outline. */
async function buildLandDots(): Promise<[number, number][]> {
  const [{ geoContains }, topo, atlas] = await Promise.all([import("d3-geo"), import("topojson-client"), import("world-atlas/land-110m.json")]);
  const tj = atlas.default as unknown as { objects: { land: never } };
  const land = topo.feature(tj as never, tj.objects.land);
  const dots: [number, number][] = [];
  const step = 2.4;
  for (let lat = -78; lat <= 84; lat += step) {
    const dLng = step / Math.max(0.2, Math.cos(lat * RAD));
    for (let lng = -180; lng < 180; lng += dLng) if (geoContains(land as never, [lng, lat])) dots.push([lat, lng]);
  }
  return dots;
}

function toVec(lat: number, lng: number): [number, number, number] {
  const la = lat * RAD, lo = lng * RAD;
  return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
}

export function Globe({ hub, customers, unplotted }: { hub: Hub; customers: GlobeCustomer[]; unplotted: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const colors = useThemeColors();
  const reduced = useReducedMotion();
  const [selected, setSelected] = useState<GlobeCustomer | null>(null);
  const [dots, setDots] = useState<[number, number][]>([]);
  const st = useRef({ lng: hub.lng, lat: 12, vLng: 0, drag: false, lastX: 0, lastY: 0, moved: 0, hover: false, hit: [] as { x: number; y: number; c: GlobeCustomer | "hub" }[] });
  const live = useRef({ colors, customers, selected, hub, dots, reduced });
  live.current = { colors, customers, selected, hub, dots, reduced };

  useEffect(() => { buildLandDots().then(setDots).catch(() => setDots([])); }, []);

  useEffect(() => {
    const canvas = cv.current!, box = wrap.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0, w = 0, h = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = box.clientWidth; h = box.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(box);

    const frame = (time: number) => {
      const { colors: c, customers: cs, selected: sel, hub: hb, dots: pts, reduced: rm } = live.current;
      const s = st.current;
      if (!s.drag) {
        if (Math.abs(s.vLng) > 0.002) { s.lng += s.vLng; s.vLng *= 0.95; }
        else if (!rm && !s.hover && !sel) s.lng += 0.06;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const R = Math.min(w, h) * 0.46, cx = w / 2, cy = h / 2;
      const phi0 = s.lat * RAD, lam0 = s.lng * RAD;
      const sp = Math.sin(phi0), cp = Math.cos(phi0);
      // returns screen x, y and depth (>0 = facing us) for a unit vector (x east, y north, z toward lng 0)
      const proj = (v: [number, number, number], scale = 1) => {
        const x1 = v[0] * Math.cos(lam0) - v[2] * Math.sin(lam0), z1 = v[0] * Math.sin(lam0) + v[2] * Math.cos(lam0);
        const y2 = v[1] * cp - z1 * sp, z2 = v[1] * sp + z1 * cp;
        return { x: cx + x1 * R * scale, y: cy - y2 * R * scale, z: z2 };
      };
      // note: rotating by -lng so that s.lng is the longitude facing the viewer
      const rot = (v: [number, number, number]) => proj([v[0], v[1], v[2]]);

      // sphere body + atmosphere glow
      const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
      g.addColorStop(0, c.rgba("accent", 0.2)); g.addColorStop(0.75, c.rgba("accent", 0.07)); g.addColorStop(1, c.rgba("accent", 0.14));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = c.rgba("cyan", 0.45); ctx.lineWidth = 1.2; ctx.shadowColor = c.rgba("accent", 0.8); ctx.shadowBlur = 18; ctx.stroke(); ctx.shadowBlur = 0;

      // graticule
      ctx.strokeStyle = c.rgba("accent", 0.1); ctx.lineWidth = 0.6;
      for (let lat = -60; lat <= 60; lat += 30) { ctx.beginPath(); let open = false; for (let lng = -180; lng <= 180; lng += 6) { const p = rot(toVec(lat, lng)); if (p.z > 0) { open ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); open = true; } else open = false; } ctx.stroke(); }
      for (let lng = -180; lng < 180; lng += 30) { ctx.beginPath(); let open = false; for (let lat = -90; lat <= 90; lat += 6) { const p = rot(toVec(lat, lng)); if (p.z > 0) { open ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); open = true; } else open = false; } ctx.stroke(); }

      // land dots
      const base = Math.max(1.1, R / 120);
      for (const [lat, lng] of pts) {
        const p = rot(toVec(lat, lng));
        if (p.z <= 0.02) continue;
        const sz = base * (0.7 + p.z * 0.6);
        ctx.fillStyle = c.rgba("cyan", 0.3 + 0.65 * p.z);
        ctx.beginPath(); ctx.arc(p.x, p.y, sz / 2, 0, Math.PI * 2); ctx.fill();
      }

      // arcs from the hub to each customer, with a travelling pulse
      const hv = toVec(hb.lat, hb.lng);
      const hits: typeof s.hit = [];
      const t = time / 1000;
      cs.forEach((cu, i) => {
        const v = toVec(cu.lat, cu.lng);
        const dot = hv[0] * v[0] + hv[1] * v[1] + hv[2] * v[2];
        const ang = Math.acos(Math.max(-1, Math.min(1, dot)));
        if (ang < 0.01) return;
        const isSel = sel?.id === cu.id;
        ctx.strokeStyle = isSel ? c.rgba("cyan", 0.95) : c.rgba("accent", 0.55); ctx.lineWidth = isSel ? 1.6 : 0.9;
        ctx.beginPath(); let open = false; const N = 40; let pulse: { x: number; y: number } | null = null;
        const pt = ((t * 0.25 + i * 0.17) % 1);
        for (let k = 0; k <= N; k++) {
          const f = k / N;
          const sinA = Math.sin(ang);
          const a = Math.sin((1 - f) * ang) / sinA, b = Math.sin(f * ang) / sinA;
          const m: [number, number, number] = [a * hv[0] + b * v[0], a * hv[1] + b * v[1], a * hv[2] + b * v[2]];
          const lift = 1 + 0.22 * Math.sin(Math.PI * f) * Math.min(1, ang / 1.2);
          const p = proj(m, lift);
          const vis = proj(m).z > -0.05;
          if (vis) { open ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); open = true; if (Math.abs(f - pt) < 1 / N) pulse = p; } else open = false;
        }
        ctx.stroke();
        if (pulse && !rm) { ctx.fillStyle = c.cyan; ctx.beginPath(); ctx.arc(pulse.x, pulse.y, 2, 0, Math.PI * 2); ctx.fill(); }
      });

      // customer markers
      for (const cu of cs) {
        const p = rot(toVec(cu.lat, cu.lng));
        if (p.z <= 0) continue;
        const col = cu.status === "CHURNED" ? c.bad : cu.status === "AT_RISK" || cu.outstanding > 0 ? c.warn : c.good;
        const isSel = sel?.id === cu.id;
        ctx.fillStyle = c.rgba("panel", 0.9); ctx.beginPath(); ctx.arc(p.x, p.y, isSel ? 6.5 : 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(p.x, p.y, isSel ? 4.5 : 3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        if (isSel || cs.length <= 8) { ctx.font = "600 11px Inter Variable, sans-serif"; ctx.fillStyle = c.fg; ctx.textAlign = "left"; ctx.fillText(cu.place, p.x + 9, p.y + 4); }
        hits.push({ x: p.x, y: p.y, c: cu });
      }
      // hub (Accra)
      const hp = rot(hv);
      if (hp.z > 0) {
        const pulseR = 6 + (rm ? 0 : 3 * (0.5 + 0.5 * Math.sin(t * 2.5)));
        ctx.strokeStyle = c.rgba("cyan", 0.5); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(hp.x, hp.y, pulseR + 4, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.shadowColor = c.cyan; ctx.shadowBlur = 16; ctx.beginPath(); ctx.arc(hp.x, hp.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        ctx.font = "700 12px Inter Variable, sans-serif"; ctx.fillStyle = c.fg; ctx.textAlign = "left"; ctx.fillText(`${hb.name} · HQ`, hp.x + 12, hp.y - 8);
        hits.push({ x: hp.x, y: hp.y, c: "hub" });
      }
      s.hit = hits;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  function down(e: React.PointerEvent) {
    const s = st.current; s.drag = true; s.lastX = e.clientX; s.lastY = e.clientY; s.moved = 0; s.vLng = 0;
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    const s = st.current;
    if (!s.drag) return;
    const dx = e.clientX - s.lastX, dy = e.clientY - s.lastY;
    s.moved += Math.abs(dx) + Math.abs(dy);
    s.lng -= dx * 0.3; s.lat = Math.max(-70, Math.min(70, s.lat + dy * 0.25)); s.vLng = -dx * 0.12;
    s.lastX = e.clientX; s.lastY = e.clientY;
  }
  function up(e: React.PointerEvent) {
    const s = st.current; s.drag = false;
    if (s.moved < 5) {
      const r = cv.current!.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
      const hit = s.hit.map((h) => ({ h, d: Math.hypot(h.x - x, h.y - y) })).filter((o) => o.d < 16).sort((a, b) => a.d - b.d)[0];
      if (hit && hit.h.c !== "hub") setSelected(hit.h.c); else setSelected(null);
    }
  }
  const focusOn = (cu: GlobeCustomer) => { setSelected(cu); st.current.lng = cu.lng; st.current.lat = Math.max(-50, Math.min(50, cu.lat * 0.6)); st.current.vLng = 0; };

  return (
    <div>
      <div ref={wrap} className="relative aspect-[4/3] w-full min-h-[260px] touch-pan-y sm:aspect-[16/10] xl:aspect-[16/11]">
        <canvas ref={cv} role="img" aria-label={`Globe showing ${customers.length} customer locations connected to ${hub.name}. Drag to rotate, click a marker for details.`}
          className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { st.current.drag = false; }}
          onPointerEnter={() => { st.current.hover = true; }} onPointerLeave={() => { st.current.hover = false; }} />
        {!customers.length && (
          <div className="pointer-events-none absolute inset-x-4 bottom-3 rounded-lg border border-line bg-panel/90 p-2.5 text-center text-xs text-muted">
            No customer locations yet. Add customers with a location such as “Kumasi, Ghana” and they appear here.
          </div>
        )}
        {selected && (
          <div className="absolute right-2 top-2 w-60 rounded-xl border border-line bg-panel/95 p-3 text-sm shadow-soft backdrop-blur" role="dialog" aria-label={`${selected.name} details`}>
            <button aria-label="Close details" className="absolute right-2 top-2 text-muted hover:text-fg" onClick={() => setSelected(null)}><X className="h-4 w-4" /></button>
            <p className="pr-5 font-semibold">{selected.name}</p>
            <p className="text-xs text-muted">{selected.location}</p>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div><dt className="eyebrow">Paid</dt><dd className="num">{ghs(selected.paid)}</dd></div>
              <div><dt className="eyebrow">Outstanding</dt><dd className={`num ${selected.outstanding > 0 ? "text-warn" : ""}`}>{ghs(selected.outstanding)}</dd></div>
            </dl>
            <Link href={`/customers?customer=${selected.id}`} className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline">Open customer profile<ArrowUpRight className="h-3 w-3" /></Link>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line/60 px-1 pt-2 text-xs text-muted">
        <span>Hub <b className="num text-accent">1</b></span>
        <span>Customers plotted <b className="num text-accent">{customers.length}</b></span>
        {unplotted > 0 && <span title="These customers have no location, or a location the map does not know yet">Not plotted <b className="num text-warn">{unplotted}</b></span>}
        <span className="ml-auto hidden sm:inline">Drag to rotate · click a marker to drill down</span>
      </div>
      {customers.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Customer locations">
          {customers.slice(0, 12).map((cu) => (
            <li key={cu.id}><button onClick={() => focusOn(cu)} className={`rounded-md border px-2 py-1 text-[11px] transition ${selected?.id === cu.id ? "border-accent bg-accent/15" : "border-line text-muted hover:text-fg"}`}>{cu.name} · {cu.place}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
