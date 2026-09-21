"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleHelp,
  FilePlus2,
  FileText,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";

import { Button, Field } from "@/components/ui";
import { createEquipment } from "@/lib/api/equipments";
import type { CreateEquipmentInput } from "@/lib/types/equipment";

type Step = 1 | 2 | 3;

type MockDocument = {
  id: string;
  name: string;
  description: string;
  type: string;
  target: string;
  status: "Indexing" | "Needs review" | "Indexed";
};

const initialDocuments: MockDocument[] = [
  {
    id: "doc-1",
    name: "P-101 Maintenance Manual",
    description: "Operating & maintenance instructions",
    type: "Manual",
    target: "P-101",
    status: "Indexing",
  },
  {
    id: "doc-2",
    name: "P-101 P&ID",
    description: "Piping & instrumentation diagram",
    type: "P&ID",
    target: "P-101",
    status: "Indexing",
  },
  {
    id: "doc-3",
    name: "P-101 Datasheet",
    description: "Manufacturer specifications",
    type: "Datasheet",
    target: "P-101",
    status: "Needs review",
  },
  {
    id: "doc-4",
    name: "P-101 Inspection Checklist",
    description: "Routine inspection procedures",
    type: "Checklist",
    target: "P-101",
    status: "Indexing",
  },
];

