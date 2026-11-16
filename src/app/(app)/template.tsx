"use client";
import type { ReactNode } from "react";
import { motion } from "framer-motion";

// A template re-mounts on every navigation, so each menu tab fades and slides in with a soft spring.
export default function Template({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.8 }}>
      {children}
    </motion.div>
  );
}
