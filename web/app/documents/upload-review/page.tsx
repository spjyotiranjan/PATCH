"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Edit2,
  FileText,
  HelpCircle,
  RefreshCw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button, StatusBadge } from "@/components/ui";
import { ProcessingStepBar } from "@/components/documents";

export default function UploadReviewPage() {
  const router = useRouter();
  const [isApproving, setIsApproving] = useState(false);
  const [approved, setApproved] = useState(false);

  // Editable form state for review
  const [docTitle, setDocTitle] = useState("P&ID Diagram P-101-002");
  const [pressure, setPressure] = useState("12.4 bar");
  const [flowRate, setFlowRate] = useState("450 m³/h");
  const [motorRating, setMotorRating] = useState("75 kW");
  const [fluidType, setFluidType] = useState("Cooling Water");

  function handleApprove() {
    setIsApproving(true);
    setTimeout(() => {
      setIsApproving(false);
      setApproved(true);
    }, 1200);
  }

  if (approved) {
    return (
      <AppShell title="Review Extracted Document">
        <div style={{ maxWidth: 680, margin: "40px auto", textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "var(--patch-success-bg, #ecfdf5)",
              color: "var(--patch-success)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <CheckCircle2 size={32} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            Document Version Approved &amp; Queued for Indexing!
          </h2>
          <p style={{ color: "var(--patch-muted)", fontSize: 14, marginBottom: 24 }}>
            Version <strong>v2.0</strong> of <strong>P&amp;ID Diagram P-101-002</strong> has been approved. Vector embedding generation is now underway.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
            <Link href="/documents/processing-state">
              <Button variant="secondary">View Indexing Progress</Button>
            </Link>
            <Link href="/equipments/eq-1/documents">
              <Button>Return to Equipment Documents</Button>
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Review Extracted Document Metadata">
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/equipments/eq-1/documents"
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
          <ArrowLeft size={14} /> Back to Equipment Documents
        </Link>
      </div>

      {/* Stepper Header */}
      <div className="card" style={{ padding: "20px 24px", marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 650, margin: 0 }}>
              Ingestion Pipeline Step 3 of 6: Review &amp; Verify Metadata
            </h3>
            <p style={{ fontSize: 13, color: "var(--patch-muted)", margin: "4px 0 0" }}>
              Target Entity: <strong>Centrifugal Pump P-101</strong> (Equipment eq-1)
            </p>
          </div>
          <StatusBadge tone="attention">Needs Review</StatusBadge>
        </div>
        <ProcessingStepBar currentStep={3} />
      </div>

      {/* Main Review Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
        {/* Left Column: Original Source PDF preview representation */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
              paddingBottom: 12,
              borderBottom: "1px solid var(--patch-boundary)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FileText size={18} color="var(--patch-accent)" />
              <strong style={{ fontSize: 14 }}>Source Document: PID-P101-002-REV2.pdf</strong>
            </div>
            <span style={{ fontSize: 12, color: "var(--patch-muted)" }}>8.5 MB · PDF</span>
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 380,
              background: "var(--patch-surface-elevated)",
              borderRadius: 8,
              border: "1px dashed var(--patch-boundary)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              textAlign: "center",
            }}
          >
            <Sparkles size={36} color="var(--patch-accent)" style={{ marginBottom: 12 }} />
            <h4 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>AI Vision &amp; OCR Parsing Complete</h4>
            <p style={{ fontSize: 13, color: "var(--patch-muted)", maxWidth: 360, margin: "0 0 16px" }}>
              Extracted 14 technical specifications, 4 tag references, and 2 maintenance schedules from page 1 and page 2.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <span className="doc-mode-pill active">Page 1 of 2</span>
              <span className="doc-mode-pill">Page 2 of 2</span>
            </div>
          </div>
        </div>

        {/* Right Column: AI Extracted Fields Review Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h4 style={{ fontSize: 15, fontWeight: 650, margin: 0 }}>Extracted Specifications</h4>
              <span style={{ fontSize: 12, color: "var(--patch-success)", fontWeight: 600 }}>
                96% Confidence
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="drawer-field">
                <label>Document Title</label>
                <input
                  className="form-select"
                  style={{ appearance: "auto", backgroundImage: "none" }}
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="drawer-field">
                  <label>Design Operating Pressure</label>
                  <input
                    className="form-select"
                    style={{ appearance: "auto", backgroundImage: "none" }}
                    value={pressure}
                    onChange={(e) => setPressure(e.target.value)}
                  />
                </div>
                <div className="drawer-field">
                  <label>Max Flow Rate</label>
                  <input
                    className="form-select"
                    style={{ appearance: "auto", backgroundImage: "none" }}
                    value={flowRate}
                    onChange={(e) => setFlowRate(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="drawer-field">
                  <label>Motor Rating</label>
                  <input
                    className="form-select"
                    style={{ appearance: "auto", backgroundImage: "none" }}
                    value={motorRating}
                    onChange={(e) => setMotorRating(e.target.value)}
                  />
                </div>
                <div className="drawer-field">
                  <label>Fluid Type</label>
                  <input
                    className="form-select"
                    style={{ appearance: "auto", backgroundImage: "none" }}
                    value={fluidType}
                    onChange={(e) => setFluidType(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h4 style={{ fontSize: 15, fontWeight: 650, margin: "0 0 12px" }}>Extracted Tag References</h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {["P-101", "P-101-M1", "MV-101A", "TT-101", "PI-102"].map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "4px 10px",
                    borderRadius: 16,
                    background: "var(--patch-surface-elevated)",
                    border: "1px solid var(--patch-boundary)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Approver Action Bar */}
      <div
        className="card"
        style={{
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--patch-surface-elevated)",
          border: "1px solid var(--patch-boundary)",
        }}
      >
        <div style={{ fontSize: 13, color: "var(--patch-muted)" }}>
          Approving will activate revision <strong>v2.0</strong> and trigger vector indexing &amp; profile refresh.
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" style={{ color: "var(--patch-danger)" }}>
            <XCircle size={15} style={{ marginRight: 6 }} /> Reject
          </Button>
          <Button variant="secondary">
            <RefreshCw size={15} style={{ marginRight: 6 }} /> Re-extract with AI
          </Button>
          <Button onClick={handleApprove} disabled={isApproving}>
            <CheckCircle2 size={15} style={{ marginRight: 6 }} />
            {isApproving ? "Approving..." : "Approve & Trigger Indexing"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
