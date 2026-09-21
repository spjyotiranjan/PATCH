"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  RefreshCw,
  RotateCcw,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, StatusBadge } from "@/components/ui";
import { ProcessingStepBar, ProfileStatusIndicator } from "@/components/documents";
import { getProcessingQueue } from "@/lib/api/documents";

interface QueueItem {
  id: string;
  documentId: string;
  documentTitle: string;
  subtitle: string;
  version: string;
  entityName: string;
  step: number;
  stepName: string;
  progressPct: number;
  status: "Indexing" | "Failed" | "Approved" | "Needs review";
  eta?: string;
  errorMsg?: string;
}

export default function ProcessingStatePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const queue = await getProcessingQueue();

        if (!cancelled) {
          setItems(
            queue.map((item) => {
              if (item.status === "FAILED") {
                return {
                  id: item.id,
                  documentId: item.documentId,
                  documentTitle: item.documentTitle,
                  subtitle: item.filename,
                  version: "",
                  entityName:
                    item.equipmentName ??
                    item.projectName ??
                    "—",
                  step: 2,
                  stepName: "Extraction Failed",
                  progressPct: 25,
                  status: "Failed" as const,
                  errorMsg: `${item.errorMessage ?? "Processing failed."} The previous active revision remains in use.`,
                };
              }

              if (item.status === "NEEDS_REVIEW") {
                return {
                  id: item.id,
                  documentId: item.documentId,
                  documentTitle: item.documentTitle,
                  subtitle: item.filename,
                  version: "",
                  entityName:
                    item.equipmentName ??
                    item.projectName ??
                    "—",
                  step: 3,
                  stepName: "Awaiting Metadata Review",
                  progressPct: 50,
                  status: "Needs review" as const,
                  eta: "Waiting for reviewer",
                };
              }

              return {
                id: item.id,
                documentId: item.documentId,
                documentTitle: item.documentTitle,
                subtitle: item.filename,
                version: "",
                entityName:
                  item.equipmentName ??
                  item.projectName ??
                  "—",
                step: 5,
                stepName: "Generating Vector Embeddings",
                progressPct: 68,
                status: "Indexing" as const,
                eta: "45 seconds remaining",
              };
            }),
          );
        }
      } catch {
        if (!cancelled) {
          setError(
            "The processing queue could not be loaded. Check your connection and retry.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  function handleRetry(id: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "Indexing",
              step: 2,
              stepName: "Retrying OCR Text Extraction...",
              progressPct: 40,
              errorMsg: undefined,
            }
          : item
      )
    );
  }

  const indexingCount = items.filter(
    (item) => item.status === "Indexing",
  ).length;
  const failedCount = items.filter(
    (item) => item.status === "Failed",
  ).length;
  const reviewCount = items.filter(
    (item) =>
      item.status === "Needs review" ||
      item.status === "Approved",
  ).length;

  return (
    <AppShell title="Document Processing &amp; Indexing Queue">
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/documents"
          style={{
            fontSize: 13,
            color: "var(--patch-muted)",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            textDecoration: "none",
            marginBottom: 12,
          }}
        >
          <ArrowLeft size={14} /> Back to Global Documents Library
        </Link>
      </div>

      {/* Summary Banner */}
      <div
        className="card"
        style={{
          padding: "20px 24px",
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--patch-surface-elevated)",
        }}
      >
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 650, margin: "0 0 4px" }}>
            Active Background Ingestion Queue
          </h3>
          <p style={{ fontSize: 13, color: "var(--patch-muted)", margin: 0 }}>
            {indexingCount} active indexing job
            {indexingCount === 1 ? "" : "s"} · {failedCount} failed
            extraction{failedCount === 1 ? "" : "s"} · {reviewCount}{" "}
            profile refresh pending
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setIsRefreshing(true);
              setTimeout(() => setIsRefreshing(false), 1000);
            }}
          >
            <RefreshCw
              size={14}
              style={{ marginRight: 6 }}
              className={isRefreshing ? "animate-spin" : ""}
            />
            Refresh Queue Status
          </Button>
        </div>
      </div>

      {/* Active Processing Items list */}
      {loading ? (
        <section
          className="empty-state card"
          aria-live="polite"
          style={{ marginBottom: 32 }}
        >
          <h2>Loading processing queue…</h2>
          <p>Checking upload, extract, review, and index states.</p>
        </section>
      ) : error ? (
        <section
          className="empty-state card"
          role="alert"
          style={{ marginBottom: 32 }}
        >
          <h2>The queue could not be loaded</h2>
          <p>{error}</p>
          <Button
            type="button"
            onClick={() =>
              setReloadToken((token) => token + 1)
            }
          >
            Retry
          </Button>
        </section>
      ) : items.length === 0 ? (
        <section
          className="empty-state card"
          style={{ marginBottom: 32 }}
        >
          <CheckCircle2 size={28} aria-hidden="true" />
          <h2>Queue is clear</h2>
          <p>
            No documents are currently uploading, extracting, or
            indexing. Every version is active or awaiting review in
            the library.
          </p>
          <Link href="/documents">
            <Button type="button" variant="secondary">
              Back to library
            </Button>
          </Link>
        </section>
      ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 32 }}>
        {items.map((item) => (
          <div key={item.id} className="card" style={{ padding: 20 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 16,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <FileText size={18} color="var(--patch-accent)" />
                  <strong style={{ fontSize: 15 }}>{item.documentTitle}</strong>
                  {item.version ? (
                    <span style={{ fontSize: 13, color: "var(--patch-muted)" }}>({item.version})</span>
                  ) : null}
                </div>
                <div style={{ fontSize: 12, color: "var(--patch-muted)", marginTop: 4 }}>
                  {item.subtitle} · Target: <strong>{item.entityName}</strong>
                </div>
              </div>

              <div>
                {item.status === "Indexing" && (
                  <StatusBadge tone="info">
                    <Loader2 size={12} className="animate-spin" style={{ marginRight: 4 }} /> Indexing
                  </StatusBadge>
                )}
                {item.status === "Failed" && <StatusBadge tone="danger">Failed</StatusBadge>}
                {item.status === "Needs review" && (
                  <StatusBadge tone="attention">Needs review</StatusBadge>
                )}
                {item.status === "Approved" && <StatusBadge tone="success">Queued</StatusBadge>}
              </div>
            </div>

            {/* Step Bar */}
            <div style={{ marginBottom: 16 }}>
              <ProcessingStepBar currentStep={item.step} />
            </div>

            {/* Status Details / Progress bar */}
            {item.status === "Indexing" && (
              <div style={{ background: "var(--patch-surface)", padding: 14, borderRadius: 8, border: "1px solid var(--patch-boundary)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                  <span>{item.stepName}</span>
                  <span style={{ fontWeight: 600 }}>{item.progressPct}%</span>
                </div>
                <div className="progress-bar-track">
                  <div className="progress-bar-fill" style={{ width: `${item.progressPct}%` }} />
                </div>
                <div style={{ fontSize: 12, color: "var(--patch-muted)", marginTop: 8 }}>
                  ETA: {item.eta}
                </div>
              </div>
            )}

            {item.status === "Failed" && (
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  padding: 14,
                  borderRadius: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <AlertCircle size={18} color="var(--patch-danger)" />
                  <div>
                    <strong style={{ fontSize: 13, color: "var(--patch-danger)", display: "block" }}>
                      {item.stepName}
                    </strong>
                    <span style={{ fontSize: 12, color: "var(--patch-muted)" }}>{item.errorMsg}</span>
                  </div>
                </div>
                <Button size="sm" onClick={() => handleRetry(item.id)}>
                  <RotateCcw size={13} style={{ marginRight: 4 }} /> Retry Extraction
                </Button>
              </div>
            )}

            {item.status === "Needs review" && (
              <div
                style={{
                  background: "var(--patch-surface-elevated)",
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid var(--patch-boundary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 13,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle2 size={16} color="var(--patch-attention)" />
                  <span>{item.stepName}. Review the extracted metadata, then approve to queue indexing.</span>
                </div>
                <Link href="/documents/upload-review">
                  <Button variant="secondary" size="sm">Review</Button>
                </Link>
              </div>
            )}

            {item.status === "Approved" && (
              <div
                style={{
                  background: "var(--patch-surface-elevated)",
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid var(--patch-boundary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 13,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle2 size={16} color="var(--patch-success)" />
                  <span>Metadata review complete. Queued for profile propagation.</span>
                </div>
                <Link href={`/documents/${item.documentId}`}>
                  <Button variant="secondary" size="sm">View Document</Button>
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>
      )}

      {/* Profile Freshness & Propagation Queue Section */}
      <div className="card">
        <h3 style={{ fontSize: 15, fontWeight: 650, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <Zap size={18} color="var(--patch-accent)" />
          Profile Freshness &amp; Propagation Queue
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderRadius: 8,
              background: "var(--patch-surface-elevated)",
              border: "1px solid var(--patch-boundary)",
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Equipment: Centrifugal Pump P-101</div>
              <div style={{ fontSize: 12, color: "var(--patch-muted)" }}>
                Triggered by P&amp;ID Diagram P-101-002 (v2.0) approval
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <ProfileStatusIndicator status="Refreshing" />
              <Button size="sm" variant="secondary">Force Sync</Button>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderRadius: 8,
              background: "var(--patch-surface-elevated)",
              border: "1px solid var(--patch-boundary)",
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Project: Cooling Water System Upgrade 2025</div>
              <div style={{ fontSize: 12, color: "var(--patch-muted)" }}>
                Inherited profile copy scheduled following P-101 refresh
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <ProfileStatusIndicator status="Stale" />
              <Button size="sm" variant="secondary">Sync Now</Button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
