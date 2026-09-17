// src/pages/NotificationSettingsPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { COLORS } from '../constants';
import { Card } from '../components/Common';
import notificationService from '../services/notificationService';
import { supabase } from '../supabaseClient';

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
  const [permission, setPermission] = useState('checking');
  const [testStatus, setTestStatus] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [pushTestLoading, setPushTestLoading] = useState(false);
  const [scheduleTest, setScheduleTest] = useState(null);
  const [scheduleTestBusy, setScheduleTestBusy] = useState(false);
  const [scheduleTestStatus, setScheduleTestStatus] = useState('');
  const scheduleTestLock = useRef(false);
  const [authDebug, setAuthDebug] = useState({
    loading: true,
    sessionExists: false,
    sessionEmail: '',
    userEmail: '',
  });
  const isNativeNotification = notificationService.isNativeNotificationAvailable();
  const testDelayMinutes = isNativeNotification ? 5 : 1;
  const testBody = isNativeNotification
    ? '보플랜 휴대폰 알림 테스트입니다. 🔔'
    : '보플랜 PC 알림 테스트입니다. 🔔';

  useEffect(() => {
    let cancelled = false;

    async function loadAuthDebug() {
      try {
        const [sessionResult, userResult] = await Promise.all([
          supabase.auth.getSession(),
          supabase.auth.getUser(),
        ]);

        if (cancelled) return;

        setAuthDebug({
          loading: false,
          sessionExists: Boolean(sessionResult.data?.session),
          sessionEmail: sessionResult.data?.session?.user?.email || '',
          userEmail: userResult.data?.user?.email || '',
        });
      } catch {
        if (!cancelled) {
          setAuthDebug({
            loading: false,
            sessionExists: false,
            sessionEmail: '',
            userEmail: '',
          });
        }
      }
    }

    loadAuthDebug();

    notificationService.checkNotificationPermission()
      .then((status) => {
        if (!cancelled) setPermission(status);
      })
      .catch(() => {
        if (!cancelled) setPermission('unknown');
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

  async function runScheduleTest(action) {
    if (scheduleTestLock.current || isNativeNotification) return;
    scheduleTestLock.current = true;
    setScheduleTestBusy(true);
    setScheduleTestStatus('');
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth?.user) throw new Error('로그인 상태를 확인해주세요.');
      if (action === 'prepare') {
        if (scheduleTest) throw new Error('기존 테스트 일정을 먼저 삭제해주세요.');
        const dueAt = Date.now() + 3 * 60 * 1000;
        const scheduledAt = new Date(dueAt + 60 * 1000);
        const id = Date.now() * 1000 + window.crypto.getRandomValues(new Uint32Array(1))[0] % 1000;
        const kst = new Date(scheduledAt.getTime() + 9 * 60 * 60 * 1000).toISOString();
        const { error } = await supabase.from('schedules').insert({
          id, user_id: auth.user.id, title: '알림 기능 테스트',
          memo: '알림 설정 임시 UI에서 생성한 검증용 일정',
          date: kst.slice(0, 10), time: kst.slice(11, 16),
          scheduled_at: scheduledAt.toISOString(), reminder_minutes: 1,
          push_enabled: true, completed: false, done: false,
          reminder_sent_at: null, customer_app_id: null, customer_name: null,
          schedule_type: 'etc',
        });
        if (error) throw new Error('테스트 일정 생성에 실패했습니다.');
        setScheduleTest({ id: String(id), owner: auth.user.id, scheduledAt: scheduledAt.toISOString(), dueAt, sent: false });
        setScheduleTestStatus('테스트 일정 생성 완료. 화면을 유지한 상태로 알림 예정 시각까지 기다려주세요.');
      } else {
        if (!scheduleTest || scheduleTest.owner !== auth.user.id) throw new Error('테스트 일정을 만든 계정으로 로그인해주세요.');
        if (action === 'delete') {
          const { data, error } = await supabase.from('schedules').delete()
            .eq('id', scheduleTest.id).eq('user_id', auth.user.id)
            .eq('title', '알림 기능 테스트')
            .eq('memo', '알림 설정 임시 UI에서 생성한 검증용 일정').select('id');
          if (error || data?.length !== 1) throw new Error('테스트 일정 삭제를 확인하지 못했습니다.');
          setScheduleTest(null);
          setScheduleTestStatus('테스트 일정 삭제 완료. 발송 검증 기록은 유지됩니다.');
        } else {
          if (Date.now() < scheduleTest.dueAt) {
            setScheduleTestStatus('아직 알림 시간이 아닙니다.');
            return;
          }
          const { data, error } = await supabase.functions.invoke('boplan-schedule-push', {
            body: { testMode: true, scheduleId: scheduleTest.id },
          });
          if (error || !data || data.error) throw new Error('일정 Push 테스트에 실패했습니다. 로그인 상태와 함수 상태를 확인해주세요.');
          const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
          if (count(data.sent) > 0) {
            setScheduleTest(current => ({ ...current, sent: true }));
            setScheduleTestStatus(`일정 Push 테스트 완료 · 성공 ${count(data.sent)}건 / 실패 ${count(data.failed)}건 · 확인 ${count(data.checked)}건 / 알림 대상 ${count(data.due)}건`);
          } else if (scheduleTest.sent && count(data.due) === 0) {
            setScheduleTestStatus('중복 발송 방지 확인 · 이미 처리된 일정입니다.');
          } else {
            setScheduleTestStatus(`발송 성공 없음 · 성공 0건 / 실패 ${count(data.failed)}건 · 확인 ${count(data.checked)}건 / 알림 대상 ${count(data.due)}건`);
          }
        }
      }
    } catch (error) {
      setScheduleTestStatus(error.message);
    } finally {
      scheduleTestLock.current = false;
      setScheduleTestBusy(false);
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

  async function scheduleTestNotification() {
    setTestLoading(true);
    setTestStatus('');

    try {
      const status = await notificationService.checkNotificationPermission();
      setPermission(status);

      if (status !== 'granted') {
        setTestStatus('먼저 알림 권한을 켜주세요.');
        return;
      }

      await notificationService.cancelLocalNotification(notificationService.TEST_NOTIFICATION_ID);
      await notificationService.scheduleLocalNotification({
        id: notificationService.TEST_NOTIFICATION_ID,
        title: '보플랜',
        body: testBody,
        delayMinutes: testDelayMinutes,
        extra: {
          type: 'test',
          source: 'notification-settings',
          platform: isNativeNotification ? 'android' : 'web',
        },
      });

      setTestStatus(`${testDelayMinutes}분 후 보플랜 테스트 알림이 울립니다.`);
    } catch (error) {
      setTestStatus(error.message || '테스트 알림 예약 중 오류가 발생했습니다.');
    } finally {
      setTestLoading(false);
    }
  }

  async function sendWebPushTestNotification() {
    setPushTestLoading(true);
    setTestStatus('');

    try {
      const status = await notificationService.checkNotificationPermission();
      setPermission(status);

      if (status !== 'granted') {
        setTestStatus('먼저 알림 권한을 켜주세요.');
        return;
      }

      const result = await notificationService.sendWebPushTestNotification();
      setTestStatus(`PC 푸시 테스트를 보냈습니다. 성공 ${result.sent || 0}건 / 실패 ${result.failed || 0}건`);
    } catch (error) {
      setTestStatus(error.message || 'PC 푸시 테스트 발송 중 오류가 발생했습니다.');
    } finally {
      setPushTestLoading(false);
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
            {!isNativeNotification && (
              <div style={{
                marginTop: 10,
                padding: '10px 12px',
                borderRadius: 12,
                background: '#F8FAFC',
                color: COLORS.textGray,
                fontSize: 12,
                lineHeight: 1.5,
                border: `1px solid ${COLORS.border}`,
              }}>
                <div style={{ fontWeight: 800, color: COLORS.text, marginBottom: 4 }}>
                  임시 진단
                </div>
                <div>세션 존재: {authDebug.loading ? '확인 중' : authDebug.sessionExists ? '있음' : '없음'}</div>
                <div>현재 인증 계정: {authDebug.loading ? '확인 중' : authDebug.userEmail || '-'}</div>
                <div>세션 계정: {authDebug.loading ? '확인 중' : authDebug.sessionEmail || '-'}</div>
                <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                  <div>임시 일정 검증 · 새로고침하거나 화면을 나가기 전에 테스트 일정을 삭제해주세요.</div>
                  <button type="button" style={styles.secondaryButton} disabled={scheduleTestBusy || Boolean(scheduleTest)} onClick={() => runScheduleTest('prepare')}>일정 Push 테스트 준비</button>
                  {scheduleTest && <>
                    <div>예정 시각: {new Date(scheduleTest.scheduledAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (KST)</div>
                    <div>알림 예정 시각: {new Date(scheduleTest.dueAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (KST)</div>
                    <button type="button" style={styles.secondaryButton} disabled={scheduleTestBusy} onClick={() => runScheduleTest('send')}>일정 Push 지금 테스트</button>
                    <button type="button" style={styles.secondaryButton} disabled={scheduleTestBusy} onClick={() => runScheduleTest('delete')}>테스트 일정 삭제</button>
                  </>}
                  {scheduleTestStatus && <div role="status">{scheduleTestStatus}</div>}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
            <button
              type="button"
              onClick={requestPhoneNotificationPermission}
              style={styles.primaryButton}
            >
              알림 권한 켜기
            </button>
            <button
              type="button"
              onClick={scheduleTestNotification}
              disabled={permission !== 'granted' || testLoading}
              style={{
                ...styles.secondaryButton,
                opacity: permission !== 'granted' || testLoading ? 0.55 : 1,
                cursor: permission !== 'granted' || testLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {testLoading ? '예약 중...' : `${testDelayMinutes}분 후 테스트 알림 보내기`}
            </button>
            {!isNativeNotification && (
              <button
                type="button"
                onClick={sendWebPushTestNotification}
                disabled={permission !== 'granted' || pushTestLoading}
                style={{
                  ...styles.secondaryButton,
                  opacity: permission !== 'granted' || pushTestLoading ? 0.55 : 1,
                  cursor: permission !== 'granted' || pushTestLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {pushTestLoading ? '발송 중...' : 'PC 푸시 테스트 보내기'}
              </button>
            )}
          </div>

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
