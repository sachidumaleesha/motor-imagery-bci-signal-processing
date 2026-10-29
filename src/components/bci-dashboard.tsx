"use client";

import {
  ActivityIcon,
  BrainCircuitIcon,
  CircleGaugeIcon,
  FileUpIcon,
  HandIcon,
  MoonIcon,
  PauseIcon,
  PlayIcon,
  RefreshCcwIcon,
  RotateCcwIcon,
  SunIcon,
  WavesIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useTheme } from "next-themes";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LatencyChart } from "@/components/chart-area-ed-arrivals";
import { MotorPowerChart } from "@/components/chart-area-heart-rate";
import { EegCanvas } from "@/components/eeg-canvas";
import { Badge } from "@/components/ui/badge";
import { BodyMap } from "@/components/ui/body-map";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  DashboardAnalysis,
  DashboardManifest,
  DatasetMetadata,
  PredictionLabel,
  ReplayDataset,
  ReplayFrame,
  TrialEvent,
} from "@/types/bci";

const Brain = dynamic(
  () => import("@/components/brain").then((module) => module.Brain),
  {
    ssr: false,
    loading: () => (
      <Skeleton className="size-full min-h-40 rounded-xl bg-muted/40" />
    ),
  },
);

const SPEEDS = [0.5, 1, 2, 4] as const;
const WINDOW_FRAMES = 128;
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

const DATASET_SECTIONS: Array<{
  label: string;
  roles: DatasetMetadata["role"][];
  accent: string;
}> = [
  {
    label: "Verified replay",
    roles: ["verified-replay"],
    accent: "bg-cyan-400",
  },
  {
    label: "Training recordings",
    roles: ["training"],
    accent: "bg-violet-400",
  },
  {
    label: "Calibration",
    roles: ["calibration"],
    accent: "bg-slate-400",
  },
  {
    label: "Exploration only",
    roles: ["exploration"],
    accent: "bg-amber-400",
  },
];

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function predictionFromValue(
  value: number | null,
): Exclude<PredictionLabel, "rest"> | null {
  if (value === 0) return "left";
  if (value === 1) return "right";
  return null;
}

