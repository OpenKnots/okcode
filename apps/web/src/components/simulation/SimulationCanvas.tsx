import { useCallback, useEffect, useRef } from "react";

import { cn } from "~/lib/utils";
import { useSimulationViewerStore } from "~/simulationViewerStore";

/**
 * The main simulation rendering surface.
 *
 * Uses a `<canvas>` element scaled to fill the available space. A
 * lightweight demo scene is drawn (grid + bouncing entities) so the
 * viewer is immediately usable before a real simulation backend is
 * wired in.
 */
export function SimulationCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef(0);

  const zoom = useSimulationViewerStore((s) => s.zoom);
  const showGrid = useSimulationViewerStore((s) => s.showGrid);
  const showEntityLabels = useSimulationViewerStore((s) => s.showEntityLabels);
  const playbackState = useSimulationViewerStore((s) => s.playbackState);
  const entities = useSimulationViewerStore((s) => s.entities);
  const selectedEntityId = useSimulationViewerStore((s) => s.selectedEntityId);
  const selectEntity = useSimulationViewerStore((s) => s.selectEntity);

  // ── Resize canvas to fill container ────────────────────────────────
  const syncSize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = container.getBoundingClientRect();
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }, []);

  useEffect(() => {
    syncSize();
    const observer =
      typeof ResizeObserver !== "undefined" && containerRef.current
        ? new ResizeObserver(syncSize)
        : null;
    if (observer && containerRef.current) observer.observe(containerRef.current);
    return () => observer?.disconnect();
  }, [syncSize]);

  // ── Render loop ────────────────────────────────────────────────────
  useEffect(() => {
    let running = true;

    const draw = () => {
      if (!running) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Apply zoom
      ctx.save();
      const cx = w / 2;
      const cy = h / 2;
      ctx.translate(cx, cy);
      ctx.scale(zoom, zoom);
      ctx.translate(-cx, -cy);

      // ── Grid ──────────────────────────────────────────────────
      if (showGrid) {
        const gridSize = 40;
        ctx.strokeStyle = "rgba(128,128,128,0.12)";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (let x = 0; x <= w; x += gridSize) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
        }
        for (let y = 0; y <= h; y += gridSize) {
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
        }
        ctx.stroke();

        // Axis cross-hairs at center
        ctx.strokeStyle = "rgba(128,128,128,0.25)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, h);
        ctx.moveTo(0, cy);
        ctx.lineTo(w, cy);
        ctx.stroke();
      }

      // ── Entities ──────────────────────────────────────────────
      for (const entity of entities) {
        const isSelected = entity.id === selectedEntityId;
        const radius = 8;

        // Body
        ctx.fillStyle = isSelected ? "hsl(217, 91%, 60%)" : "hsl(217, 70%, 55%)";
        ctx.beginPath();
        ctx.arc(entity.x, entity.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Selection ring
        if (isSelected) {
          ctx.strokeStyle = "hsl(217, 91%, 75%)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(entity.x, entity.y, radius + 4, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Label
        if (showEntityLabels) {
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.font = "11px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(entity.label, entity.x, entity.y - radius - 6);
        }
      }

      // ── Paused overlay ────────────────────────────────────────
      if (playbackState === "paused") {
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "bold 16px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("PAUSED", cx, cy);
      }

      // ── Stopped placeholder ───────────────────────────────────
      if (playbackState === "stopped" && entities.length === 0) {
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.font = "14px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Press play to start simulation", cx, cy);
      }

      ctx.restore();

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [zoom, showGrid, showEntityLabels, playbackState, entities, selectedEntityId]);

  // ── Click-to-select entities ───────────────────────────────────────
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const hitRadius = 14;

      for (const entity of entities) {
        const dx = entity.x - x;
        const dy = entity.y - y;
        if (Math.sqrt(dx * dx + dy * dy) <= hitRadius) {
          selectEntity(entity.id);
          return;
        }
      }
      selectEntity(null);
    },
    [entities, selectEntity],
  );

  return (
    <div
      ref={containerRef}
      className={cn("relative min-h-0 min-w-0 flex-1 overflow-hidden bg-[#0c0c14]", className)}
    >
      <canvas ref={canvasRef} className="absolute inset-0 cursor-crosshair" onClick={handleClick} />
    </div>
  );
}
