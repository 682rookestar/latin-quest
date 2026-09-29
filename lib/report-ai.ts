const DEFAULT_REPORT_AI_MODELS = [
  "inclusionai/ling-3.0-flash-vl-free",
  "typesafe-ai/jev",
  "inclusionai/ling-3.0-flash-fin-free",
] as const;

function splitModels(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
}

export function getReportAiModels(env: NodeJS.ProcessEnv = process.env) {
  const configured = [
    ...splitModels(env.REPORT_AI_MODELS),
    ...splitModels(env.REPORT_AI_MODEL),
  ];

  return [...new Set([...configured, ...DEFAULT_REPORT_AI_MODELS])];
}