function BentoCard({
  title,
  subtitle,
  icon,
  action,
  className = "",
  contentClassName = "",
  children,
}: {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  action?: ReactNode;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <Card
      className={`bento-card min-h-0 gap-0 overflow-hidden rounded-2xl py-0 ${className}`}
    >
      <CardHeader className="flex min-h-12 flex-row items-center gap-2 border-b border-white/6 px-3 py-2">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate font-heading text-[13px] font-semibold tracking-tight">
            {title}
          </CardTitle>
          {subtitle && (
            <p className="truncate text-[10px] text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </CardHeader>
      <CardContent className={`min-h-0 flex-1 p-3 ${contentClassName}`}>
        {children}
      </CardContent>
    </Card>
  );
}

function EmptyPanel({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex size-full min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 text-center">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <p className="text-xs font-medium">{title}</p>
        <p className="mt-1 max-w-xs text-[10px] leading-relaxed text-muted-foreground">
          {text}
        </p>
      </div>
    </div>
  );
}

function StatChip({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "cyan" | "amber";
}) {
  return (
    <div className="hidden min-w-[86px] rounded-xl border border-border/70 bg-card/70 px-2.5 py-1.5 xl:block">
      <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-0.5 font-mono text-xs font-semibold tabular-nums ${tone === "cyan" ? "text-cyan-400" : tone === "amber" ? "text-amber-300" : "text-foreground"}`}
      >
        {value}
      </p>
    </div>
  );
}

export function BciDashboard({
  manifest,
  analysis,
}: {
  manifest: DashboardManifest;
  analysis: DashboardAnalysis;
}) {
  const [datasetId, setDatasetId] = useState("s001-r04");
  const [dataset, setDataset] = useState<ReplayDataset | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadDataset, setUploadDataset] = useState<ReplayDataset | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);
  const [brainFollows, setBrainFollows] = useState(true);
  const [inspectedBrainId, setInspectedBrainId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useTheme();
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => setThemeReady(true), []);

  useEffect(() => {
    if (datasetId === "upload" && uploadDataset) {
      setDataset(uploadDataset);
      setFrameIndex(0);
      setPlaying(false);
      return;
    }
    const metadata = manifest.datasets.find((item) => item.id === datasetId);
    if (!metadata?.dataUrl) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(metadata.dataUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load ${metadata.name}`);
        return response.json() as Promise<ReplayDataset>;
      })
      .then((value) => {
        setDataset(value);
        setFrameIndex(0);
        setPlaying(false);
        setBrainFollows(true);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError")
          return;
        setError(
          reason instanceof Error
            ? reason.message
            : "The recording could not be loaded.",
        );
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [datasetId, manifest.datasets, uploadDataset]);

  useEffect(() => {
    if (!playing || !dataset) return;
    let animationFrame = 0;
    let previous = performance.now();
    let accumulated = 0;
    const tick = (now: number) => {
      accumulated += (now - previous) * speed;
      previous = now;
      const steps = Math.floor(accumulated / dataset.frameIntervalMs);
      if (steps > 0) {
        accumulated -= steps * dataset.frameIntervalMs;
        setFrameIndex((current) => {
          const next = Math.min(current + steps, dataset.frames.length - 1);
          if (next >= dataset.frames.length - 1) setPlaying(false);
          return next;
        });
      }
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [dataset, playing, speed]);

  const currentFrame = dataset?.frames[frameIndex];
  const currentPrediction = predictionFromValue(
    currentFrame?.smoothedPrediction ?? null,
  );
  const scoredPrediction =
    currentFrame?.groundTruth !== "rest" ? currentPrediction : null;
  const predictionText = !dataset?.capabilities.verifiedPredictions
    ? "Preview only"
    : currentFrame?.groundTruth === "rest"
      ? "Not scored"
      : currentPrediction
        ? `${currentPrediction[0]?.toUpperCase()}${currentPrediction.slice(1)}`
        : "Warming up";
  const bodySelection = scoredPrediction ? [`${scoredPrediction}-palm`] : [];
  const automaticBrainId =
    scoredPrediction === "left"
      ? "right-frontal"
      : scoredPrediction === "right"
        ? "left-frontal"
        : null;
  const selectedBrainId = brainFollows ? automaticBrainId : inspectedBrainId;

  const visibleFrames = useMemo(
    () =>
      dataset?.frames.slice(
        Math.max(0, frameIndex - WINDOW_FRAMES + 1),
        frameIndex + 1,
      ) ?? [],
    [dataset, frameIndex],
  );
  const powerData = visibleFrames.map((frame) => ({
    time: frame.t,
    c3Mu: frame.power[0],
    c4Mu: frame.power[1],
    c3Beta: frame.power[2],
    c4Beta: frame.power[3],
  }));
  const latencyData = visibleFrames.flatMap((frame) =>
    frame.latencyMs == null
      ? []
      : [{ time: frame.t, latency: frame.latencyMs }],
  );

  async function handleUpload(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".edf")) {
      setError("Choose an EDF or EDF+ file.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("The EDF file is larger than the 100 MB local preview limit.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const { blobSource, openEdf, readAnnotations, readWindow, toPhysical } =
        await import("edfcore");
      const recording = await openEdf(blobSource(file));
      const signalIndices = recording.header.dataSignalIndices.slice(0, 16);
      if (signalIndices.length === 0)
        throw new Error("This EDF file has no data signals.");
      const signals = signalIndices.map(
        (index) => recording.header.signals[index],
      );
      if (signals.some((signal) => !signal))
        throw new Error("This EDF file has incomplete signal metadata.");
      const previewSeconds = Math.min(8, recording.timeline.spanSeconds);
      const chunks = await readWindow(recording, {
        signalIndices,
        startSeconds: 0,
        durationSeconds: previewSeconds,
      });
      const chunk = chunks[0];
      if (!chunk)
        throw new Error(
          "The first eight seconds of this EDF file contain no samples.",
        );
      const physical = chunk.signals.map((chunkSignal, index) => {
        const signal = signals[index];
        if (!signal)
          throw new Error("This EDF file has incomplete signal metadata.");
        const values = toPhysical(signal, chunkSignal.digital);
        const unit = signal.unit.toLowerCase();
        const factor = unit === "v" ? 1e6 : unit === "mv" ? 1e3 : 1;
        return Array.from(values, (value) => value * factor);
      });
      const previewFrames = Math.min(
        128,
        Math.max(2, Math.min(...physical.map((values) => values.length))),
      );
      let trials: TrialEvent[] = [];
      if (recording.header.annotationSignalIndices.length > 0) {
        const decoded = await readAnnotations(recording, {
          start: 0,
          count: recording.header.recordCount,
        });
        trials = decoded.annotations.flatMap((annotation) => {
          const label =
            annotation.text === "T1"
              ? "left"
              : annotation.text === "T2"
                ? "right"
                : null;
          return label
            ? [
                {
                  onset: annotation.onsetSecondsFromFirstRecord,
                  duration: annotation.durationSeconds ?? 0,
                  label,
                },
              ]
            : [];
        });
      }
      const frames: ReplayFrame[] = Array.from(
        { length: previewFrames },
        (_, index) => {
          const fraction = index / Math.max(previewFrames - 1, 1);
          const time = fraction * previewSeconds;
          const trial = trials.find(
            (item) => time >= item.onset && time <= item.onset + item.duration,
          );
          return {
            t: time,
            signal: physical.map(
              (values) =>
                values[
                  Math.min(
                    values.length - 1,
                    Math.round(fraction * (values.length - 1)),
                  )
                ] ?? 0,
            ),
            power: [0, 0, 0, 0],
            groundTruth: trial?.label ?? "rest",
            rawPrediction: null,
            smoothedPrediction: null,
            latencyMs: null,
            queueDrop: null,
          };
        },
      );
      const firstRate = signals[0]?.sampleRateHz ?? 0;
      const uploaded: ReplayDataset = {
        id: "upload",
        name: file.name,
        subject: "Local EDF",
        subjectCode: "LOCAL",
        run: 0,
        role: "upload",
        description: `Local-only preview of the first ${previewSeconds.toFixed(1)} seconds`,
        sourceFile: file.name,
        sampleRateHz: firstRate,
        frameIntervalMs:
          (previewSeconds * 1000) / Math.max(previewFrames - 1, 1),
        durationSeconds: previewSeconds,
        frameCount: frames.length,
        channels: signals.map((signal) => signal.label),
        capabilities: {
          waveform: true,
          annotations: trials.length > 0,
          verifiedPredictions: false,
          measuredLatency: false,
        },
        trials,
        frames,
      };
      setUploadDataset(uploaded);
      setDatasetId("upload");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "This EDF file could not be read.",
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (loading && !dataset) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
        Preparing verified EEG replay…
      </div>
    );
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-cyan-400/12 text-cyan-300 ring-1 ring-cyan-300/20">
            <BrainCircuitIcon className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-heading text-sm font-semibold tracking-tight sm:text-base">
              NeuroStream BCI
            </h1>
            <p className="hidden text-[10px] text-muted-foreground sm:block">
              Motor imagery signal processing
            </p>
          </div>
          <Badge
            variant="outline"
            className="hidden border-cyan-400/25 bg-cyan-400/8 text-[9px] tracking-[0.13em] text-cyan-300 md:inline-flex"
          >
            <span className="mr-1 size-1.5 rounded-full bg-cyan-300" /> RECORDED
            REPLAY
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={datasetId}
            onValueChange={(value) => setDatasetId(value)}
          >
            <SelectTrigger
              size="sm"
              className="max-w-[200px] border border-border/70 bg-card/80 sm:w-[200px]"
            >
              <SelectValue placeholder="Choose recording" />
            </SelectTrigger>
            <SelectContent
              position="popper"
              align="end"
              className="w-[248px] rounded-xl border border-border/80 bg-popover/96 p-1 shadow-2xl backdrop-blur-xl"
            >
              {DATASET_SECTIONS.map((section, sectionIndex) => {
                const items = manifest.datasets.filter((item) =>
                  section.roles.includes(item.role),
                );
                if (items.length === 0) return null;
                return (
                  <div key={section.label}>
                    {sectionIndex > 0 && (
                      <SelectSeparator className="mx-1 my-1" />
                    )}
                    <SelectGroup className="p-0.5">
                      <SelectLabel className="flex items-center gap-2 px-2 py-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
                        <span
                          className={`size-1.5 rounded-full ${section.accent}`}
                        />
                        {section.label}
                      </SelectLabel>
                      {items.map((item) => (
                        <SelectItem
                          key={item.id}
                          value={item.id}
                          className="rounded-lg py-1.5 pr-8 pl-2.5 text-xs data-[state=checked]:bg-cyan-400/10 data-[state=checked]:text-cyan-700 focus:bg-accent/70 dark:data-[state=checked]:text-cyan-300"
                        >
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </div>
                );
              })}
              {uploadDataset && (
                <>
                  <SelectSeparator className="mx-1 my-1" />
                  <SelectGroup className="p-0.5">
                    <SelectLabel className="flex items-center gap-2 px-2 py-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
                      <span className="size-1.5 rounded-full bg-emerald-400" />
                      Local preview
                    </SelectLabel>
                    <SelectItem
                      value="upload"
                      className="rounded-lg py-1.5 pr-8 pl-2.5 text-xs data-[state=checked]:bg-emerald-400/10 data-[state=checked]:text-emerald-700 dark:data-[state=checked]:text-emerald-300"
                    >
                      {uploadDataset.name}
                    </SelectItem>
                  </SelectGroup>
                </>
              )}
            </SelectContent>
          </Select>
          <input
            ref={fileInputRef}
            type="file"
            accept=".edf"
            className="hidden"
            onChange={(event) => void handleUpload(event.target.files?.[0])}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                aria-label="Upload EDF file"
              >
                {uploading ? (
                  <RefreshCcwIcon className="animate-spin" />
                ) : (
                  <FileUpIcon />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Preview an EDF locally</TooltipContent>
          </Tooltip>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Toggle color theme"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {themeReady && theme === "light" ? <MoonIcon /> : <SunIcon />}
          </Button>
        </div>
      </header>

      <section className="transport-bar" aria-label="Replay controls">
        <Button
          size="sm"
          className="h-8 min-w-20 rounded-xl"
          disabled={!dataset}
          onClick={() => setPlaying((value) => !value)}
        >
          {playing ? (
            <PauseIcon data-icon="inline-start" />
          ) : (
            <PlayIcon data-icon="inline-start" />
          )}
          {playing ? "Pause" : "Play"}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Restart replay"
          onClick={() => {
            setFrameIndex(0);
            setPlaying(false);
          }}
        >
          <RotateCcwIcon />
        </Button>
        <Select
          value={String(speed)}
          onValueChange={(value) =>
            setSpeed(Number(value) as (typeof SPEEDS)[number])
          }
        >
          <SelectTrigger
            size="sm"
            className="w-[72px] border border-border/60 bg-card/70"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SPEEDS.map((value) => (
              <SelectItem key={value} value={String(value)}>
                {value}×
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="w-9 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
          {formatTime(currentFrame?.t ?? 0)}
        </span>
        <Slider
          aria-label="Replay position"
          value={[frameIndex]}
          min={0}
          max={Math.max((dataset?.frames.length ?? 1) - 1, 0)}
          step={1}
          className="min-w-24 flex-1"
          onValueChange={(value) => {
            setPlaying(false);
            setFrameIndex(value[0] ?? 0);
          }}
        />
        <span className="w-9 font-mono text-[10px] tabular-nums text-muted-foreground">
          {formatTime(dataset?.durationSeconds ?? 0)}
        </span>
        <StatChip
          label="Prediction"
          value={predictionText}
          tone={
            scoredPrediction === "right"
              ? "amber"
              : scoredPrediction === "left"
                ? "cyan"
                : "default"
          }
        />
        <StatChip
          label="Latency"
          value={
            currentFrame?.latencyMs == null
              ? "—"
              : `${currentFrame.latencyMs.toFixed(3)} ms`
          }
        />
        <StatChip
          label="Drops"
          value={
            dataset?.capabilities.measuredLatency
              ? String(analysis.timing.simulated_queue_drops)
              : "—"
          }
        />
      </section>

      {error && (
        <div
          role="alert"
          className="fixed top-16 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-rose-400/30 bg-rose-950/95 px-4 py-2 text-xs text-rose-100 shadow-xl"
        >
          {error}
          <button
            type="button"
            className="ml-3 underline"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <section className="bento-grid">
        <BentoCard
          title="Live EEG stream"
          subtitle={`${dataset?.channels.length ?? 0} channels · 8–30 Hz display · last 8 seconds`}
          icon={<WavesIcon className="size-4" />}
          className="bento-eeg"
          action={
            <Badge variant="outline" className="font-mono text-[9px]">
              {dataset?.sampleRateHz ?? 0} Hz
            </Badge>
          }
          contentClassName="p-1.5"
        >
          {dataset ? (
            <EegCanvas
              frames={dataset.frames}
              frameIndex={frameIndex}
              channels={dataset.channels}
            />
          ) : (
            <Skeleton className="size-full" />
          )}
        </BentoCard>

        <BentoCard
          title="Body cue"
          subtitle="Classifier output"
          icon={<HandIcon className="size-4" />}
          className="bento-body"
          action={
            <Badge
              variant="outline"
              className={
                scoredPrediction === "left"
                  ? "border-cyan-400/30 text-cyan-300"
                  : scoredPrediction === "right"
                    ? "border-amber-400/30 text-amber-300"
                    : "text-muted-foreground"
              }
            >
              {predictionText}
            </Badge>
          }
          contentClassName="flex flex-col items-center justify-between gap-1 py-2"
        >
          {dataset?.capabilities.verifiedPredictions ? (
            <>
              <div className="flex w-full items-center justify-between rounded-lg bg-muted/30 px-2 py-1 text-[9px] text-muted-foreground">
                <span>Expected cue</span>
                <span
                  className={
                    currentFrame?.groundTruth === "left"
                      ? "text-cyan-300"
                      : currentFrame?.groundTruth === "right"
                        ? "text-amber-300"
                        : ""
                  }
                >
                  {currentFrame?.groundTruth === "rest"
                    ? "Rest"
                    : currentFrame?.groundTruth}
                </span>
              </div>
              <BodyMap
                views={["front"]}
                value={bodySelection}
                onValueChange={() => undefined}
                readOnly
                label="Predicted hand"
                className="body-cue-map mx-auto w-full max-w-[118px] gap-0 [&>div]:gap-0 [&_figcaption]:sr-only [&_p:not(.sr-only)]:hidden [&_svg]:max-w-[112px]"
                style={
                  {
                    "--primary":
                      scoredPrediction === "right"
                        ? "oklch(0.78 0.16 76)"
                        : "oklch(0.78 0.15 210)",
                  } as CSSProperties
                }
              />
              <output className="text-center text-[10px] text-muted-foreground">
                {scoredPrediction
                  ? `${scoredPrediction === "left" ? "Left" : "Right"} hand predicted`
                  : "No scored prediction"}
              </output>
            </>
          ) : (
            <EmptyPanel
              icon={<HandIcon className="size-5" />}
              title="Signal preview only"
              text={
                dataset?.role === "upload"
                  ? "Signal preview only - no verified classifier result for this file."
                  : "No verified model result exists for this recording."
              }
            />
          )}
        </BentoCard>

        <BentoCard
          title="Interactive brain"
          subtitle="Approximate contralateral hemisphere"
          icon={<BrainCircuitIcon className="size-4" />}
          className="bento-brain"
          action={
            dataset?.capabilities.verifiedPredictions ? (
              <Button
                variant={brainFollows ? "secondary" : "outline"}
                size="xs"
                className="h-6 px-2 text-[9px]"
                onClick={() => {
                  setBrainFollows(true);
                  setInspectedBrainId(null);
                }}
              >
                {brainFollows ? "Following" : "Resume live"}
              </Button>
            ) : null
          }
          contentClassName="relative p-1.5"
        >
          {dataset?.capabilities.verifiedPredictions ? (
            <>
              <Brain
                src="/models/brain.glb"
                selectedId={selectedBrainId}
                onSelectionChange={(id) => {
                  setBrainFollows(false);
                  setInspectedBrainId(id);
                }}
                defaultView="Superior"
                label="Interactive brain showing an approximate contralateral hemisphere"
                className="size-full min-h-0 rounded-xl"
              />
              <div className="pointer-events-none absolute right-2 bottom-2 left-2 rounded-lg bg-background/82 px-2 py-1 text-center text-[8px] leading-tight text-muted-foreground backdrop-blur">
                Educational view only · not an EEG source map
              </div>
            </>
          ) : (
            <EmptyPanel
              icon={<BrainCircuitIcon className="size-5" />}
              title="Brain automation unavailable"
              text="Uploaded and exploration files do not have verified predictions."
            />
          )}
        </BentoCard>

        <BentoCard
          title="C3 / C4 motor power"
          subtitle="Mu and beta rhythms"
          icon={<ActivityIcon className="size-4" />}
          className="bento-power"
          contentClassName="pb-2"
        >
          {dataset?.role === "upload" ? (
            <EmptyPanel
              icon={<ActivityIcon className="size-5" />}
              title="Band power unavailable"
              text="The local EDF preview shows signal samples only."
            />
          ) : (
            <MotorPowerChart data={powerData} />
          )}
        </BentoCard>

        <BentoCard
          title="Pipeline latency"
          subtitle="Filter + ICA + CSP + LDA + vote"
          icon={<CircleGaugeIcon className="size-4" />}
          className="bento-latency"
          action={
            dataset?.capabilities.measuredLatency ? (
              <Badge
                variant="outline"
                className="border-emerald-400/25 text-[9px] text-emerald-300"
              >
                PASS &lt; 15 ms
              </Badge>
            ) : null
          }
          contentClassName="flex flex-col pb-2"
        >
          {dataset?.capabilities.measuredLatency ? (
            <>
              <div className="mb-1 grid grid-cols-3 gap-2 text-[9px] text-muted-foreground">
                <span>
                  Mean{" "}
                  <b className="font-mono text-foreground">
                    {analysis.timing.mean_ms.toFixed(3)}
                  </b>
                </span>
                <span>
                  P95{" "}
                  <b className="font-mono text-foreground">
                    {analysis.timing.p95_ms.toFixed(3)}
                  </b>
                </span>
                <span>
                  Max{" "}
                  <b className="font-mono text-foreground">
                    {analysis.timing.max_ms.toFixed(3)}
                  </b>{" "}
                  ms
                </span>
              </div>
              <div className="min-h-0 flex-1">
                <LatencyChart data={latencyData} />
              </div>
            </>
          ) : (
            <EmptyPanel
              icon={<CircleGaugeIcon className="size-5" />}
              title="No measured latency"
              text="Timing is available only for the verified Subject 1 Run 04 replay."
            />
          )}
        </BentoCard>

        <BentoCard
          title="Session results"
          subtitle="Verified analysis, kept separate"
          icon={<CircleGaugeIcon className="size-4" />}
          className="bento-results"
          contentClassName="p-2"
        >
          {dataset?.role === "upload" ? (
            <EmptyPanel
              icon={<FileUpIcon className="size-5" />}
              title="Local signal preview"
              text="No classifier, CSP or latency result is claimed for this uploaded file."
            />
          ) : (
            <Tabs
              defaultValue="performance"
              className="size-full min-h-0 gap-1"
            >
              <TabsList className="h-7 w-full rounded-lg p-0.5">
                <TabsTrigger
                  value="performance"
                  className="rounded-md py-0.5 text-[10px]"
                >
                  Performance
                </TabsTrigger>
                <TabsTrigger
                  value="csp"
                  className="rounded-md py-0.5 text-[10px]"
                >
                  CSP patterns
                </TabsTrigger>
              </TabsList>
              <TabsContent value="performance" className="min-h-0">
                <div className="grid h-full grid-cols-2 gap-1.5">
                  {[
                    [
                      "LDA offline",
                      `${(analysis.cv.LDA.accuracy * 100).toFixed(1)}%`,
                      "10-fold OOF",
                    ],
                    [
                      "SVM offline",
                      `${(analysis.cv.SVM.accuracy * 100).toFixed(1)}%`,
                      "10-fold OOF",
                    ],
                    [
                      "Replay windows",
                      `${(analysis.stream.overlapping_window_accuracy * 100).toFixed(1)}%`,
                      "correlated windows",
                    ],
                    [
                      "Trial vote",
                      `${Math.round(analysis.stream.trial_accuracy * analysis.stream.trial_count)}/${analysis.stream.trial_count}`,
                      "small reserved run",
                    ],
                  ].map(([label, value, note]) => (
                    <div
                      key={label}
                      className="rounded-lg border border-border/60 bg-muted/20 p-2"
                    >
                      <p className="text-[9px] text-muted-foreground">
                        {label}
                      </p>
                      <p className="mt-0.5 font-mono text-base font-semibold tabular-nums">
                        {value}
                      </p>
                      <p className="text-[8px] text-muted-foreground">{note}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>
              <TabsContent
                value="csp"
                className="relative min-h-0 overflow-hidden rounded-lg bg-white/95"
              >
                <Image
                  src="/data/dashboard/csp-patterns.png"
                  alt="Verified CSP scalp pattern topographies"
                  fill
                  sizes="320px"
                  className="object-contain p-1"
                />
              </TabsContent>
            </Tabs>
          )}
        </BentoCard>
      </section>
    </main>
  );
}
