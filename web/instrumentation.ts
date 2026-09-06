// Optional metadata tracing uses the already-declared OpenTelemetry stack.
export async function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    !process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  )
    return;
  const [{ NodeSDK }, { OTLPTraceExporter }, { resourceFromAttributes }] =
    await Promise.all([
      import("@opentelemetry/sdk-node"),
      import("@opentelemetry/exporter-trace-otlp-proto"),
      import("@opentelemetry/resources"),
    ]);
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      "service.name": process.env.OTEL_SERVICE_NAME ?? "patch-web",
    }),
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    }),
  });
  sdk.start();
}
