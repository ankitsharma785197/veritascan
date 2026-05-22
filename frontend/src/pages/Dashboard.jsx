import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Eye, File, FileText, LogOut, Menu, ScanLine, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { Report } from '../components/Report.jsx';
import { ScanUploader } from '../components/ScanUploader.jsx';

const scanMessages = [
  'Extracting metadata...',
  'Checking pixel entropy...',
  'Running neural fingerprint analysis...',
  'Analyzing compression artifacts...',
  'Querying Gemini vision model...',
  'Compiling forensic report...'
];

function verdictTone(verdict) {
  if (verdict === 'LIKELY_AI_OR_EDITED') return { tone: 'tone-ai', label: 'AI' };
  if (verdict === 'LIKELY_AUTHENTIC') return { tone: 'tone-authentic', label: 'OK' };
  return { tone: 'tone-inconclusive', label: 'INC' };
}

function formatBytes(bytes = 0) {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function relativeTime(value) {
  if (!value) return 'just now';
  const seconds = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function HistoryList({ scans, activeScan, onSelect, onDelete, onClear, onClose }) {
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <>
      <div className="sidebar-head">
        <div className="sidebar-title">
          <Eye size={18} />
          <h2>Scan History</h2>
          <span className="count-badge">{scans.length}</span>
        </div>
        <div className="clear-confirm">
          {scans.length > 0 && (
            confirmClear ? (
              <>
                <button type="button" className="danger-btn" onClick={() => { onClear(); setConfirmClear(false); }}>Confirm</button>
                <button type="button" className="ghost-btn" onClick={() => setConfirmClear(false)}>Cancel</button>
              </>
            ) : (
              <button type="button" className="ghost-btn" onClick={() => setConfirmClear(true)}>Clear All</button>
            )
          )}
          {onClose && (
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close history">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="history-list">
        {scans.length ? scans.map((scan, index) => {
          const verdict = verdictTone(scan.verdict);
          return (
            <button
              type="button"
              className={`history-card ${activeScan?._id === scan._id ? 'active' : ''}`}
              key={scan._id}
              style={{ animationDelay: `${Math.min(index * 32, 260)}ms` }}
              onClick={() => onSelect(scan)}
            >
              <div className="history-main">
                <div className="history-name">
                  {scan.fileKind === 'pdf' ? <FileText size={15} /> : <File size={15} />}
                  <span title={scan.fileName}>{scan.fileName}</span>
                </div>
                <span className={`verdict-pill ${verdict.tone}`}>{verdict.label}</span>
              </div>
              <div className="history-meta">{formatBytes(scan.fileSize)} · {relativeTime(scan.createdAt)}</div>
              <div className="history-confidence">{scan.confidence}% confidence</div>
              <span
                className="history-delete"
                role="button"
                tabIndex={0}
                aria-label={`Delete ${scan.fileName}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(scan._id);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    onDelete(scan._id);
                  }
                }}
              >
                <Trash2 size={15} />
              </span>
            </button>
          );
        }) : (
          <div className="empty-history">
            <Eye size={34} />
            <p>No scans yet</p>
          </div>
        )}
      </div>
    </>
  );
}

function ScanAnimation({ file }) {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(9);
  const [previewUrl, setPreviewUrl] = useState('');
  const isImage = file?.type?.startsWith('image/');

  useEffect(() => {
    const statusTimer = window.setInterval(() => {
      setStep((current) => (current + 1) % scanMessages.length);
    }, 1500);
    const progressTimer = window.setInterval(() => {
      setProgress((current) => Math.min(93, current + Math.floor(Math.random() * 13) + 5));
    }, 850);

    return () => {
      window.clearInterval(statusTimer);
      window.clearInterval(progressTimer);
    };
  }, []);

  useEffect(() => {
    if (!file || !isImage) {
      setPreviewUrl('');
      return undefined;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);

  return (
    <section className="scan-panel" aria-label="Forensic scan in progress">
      <div className="scan-preview">
        {isImage && previewUrl ? <img src={previewUrl} alt={file.name} /> : <FileText size={82} />}
        <div className="scan-line" />
      </div>

      <div className="scan-status">
        <h2><ScanLine size={24} /> Analyzing with forensic engine...</h2>
        <p>{scanMessages[step]}</p>
      </div>

      <div className="progress-shell">
        <div className="progress-meta">
          <span>FORENSIC PASS</span>
          <span>{progress}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </section>
  );
}

export function Dashboard() {
  const { token, user, logout } = useAuth();
  const [file, setFile] = useState(null);
  const [scans, setScans] = useState([]);
  const [activeScan, setActiveScan] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function loadHistory() {
    const data = await api('/scans', { token });
    setScans(data.scans);
    setActiveScan((current) => current || data.scans[0] || null);
  }

  useEffect(() => {
    loadHistory().catch((err) => setError(err.message));
  }, []);

  async function scanFile() {
    if (!file || scanning) return;
    const body = new FormData();
    body.append('file', file);
    setScanning(true);
    setActiveScan(null);
    setError('');

    try {
      const data = await api('/scans', { method: 'POST', token, body });
      setScans((current) => [data.scan, ...current]);
      setActiveScan(data.scan);
      setFile(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  }

  async function deleteScan(scanId) {
    setError('');
    try {
      await api(`/scans/${scanId}`, { method: 'DELETE', token });
      setScans((current) => {
        const next = current.filter((scan) => scan._id !== scanId);
        if (activeScan?._id === scanId) setActiveScan(next[0] || null);
        return next;
      });
    } catch (err) {
      setError(err.message);
    }
  }

  async function clearScans() {
    setError('');
    try {
      await api('/scans', { method: 'DELETE', token });
      setScans([]);
      setActiveScan(null);
    } catch (err) {
      setError(err.message);
    }
  }

  function scanAnother() {
    setActiveScan(null);
    setFile(null);
    setError('');
  }

  const mainState = useMemo(() => {
    if (scanning) return 'scanning';
    if (activeScan) return 'report';
    return 'idle';
  }, [scanning, activeScan]);

  const history = (
    <HistoryList
      scans={scans}
      activeScan={activeScan}
      onSelect={(scan) => {
        setActiveScan(scan);
        setFile(null);
        setDrawerOpen(false);
      }}
      onDelete={deleteScan}
      onClear={clearScans}
    />
  );

  return (
    <main className="app-screen">
      <header className="topbar">
        <div className="brand-mark">
          <div className="brand-icon"><Eye size={20} /></div>
          <div>
            <div className="brand-word">VeritaScan</div>
            <div className="brand-sub">forensic content intelligence</div>
          </div>
        </div>

        <div className="topbar-actions">
          <span className="user-email">{user?.email}</span>
          <button type="button" className="history-toggle" onClick={() => setDrawerOpen(true)}>
            <Menu size={17} />
            History [{scans.length}]
          </button>
          <button type="button" className="ghost-btn logout-btn" onClick={logout}>
            <LogOut size={16} />
            <span className="logout-text">Log Out</span>
          </button>
        </div>
      </header>

      <div className="app-layout">
        <aside className="sidebar desktop-sidebar">{history}</aside>

        <section className="main-content">
          {error && (
            <div className="error-banner" role="alert">
              <AlertTriangle size={17} />
              <span>{error}</span>
            </div>
          )}

          {mainState === 'scanning' && <ScanAnimation file={file} />}

          {mainState === 'report' && (
            <Report scan={activeScan} onScanAnother={scanAnother} onDelete={deleteScan} />
          )}

          {mainState === 'idle' && (
            <div className="idle-state">
              <div className="idle-copy">
                <h1>Upload a file to begin forensic analysis</h1>
                <p>Images and PDFs are scanned for AI generation, edits, visual manipulation, and document tampering.</p>
              </div>
              <ScanUploader
                selectedFile={file}
                onFileSelect={setFile}
                onSubmit={scanFile}
                scanning={scanning}
              />
            </div>
          )}
        </section>
      </div>

      {drawerOpen && (
        <>
          <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} />
          <aside className="history-drawer" aria-label="Scan history drawer">
            <HistoryList
              scans={scans}
              activeScan={activeScan}
              onSelect={(scan) => {
                setActiveScan(scan);
                setFile(null);
                setDrawerOpen(false);
              }}
              onDelete={deleteScan}
              onClear={clearScans}
              onClose={() => setDrawerOpen(false)}
            />
          </aside>
        </>
      )}
    </main>
  );
}
