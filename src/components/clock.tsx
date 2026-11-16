"use client";
import { useEffect, useState } from "react";

const tf = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Accra", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const df = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Accra", year: "numeric", month: "2-digit", day: "2-digit" });
const wf = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Accra", weekday: "long" });

/** Live clock in Africa/Accra. Renders after mount so server and browser never disagree. */
export function Clock({ compact }: { compact?: boolean }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!now) return <div className="h-9 w-28" aria-hidden />;
  return (
    <div className="text-right leading-tight" aria-label="Current time in Accra">
      <div className={compact ? "num text-sm font-semibold" : "num text-lg font-semibold tracking-wider text-fg"}>{tf.format(now)}</div>
      {!compact && <div className="num text-[10px] text-muted">{df.format(now)} {wf.format(now)}</div>}
    </div>
  );
}
