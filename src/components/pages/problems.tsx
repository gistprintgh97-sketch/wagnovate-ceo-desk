"use client";
import { PageHeader } from "@/components/ui";
import { ModuleTabs } from "@/components/module";
import { ResourceManager } from "@/components/resource-manager";
import { iso, today } from "@/lib/dates";

export function ProblemsPage() {
  return (
    <>
      <PageHeader title="Problems & Lessons" subtitle="What is blocking progress, and what each week taught you." />
      <ModuleTabs fallback="problems" tabs={[{ id: "problems", label: "Problems & bottlenecks" }, { id: "lessons", label: "Lessons library" }]}>
        {(tab) => tab === "problems"
          ? <ResourceManager resource="problems" defaults={{ identifiedAt: iso(today()) }} />
          : <ResourceManager resource="lessons" defaults={{ date: iso(today()) }} addLabel="Add lesson" />}
      </ModuleTabs>
    </>
  );
}
