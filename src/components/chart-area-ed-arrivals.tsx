"use client";

import { useId, useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Label,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export type LatencyPoint = { time: number; latency: number };

const chartConfig = {
  latency: { label: "Pipeline latency", color: "#a78bfa" },
} satisfies ChartConfig;

export function LatencyChart({ data }: { data: LatencyPoint[] }) {
  const gradientId = useId().replaceAll(":", "");
  const maxLatency = useMemo(
    () => Math.max(...data.map((point) => point.latency), 1),
    [data],
  );
  const displayMax = Math.max(2, Math.ceil(maxLatency * 12) / 10);

  return (
    <ChartContainer
      config={chartConfig}
      className="size-full min-h-0 aspect-auto"
    >
      <AreaChart
        accessibilityLayer
        data={data}
        margin={{ left: -28, right: 8, top: 10, bottom: 0 }}
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
          yAxisId="latency"
          tickLine={false}
          axisLine={false}
          domain={[0, displayMax]}
          tickFormatter={(value) => `${value}`}
        />
        <YAxis yAxisId="target" hide domain={[0, 15]} />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              indicator="line"
              labelFormatter={(value) => `${Number(value).toFixed(2)} seconds`}
              formatter={(value) => (
                <div className="flex w-full items-center justify-between gap-6">
                  <span className="text-muted-foreground">Latency</span>
                  <span className="font-mono font-medium tabular-nums">
                    {Number(value).toFixed(3)} ms
                  </span>
                </div>
              )}
            />
          }
        />
        <defs>
          <linearGradient
            id={`${gradientId}-latency`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="5%"
              stopColor="var(--color-latency)"
              stopOpacity={0.55}
            />
            <stop
              offset="95%"
              stopColor="var(--color-latency)"
              stopOpacity={0.04}
            />
          </linearGradient>
        </defs>
        <Area
          yAxisId="latency"
          dataKey="latency"
          type="monotone"
          fill={`url(#${gradientId}-latency)`}
          stroke="var(--color-latency)"
          strokeWidth={1.7}
          isAnimationActive={false}
        />
        <ReferenceLine
          yAxisId="target"
          y={15}
          stroke="#fb7185"
          strokeDasharray="4 4"
        >
          <Label
            value="15 ms target"
            position="insideTopRight"
            fill="#fb7185"
            fontSize={10}
          />
        </ReferenceLine>
      </AreaChart>
    </ChartContainer>
  );
}
