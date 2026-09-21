import {
  BriefcaseBusiness,
  CheckCircle2,
  FileText,
  MessageCircle,
  Wrench,
} from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui";

const equipment = [
  ["Centrifugal Pump P-101", "Healthy"],
  ["Boiler B-201", "Warning"],
  ["Filler O2", "Healthy"],
  ["Conveyor 11", "Healthy"],
  ["Capper 04", "Warning"],
];

const documents = [
  [
    "P-101 Maintenance Manual",
    "2 min ago",
    "ready",
  ],
  ["B-201 PAID", "8 min ago", "ready"],
  [
    "Filler O2 SOP",
    "15 min ago",
    "processing",
  ],
  [
    "Conveyor 11 Drawing",
    "32 min ago",
    "processing",
  ],
  [
    "Capper 04 Datasheet",
    "1 hr ago",
    "ready",
  ],
];

const chatSessions = [
  "Filler O2 pressure instability",
  "Capper 04 torque variation",
  "Conveyor 11 alignment check",
  "Labeler 01 sensor fault",
  "Line 3 lockout review",
];

export default function HomePage() {
  return (
    <AppShell title="Operations home">
      <div className="home-grid">
        <section className="metric-grid">
          <Metric
            title="Equipments"
            value="128"
            note="2 warnings"
            tone="attention"
            icon={<Wrench />}
          />

          <Metric
            title="Active Projects"
            value="6"
            note="1 due soon"
            tone="attention"
            icon={
              <BriefcaseBusiness />
            }
          />

          <Metric
            title="Documents"
            value="1,248"
            note="24 processing"
            tone="info"
            icon={<FileText />}
          />
        </section>

        <div className="split-grid">
          <Panel
            title="Recent Equipments"
            viewAllHref="/equipments"
          >
            <div className="list">
              {equipment.map(
                ([name, state]) => (
                  <div
                    className="list-row"
                    key={name}
                  >
                    <Wrench size={19} />

                    <strong>
                      {name}
                    </strong>

                    <StatusBadge
                      tone={
                        state ===
                        "Healthy"
                          ? "success"
                          : "attention"
                      }
                    >
                      {state}
                    </StatusBadge>
                  </div>
                ),
              )}
            </div>
          </Panel>

          <Panel
            title="Document processing"
            viewAllHref="/documents"
          >
            <div className="list">
              {documents.map(
                ([name, time, state]) => (
                  <div
                    className="list-row"
                    key={name}
                  >
                    <FileText size={19} />

                    <strong>
                      {name}
                    </strong>

                    <span className="row-meta">
                      {time}
                    </span>

                    {state ===
                    "ready" ? (
                      <CheckCircle2
                        className="success-icon"
                        size={20}
                      />
                    ) : (
                      <span
                        className="processing-ring"
                        aria-label="Processing"
                      />
                    )}
                  </div>
                ),
              )}
            </div>
          </Panel>
        </div>

        <Panel
          title="Recent Chat sessions"
          viewAllHref="/chat"
        >
          <div className="chat-session-grid">
            {chatSessions.map(
              (title, index) => (
                <Link
                  className="chat-session"
                  href="/chat"
                  key={title}
                >
                  <MessageCircle
                    size={20}
                  />

                  <span>{title}</span>

                  {index === 0 ? (
                    <StatusBadge tone="info">
                      New
                    </StatusBadge>
                  ) : (
                    <time>
                      {index === 1
                        ? "10:42 AM"
                        : index === 3
                          ? "7:41 AM"
                          : ""}
                    </time>
                  )}
                </Link>
              ),
            )}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}

function Metric({
  title,
  value,
  note,
  tone,
  icon,
}: {
  title: string;
  value: string;
  note: string;
  tone: "attention" | "info";
  icon: React.ReactNode;
}) {
  return (
    <article className="metric-panel">
      <div>
        <h2>{title}</h2>

        <strong>{value}</strong>

        <StatusBadge tone={tone}>
          {note}
        </StatusBadge>
      </div>

      <span className="metric-icon">
        {icon}
      </span>
    </article>
  );
}

function Panel({
  title,
  viewAllHref,
  children,
}: {
  title: string;
  viewAllHref: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{title}</h2>

        <a href={viewAllHref}>View all</a>
      </div>

      {children}
    </section>
  );
}