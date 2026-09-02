/**
 * Phase 1 OpenAPI surface. This stays intentionally narrow until FastAPI
 * publishes the complete v1 schema; later generated types extend this file.
 */
export interface AiHealthResponse {
  service: string;
  status: "ready" | "configuration_required";
  missingConfiguration: string[];
}

export interface paths {
  "/health": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": AiHealthResponse;
          };
        };
      };
    };
  };
}
