"use client";

import { useEffect, useRef } from "react";
import type { ReplayFrame } from "@/types/bci";

const WINDOW_FRAMES = 128;

export function EegCanvas({
  frames,
  frameIndex,
  channels,
}: {
  frames: ReplayFrame[];
  frameIndex: number;
  channels: string[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);

      const start = Math.max(0, frameIndex - WINDOW_FRAMES + 1);
      const visible = frames.slice(start, frameIndex + 1);
      const plotLeft = 38;
      const plotWidth = Math.max(1, rect.width - plotLeft - 6);
      const rowHeight = rect.height / Math.max(channels.length, 1);

      for (let point = 0; point < visible.length; point += 1) {
        const label = visible[point]?.groundTruth;
        if (label === "rest") continue;
        const x =
          plotLeft + (point / Math.max(visible.length - 1, 1)) * plotWidth;
        const nextX =
          plotLeft +
          ((point + 1) / Math.max(visible.length - 1, 1)) * plotWidth;
        context.fillStyle =
          label === "left"
            ? "rgba(34,211,238,0.055)"
            : "rgba(251,191,36,0.055)";
        context.fillRect(x, 0, Math.max(1, nextX - x), rect.height);
      }

      context.lineWidth = 1;
      context.strokeStyle = "rgba(148,163,184,0.10)";
      for (let row = 0; row <= channels.length; row += 1) {
        const y = row * rowHeight;
        context.beginPath();
        context.moveTo(plotLeft, y);
        context.lineTo(rect.width, y);
        context.stroke();
      }
      for (let frame = 0; frame < WINDOW_FRAMES; frame += 16) {
        const x = plotLeft + (frame / (WINDOW_FRAMES - 1)) * plotWidth;
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, rect.height);
        context.stroke();
      }

      channels.forEach((channel, channelIndex) => {
        const center = rowHeight * (channelIndex + 0.5);
        const values = visible.map((frame) => frame.signal[channelIndex] ?? 0);
        const max = Math.max(...values.map((value) => Math.abs(value)), 0.5);
        const scale = (rowHeight * 0.34) / max;
        context.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
        context.textBaseline = "middle";
        context.fillStyle =
          channel === "C3"
            ? "#22d3ee"
            : channel === "C4"
              ? "#fbbf24"
              : "#7890aa";
        context.fillText(channel, 5, center);
        context.strokeStyle =
          channel === "C3"
            ? "#22d3ee"
            : channel === "C4"
              ? "#fbbf24"
              : "rgba(148,163,184,0.68)";
        context.lineWidth = channel === "C3" || channel === "C4" ? 1.35 : 0.8;
        context.beginPath();
        values.forEach((value, point) => {
          const x =
            plotLeft + (point / Math.max(values.length - 1, 1)) * plotWidth;
          const y = center - value * scale;
          if (point === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.stroke();
      });
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [channels, frameIndex, frames]);

  return (
    <canvas
      ref={canvasRef}
      className="size-full min-h-0"
      role="img"
      aria-label="Sixteen channel EEG signal trace for the most recent eight seconds"
    />
  );
}
