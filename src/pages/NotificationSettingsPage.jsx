// src/pages/NotificationSettingsPage.jsx
import React, { useState, useEffect } from 'react';
import { COLORS } from '../constants';
import { Card } from '../components/Common';
import notificationService from '../services/notificationService';
import notificationSettingsService from '../services/notificationSettingsService';

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

function Toggle({ value, onChange, disabled = false }) {
  return (
    <div
      onClick={() => {
        if (!disabled) onChange(!value);
      }}
      style={{
        width: 44, height: 24, borderRadius: 999,
        background: value ? COLORS.primary : '#D1D5DB',
        position: 'relative', cursor: disabled ? 'wait' : 'pointer',
        transition: 'background 0.2s', flexShrink: 0,
        opacity: disabled ? 0.55 : 1,
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

function SettingRow({ icon, title, desc, enabled, onToggle, toggleDisabled = false, children }) {
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
        <Toggle value={enabled} onChange={onToggle} disabled={toggleDisabled} />
      </div>
      {children}
    </div>
  );
}

export default function NotificationSettingsPage({ onBack }) {
  const [settings, setSettings] = useState(loadSettings);
  const [permission, setPermission] = useState('checking');
  const [testStatus, setTestStatus] = useState('');
  const [carSettingsLoading, setCarSettingsLoading] = useState(true);
  const [carSettingsSaving, setCarSettingsSaving] = useState(false);
  const [carSettingsError, setCarSettingsError] = useState('');
  const isNativeNotification = notificationService.isNativeNotificationAvailable();

  useEffect(() => {
    let cancelled = false;

    notificationService.checkNotificationPermission()
      .then((status) => {
        if (!cancelled) setPermission(status);
      })
      .catch(() => {
        if (!cancelled) setPermission('unknown');
      });

    notificationSettingsService.ensureCarExpirySettings()
      .then((carExpiry) => {
        if (!cancelled) {
          setSettings((current) => ({ ...current, carExpiry }));
          setCarSettingsError('');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCarSettingsError('자동차 만기 알림 설정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
        }
      })
      .finally(() => {
        if (!cancelled) setCarSettingsLoading(false);
      });

    let listener = null;
    notificationService.addActionListener((event) => {
      console.log('보플랜 테스트 알림 클릭', event?.notification?.extra || {});
    }).then((handle) => {
      listener = handle;
    }).catch(() => {});

    return () => {
      cancelled = true;
      listener?.remove?.();
    };
  }, []);

  function update(key, val) {
    const next = { ...settings, [key]: { ...settings[key], ...val } };
    setSettings(next);
    localStorage.setItem('notif_settings', JSON.stringify(next));
  }

  async function updateCarExpiry(val) {
    if (carSettingsLoading || carSettingsSaving) return;

    const next = { ...settings.carExpiry, ...val };
    setCarSettingsSaving(true);
    setCarSettingsError('');
    try {
      const saved = await notificationSettingsService.updateCarExpirySettings(next);
      setSettings((current) => ({ ...current, carExpiry: saved }));
    } catch {
      setCarSettingsError('자동차 만기 알림 설정을 저장하지 못했습니다. 기존 설정을 유지합니다.');
    } finally {
      setCarSettingsSaving(false);
    }
  }

  async function requestPhoneNotificationPermission() {
    setTestStatus('');
    try {
      const status = await notificationService.requestNotificationPermission();
      setPermission(status);
      if (status === 'granted') {
        setTestStatus('알림 권한이 허용되었습니다.');
      } else if (status === 'denied') {
        setTestStatus('알림 권한이 허용되지 않았습니다. 휴대폰 설정에서 알림 권한을 확인해주세요.');
      } else {
        setTestStatus('알림 권한을 다시 확인해주세요.');
      }
    } catch (error) {
      setTestStatus(error.message || '알림 권한 요청 중 오류가 발생했습니다.');
    }
  }

  const permissionLabel = {
    checking: '확인 중',
    granted: '허용됨',
    denied: '허용되지 않음',
    prompt: '확인 필요',
    unsupported: '지원하지 않음',
    unknown: '확인 필요',
  }[permission] || '확인 필요';

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
        <Card style={{ marginBottom: 14 }}>
          <div style={{ paddingBottom: 14, borderBottom: `1px solid ${COLORS.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: COLORS.text }}>휴대폰 알림</div>
                <div style={{ fontSize: 12, color: COLORS.textGray, marginTop: 4, lineHeight: 1.5 }}>
                  {isNativeNotification
                    ? '보플랜의 일정과 고객 알림을 휴대폰 알림센터에서 받을 수 있습니다.'
                    : 'Windows PC에서는 Edge/Chrome 또는 설치된 보플랜 앱의 시스템 알림으로 테스트할 수 있습니다.'}
                </div>
              </div>
              <span style={{
                flexShrink: 0,
                borderRadius: 999,
                padding: '5px 10px',
                fontSize: 11,
                fontWeight: 800,
                color: permission === 'granted' ? '#047857' : COLORS.primary,
                background: permission === 'granted' ? '#ECFDF5' : COLORS.primaryBg,
                border: `1px solid ${permission === 'granted' ? '#A7F3D0' : '#DDD6FE'}`,
              }}>
                {permissionLabel}
              </span>
            </div>
          </div>

          {permission !== 'granted' && (
          <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
            <button
              type="button"
              onClick={requestPhoneNotificationPermission}
              style={styles.primaryButton}
            >
              알림 권한 켜기
            </button>
          </div>
          )}

          {testStatus && (
            <div style={{
              marginTop: 10,
              padding: '10px 12px',
              borderRadius: 12,
              background: '#F8FAFC',
              color: COLORS.textGray,
              fontSize: 12,
              lineHeight: 1.5,
            }}>
              {testStatus}
            </div>
          )}
        </Card>

        <Card>
          <SettingRow
            icon="🚗" title="자동차 만기 알림"
            desc="자동차 보험 만기 전 알림"
            enabled={settings.carExpiry.enabled}
            onToggle={v => updateCarExpiry({ enabled: v })}
            toggleDisabled={carSettingsLoading || carSettingsSaving}
          >
            <DaysSelector
              value={settings.carExpiry.days}
              onChange={d => updateCarExpiry({ days: d })}
              disabled={!settings.carExpiry.enabled || carSettingsLoading || carSettingsSaving}
            />
            {carSettingsError && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#B91C1C', lineHeight: 1.4 }}>
                {carSettingsError}
              </div>
            )}
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

const styles = {
  primaryButton: {
    width: '100%',
    border: 'none',
    borderRadius: 12,
    padding: '12px 14px',
    background: COLORS.primary,
    color: '#fff',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
  secondaryButton: {
    width: '100%',
    border: `1.5px solid ${COLORS.primary}`,
    borderRadius: 12,
    padding: '12px 14px',
    background: COLORS.primaryBg,
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: 800,
  },
};
