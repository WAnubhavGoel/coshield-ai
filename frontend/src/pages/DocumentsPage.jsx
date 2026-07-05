import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import axios from '../api/axiosConfig';

const VITE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const IconUpload = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="16 16 12 12 8 16"/>
    <line x1="12" y1="12" x2="12" y2="21"/>
    <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>
  </svg>
);

const IconFile = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

const IconRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
  </svg>
);

const IconEye = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
  </svg>
);

const StatusBadge = ({ status }) => {
  const map = {
    COMPLETED:  { cls: 'badge-success', label: 'Completed' },
    PROCESSING: { cls: 'badge-warning', label: 'Processing' },
    PENDING:    { cls: 'badge-muted',   label: 'Pending'    },
    FAILED:     { cls: 'badge-danger',  label: 'Failed'     },
  };
  const { cls, label } = map[status] || map.PENDING;
  return <span className={`badge ${cls}`}>{label}</span>;
};

const RoleBadge = ({ role }) => {
  const map = {
    ADMIN:             { cls: 'badge-danger',  label: 'Admin'            },
    COMPLIANCE_OFFICER:{ cls: 'badge-warning', label: 'Compliance'       },
    USER:              { cls: 'badge-muted',   label: 'User'             },
  };
  const { cls, label } = map[role] || { cls: 'badge-muted', label: role };
  return <span className={`badge ${cls}`}>{label}</span>;
};

/* ── Document Viewer Drawer ─────────────────────────────────────── */
function DocumentViewerDrawer({ doc, token, onClose }) {
  const serveUrl = `${VITE_API_URL}/documents/${doc.id}/serve?token=${encodeURIComponent(token)}`;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="doc-viewer-drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--danger)', opacity: 0.8 }}><IconFile /></span>
            {doc.title}
          </div>
          <button className="close-btn" onClick={onClose}><IconX /></button>
        </div>
        <div className="doc-viewer-frame-wrap">
          <iframe
            src={serveUrl}
            title={doc.title}
            className="doc-viewer-frame"
            type="application/pdf"
          />
        </div>
      </div>
    </div>
  );
}

