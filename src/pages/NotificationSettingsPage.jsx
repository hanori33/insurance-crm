// src/pages/NotificationSettingsPage.jsx
import React, { useState, useEffect } from 'react';
import { COLORS } from '../constants';
import { Card } from '../components/Common';

const DEFAULTS = {
  carExpiry: { enabled: true, days: 30 },
  saleExpiry: { enabled: true, days: 30 },
  birthday: { enabled: true },
  baby: { enabled: true },
};

function loadSettings() {
  try {
    const saved = localStorage.getItem('notif_settings');
    return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS;
  } catch { return DEFAULTS; }
}

function Toggle({ value, onChange }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 24, borderRadius: 999,
        background: value ? COLORS.primary : '#D1D5DB',
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 3,
        left: value ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
      }} />
    </div>
  );
}

function DaysSelector({ value, onChange, disabled }) {
  const options = [7, 14, 30];
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
      {options.map(d => (
        <button
          key={d}
          onClick={() => onChange(d)}
          disabled={disabled}
          style={{
            flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
            border: `1.5px solid ${value === d ? COLORS.primary : COLORS.border}`,
            background: value === d ? COLORS.primaryBg : '#fff',
            color: value === d ? COLORS.primary : COLORS.textGray,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.4 : 1,
          }}
        >{d}일 전</button>
      ))}
    </div>
  );
}

function SettingRow({ icon, title, desc, enabled, onToggle, children }) {
  return (
    <div style={{ padding: '14px 0', borderBottom: `1px solid ${COLORS.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>{icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.text }}>{title}</div>
            {desc && <div style={{ fontSize: 12, color: COLORS.textGray, marginTop: 2 }}>{desc}</div>}
          </div>
        </div>
        <Toggle value={enabled} onChange={onToggle} />
      </div>
      {children}
    </div>
  );
}

export default function NotificationSettingsPage({ onBack }) {
  const [settings, setSettings] = useState(loadSettings);

  function update(key, val) {
    const next = { ...settings, [key]: { ...settings[key], ...val } };
    setSettings(next);
    localStorage.setItem('notif_settings', JSON.stringify(next));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        background: COLORS.white, padding: '14px 20px',
        display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0,
      }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: COLORS.textGray }}>←</button>
        <span style={{ fontWeight: 700, fontSize: 17, color: COLORS.text }}>알림 설정</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        <Card>
          <SettingRow
            icon="🚗" title="자동차 만기 알림"
            desc="자동차 보험 만기 전 알림"
            enabled={settings.carExpiry.enabled}
            onToggle={v => update('carExpiry', { enabled: v })}
          >
            <DaysSelector
              value={settings.carExpiry.days}
              onChange={d => update('carExpiry', { days: d })}
              disabled={!settings.carExpiry.enabled}
            />
          </SettingRow>

          <SettingRow
            icon="📋" title="보험 만기 알림"
            desc="보험 계약 만기 전 알림"
            enabled={settings.saleExpiry.enabled}
            onToggle={v => update('saleExpiry', { enabled: v })}
          >
            <DaysSelector
              value={settings.saleExpiry.days}
              onChange={d => update('saleExpiry', { days: d })}
              disabled={!settings.saleExpiry.enabled}
            />
          </SettingRow>

          <SettingRow
            icon="🎂" title="생일 알림"
            desc="고객 생일 당일 알림"
            enabled={settings.birthday.enabled}
            onToggle={v => update('birthday', { enabled: v })}
          />

          <div style={{ borderBottom: 'none' }}>
            <SettingRow
              icon="👶" title="태아 D-day 알림"
              desc="출산예정일 30일 이내 알림"
              enabled={settings.baby.enabled}
              onToggle={v => update('baby', { enabled: v })}
            />
          </div>
        </Card>

        <div style={{ fontSize: 12, color: COLORS.textGray, textAlign: 'center', marginTop: 16 }}>
          설정은 이 기기에 저장됩니다
        </div>
      </div>
    </div>
  );
}