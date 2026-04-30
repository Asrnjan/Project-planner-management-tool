import { useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Edit3,
  ExternalLink,
  FileCheck2,
  FileText,
  FolderOpen,
  Link2,
  Save,
  Search,
  Trash2,
} from "lucide-react";

const EMPTY_FORM = {
  title: "",
  documentType: "Other",
  version: "1.0",
  owner: "",
  status: "Draft",
  documentUrl: "",
  description: "",
  notes: "",
  lastUpdatedDate: "",
};

const DOCUMENT_TYPES = [
  "BRD",
  "SOW",
  "Proposal",
  "Project Plan",
  "MoM",
  "Risk Register",
  "Change Request",
  "Client Approval",
  "Technical Document",
  "Deployment Document",
  "Other",
];

function getStatusClass(status) {
  if (status === "Approved") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "In Review") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (status === "Rejected") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (status === "Archived") {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function Field({ label, children, hint }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      {children}
      {hint ? <span className="text-[11px] text-slate-400">{hint}</span> : null}
    </label>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
    />
  );
}

function SelectInput(props) {
  return (
    <select
      {...props}
      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
    />
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      rows={props.rows || 4}
      className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-6 text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
    />
  );
}

function SummaryCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
        {value}
      </div>
    </div>
  );
}

export default function ProjectDocumentsView({
  selectedProject,
  projectDocuments = [],
  onAddDocument,
  onUpdateDocument,
  onDeleteDocument,
}) {
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    lastUpdatedDate: new Date().toISOString().slice(0, 10),
  });
  const [editingDocumentId, setEditingDocumentId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [message, setMessage] = useState("");

  const allProjectDocuments = useMemo(() => {
    if (!selectedProject) return [];
    return projectDocuments.filter(
      (document) => document.projectId === selectedProject.id
    );
  }, [projectDocuments, selectedProject]);

  const documents = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return allProjectDocuments.filter((document) => {
      const matchesSearch =
        !query ||
        document.title?.toLowerCase().includes(query) ||
        document.owner?.toLowerCase().includes(query) ||
        document.description?.toLowerCase().includes(query) ||
        document.notes?.toLowerCase().includes(query) ||
        document.documentType?.toLowerCase().includes(query);

      const matchesType =
        typeFilter === "All" || document.documentType === typeFilter;

      const matchesStatus =
        statusFilter === "All" || document.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [allProjectDocuments, searchText, typeFilter, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: allProjectDocuments.length,
      approved: allProjectDocuments.filter((doc) => doc.status === "Approved")
        .length,
      review: allProjectDocuments.filter((doc) => doc.status === "In Review")
        .length,
      archived: allProjectDocuments.filter((doc) => doc.status === "Archived")
        .length,
    };
  }, [allProjectDocuments]);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm({
      ...EMPTY_FORM,
      lastUpdatedDate: new Date().toISOString().slice(0, 10),
    });
    setEditingDocumentId("");
  }

  function handleEdit(document) {
    setEditingDocumentId(document.id);
    setForm({
      ...EMPTY_FORM,
      ...document,
    });
    setMessage("Editing document record.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!selectedProject) {
      setMessage("Please select a project first.");
      return;
    }

    if (!form.title.trim()) {
      setMessage("Please enter document title.");
      return;
    }

    const payload = {
      ...form,
      projectId: selectedProject.id,
    };

    if (editingDocumentId) {
      onUpdateDocument(editingDocumentId, payload);
      setMessage("Document updated successfully.");
    } else {
      onAddDocument(payload);
      setMessage("Document added successfully.");
    }

    resetForm();
  }

  if (!selectedProject) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
          <FolderOpen className="h-4 w-4" />
          Project Documents
        </div>
        <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">
          Select a project first
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Project document management is available only for a selected project.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 p-5 text-white">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200">
                <FolderOpen className="h-3.5 w-3.5" />
                Project Documents
              </div>

              <h3 className="mt-4 text-2xl font-semibold tracking-tight">
                {selectedProject.name}
              </h3>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Maintain all project references in one place: BRD, SOW, proposals,
                approvals, MoM, technical documents, deployment notes, and review
                comments.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                Current Register
              </div>
              <div className="mt-1 text-3xl font-semibold text-white">
                {allProjectDocuments.length}
              </div>
              <div className="mt-1 text-xs text-slate-300">
                document record(s)
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Total Documents" value={stats.total} icon={FileText} />
          <SummaryCard label="Approved" value={stats.approved} icon={CheckCircle2} />
          <SummaryCard label="In Review" value={stats.review} icon={FileCheck2} />
          <SummaryCard label="Archived" value={stats.archived} icon={Archive} />
        </div>
      </section>

      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h4 className="text-base font-semibold text-slate-900">
              {editingDocumentId ? "Edit Document Record" : "Add Project Document"}
            </h4>
            <p className="mt-1 text-sm text-slate-500">
              Store document metadata, links, ownership, version, approval status,
              and review notes.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              <Save className="h-4 w-4" />
              {editingDocumentId ? "Update Document" : "Add Document"}
            </button>

            {editingDocumentId ? (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>

        {message ? (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
            {message}
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <Field label="Document Title">
            <TextInput
              value={form.title}
              onChange={(event) => updateField("title", event.target.value)}
              placeholder="Example: BRD v1.0"
            />
          </Field>

          <Field label="Document Type">
            <SelectInput
              value={form.documentType}
              onChange={(event) => updateField("documentType", event.target.value)}
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </SelectInput>
          </Field>

          <Field label="Version">
            <TextInput
              value={form.version}
              onChange={(event) => updateField("version", event.target.value)}
              placeholder="1.0"
            />
          </Field>

          <Field label="Owner">
            <TextInput
              value={form.owner}
              onChange={(event) => updateField("owner", event.target.value)}
              placeholder="Document owner"
            />
          </Field>

          <Field label="Status">
            <SelectInput
              value={form.status}
              onChange={(event) => updateField("status", event.target.value)}
            >
              <option value="Draft">Draft</option>
              <option value="In Review">In Review</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Archived">Archived</option>
            </SelectInput>
          </Field>

          <Field label="Last Updated Date">
            <TextInput
              type="date"
              value={form.lastUpdatedDate}
              onChange={(event) => updateField("lastUpdatedDate", event.target.value)}
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Document Link" hint="Use Google Drive, SharePoint, OneDrive, or any accessible document URL.">
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                value={form.documentUrl}
                onChange={(event) => updateField("documentUrl", event.target.value)}
                placeholder="Paste document link here"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
              />
            </div>
          </Field>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Field label="Description">
            <TextArea
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
              placeholder="Short description of the document."
            />
          </Field>

          <Field label="Review Notes">
            <TextArea
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              placeholder="Review comments, approval notes, or pending actions."
            />
          </Field>
        </div>
      </form>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h4 className="text-base font-semibold text-slate-900">
              Document Register
            </h4>
            <p className="mt-1 text-sm text-slate-500">
              Search, filter, review, edit, or open project document records.
            </p>
          </div>

          <div className="grid gap-2 md:grid-cols-[1fr_auto_auto] xl:min-w-[720px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search documents"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
            >
              <option value="All">All Types</option>
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
            >
              <option value="All">All Status</option>
              <option value="Draft">Draft</option>
              <option value="In Review">In Review</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Archived">Archived</option>
            </select>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {documents.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
              No matching documents found.
            </div>
          ) : (
            documents.map((document) => (
              <div
                key={document.id}
                className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                        <FileText className="h-5 w-5" />
                      </div>

                      <div>
                        <h5 className="font-semibold tracking-tight text-slate-900">
                          {document.title}
                        </h5>
                        <div className="mt-1 text-xs text-slate-500">
                          {document.documentType} | Version {document.version || "-"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${getStatusClass(
                          document.status
                        )}`}
                      >
                        {document.status}
                      </span>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                        Owner: {document.owner || "-"}
                      </span>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                        Updated: {document.lastUpdatedDate || "-"}
                      </span>
                    </div>

                    <p className="mt-3 max-w-5xl text-sm leading-6 text-slate-600">
                      {document.description || "No description added."}
                    </p>

                    {document.notes ? (
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Review Notes
                        </div>
                        {document.notes}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {document.documentUrl ? (
                      <a
                        href={document.documentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open
                      </a>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => handleEdit(document)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                      <Edit3 className="h-4 w-4" />
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Are you sure you want to delete this document record?"
                          )
                        ) {
                          onDeleteDocument(document.id);
                        }
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}