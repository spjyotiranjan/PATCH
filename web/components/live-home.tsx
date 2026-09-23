"use client";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import {
  LoadState,
  RecordState,
  useResource,
} from "@/components/backend-state";
import { getEquipmentRecords, getProjectRecords } from "@/lib/api/resources";
import { getLibrary } from "@/lib/api/document-workflow";
import { listSessions } from "@/lib/api/chat-workflow";

async function loadHome() {
  const [equipments, projects, documents, sessions] = await Promise.all([
    getEquipmentRecords(),
    getProjectRecords(),
    getLibrary(),
    listSessions(),
  ]);
  return { equipments, projects, documents, sessions };
}
export function LiveHome() {
  const resource = useResource(loadHome);
  const data = resource.data;
  return (
    <AppShell title="Operations home">
      <LoadState {...resource} retry={resource.refresh} />
      {data && (
        <div className="home-grid">
          <section className="metric-grid">
            {[
              {
                title: "Accessible Equipments",
                value: data.equipments.length,
                href: "/equipments",
              },
              {
                title: "Active Projects",
                value: data.projects.filter(
                  (project) => project.status === "ACTIVE",
                ).length,
                href: "/projects",
              },
              {
                title: "Accessible Documents",
                value: data.documents.length,
                href: "/documents",
              },
            ].map((metric) => (
              <article className="metric-panel" key={metric.title}>
                <h2>
                  <Link href={metric.href}>{metric.title}</Link>
                </h2>
                <strong>{metric.value}</strong>
              </article>
            ))}
          </section>
          <div className="split-grid">
            <section className="panel integration-panel">
              <div className="panel-heading">
                <h2>Recent Equipments</h2>
                <Link href="/equipments">View all</Link>
              </div>
              {data.equipments.slice(0, 5).map((equipment) => (
                <div className="list-row" key={equipment.id}>
                  <Link href={`/equipments/${equipment.id}`}>
                    {equipment.name}
                  </Link>
                  <RecordState value={equipment.operationalState} />
                </div>
              ))}
              {!data.equipments.length && <p>No Equipments yet.</p>}
            </section>
            <section className="panel integration-panel">
              <div className="panel-heading">
                <h2>Recent documents</h2>
                <Link href="/documents/processing-state">
                  Processing and review
                </Link>
              </div>
              {data.documents.slice(0, 5).map((document) => (
                <div className="list-row" key={document.id}>
                  <Link
                    href={
                      document.activeVersionId
                        ? `/documents/${document.activeVersionId}`
                        : "/documents/processing-state"
                    }
                  >
                    {document.title}
                  </Link>
                  <RecordState
                    value={
                      document.activeVersionId ? "ACTIVE" : "NO_ACTIVE_VERSION"
                    }
                  />
                </div>
              ))}
              {!data.documents.length && <p>No documents yet.</p>}
            </section>
          </div>
          <section className="panel integration-panel">
            <div className="panel-heading">
              <h2>Recent Chat sessions</h2>
              <Link href="/chat">View all</Link>
            </div>
            {data.sessions.slice(0, 8).map((session) => (
              <div className="list-row" key={session.id}>
                <Link href={`/chat/${session.id}`}>{session.title}</Link>
                <time>{new Date(session.updatedAt).toLocaleString()}</time>
              </div>
            ))}
            {!data.sessions.length && (
              <p>
                No conversations yet. <Link href="/chat/new">Start a chat</Link>
                .
              </p>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
