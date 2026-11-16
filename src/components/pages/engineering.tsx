"use client";
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button, PageHeader } from "@/components/ui";
import { ModuleTabs } from "@/components/module";
import { ResourceManager } from "@/components/resource-manager";
import { ProjectProfile } from "@/components/profiles";

export function EngineeringPage() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <PageHeader title="Engineering & Products" subtitle="What you built, and the products and projects it belongs to." />
      <ModuleTabs fallback="achievements" tabs={[{ id: "achievements", label: "Achievements" }, { id: "projects", label: "Projects & products" }]}>
        {(tab) => tab === "achievements"
          ? <ResourceManager resource="achievements" />
          : <ResourceManager resource="projects" rowActions={(p) => <Button className="min-h-[32px] px-2 py-1 text-xs" onClick={() => setOpen(p.id)}><ExternalLink className="h-3.5 w-3.5" />Open</Button>} />}
      </ModuleTabs>
      <ProjectProfile id={open} onClose={() => setOpen(null)} />
    </>
  );
}
