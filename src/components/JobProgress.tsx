"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/client";
import { Progress } from "./ui";

type Job = { id: string; status: string; progress: number; total: number; error: string | null; result: Record<string, number> | null };

export function JobProgress({ jobId, label, onDone }: { jobId: string; label: string; onDone?: (j: Job) => void }) {
  const [job, setJob] = useState<Job | null>(null);
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const j = await api<Job>(`/api/jobs/${jobId}`);
        if (stop) return;
        setJob(j);
        if (j.status === "DONE" || j.status === "ERROR") {
          onDone?.(j);
          return;
        }
      } catch {}
      if (!stop) setTimeout(tick, 1500);
    };
    tick();
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);
  if (!job || job.status === "DONE") return null;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-brand/20 bg-brand/5 px-3 py-2 text-sm">
      {job.status === "ERROR" ? (
        <span className="text-red-600">{label} failed: {job.error}</span>
      ) : (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-brand" />
          <span className="whitespace-nowrap">{label}{job.status === "QUEUED" ? " (queued)" : ""} {job.total ? `${job.progress}/${job.total}` : ""}</span>
          {job.total > 0 && <div className="w-40"><Progress value={job.progress} max={job.total} /></div>}
        </>
      )}
    </div>
  );
}
