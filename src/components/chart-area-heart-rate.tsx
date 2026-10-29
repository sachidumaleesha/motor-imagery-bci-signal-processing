"use client";

import { useId, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export type MotorPowerPoint = {
  time: number;
  c3Mu: number;
  c4Mu: number;
  c3Beta: number;
  c4Beta: number;
};

const chartConfig = {
  c3: { label: "C3", color: "#22d3ee" },
  c4: { label: "C4", color: "#fbbf24" },
} satisfies ChartConfig;

export function MotorPowerChart({ data }: { data: MotorPowerPoint[] }) {
  const [band, setBand] = useState<"mu" | "beta">("mu");
  const gradientId = useId().replaceAll(":", "");
  const chartData = data.map((point) => ({
    time: point.time,
    c3: band === "mu" ? point.c3Mu : point.c3Beta,
    c4: band === "mu" ? point.c4Mu : point.c4Beta,
  }));

  return (
    <div className="flex size-full min-h-0 flex-col">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          Rolling 500 ms band power
        </p>
        <fieldset className="flex rounded-lg border-0 bg-muted/60 p-0.5">
          <legend className="sr-only">Frequency band</legend>
          {(["mu", "beta"] as const).map((value) => (
            <Button
              key={value}
              type="button"
              size="xs"
              variant={band === value ? "secondary" : "ghost"}
              className="h-6 px-2 uppercase"
              onClick={() => setBand(value)}
            >
              {value}
            </Button>
          ))}
        </fieldset>
      </div>
      <ChartContainer
        config={chartConfig}
        className="min-h-0 flex-1 aspect-auto w-full"
      >
        <AreaChart
          accessibilityLayer
          data={chartData}
          margin={{ left: -26, right: 6, top: 4, bottom: 0 }}
        >
          <CartesianGrid vertical={false} strokeOpacity={0.3} />
          <XAxis
            dataKey="time"
            tickLine={false}
            axisLine={false}
            minTickGap={28}
            tickFormatter={(value) => `${Number(value).toFixed(0)}s`}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => Number(value).toFixed(0)}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                indicator="line"
                labelFormatter={(value) =>
                  `${Number(value).toFixed(2)} seconds`
                }
              />
            }
          />
          <defs>
            <linearGradient id={`${gradientId}-c3`} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="var(--color-c3)"
                stopOpacity={0.45}
              />
              <stop
                offset="95%"
                stopColor="var(--color-c3)"
                stopOpacity={0.02}
              />
            </linearGradient>
            <linearGradient id={`${gradientId}-c4`} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="var(--color-c4)"
                stopOpacity={0.35}
              />
              <stop
                offset="95%"
                stopColor="var(--color-c4)"
                stopOpacity={0.02}
              />
            </linearGradient>
          </defs>
          <Area
            dataKey="c3"
            type="monotone"
            fill={`url(#${gradientId}-c3)`}
            stroke="var(--color-c3)"
            strokeWidth={1.7}
            isAnimationActive={false}
          />
          <Area
            dataKey="c4"
            type="monotone"
            fill={`url(#${gradientId}-c4)`}
            stroke="var(--color-c4)"
            strokeWidth={1.7}
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
