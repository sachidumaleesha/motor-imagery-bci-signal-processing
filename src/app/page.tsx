import { BciDashboard } from "@/components/bci-dashboard";
import type { DashboardAnalysis, DashboardManifest } from "@/types/bci";
import analysisJson from "../../public/data/dashboard/analysis.json";
import manifestJson from "../../public/data/dashboard/manifest.json";

export default function Home() {
  return (
    <BciDashboard
      manifest={manifestJson as unknown as DashboardManifest}
      analysis={analysisJson as unknown as DashboardAnalysis}
    />
  );
}
