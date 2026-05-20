import React from 'react';
import { COLORS } from '../constants';

export default function Modal({ visible, onClose, title, children }) {
  if (!visible) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(17, 24, 39, 0.58)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 999998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '85vh',
          overflowY: 'auto',
          background: COLORS.white || '#fff',
          borderRadius: 24,
          padding: '24px 20px 32px',
          boxSizing: 'border-box',
          boxShadow: '0 24px 80px rgba(0,0,0,0.32)',
          border: '1px solid rgba(255,255,255,0.9)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <span
            style={{
              fontWeight: 800,
              fontSize: 18,
              color: COLORS.text,
            }}
          >
            {title}
          </span>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 24,
              cursor: 'pointer',
              color: COLORS.textGray,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}