export function EquipmentForm() {
  const [step, setStep] = useState<Step>(1);

  const [form, setForm] = useState<CreateEquipmentInput>({
    name: "",
    type: "",
    description: "",
    location: "",
    serialNumber: "",
    manufacturer: "",
    model: "",
  });

  const [documents, setDocuments] =
    useState<MockDocument[]>(initialDocuments);

  const [documentMode, setDocumentMode] =
    useState<"add" | "skip">("add");

  const [submitting, setSubmitting] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [createdId, setCreatedId] =
    useState<string | null>(null);

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  function update(
    key: keyof CreateEquipmentInput,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function validateDetails() {
    if (!form.name.trim()) {
      setError("Equipment name is required.");
      return false;
    }

    if (!form.type.trim()) {
      setError("Equipment type is required.");
      return false;
    }

    setError(null);
    return true;
  }

  function goToDocuments() {
    if (!validateDetails()) {
      return;
    }

    setStep(2);
  }

  function goToReview() {
    setStep(3);
  }

  function handleFileSelected(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const extension =
      file.name.split(".").pop()?.toUpperCase() || "FILE";

    const newDocument: MockDocument = {
      id: `local-${Date.now()}`,
      name: file.name,
      description: "Uploaded document",
      type: extension,
      target: form.name || "New equipment",
      status: "Indexing",
    };

    setDocuments((current) => [
      ...current,
      newDocument,
    ]);

    setDocumentMode("add");

    event.target.value = "";
  }

  function removeDocument(id: string) {
    setDocuments((current) =>
      current.filter(
        (document) => document.id !== id,
      ),
    );
  }

  async function submit(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (!validateDetails()) {
      setStep(1);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const equipment =
        await createEquipment({
          name: form.name.trim(),
          type: form.type.trim(),
          description:
            form.description.trim(),
          location:
            (form.location ?? "").trim() ||
            undefined,
          serialNumber:
            (form.serialNumber ?? "").trim() ||
            undefined,
          manufacturer:
            (
              form.manufacturer ?? ""
            ).trim() || undefined,
          model:
            (form.model ?? "").trim() ||
            undefined,
        });

      setCreatedId(equipment.id);
      setStep(3);
    } catch {
      setError(
        "Unable to create the equipment. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="wizard"
      onSubmit={submit}
    >
      {/* =====================================================
          STEPPER
          ===================================================== */}

      <div className="wizard-steps">
        <WizardStep
          number={1}
          label="Details"
          active={step === 1}
          complete={step > 1}
        />

        <div className="wizard-line" />

        <WizardStep
          number={2}
          label="Documents"
          active={step === 2}
          complete={step > 2}
        />

        <div className="wizard-line" />

        <WizardStep
          number={3}
          label="Review"
          active={step === 3}
          complete={false}
        />
      </div>

      {/* =====================================================
          STEP 1 — DETAILS
          ===================================================== */}

      {step === 1 ? (
        <section className="wizard-panel">
          <div className="wizard-heading">
            <div>
              <p className="eyebrow">
                Step 1 of 3
              </p>

              <h2>
                Equipment details
              </h2>

              <p>
                Add the basic information
                for this equipment.
              </p>
            </div>
          </div>

          <div className="equipment-details-layout">
            <div className="equipment-details-main">
              <div className="form-grid">
                <Field
                  label="Equipment name"
                  required
                >
                  <input
                    value={form.name}
                    onChange={(event) =>
                      update(
                        "name",
                        event.target.value,
                      )
                    }
                    placeholder="e.g. Centrifugal Pump P-101"
                    required
                    maxLength={150}
                  />
                </Field>

                <Field
                  label="Equipment type"
                  required
                >
                  <input
                    value={form.type}
                    onChange={(event) =>
                      update(
                        "type",
                        event.target.value,
                      )
                    }
                    placeholder="e.g. Pump"
                    required
                    maxLength={100}
                  />
                </Field>

                <Field label="Location">
                  <input
                    value={form.location}
                    onChange={(event) =>
                      update(
                        "location",
                        event.target.value,
                      )
                    }
                    placeholder="Plant A · Bay 2"
                    maxLength={150}
                  />
                </Field>

                <Field
                  label="Description"
                  hint="Recommended for better AI routing"
                >
                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      update(
                        "description",
                        event.target.value,
                      )
                    }
                    placeholder="Describe the equipment, its purpose, key components, and operating context."
                    rows={4}
                    maxLength={1000}
                  />

                  <div className="field-counter">
                    {form.description.length}/1000
                  </div>
                </Field>

                <Field label="Serial number">
                  <input
                    value={form.serialNumber}
                    onChange={(event) =>
                      update(
                        "serialNumber",
                        event.target.value,
                      )
                    }
                    placeholder="P101-2026-001"
                    maxLength={100}
                  />
                </Field>

                <Field label="Manufacturer">
                  <input
                    value={form.manufacturer}
                    onChange={(event) =>
                      update(
                        "manufacturer",
                        event.target.value,
                      )
                    }
                    placeholder="Manufacturer"
                    maxLength={120}
                  />
                </Field>

                <Field label="Model">
                  <input
                    value={form.model}
                    onChange={(event) =>
                      update(
                        "model",
                        event.target.value,
                      )
                    }
                    placeholder="Model"
                    maxLength={120}
                  />
                </Field>
              </div>
            </div>

            {/* DESCRIPTION HELP PANEL */}

            <aside className="description-help-panel">
              <div className="description-help-icon">
                <CircleHelp size={18} />
              </div>

              <h3>
                Why add a description?
              </h3>

              <div className="description-help-list">
                <div>
                  <span />
                  <p>
                    Adds context for retrieval
                    routing
                  </p>
                </div>

                <div>
                  <span />
                  <p>
                    Helps identify relevant
                    current sources
                  </p>
                </div>

                <div>
                  <span />
                  <p>
                    Can be added or changed
                    later
                  </p>
                </div>
              </div>
            </aside>
          </div>

          {error ? (
            <p
              className="form-message form-message-error"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="wizard-actions">
            <Link href="/equipments">
              <Button
                type="button"
                variant="secondary"
                icon={<ArrowLeft size={17} />}
              >
                Cancel
              </Button>
            </Link>

            <Button
              type="button"
              icon={<ArrowRight size={17} />}
              onClick={goToDocuments}
            >
              Next
            </Button>
          </div>
        </section>
      ) : null}

      {/* =====================================================
          STEP 2 — DOCUMENTS
          ===================================================== */}

      {step === 2 ? (
        <section className="wizard-panel">
          <div className="wizard-heading">
            <div>
              <p className="eyebrow">
                Step 2 of 3
              </p>

              <h2>
                Add documents for this
                Equipment
                <span className="optional-label">
                  {" "}
                  (optional)
                </span>
              </h2>

              <p>
                Add documents now or skip.
                You can add or link them later.
              </p>
            </div>
          </div>

          {/* DOCUMENT MODE CARDS */}

          <div className="document-mode-grid">
            <button
              type="button"
              className={`document-mode-card ${
                documentMode === "add"
                  ? "document-mode-card-active"
                  : ""
              }`}
              onClick={() =>
                setDocumentMode("add")
              }
            >
              <span className="document-radio">
                {documentMode === "add" ? (
                  <span />
                ) : null}
              </span>

              <div className="document-mode-content">
                <strong>
                  Add documents now
                </strong>

                <p>
                  Upload or link relevant
                  documents to help set up
                  your Equipment with the
                  right information from the
                  start.
                </p>
              </div>

              <FileText
                className="document-mode-icon"
                size={38}
              />
            </button>

            <button
              type="button"
              className={`document-mode-card ${
                documentMode === "skip"
                  ? "document-mode-card-active"
                  : ""
              }`}
              onClick={() =>
                setDocumentMode("skip")
              }
            >
              <span className="document-radio">
                {documentMode === "skip" ? (
                  <span />
                ) : null}
              </span>

              <div className="document-mode-content">
                <strong>
                  Skip for now
                </strong>

                <p>
                  You can add documents later
                  from the Equipment record or
                  Documents library.
                </p>
              </div>

              <FileText
                className="document-mode-icon"
                size={38}
              />
            </button>
          </div>

          {/* DOCUMENTS */}

          {documentMode === "add" ? (
            <div className="uploaded-documents-section">
              <div className="uploaded-documents-header">
                <div>
                  <h3>
                    Uploaded documents
                  </h3>

                  <p>
                    {documents.length} document
                    {documents.length === 1
                      ? ""
                      : "s"}
                  </p>
                </div>

                <div className="document-actions">
                  <button
                    type="button"
                    className="document-secondary-button"
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                  >
                    <Plus size={16} />
                    Add new document
                  </button>

                  <button
                    type="button"
                    className="document-primary-button"
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                  >
                    <Upload size={16} />
                    Add new version
                  </button>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                hidden
                onChange={handleFileSelected}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
              />

              <div className="documents-table-wrapper">
                <table className="documents-table">
                  <thead>
                    <tr>
                      <th>
                        Logical document
                      </th>

                      <th>
                        Document type
                      </th>

                      <th>
                        Equipment target
                      </th>

                      <th>
                        Processing status
                      </th>

                      <th />
                    </tr>
                  </thead>

                  <tbody>
                    {documents.map(
                      (document) => (
                        <tr
                          key={document.id}
                        >
                          <td>
                            <div className="document-name-cell">
                              <FileText
                                size={18}
                              />

                              <div>
                                <strong>
                                  {
                                    document.name
                                  }
                                </strong>

                                <span>
                                  {
                                    document.description
                                  }
                                </span>
                              </div>
                            </div>
                          </td>

                          <td>
                            {
                              document.type
                            }
                          </td>

                          <td>
                            {
                              document.target
                            }
                          </td>

                          <td>
                            <span
                              className={`document-status document-status-${document.status
                                .toLowerCase()
                                .replace(
                                  " ",
                                  "-",
                                )}`}
                            >
                              <span />

                              {
                                document.status
                              }
                            </span>
                          </td>

                          <td>
                            <button
                              type="button"
                              className="icon-danger-button"
                              aria-label={`Delete ${document.name}`}
                              onClick={() =>
                                removeDocument(
                                  document.id,
                                )
                              }
                            >
                              <Trash2
                                size={16}
                              />
                            </button>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              <div className="document-completeness">
                <div className="document-completeness-ring">
                  {documents.length}/4
                </div>

                <div>
                  <strong>
                    Description completeness
                  </strong>

                  <span>
                    Optional — adding at least
                    one document is recommended.
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="document-skip-panel">
              <Check size={24} />

              <div>
                <strong>
                  Documents skipped
                </strong>

                <p>
                  You can add documents later
                  from the Equipment workspace.
                </p>
              </div>
            </div>
          )}

          <div className="wizard-actions">
            <Button
              type="button"
              variant="secondary"
              icon={<ArrowLeft size={17} />}
              onClick={() => setStep(1)}
            >
              Back
            </Button>

            <Button
              type="button"
              icon={<ArrowRight size={17} />}
              onClick={goToReview}
            >
              Continue
            </Button>
          </div>
        </section>
      ) : null}

      {/* =====================================================
          STEP 3 — REVIEW
          ===================================================== */}

      {step === 3 ? (
        <section className="wizard-panel">
          <div className="wizard-heading">
            <div>
              <p className="eyebrow">
                Step 3 of 3
              </p>

              <h2>
                Review equipment
              </h2>

              <p>
                Review the information before
                creating this Equipment.
              </p>
            </div>
          </div>

          <div className="review-layout">
            <div className="review-section">
              <div className="review-section-header">
                <div>
                  <span>
                    Equipment
                  </span>

                  <h3>
                    {form.name ||
                      "Unnamed equipment"}
                  </h3>
                </div>

                <button
                  type="button"
                  className="review-edit-button"
                  onClick={() =>
                    setStep(1)
                  }
                >
                  Edit
                </button>
              </div>

              <div className="review-grid">
                <ReviewItem
                  label="Equipment type"
                  value={form.type}
                />

                <ReviewItem
                  label="Location"
                  value={form.location}
                />

                <ReviewItem
                  label="Serial number"
                  value={
                    form.serialNumber
                  }
                />

                <ReviewItem
                  label="Manufacturer"
                  value={
                    form.manufacturer
                  }
                />

                <ReviewItem
                  label="Model"
                  value={form.model}
                />

                <ReviewItem
                  label="Documents"
                  value={`${documents.length} document${
                    documents.length === 1
                      ? ""
                      : "s"
                  }`}
                />
              </div>

              <div className="review-description">
                <span>
                  Description
                </span>

                <p>
                  {form.description ||
                    "No description provided."}
                </p>
              </div>
            </div>

            <aside className="review-summary">
              <Check size={22} />

              <h3>
                Ready to create
              </h3>

              <p>
                This Equipment will be created
                with the information shown on
                this page.
              </p>

              <div className="review-summary-row">
                <span>
                  Documents
                </span>

                <strong>
                  {documents.length}
                </strong>
              </div>
            </aside>
          </div>

          {error ? (
            <p
              className="form-message form-message-error"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="wizard-actions">
            <Button
              type="button"
              variant="secondary"
              icon={<ArrowLeft size={17} />}
              onClick={() => setStep(2)}
            >
              Back
            </Button>

            <Button
              type="submit"
              disabled={submitting}
              icon={<Check size={17} />}
            >
              {submitting
                ? "Creating..."
                : "Create Equipment"}
            </Button>
          </div>

          {createdId ? (
            <div className="creation-success">
              <Check size={20} />

              <div>
                <strong>
                  Equipment created successfully.
                </strong>

                <p>
                  Your mock frontend record is
                  ready for backend integration.
                </p>
              </div>

              <Link
                href={`/equipments/${createdId}`}
              >
                Open Equipment
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}
    </form>
  );
}

/* =========================================================
   REVIEW ITEM
   ========================================================= */

function ReviewItem({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  return (
    <div className="review-item">
      <span>{label}</span>

      <strong>
        {value?.trim() || "Not provided"}
      </strong>
    </div>
  );
}

/* =========================================================
   WIZARD STEP
   ========================================================= */

function WizardStep({
  number,
  label,
  active,
  complete,
}: {
  number: number;
  label: string;
  active: boolean;
  complete: boolean;
}) {
  return (
    <div
      className={[
        "wizard-step",
        active
          ? "wizard-step-active"
          : "",
        complete
          ? "wizard-step-complete"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span>
        {complete ? (
          <Check size={15} />
        ) : (
          number
        )}
      </span>

      <strong>{label}</strong>
    </div>
  );
}