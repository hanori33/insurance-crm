
import React from 'react';
import { COLORS } from '../constants';
import { Avatar, StatusBadge, Divider } from './Common';
import { formatDate } from '../utils';

export default function CustomerCard({ customer, onClick, showDate = true, isLast = false }) {
  return (
    <>
      <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          <Avatar name={customer.name} size={44} src={customer.avatar_url} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: COLORS.text }}>{customer.name}</div>
            <div style={{ fontSize: 12, color: COLORS.textGray, marginTop: 2 }}>{customer.phone}</div>
            {showDate && customer.last_contact && (
              <div style={{ fontSize: 11, color: COLORS.textLight, marginTop: 1 }}>최근 상담: {formatDate(customer.last_contact)}</div>
            )}
          </div>
        </div>
        <StatusBadge status={customer.status} />
      </div>
      {!isLast && <Divider style={{ margin: '0 16px' }} />}
    </>
  );
}