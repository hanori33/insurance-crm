import React, { useEffect } from 'react';
import { COLORS } from '../constants';

export default function ClaimPdfPreview({ file, onClose, onAddFile }) {
  const [previewUrl, setPreviewUrl] = React.useState('');

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return undefined;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!file) return null;

  return (
    <div style={styles.previewBox}>
      <div style={styles.previewHeader}>
        <div>
          <div style={styles.previewTitle}>청구서 미리보기</div>
          <div style={styles.previewMeta}>{file.name}</div>
        </div>
        <div style={styles.previewActions}>
          <a href={previewUrl} target="_blank" rel="noreferrer" style={styles.secondaryButton}>
            새 창으로 보기
          </a>
          <button type="button" onClick={() => onAddFile(file)} style={styles.primaryButton}>
            작성본을 팩스에 추가
          </button>
          <button type="button" onClick={onClose} style={styles.closeButton}>
            닫기
          </button>
        </div>
      </div>

      {previewUrl && <iframe title="보험금 청구서 미리보기" src={previewUrl} style={styles.iframe} />}
    </div>
  );
}

const styles = {
  previewBox: {
    marginTop: 18,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 18,
    background: '#F8FAFC',
    padding: 12,
  },
  previewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: 900,
    color: COLORS.text,
  },
  previewMeta: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.textGray,
    wordBreak: 'break-all',
  },
  previewActions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  primaryButton: {
    border: 'none',
    background: COLORS.primary,
    color: '#fff',
    borderRadius: 999,
    padding: '9px 12px',
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer',
  },
  secondaryButton: {
    border: `1px solid ${COLORS.border}`,
    background: '#fff',
    color: COLORS.primary,
    borderRadius: 999,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 900,
    textDecoration: 'none',
  },
  closeButton: {
    border: 'none',
    background: '#E5E7EB',
    color: COLORS.text,
    borderRadius: 999,
    padding: '9px 12px',
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer',
  },
  iframe: {
    width: '100%',
    height: 'min(68vh, 720px)',
    border: 'none',
    borderRadius: 12,
    background: '#fff',
  },
};
