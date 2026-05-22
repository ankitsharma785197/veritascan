import React, { useMemo, useState } from 'react';
import { ChevronDown, HelpCircle, ShieldCheck, Trash2, Upload, XCircle } from 'lucide-react';

const verdictMap = {
  LIKELY_AI_OR_EDITED: {
    label: 'AI / MANIPULATED',
    Icon: XCircle,
    color: 'var(--verdict-ai)',
    bg: 'var(--verdict-ai-bg)',
    glow: 'rgba(255, 68, 102, 0.28)'
  },
  LIKELY_AUTHENTIC: {
    label: 'AUTHENTIC',
    Icon: ShieldCheck,
    color: 'var(--verdict-authentic)',
    bg: 'var(--verdict-authentic-bg)',
    glow: 'rgba(0, 229, 160, 0.24)'
  },
  INCONCLUSIVE: {
    label: 'INCONCLUSIVE',
    Icon: HelpCircle,
    color: 'var(--verdict-inconclusive)',
    bg: 'var(--verdict-inconclusive-bg)',
    glow: 'rgba(255, 184, 0, 0.24)'
  }
};

const severityColors = {
  high: 'var(--verdict-ai)',
  medium: 'var(--verdict-inconclusive)',
  low: 'rgba(0, 212, 255, 0.6)'
};

function formatBytes(bytes = 0) {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value) {
  if (!value) return 'recently';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatMetadataValue(value) {
  if (typeof value === 'boolean') {
    return <span className={value ? 'bool-yes' : 'bool-no'}>{value ? 'Yes' : 'No'}</span>;
  }
  if (value === null || value === undefined || value === '') return 'Not available';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function metadataEntries(scan) {
  const data = scan.metadata || {};
  if (scan.fileKind === 'pdf') {
    return [
      ['Pages', data.pages],
      ['Extractable text', data.hasExtractableText],
      ['Text length', data.extractedTextLength],
      ['Extraction error', data.extractionError || 'None']
    ];
  }

  return [
    ['Width', data.width],
    ['Height', data.height],
    ['Format', data.format],
    ['Color space', data.space],
    ['EXIF present', data.hasExif],
    ['XMP present', data.hasXmp],
    ['ICC present', data.hasIcc]
  ];
}

export function Report({ scan, onScanAnother, onDelete }) {
  const [metadataOpen, setMetadataOpen] = useState(false);
  const verdict = verdictMap[scan?.verdict] || verdictMap.INCONCLUSIVE;
  const Icon = verdict.Icon;
  const entries = useMemo(() => metadataEntries(scan || {}), [scan]);
  const indicators = Array.isArray(scan?.indicators) ? scan.indicators.filter(Boolean) : [];

  if (!scan) return null;

  return (
    <section
      className="report"
      style={{
        '--verdict-color': verdict.color,
        '--verdict-bg': verdict.bg,
        '--verdict-glow': verdict.glow
      }}
    >
      <aside className="verdict-card">
        <div className="verdict-head">
          <div className="verdict-icon">
            <Icon size={42} />
          </div>
          <h2>{verdict.label}</h2>
        </div>

        <div className="divider" />

        <div>
          <div className="confidence-label">
            <span>Confidence</span>
            <strong>{scan.confidence}%</strong>
          </div>
          <div className="confidence-track">
            <div className="confidence-fill" style={{ '--fill': `${scan.confidence || 0}%` }} />
          </div>
        </div>

        <div className="divider" />

        <div className="file-facts">
          <strong title={scan.fileName}>{scan.fileName}</strong>
          <span>
            {scan.fileKind === 'pdf' ? 'PDF' : 'Image'} · {formatBytes(scan.fileSize)} · {formatDate(scan.createdAt)}
          </span>
        </div>
      </aside>

      <article className="details-card">
        <section className="report-section">
          <h3 className="section-label">Analysis Summary</h3>
          <p className="summary-text">{scan.explanation}</p>
        </section>

        <section className="report-section">
          <h3 className="section-label">Risk Indicators</h3>
          {indicators.length > 0 ? (
            <div className="indicator-list">
              {indicators.map((indicator, index) => {
                const severity = indicator.severity || 'medium';
                return (
                  <div
                    className="indicator-row"
                    key={`${indicator.label}-${index}`}
                    style={{ '--severity-color': severityColors[severity] || severityColors.medium }}
                  >
                    <span className="severity-dot" />
                    <div>
                      <strong>{indicator.label}</strong>
                      <p>{indicator.detail}</p>
                    </div>
                    <span className="severity-badge">{severity}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="no-indicators">No specific risk signals detected.</p>
          )}
        </section>

        <section className="metadata-box">
          <button
            type="button"
            className={`metadata-toggle ${metadataOpen ? 'open' : ''}`}
            onClick={() => setMetadataOpen((open) => !open)}
          >
            <span>Technical Metadata</span>
            <ChevronDown size={16} />
          </button>
          <div className={`metadata-content ${metadataOpen ? 'open' : ''}`}>
            <dl className="metadata-grid">
              {entries.map(([key, value]) => (
                <div className="metadata-item" key={key}>
                  <dt>{key}</dt>
                  <dd>{formatMetadataValue(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <div className="report-actions">
          <button type="button" className="primary-btn" onClick={onScanAnother}>
            <Upload size={17} />
            Scan Another File
          </button>
          <button type="button" className="danger-btn" onClick={() => onDelete(scan._id)}>
            <Trash2 size={16} />
            Delete This Report
          </button>
        </div>
      </article>
    </section>
  );
}
