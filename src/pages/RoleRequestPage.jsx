// src/pages/RoleRequestPage.jsx
import React, { useState, useEffect } from 'react';
import { COLORS } from '../constants';
import { Card, LoadingSpinner } from '../components/Common';
import Field from '../components/Field';
import roleService, { isAdminRole } from '../services/roleService';
import noticeService from '../services/noticeService';

const ROLE_OPTIONS = [
  { value: 'division_head', label: '사업단장' },
  { value: 'branch_head', label: '본부장' },
  { value: 'deputy_branch_head', label: '부본부장' },
  { value: 'office_head', label: '지점장' },
  { value: 'deputy_office_head', label: '부지점장' },
  { value: 'team_leader', label: '팀장' },
  { value: 'team_member', label: '팀원' },
];

const REQUEST_ROLE_OPTIONS = ROLE_OPTIONS;
const COMPANY_ORGANIZATIONS = {
  '인카다이렉트': {
    '로얄사업단': [
      '배세영 지점',
      '장석환 지점',
      '이재원 지점',
      '육심호 지점',
      '김단비 지점',
    ],
  },
};

function normalizeCompanyKey(value) {
  return String(value || '').trim().replace(/\s+/g, '').toLowerCase();
}

function findCompany(value) {
  const key = normalizeCompanyKey(value);
  if (!key) return null;

  const companyName = Object.keys(COMPANY_ORGANIZATIONS).find(
    (name) => normalizeCompanyKey(name) === key
  );

  return companyName
    ? { companyName, organizations: COMPANY_ORGANIZATIONS[companyName] }
    : null;
}

const SELECT_STYLE = {
  width: '100%',
  border: `1.5px solid ${COLORS.border}`,
  background: '#fff',
  borderRadius: 12,
  padding: '12px 14px',
  marginBottom: 14,
  fontSize: 16,
  minHeight: 48,
  color: COLORS.text,
  boxSizing: 'border-box',
  outline: 'none',
};

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

function displayValue(value) {
  const text = String(value || '').trim();
  return text || '-';
}

function formatRequestDate(value) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function RequestInfo({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 600, wordBreak: 'break-word' }}>
        {displayValue(value)}
      </div>
    </div>
  );
}

