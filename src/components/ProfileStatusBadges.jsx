import React from 'react';
import { getProStatusLabel } from '../utils';

export default function ProfileStatusBadges({ profile, isAdmin = false }) {
  const faxCredit = Number(profile?.fax_credit);
  const faxLabel = Number.isFinite(faxCredit) ? Math.max(0, Math.floor(faxCredit)) : 0;
  const membershipLabel = isAdmin ? '관리자' : getProStatusLabel(profile);

  const badgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 18,
    padding: '2px 6px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.2)',
    color: '#fff',
    fontSize: 10,
    fontWeight: 800,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        marginTop: 3,
        maxWidth: '100%',
        overflow: 'hidden',
      }}
    >
      <span style={badgeStyle}>{membershipLabel}</span>
      <span style={badgeStyle}>팩스 {faxLabel}건</span>
    </div>
  );
}