/* ── Upload Drawer ──────────────────────────────────────────────── */
function UploadDrawer({ onClose, onSuccess, userRole }) {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [roleRequired, setRoleRequired] = useState('USER');
  const [loading, setLoading] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef();

  const canUpload = userRole === 'COMPLIANCE_OFFICER' || userRole === 'ADMIN';

  if (!canUpload) {
    return (
      <div className="drawer-overlay" onClick={onClose}>
        <div className="drawer" onClick={e => e.stopPropagation()}>
          <div className="drawer-title">
            Upload Document
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Only Compliance Officers or Admins can upload documents.
          </p>
        </div>
      </div>
    );
  }

  const handleDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === 'application/pdf') setFile(dropped);
    else toast('Only PDF files are supported', 'error');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) { toast('Please select a PDF file', 'error'); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('pdf', file);
      if (title) fd.append('title', title);
      fd.append('roleRequired', roleRequired);
      await axios.post('/documents/upload', fd, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      toast('Document uploaded and ingestion started!', 'success');
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Upload failed';
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-title">
          Upload Document
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Drop Zone */}
          <div
            className={`upload-zone ${drag ? 'drag-over' : ''}`}
            style={{ padding: '28px', marginBottom: 0 }}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              style={{ display: 'none' }}
              onChange={(e) => setFile(e.target.files[0])}
            />
            <div className="upload-icon" style={{ width: 40, height: 40, margin: '0 auto 10px' }}>
              <IconUpload />
            </div>
            {file
              ? <h3 style={{ color: 'var(--primary)' }}>{file.name}</h3>
              : <><h3>Drop PDF here</h3><p>or click to browse</p></>
            }
          </div>

          <div className="field">
            <label htmlFor="doc-title">Document Title (optional)</label>
            <input
              id="doc-title"
              type="text"
              placeholder="ISO 27001 Security Policy"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="doc-role">Minimum Role Required</label>
            <select
              id="doc-role"
              value={roleRequired}
              onChange={(e) => setRoleRequired(e.target.value)}
            >
              <option value="USER">User (everyone)</option>
              <option value="COMPLIANCE_OFFICER">Compliance Officer</option>
              <option value="ADMIN">Admin only</option>
            </select>
          </div>

          <button
            id="upload-submit-btn"
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
          >
            {loading ? <><div className="spinner" /> Uploading…</> : 'Upload & Ingest'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────── */
export default function DocumentsPage() {
  const { currentUser } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [viewerDoc, setViewerDoc] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const canManage = currentUser?.role === 'COMPLIANCE_OFFICER' || currentUser?.role === 'ADMIN';

  const load = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/documents');
      const data = response.data;
      setDocs(data.documents || []);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to fetch documents';
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Auto-open upload drawer if navigated from dashboard quick action
    if (searchParams.get('upload') === 'true') {
      setShowUpload(true);
    }
  }, []);

  const canUpload = currentUser?.role === 'COMPLIANCE_OFFICER' || currentUser?.role === 'ADMIN';

  const handleDelete = async (e, docId, docTitle) => {
    e.stopPropagation(); // prevent row click (viewer) from firing
    if (!window.confirm(`Delete "${docTitle}" and all its indexed chunks? This cannot be undone.`)) return;
    setDeletingId(docId);
    try {
      await axios.delete(`/documents/${docId}`);
      toast(`"${docTitle}" deleted successfully`, 'success');
      setDocs(prev => prev.filter(d => d.id !== docId));
      if (viewerDoc?.id === docId) setViewerDoc(null);
    } catch (err) {
      const msg = err.response?.data?.error || 'Delete failed';
      toast(msg, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const fmt = (iso) => new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });

  // Get JWT token from localStorage for the iframe serve URL
  const token = localStorage.getItem('coshield_token') || '';

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <h1>Documents</h1>
          <p>Manage your compliance policy library</p>
        </div>
        <div className="topbar-right">
          <button className="btn btn-ghost btn-sm" onClick={load} title="Refresh">
            <IconRefresh /> Refresh
          </button>
          {canUpload && (
            <button
              id="open-upload-btn"
              className="btn btn-primary btn-sm"
              onClick={() => setShowUpload(true)}
            >
              <IconUpload /> Upload PDF
            </button>
          )}
        </div>
      </header>

      <div className="page-content page-enter">
        {/* Upload Prompt (for non-uploaders) */}
        {!canUpload && (
          <div
            className="upload-zone"
            style={{ cursor: 'default', opacity: 0.6, marginBottom: '24px' }}
          >
            <div className="upload-icon">
              <IconUpload />
            </div>
            <h3>Document Upload</h3>
            <p>Only Compliance Officers and Admins can upload documents.</p>
          </div>
        )}

        {/* Documents Table */}
        <div className="docs-table">
          <div className="docs-table-header">
            <h2>All Documents ({docs.length})</h2>
            <span className="badge badge-info">Click a row to preview</span>
          </div>

          {loading ? (
            <div style={{ padding: '48px', display: 'flex', justifyContent: 'center' }}>
              <div className="spinner spinner-lg" />
            </div>
          ) : docs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><IconFile /></div>
              <div className="empty-title">No documents yet</div>
              <div className="empty-sub">
                {canUpload
                  ? 'Upload your first compliance PDF to get started.'
                  : 'No documents have been ingested for your organization yet.'}
              </div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Status</th>
                  <th>Access Level</th>
                  <th>Department</th>
                  <th>Uploaded By</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr
                    key={doc.id}
                    className="doc-row-clickable"
                    onClick={() => setViewerDoc(doc)}
                    title="Click to preview document"
                  >
                    <td>
                      <div className="doc-icon">
                        <span style={{ color: 'var(--danger)', opacity: 0.8 }}><IconFile /></span>
                        <span className="doc-name">{doc.title}</span>
                      </div>
                    </td>
                    <td><StatusBadge status={doc.status} /></td>
                    <td><RoleBadge role={doc.roleRequired} /></td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {doc.department?.name || '—'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                      {doc.uploadedBy?.email || '—'}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '12.5px' }}>
                      {fmt(doc.createdAt)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                        <span className="doc-preview-hint">
                          <IconEye /> Preview
                        </span>
                        {canManage && (
                          <button
                            className="btn-delete-doc"
                            title="Delete document"
                            disabled={deletingId === doc.id}
                            onClick={(e) => handleDelete(e, doc.id, doc.title)}
                          >
                            {deletingId === doc.id
                              ? <div className="spinner" style={{ width: 12, height: 12 }} />
                              : <IconTrash />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showUpload && (
        <UploadDrawer
          onClose={() => setShowUpload(false)}
          onSuccess={load}
          userRole={currentUser?.role}
        />
      )}

      {viewerDoc && (
        <DocumentViewerDrawer
          doc={viewerDoc}
          token={token}
          onClose={() => setViewerDoc(null)}
        />
      )}
    </>
  );
}