export default function RoleRequestPage({ user }) {
  const [myRequest, setMyRequest] = useState(null);
  const [myRole, setMyRole] = useState('agent');
  const [allRequests, setAllRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    userName: user?.user_metadata?.display_name || '',
    requestedRole: 'team_member',
    companyName: '',
    organization: '',
    branch: '',
    office: '',
    customOrganization: '',
    customOffice: '',
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
      setMyRole(role || 'agent');

      if (isAdminRole(role)) {
        const all = await roleService.listAll().catch(() => []);
        setAllRequests(all);
      }
    } finally {
      setLoading(false);
    }
  }

  const hasActiveRequest =
    myRequest && (myRequest.status === 'pending' || myRequest.status === 'approved');

  const canShowForm = !hasActiveRequest && !isAdminRole(myRole);
  const selectedCompany = findCompany(form.companyName);
  const organizationOptions = selectedCompany
    ? Object.keys(selectedCompany.organizations)
    : [];
  const isKnownCompany = !!selectedCompany;
  const officeOptions = form.organization
    ? selectedCompany?.organizations[form.organization] || []
    : [];

  async function handleSubmit() {
    if (!form.userName.trim()) {
      setError('이름을 입력하세요');
      return;
    }

    if (!form.companyName.trim()) {
      setError('회사명을 입력하세요');
      return;
    }

    if (isKnownCompany) {
      if (!form.organization || !organizationOptions.includes(form.organization)) {
        setError('사업단을 선택하세요');
        return;
      }

      if (!form.office || !officeOptions.includes(form.office)) {
        setError('지점을 선택하세요');
        return;
      }
    } else {
      if (!form.customOrganization.trim()) {
        setError('사업단을 입력하세요');
        return;
      }

      if (!form.customOffice.trim()) {
        setError('지점을 입력하세요');
        return;
      }
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await roleService.request({
        ...form,
        companyName: selectedCompany?.companyName || form.companyName.trim(),
        organization: selectedCompany
          ? form.organization
          : form.customOrganization.trim(),
        office: selectedCompany
          ? form.office
          : form.customOffice.trim(),
        branch: selectedCompany
          ? form.office
          : form.customOffice.trim(),
      });
      setSuccess('권한 신청이 완료되었습니다! 관리자 승인 후 적용됩니다.');
      await load();
    } catch (e) {
      setError(e.message || '신청 실패');
    } finally {
      setSaving(false);
    }
  }

 async function handleApprove(req) {
  try {
    await roleService.approve(req.id, req.user_id, req.requested_role, {
      userName: req.user_name,
      companyName: req.company_name,
      organization: req.organization,
      branch: req.branch,
      office: req.office,
      team: req.team,
    });

    await load();
  } catch (e) {
    alert(e.message || '승인 실패');
  }
}

  async function handleReject(req) {
    if (!window.confirm('거절하시겠습니까?')) return;

    try {
      await roleService.reject(req.id);
      await load();
    } catch (e) {
      alert(e.message || '거절 실패');
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div
        style={{
          background: '#fff',
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: `1px solid ${COLORS.border}`,
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 17, color: COLORS.text }}>권한 신청</span>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {hasActiveRequest && (
          <Card>
            <div style={{ fontWeight: 800, fontSize: 15, color: COLORS.text, marginBottom: 12 }}>
              내 신청 현황
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, color: COLORS.text, fontWeight: 600 }}>
                  {ROLE_OPTIONS.find((r) => r.value === myRequest.requested_role)?.label ||
                    myRequest.requested_role}
                </div>

                <div style={{ fontSize: 12, color: COLORS.textGray, marginTop: 4 }}>
                  {myRequest.created_at
                    ? new Date(myRequest.created_at).toLocaleDateString('ko-KR')
                    : '-'}{' '}
                  신청
                </div>

                {myRequest.organization && (
                  <div style={{ fontSize: 12, color: COLORS.textGray, marginTop: 6 }}>
                    사업단: {myRequest.organization}
                  </div>
                )}
                {(myRequest.office || myRequest.branch) && (
                  <div style={{ fontSize: 12, color: COLORS.textGray }}>
                    지점: {myRequest.office || myRequest.branch}
                  </div>
                )}
              </div>

              <span
                style={{
                  background: STATUS_COLORS[myRequest.status]?.bg || '#F3F4F6',
                  color: STATUS_COLORS[myRequest.status]?.color || COLORS.text,
                  borderRadius: 999,
                  padding: '4px 12px',
                  fontSize: 12,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                }}
              >
                {STATUS_LABELS[myRequest.status] || myRequest.status}
              </span>
            </div>
          </Card>
        )}

        {canShowForm && (
          <Card>
            <div style={{ fontWeight: 800, fontSize: 15, color: COLORS.text, marginBottom: 16 }}>
              권한 신청하기
            </div>

            {myRequest?.status === 'rejected' && (
              <div
                style={{
                  background: '#FEE2E2',
                  color: '#DC2626',
                  padding: 12,
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 14,
                }}
              >
                이전 신청이 거절되었습니다. 내용을 수정해서 다시 신청할 수 있습니다.
              </div>
            )}

            <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>
              이름
            </span>
            <Field
              icon="👤"
              placeholder="이름"
              value={form.userName}
              onChange={(e) => setForm((p) => ({ ...p, userName: e.target.value }))}
            />

            <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 8, display: 'block' }}>
              신청 역할
            </span>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {REQUEST_ROLE_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, requestedRole: r.value }))}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 999,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    background: form.requestedRole === r.value ? COLORS.primary : COLORS.primaryBg,
                    color: form.requestedRole === r.value ? '#fff' : COLORS.primary,
                    fontWeight: form.requestedRole === r.value ? 700 : 400,
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>
              회사명
            </span>
            <Field
              icon="🏢"
              placeholder="예: 인카다이렉트"
              value={form.companyName}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  companyName: e.target.value,
                  organization: '',
                  office: '',
                  customOrganization: '',
                  customOffice: '',
                }))
              }
            />

            <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>
              사업단
            </span>
            {isKnownCompany ? (
              <select
                value={form.organization}
                onChange={(e) =>
                  setForm((p) => ({ ...p, organization: e.target.value, office: '' }))
                }
                style={SELECT_STYLE}
              >
                <option value="">사업단을 선택하세요</option>
                {organizationOptions.map((organization) => (
                  <option key={organization} value={organization}>
                    {organization}
                  </option>
                ))}
              </select>
            ) : (
              <Field
                icon="🏢"
                placeholder={
                  form.companyName.trim()
                    ? '사업단을 직접 입력하세요'
                    : '회사명을 먼저 입력해주세요'
                }
                value={form.customOrganization}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    customOrganization: e.target.value,
                  }))
                }
                disabled={!form.companyName.trim()}
              />
            )}

            <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>
              지점
            </span>
            {isKnownCompany ? (
              <select
                value={form.office}
                onChange={(e) => setForm((p) => ({ ...p, office: e.target.value }))}
                disabled={!form.organization || officeOptions.length === 0}
                style={{
                  ...SELECT_STYLE,
                  opacity: form.organization && officeOptions.length > 0 ? 1 : 0.65,
                  background: form.organization && officeOptions.length > 0 ? '#fff' : '#F3F4F6',
                }}
              >
                <option value="">
                  {form.organization ? '지점을 선택하세요' : '사업단을 먼저 선택해주세요'}
                </option>
                {officeOptions.map((office) => (
                  <option key={office} value={office}>
                    {office}
                  </option>
                ))}
              </select>
            ) : (
              <Field
                icon="📍"
                placeholder={
                  form.customOrganization.trim()
                    ? '지점을 직접 입력하세요'
                    : '사업단을 먼저 입력해주세요'
                }
                value={form.customOffice}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    customOffice: e.target.value,
                  }))
                }
                disabled={!form.companyName.trim() || !form.customOrganization.trim()}
              />
            )}

            {error && <div style={{ color: '#DC2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            {success && <div style={{ color: '#16A34A', fontSize: 13, marginBottom: 12 }}>{success}</div>}

            <button
              onClick={handleSubmit}
              disabled={saving}
              style={{
                width: '100%',
                padding: '14px 0',
                borderRadius: 12,
                border: 'none',
                background: COLORS.primary,
                color: '#fff',
                fontSize: 16,
                fontWeight: 700,
                cursor: saving ? 'default' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? '신청 중...' : '권한 신청'}
            </button>
          </Card>
        )}

        {isAdminRole(myRole) && (
          <Card>
            <div style={{ fontWeight: 800, fontSize: 15, color: COLORS.text, marginBottom: 16 }}>
              권한 신청 목록
            </div>

            {allRequests.length === 0 ? (
              <div style={{ fontSize: 13, color: COLORS.textGray }}>신청이 없습니다</div>
            ) : (
              allRequests.map((req, i) => (
                <div
                  key={req.id}
                  style={{
                    padding: '14px 0',
                    borderBottom: i < allRequests.length - 1 ? `1px solid ${COLORS.border}` : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: COLORS.text }}>
                        {displayValue(req.user_name)}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: COLORS.textGray,
                          marginTop: 3,
                          wordBreak: 'break-all',
                        }}
                      >
                        {displayValue(req.user_email)}
                      </div>
                    </div>

                    <span
                      style={{
                        background: STATUS_COLORS[req.status]?.bg || '#F3F4F6',
                        color: STATUS_COLORS[req.status]?.color || COLORS.text,
                        borderRadius: 999,
                        padding: '4px 12px',
                        fontSize: 12,
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {STATUS_LABELS[req.status] || req.status}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))',
                      gap: '12px 14px',
                      marginTop: 14,
                      padding: 12,
                      borderRadius: 12,
                      background: '#F8FAFC',
                    }}
                  >
                    <RequestInfo label="소속 유형" value={req.affiliation_type} />
                    <RequestInfo label="회사명" value={req.company_name} />
                    <RequestInfo label="사업단명" value={req.organization} />
                    <RequestInfo label="지점명" value={req.office || req.branch} />
                    <RequestInfo
                      label="신청 역할"
                      value={
                        ROLE_OPTIONS.find((r) => r.value === req.requested_role)?.label ||
                        req.requested_role
                      }
                    />
                    <RequestInfo label="신청일시" value={formatRequestDate(req.created_at)} />
                  </div>

                  {req.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button
                        onClick={() => handleApprove(req)}
                        style={{
                          flex: 1,
                          padding: '8px 0',
                          borderRadius: 10,
                          border: 'none',
                          background: '#DCFCE7',
                          color: '#16A34A',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        ✅ 승인
                      </button>
                      <button
                        onClick={() => handleReject(req)}
                        style={{
                          flex: 1,
                          padding: '8px 0',
                          borderRadius: 10,
                          border: 'none',
                          background: '#FEE2E2',
                          color: '#DC2626',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
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
