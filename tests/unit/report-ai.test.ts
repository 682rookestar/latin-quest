import { describe, expect, it } from "vitest";
import { getReportAiModels } from "@/lib/report-ai";

describe("report AI model configuration", () => {
  it("uses multiple free models by default", () => {
    expect(getReportAiModels({} as NodeJS.ProcessEnv)).toEqual([
      "inclusionai/ling-3.0-flash-vl-free",
      "typesafe-ai/jev",
      "inclusionai/ling-3.0-flash-fin-free",
    ]);
  });

  it("tries configured models first and removes duplicates", () => {
    expect(getReportAiModels({
      REPORT_AI_MODELS: "custom/first, inclusionai/ling-3.0-flash-vl-free",
      REPORT_AI_MODEL: "custom/legacy",
    } as NodeJS.ProcessEnv)).toEqual([
      "custom/first",
      "inclusionai/ling-3.0-flash-vl-free",
      "custom/legacy",
      "typesafe-ai/jev",
      "inclusionai/ling-3.0-flash-fin-free",
    ]);
  });
});
