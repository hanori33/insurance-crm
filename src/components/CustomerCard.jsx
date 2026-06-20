
import React from 'react';
import { COLORS } from '../constants';
import { Avatar, StatusBadge, Divider } from './Common';
import { formatDate, formatDueDateWithDDay } from '../utils';

export default function CustomerCard({ customer, onClick, showDate = true, isLast = false }) {
  const isBabyCustomer = customer.customer_type === '태아' || Boolean(customer.baby_name);
  const babyName = String(customer.baby_name || '').trim() || '태아';
  const dueDateWithDDay = customer.due_date ? formatDueDateWithDDay(customer.due_date) : '';

  return (
    <>
      <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          <Avatar name={customer.name} size={44} src={customer.avatar_url} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: COLORS.text }}>{customer.name}</div>
            <div style={{ fontSize: 12, color: COLORS.textGray, marginTop: 2 }}>{customer.phone}</div>
            {isBabyCustomer && (
              <div
                style={{
                  fontSize: 11,
                  color: COLORS.primary,
                  marginTop: 2,
                  lineHeight: 1.4,
                  whiteSpace: 'normal',
                  overflowWrap: 'anywhere',
                }}
              >
                👶 {babyName}{dueDateWithDDay ? ` · ${dueDateWithDDay}` : ''}
              </div>
            )}
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
