/**
 * Vite wiring for the agent-facing site files (see build.ts).
 */
import { prerenderIndexHtml, siteFiles } from "./build.ts";

interface EmitContext {
  emitFile: (file: { fileName: string; source: string; type: "asset" }) => unknown;
}

export function agentReadySite(): {
  generateBundle: (this: EmitContext) => void;
  name: string;
  transformIndexHtml: (html: string) => string;
} {
  return {
    generateBundle(this: EmitContext): void {
      for (const file of siteFiles()) this.emitFile({ ...file, type: "asset" });
    },
    name: "agent-ready-site",
    transformIndexHtml: prerenderIndexHtml,
  };
}
