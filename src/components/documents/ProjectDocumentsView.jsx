import { useMemo, useState } from "react";
import { ExternalLink, FileText, FolderOpen, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { confirmAction, notify } from "../../ui/feedback";
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  Field,
  Modal,
  Panel,
  StatStrip,
  cx,
  inputClass,
} from "../../ui/primitives";

const DOCUMENT_TYPES = [
  "Charter",
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

const DOCUMENT_STATUSES = ["Draft", "In Review", "Approved", "Rejected", "Archived"];

const STATUS_TONE = {
  Draft: "amber",
  "In Review": "blue",
  Approved: "green",
  Rejected: "red",
  Archived: "slate",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm() {
  return {
    title: "",
    documentType: "Other",
    version: "1.0",
    owner: "",
    status: "Draft",
    documentUrl: "",
    description: "",
    notes: "",
    lastUpdatedDate: today(),
  };
}

function safeUrl(url) {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}

function DocumentForm({ initial, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => ({ ...emptyForm(), ...(initial || {}) }));
  const [error, setError] = useState("");
  const types = DOCUMENT_TYPES.includes(form.documentType) ? DOCUMENT_TYPES : [form.documentType, ...DOCUMENT_TYPES];

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  }

  function submit(event) {
    event.preventDefault();
    if (!form.title.trim()) {
      setError("Give the document a title.");
      return;
    }
    if (form.documentUrl && !safeUrl(form.documentUrl.trim())) {
      setError("The link must start with http:// or https://");
      return;
    }
    onSubmit({ ...form, title: form.title.trim(), documentUrl: form.documentUrl.trim() });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Title" htmlFor="doc-title" required>
        <input id="doc-title" value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="e.g. Business requirements v1" className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Type" htmlFor="doc-type">
          <select id="doc-type" value={form.documentType} onChange={(e) => update("documentType", e.target.value)} className={inputClass}>
            {types.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </Field>
        <Field label="Status" htmlFor="doc-status">
          <select id="doc-status" value={form.status} onChange={(e) => update("status", e.target.value)} className={inputClass}>
            {DOCUMENT_STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </Field>
        <Field label="Version" htmlFor="doc-version">
          <input id="doc-version" value={form.version} onChange={(e) => update("version", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Owner" htmlFor="doc-owner">
          <input id="doc-owner" value={form.owner} onChange={(e) => update("owner", e.target.value)} placeholder="Name" className={inputClass} />
        </Field>
        <Field label="Last updated" htmlFor="doc-updated">
          <input id="doc-updated" type="date" value={form.lastUpdatedDate} onChange={(e) => update("lastUpdatedDate", e.target.value)} className={inputClass} />
        </Field>
      </div>
      <Field label="Link" htmlFor="doc-url" hint="Google Drive, SharePoint, OneDrive or any web address.">
        <input id="doc-url" type="url" value={form.documentUrl} onChange={(e) => update("documentUrl", e.target.value)} placeholder="https://" className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Description" htmlFor="doc-desc">
          <textarea id="doc-desc" value={form.description} onChange={(e) => update("description", e.target.value)} className={cx(inputClass, "min-h-[80px]")} />
        </Field>
        <Field label="Review notes" htmlFor="doc-notes">
          <textarea id="doc-notes" value={form.notes} onChange={(e) => update("notes", e.target.value)} className={cx(inputClass, "min-h-[80px]")} />
        </Field>
      </div>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary">
          {initial ? "Save changes" : "Add document"}
        </Button>
      </div>
    </form>
  );
}

/** Register of links to a project's documents (charters, specs, sign-offs). */
export default function ProjectDocumentsView({
  selectedProject,
  projectDocuments = [],
  onAddDocument,
  onUpdateDocument,
  onDeleteDocument,
}) {
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dialog, setDialog] = useState(null); // { document?: object }

  const allDocuments = useMemo(
    () => (selectedProject ? projectDocuments.filter((doc) => doc.projectId === selectedProject.id) : []),
    [projectDocuments, selectedProject]
  );

  const documents = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return allDocuments.filter((doc) => {
      const matchesSearch =
        !query ||
        [doc.title, doc.owner, doc.description, doc.notes, doc.documentType].some((value) =>
          String(value || "").toLowerCase().includes(query)
        );
      return (
        matchesSearch &&
        (typeFilter === "All" || doc.documentType === typeFilter) &&
        (statusFilter === "All" || doc.status === statusFilter)
      );
    });
  }, [allDocuments, searchText, typeFilter, statusFilter]);

  if (!selectedProject) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="Pick a project first"
        description='Documents belong to a single project. Choose one from "Project" at the top of the page.'
      />
    );
  }

  const count = (status) => allDocuments.filter((doc) => doc.status === status).length;

  async function remove(doc) {
    const ok = await confirmAction({
      title: `Delete "${doc.title}"?`,
      message: "Only the record is removed; the linked file stays where it is.",
      confirmLabel: "Delete record",
    });
    if (ok) {
      onDeleteDocument(doc.id);
      notify.success("Document record deleted.");
    }
  }

  return (
    <div className="space-y-4">
      <StatStrip
        items={[
          { label: "Documents", value: allDocuments.length },
          { label: "Approved", value: count("Approved"), tone: "text-emerald-700" },
          { label: "In review", value: count("In Review"), tone: "text-blue-700" },
          { label: "Draft", value: count("Draft") },
          { label: "Archived", value: count("Archived"), tone: "text-slate-500" },
        ]}
      />

      <Panel
        title="Document register"
        subtitle="Links to charters, specs, approvals and other project documents."
        icon={FileText}
        actions={
          <Button size="sm" variant="primary" icon={Plus} onClick={() => setDialog({})}>
            Add document
          </Button>
        }
      >
        <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3">
          <label className="relative min-w-[200px] flex-1">
            <span className="sr-only">Search documents</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search documents..." className={cx(inputClass, "py-1.5 pl-9")} />
          </label>
          <label>
            <span className="sr-only">Filter by type</span>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={cx(inputClass, "w-auto py-1.5")}>
              <option value="All">All types</option>
              {DOCUMENT_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={cx(inputClass, "w-auto py-1.5")}>
              <option value="All">All statuses</option>
              {DOCUMENT_STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
        </div>

        <DataTable
          rows={documents}
          empty={allDocuments.length ? "No documents match your filters." : "No documents yet. Add the charter or requirements first."}
          columns={[
            {
              key: "title",
              label: "Document",
              render: (doc) => {
                const url = safeUrl(doc.documentUrl);
                return (
                  <div className="min-w-0">
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-indigo-700 hover:underline">
                        {doc.title} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </a>
                    ) : (
                      <span className="font-medium text-slate-900">{doc.title}</span>
                    )}
                    {doc.description ? <div className="truncate text-xs text-slate-500">{doc.description}</div> : null}
                  </div>
                );
              },
            },
            { key: "documentType", label: "Type" },
            { key: "version", label: "Version", className: "tabular-nums" },
            { key: "owner", label: "Owner", render: (doc) => doc.owner || "—" },
            { key: "status", label: "Status", render: (doc) => <Badge tone={STATUS_TONE[doc.status] || "slate"}>{doc.status}</Badge> },
            { key: "lastUpdatedDate", label: "Updated", className: "whitespace-nowrap" },
            {
              key: "actions",
              label: <span className="sr-only">Actions</span>,
              className: "w-px whitespace-nowrap text-right",
              render: (doc) => (
                <span className="inline-flex gap-1">
                  <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setDialog({ document: doc })} aria-label={`Edit ${doc.title}`}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" icon={Trash2} onClick={() => remove(doc)} aria-label={`Delete ${doc.title}`}>
                    Delete
                  </Button>
                </span>
              ),
            },
          ]}
        />
      </Panel>

      <Modal
        open={Boolean(dialog)}
        onClose={() => setDialog(null)}
        title={dialog?.document ? "Edit document" : "Add document"}
        size="lg"
      >
        {dialog ? (
          <DocumentForm
            initial={dialog.document}
            onCancel={() => setDialog(null)}
            onSubmit={(values) => {
              if (dialog.document) {
                onUpdateDocument(dialog.document.id, { ...values, projectId: selectedProject.id });
                notify.success("Document updated.");
              } else {
                onAddDocument({ ...values, projectId: selectedProject.id });
                notify.success("Document added.");
              }
              setDialog(null);
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}
