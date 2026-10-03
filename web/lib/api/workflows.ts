import { api, post, patch, items, id } from "./http";
import type {
  AI,
  Log,
  ProcedureRecord,
  ProcedureVersion,
  Run,
  Schedule,
} from "./contracts";

const logPath = (projectId: string) =>
  `/api/projects/${id(projectId)}/maintenance-logs`;
export const listLogs = (projectId: string) => items<Log>(logPath(projectId));
export type LogInput = {
  scopeType: "PROJECT" | "EQUIPMENT";
  equipmentId: string | null;
  text: string;
  attachmentVersionIds: string[];
  citations: AI["Citation"][];
};
export const createLog = (projectId: string, input: LogInput) =>
  post<Log>(logPath(projectId), input);
export const draftLog = (projectId: string, input: LogInput) =>
  post<{
    status: string;
    draftText?: string | null;
    citations?: AI["Citation"][];
  }>(`${logPath(projectId)}/draft-helper`, input);
export const saveLog = (log: Log, text: string) =>
  patch<Log>(`${logPath(log.projectId)}/${id(log.id)}`, {
    expectedRevision: log.revision,
    text,
  });
export const submitLog = (log: Log) =>
  post<Log>(`${logPath(log.projectId)}/${id(log.id)}/submit`, {
    expectedRevision: log.revision,
  });
const procedurePath = (projectId: string) =>
  `/api/projects/${id(projectId)}/procedures`;
export const listProcedures = (projectId: string) =>
  api<{
    items: ProcedureRecord[];
    generationRequests: { id: string; status: string }[];
  }>(procedurePath(projectId));
export const listProcedureVersions = (projectId: string, procedureId: string) =>
  items<ProcedureVersion>(
    `${procedurePath(projectId)}/${id(procedureId)}/versions`,
  );
export const versionPath = (
  version: Pick<ProcedureVersion, "projectId" | "procedureId" | "id">,
) =>
  `${procedurePath(version.projectId)}/${id(version.procedureId)}/versions/${id(version.id)}`;
export const getProcedureVersion = (
  projectId: string,
  procedureId: string,
  key: string,
) => api<ProcedureVersion>(versionPath({ projectId, procedureId, id: key }));
export const saveProcedure = (version: ProcedureVersion) =>
  patch<ProcedureVersion>(versionPath(version), {
    expectedRevision: version.revision,
    title: version.title,
    steps: version.steps.map(
      ({ stepId, title, instructions, required, citationIds }) => ({
        stepId,
        title,
        instructions,
        required,
        citationIds,
      }),
    ),
    citations: version.citations,
  });
export const transitionProcedure = (
  version: ProcedureVersion,
  action: "revalidate" | "review" | "request-changes" | "approve" | "publish",
  acknowledgedReasons?: string[],
) =>
  post<ProcedureVersion>(`${versionPath(version)}/${action}`, {
    expectedRevision: version.revision,
    ...(action === "approve"
      ? {
          confirmHumanReview: true,
          acknowledgedReasons: acknowledgedReasons ?? [],
        }
      : {}),
  });
export const forkProcedure = (version: ProcedureVersion) =>
  post<ProcedureVersion>(`${versionPath(version)}/fork`);
export const regenerateProcedure = (
  projectId: string,
  procedureId: string,
  supplementalEquipmentDocumentIds?: string[],
) =>
  post(
    `${procedurePath(projectId)}/${id(procedureId)}/regenerate`,
    supplementalEquipmentDocumentIds
      ? { supplementalEquipmentDocumentIds }
      : {},
  );
export const scheduleProcedure = (
  projectId: string,
  procedureId: string,
  schedule: Schedule,
) => post(`${procedurePath(projectId)}/${id(procedureId)}/schedule`, schedule);
export const listRuns = (projectId: string, procedureId: string) =>
  items<Run>(`${procedurePath(projectId)}/${id(procedureId)}/runs`);
export const createRun = (projectId: string, procedureId: string) =>
  post<Run>(`${procedurePath(projectId)}/${id(procedureId)}/runs`);
export const getRun = (key: string) =>
  api<Run>(`/api/procedure-runs/${id(key)}`);
export const changeStep = (
  run: Run,
  stepId: string,
  checked: boolean,
  note: string,
) =>
  post<Run>(
    `/api/procedure-runs/${id(run.id)}/steps/${id(stepId)}/completion`,
    {
      expectedRevision: run.revision,
      checked,
      note,
      exception:
        run.steps.find((step) => step.stepId === stepId)?.exception ?? null,
    },
  );
export const completeRun = (run: Run) =>
  post<Run>(`/api/procedure-runs/${id(run.id)}/complete`, {
    expectedRevision: run.revision,
  });
