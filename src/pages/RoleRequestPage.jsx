// src/pages/RoleRequestPage.jsx
import React, { useState, useEffect } from 'react';
import { COLORS } from '../constants';
import { Card, LoadingSpinner } from '../components/Common';
import Field from '../components/Field';
import roleService from '../services/roleService';
import noticeService from '../services/noticeService';

const ROLE_OPTIONS = [
  { value: 'division_head', label: '사업단장' },
  { value: 'branch_head', label: '본부장' },
  { value: 'office_head', label: '지점장' },
  { value: 'team_leader', label: '팀장' },
];

const STATUS_LABELS = {
  pending: '검토 중',
  approved: '승인됨',
  rejected: '거절됨',
};

const STATUS_COLORS = {
  pending: { bg: '#FEF3C7', color: '#D97706' },
  approved: { bg: '#DCFCE7', color: '#16A34A' },
  rejected: { bg: '#FEE2E2', color: '#DC2626' },
};

export default function RoleRequestPage({ user }) {
  const [myRequest, setMyRequest] = useState(null);
  const [myRole, setMyRole] = useState('agent');
  const [allRequests, setAllRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    userName: user?.user_metadata?.display_name || '',
    requestedRole: 'team_leader',
    organization: '',
    branch: '',
    office: '',
    team: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [myReq, role] = await Promise.all([
        roleService.getMyRequest().catch(() => null),
        noticeService.getMyRole().catch(() => 'agent'),
      ]);
      setMyRequest(myReq);
      setMyRole(role);

      if (role === 'superadmin') {
        const all = await roleService.listAll().catch(() => []);
        setAllRequests(all);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!form.userName.trim()) { setError('이름을 입력하세요'); return; }
    setSaving(true);
    setError('');
    try {
      await roleService.request(form);
      setSuccess('권한 신청이 완료되었습니다! 관리자 승인 후 적용됩니다.');
      load();
    } catch(e) {
      setError(e.message || '신청 실패');
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(req) {
    try {
      await roleService.approve(req.id, req.user_id, req.requested_role, {
        organization: req.organization,
        branch: req.branch,
        office: req.office,
        team: req.team,
      });
      load();
    } catch(e) {
      alert(e.message || '승인 실패');
    }
  }

  async function handleReject(req) {
    if (!window.confirm('거절하시겠습니까?')) return;
    try {
      await roleService.reject(req.id);
      load();
    } catch(e) {
      alert(e.message || '거절 실패');
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        background: '#fff', padding: '14px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0,
      }}>
        <span style={{ fontWeight: 700, fontSize: 17, color: COLORS.text }}>권한 신청</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* 내 신청 현황 */}
        {myRequest && (
          <Card>
            <div style={{ fontWeight: 800, fontSize: 15, color: COLORS.text, marginBottom: 12 }}>
              내 신청 현황
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 14, color: COLORS.text, fontWeight: 600 }}>
                  {ROLE_OPTIONS.find(r => r.value === myRequest.requested_role)?.label || myRequest.requested_role}
                </div>
                <div style={{ fontSize: 12, color: COLORS.textGray, marginTop: 4 }}>
                  {new Date(myRequest.created_at).toLocaleDateString('ko-KR')} 신청
                </div>
              </div>
              <span style={{
                background: STATUS_COLORS[myRequest.status]?.bg || '#F3F4F6',
                color: STATUS_COLORS[myRequest.status]?.color || COLORS.text,
                borderRadius: 999, padding: '4px 12px',
                fontSize: 12, fontWeight: 800,
              }}>
                {STATUS_LABELS[myRequest.status] || myRequest.status}
              </span>
            </div>
          </Card>
        )}

        {/* 신청 폼 (승인되지 않은 경우만) */}
        {myRole === 'agent' && (!myRequest || myRequest.status === 'rejected') && (
          <Card>
            <div style={{ fontWeight: 800, fontSize: 15, color: COLORS.text, marginBottom: 16 }}>
              권한 신청하기
            </div>

            <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>이름</span>
            <Field
              icon="👤"
              placeholder="이름"
              value={form.userName}
              onChange={e => setForm(p => ({ ...p, userName: e.target.value }))}
            />

            <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 8, display: 'block' }}>신청 역할</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {ROLE_OPTIONS.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, requestedRole: r.value }))}
                  style={{
                    padding: '6px 14px', borderRadius: 999, border: 'none',
                    cursor: 'pointer', fontSize: 13,
                    background: form.requestedRole === r.value ? COLORS.primary : COLORS.primaryBg,
                    color: form.requestedRole === r.value ? '#fff' : COLORS.primary,
                    fontWeight: form.requestedRole === r.value ? 700 : 400,
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>소속 사업단</span>
            <Field icon="🏢" placeholder="사업단명" value={form.organization} onChange={e => setForm(p => ({ ...p, organization: e.target.value }))} />

            <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>본부</span>
            <Field icon="🏬" placeholder="본부명" value={form.branch} onChange={e => setForm(p => ({ ...p, branch: e.target.value }))} />

            <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>지점</span>
            <Field icon="🏪" placeholder="지점명" value={form.office} onChange={e => setForm(p => ({ ...p, office: e.target.value }))} />

            <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>팀</span>
            <Field icon="👥" placeholder="팀명" value={form.team} onChange={e => setForm(p => ({ ...p, team: e.target.value }))} />

            {error && <div style={{ color: '#DC2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            {success && <div style={{ color: '#16A34A', fontSize: 13, marginBottom: 12 }}>{success}</div>}

            <button
              onClick={handleSubmit}
              disabled={saving}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 12,
                border: 'none', background: COLORS.primary, color: '#fff',
                fontSize: 16, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {saving ? '신청 중...' : '권한 신청'}
            </button>
          </Card>
        )}

        {/* 관리자용 신청 목록 */}
        {myRole === 'superadmin' && (
          <Card>
            <div style={{ fontWeight: 800, fontSize: 15, color: COLORS.text, marginBottom: 16 }}>
              권한 신청 목록
            </div>
            {allRequests.length === 0 ? (
              <div style={{ fontSize: 13, color: COLORS.textGray }}>신청이 없습니다</div>
            ) : (
              allRequests.map((req, i) => (
                <div key={req.id} style={{
                  padding: '14px 0',
                  borderBottom: i < allRequests.length - 1 ? `1px solid ${COLORS.border}` : 'none',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.text }}>
                        {req.user_name} ({req.user_email})
                      </div>
                      <div style={{ fontSize: 12, color: COLORS.textGray, marginTop: 4 }}>
                        신청 역할: {ROLE_OPTIONS.find(r => r.value === req.requested_role)?.label}
                      </div>
                      {req.organization && <div style={{ fontSize: 12, color: COLORS.textGray }}>사업단: {req.organization}</div>}
                      {req.branch && <div style={{ fontSize: 12, color: COLORS.textGray }}>본부: {req.branch}</div>}
                      {req.office && <div style={{ fontSize: 12, color: COLORS.textGray }}>지점: {req.office}</div>}
                      {req.team && <div style={{ fontSize: 12, color: COLORS.textGray }}>팀: {req.team}</div>}
                      <div style={{ fontSize: 11, color: COLORS.textLight, marginTop: 4 }}>
                        {new Date(req.created_at).toLocaleDateString('ko-KR')} 신청
                      </div>
                    </div>
                    <span style={{
                      background: STATUS_COLORS[req.status]?.bg || '#F3F4F6',
                      color: STATUS_COLORS[req.status]?.color || COLORS.text,
                      borderRadius: 999, padding: '4px 12px',
                      fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap',
                    }}>
                      {STATUS_LABELS[req.status] || req.status}
                    </span>
                  </div>

                  {req.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button
                        onClick={() => handleApprove(req)}
                        style={{
                          flex: 1, padding: '8px 0', borderRadius: 10,
                          border: 'none', background: '#DCFCE7', color: '#16A34A',
                          fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        ✅ 승인
                      </button>
                      <button
                        onClick={() => handleReject(req)}
                        style={{
                          flex: 1, padding: '8px 0', borderRadius: 10,
                          border: 'none', background: '#FEE2E2', color: '#DC2626',
                          fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        ❌ 거절
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </Card>
        )}
      </div>
    </div>
  );
}