import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Loader2, Upload, X } from 'lucide-react';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

function formatBytes(bytes = 0) {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function ScanUploader({ onFileSelect, selectedFile, onSubmit, scanning }) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const isPdf = selectedFile?.type === 'application/pdf';
  const isImage = selectedFile?.type?.startsWith('image/');

  useEffect(() => {
    if (!selectedFile || !isImage) {
      setPreviewUrl('');
      return undefined;
    }

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile, isImage]);

  const fileSize = useMemo(() => formatBytes(selectedFile?.size), [selectedFile]);

  function pickFile(file) {
    if (!file || scanning || !allowedTypes.has(file.type)) return;
    onFileSelect(file);
  }

  function handleDragOver(event) {
    event.preventDefault();
    if (scanning) return;
    event.dataTransfer.dropEffect = 'copy';
    setIsDragging(true);
  }

  function handleDragLeave(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsDragging(false);
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    pickFile(event.dataTransfer.files?.[0]);
  }

  return (
    <section className={`upload-wrap upload-zone ${isDragging ? 'dragging' : ''}`}>
      <input
        id="file-input"
        className="file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        disabled={scanning}
        onChange={(event) => pickFile(event.target.files?.[0])}
      />

      {!selectedFile ? (
        <label
          htmlFor="file-input"
          className="dropzone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload size={48} />
          <div className="dropzone-main">
            <span className="dropzone-title">{isDragging ? 'Release to upload' : 'Drag & drop your file here'}</span>
            <span className="dropzone-sub">or click to browse</span>
          </div>
          <div className="format-row" aria-label="Supported formats">
            {['JPG', 'PNG', 'WEBP', 'PDF'].map((format) => <span className="format-badge" key={format}>{format}</span>)}
          </div>
          <span className="max-note">Max 20 MB</span>
        </label>
      ) : (
        <div className="file-preview" aria-label="Selected file preview">
          <button
            type="button"
            className="remove-file"
            onClick={() => onFileSelect(null)}
            disabled={scanning}
            aria-label="Remove selected file"
          >
            <X size={18} />
          </button>

          <div className="preview-stage">
            {isImage && previewUrl ? (
              <img src={previewUrl} alt={selectedFile.name} />
            ) : (
              <div className="pdf-preview">
                <FileText size={72} />
                <span title={selectedFile.name}>{selectedFile.name}</span>
              </div>
            )}
          </div>

          <div className="selected-meta">
            <strong title={selectedFile.name}>{selectedFile.name}</strong>
            <span>{isPdf ? 'PDF document' : 'Image file'} · {fileSize}</span>
          </div>

          {scanning ? (
            <div className="loading-row">
              <Loader2 className="spin" size={18} />
              <span>Analyzing...</span>
            </div>
          ) : (
            <button type="button" className="primary-btn" onClick={onSubmit}>
              Analyze File
              <span aria-hidden="true">-&gt;</span>
            </button>
          )}
        </div>
      )}
    </section>
  );
}
