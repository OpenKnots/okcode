"use client";

import { Link2, Plus, MoreHorizontal } from "lucide-react";

export function UIPanelDetail() {
  return (
    <div className="w-[380px] h-[580px] bg-zinc-900/95 backdrop-blur rounded-xl border border-zinc-800/80 shadow-2xl shadow-black/50 overflow-hidden">
      {/* Header breadcrumb */}
      <div className="px-4 py-3 border-b border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[12px]">
          <span className="text-zinc-500">Engineering</span>
          <span className="text-zinc-600">›</span>
          <span className="text-emerald-400">Spice harvester</span>
          <span className="text-zinc-600">›</span>
          <span className="text-zinc-300">ENG-135</span>
        </div>
        <MoreHorizontal className="w-4 h-4 text-zinc-500" />
      </div>

      {/* Content */}
      <div className="p-4 overflow-auto h-[calc(100%-48px)] scrollbar-hide">
        <h2 className="text-white text-xl font-semibold mb-4">Refactor sonic crawler</h2>

        {/* Code block mockup - styled like Linear's */}
        <div className="bg-zinc-950/80 rounded-lg p-4 text-[11px] font-mono mb-4 border border-zinc-800/50 space-y-2">
          <div>
            <span className="text-zinc-500">{"Comment."}</span>
            <span className="text-amber-300">{"documentContent"}</span>
            <span className="text-zinc-400">{" is defined wrongly. It should be a "}</span>
            <span className="text-cyan-300">LazyManyToOne</span>
            <span className="text-zinc-400">{" relation."}</span>
          </div>

          <div className="mt-3 text-zinc-600">
            {"/** The document content that this comment is associated with. */"}
          </div>
          <div>
            <span className="text-purple-400">{"@ManyToOne"}</span>
            <span className="text-zinc-400">{"(() => "}</span>
            <span className="text-cyan-300">{"DocumentContent"}</span>
            <span className="text-zinc-400">{", {"}</span>
            <span className="text-amber-300">{"comments"}</span>
            <span className="text-zinc-400">{", { "}</span>
            <span className="text-amber-300">{"cascade"}</span>
            <span className="text-zinc-400">{": "}</span>
            <span className="text-orange-300">{"true"}</span>
            <span className="text-zinc-400">{", "}</span>
            <span className="text-amber-300">{"nullable"}</span>
            <span className="text-zinc-400">{": "}</span>
            <span className="text-orange-300">{"false"}</span>
            <span className="text-zinc-400">{", "}</span>
            <span className="text-amber-300">{"indexed"}</span>
            <span className="text-zinc-400">{": "}</span>
            <span className="text-orange-300">{"true"}</span>
            <span className="text-zinc-400">{" })"}</span>
          </div>
          <div>
            <span className="text-blue-400">{"public "}</span>
            <span className="text-amber-300">{"documentContent"}</span>
            <span className="text-zinc-400">{"?: "}</span>
            <span className="text-cyan-300">{"DocumentContent"}</span>
            <span className="text-zinc-400">{";"}</span>
          </div>

          <div className="mt-3 text-zinc-400">
            {"We would be accessing "}
            <span className="text-emerald-400">{"CachedPromise<DocumentContent>"}</span>
            {" then, and document content would be hydrated, so we'd have to handle accessing"}
          </div>
          <div className="text-zinc-400">{"property touch."}</div>

          <div className="mt-2">
            <span className="text-amber-300">{"comment"}</span>
            <span className="text-zinc-400">{"."}</span>
            <span className="text-amber-300">{"documentContent"}</span>
            <span className="text-zinc-400">{"."}</span>
            <span className="text-amber-300">{"value"}</span>
            <span className="text-zinc-400">{" would still be undefined until hydrated"}</span>
          </div>
        </div>

        {/* Meta actions */}
        <div className="space-y-2 text-[13px] mb-4">
          <div className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors">
            <Plus className="w-4 h-4" />
            <span>Add sub-issues</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors">
            <Link2 className="w-4 h-4" />
            <span>Links</span>
          </div>
        </div>

        {/* PR reference */}
        <div className="text-[11px] text-zinc-500 mb-4">
          <span className="text-zinc-600">#20319</span>
          <span className="text-zinc-500">
            {" "}
            igor/eng-135 add source to insights slice and segment
          </span>
        </div>

        {/* Activity */}
        <div className="pt-3 border-t border-zinc-800/50">
          <div className="text-[11px] text-zinc-500 font-medium mb-3">Activity</div>
          <div className="flex items-start gap-2">
            <img src="https://i.pravatar.cc/24?img=1" alt="" className="w-6 h-6 rounded-full" />
            <div className="flex-1">
              <p className="text-zinc-400 text-[12px]">
                <span className="text-white">nan</span>
                <span className="text-zinc-500"> moved from </span>
                <span className="text-zinc-300">Backlog</span>
                <span className="text-zinc-500"> to </span>
                <span className="text-zinc-300">In Progress</span>
              </p>
              <p className="text-zinc-600 text-[11px] mt-0.5">5 months ago</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
