import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ChatWorkspaceOverview } from "../components/chat-workspace-overview";

it("renders conversational Markdown with distinct product references and explicit partial coverage", () => {
  render(
    <ChatWorkspaceOverview
      overview={{
        scope: "HELP",
        catalog: {
          entities: [],
          documents: [],
          partial: true,
          help: [
            {
              id: "help",
              title: "Document revisions",
              text: "Reviewed workflow",
            },
          ],
        },
        passages: [
          {
            text: "## Add a revision\n\nUse **Add new version** in Documents.\n\n- Review the extraction.\n- Approve before indexing.",
            recordIds: ["help:0"],
          },
        ],
      }}
    />,
  );
  expect(
    screen.getByRole("heading", { name: "Add a revision" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Add new version").tagName).toBe("STRONG");
  expect(screen.getByText(/This context is partial/)).toBeInTheDocument();
  expect(screen.getByText(/Records and guidance used/)).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Source/ }),
  ).not.toBeInTheDocument();
});

it("shows reviewed help when generated wording is rejected", () => {
  render(
    <ChatWorkspaceOverview
      overview={{
        scope: "HELP",
        passages: [],
        catalog: {
          entities: [],
          documents: [],
          partial: false,
          help: [
            {
              id: "help",
              title: "Upload",
              text: "Use Add new document in Documents.",
            },
          ],
        },
      }}
    />,
  );
  expect(
    screen.getByText("Use Add new document in Documents."),
  ).toBeInTheDocument();
  expect(screen.queryByText(/No matching accessible/)).not.toBeInTheDocument();
});

it("shows an empty log view even when other accessible records exist", () => {
  render(
    <ChatWorkspaceOverview
      overview={{
        scope: "LOGS",
        passages: [],
        catalog: {
          entities: [
            {
              id: "p",
              type: "PROJECT",
              name: "Project",
              description: "",
              status: "ACTIVE",
            },
          ],
          documents: [],
          partial: false,
          workflowRecords: [],
        },
      }}
    />,
  );
  expect(
    screen.getByText("No matching accessible records in this view."),
  ).toBeInTheDocument();
});
