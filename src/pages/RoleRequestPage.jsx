// src/pages/RoleRequestPage.jsx
import React, { useState, useEffect } from 'react';
import { COLORS } from '../constants';
import { Card, LoadingSpinner } from '../components/Common';
import Field from '../components/Field';
import roleService, { isAdminRole } from '../services/roleService';
import noticeService from '../services/noticeService';
import inviteService from '../services/inviteService';
import organizationService from '../services/organizationService';

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

const ORG_REQUEST_STATUS_LABELS = {
  pending: '승인 대기',
  approved: '승인됨',
  rejected: '거절됨',
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

function getPendingInviteCode() {
  if (typeof window === 'undefined') return '';

  const params = new URLSearchParams(window.location.search);
  return (
    params.get('invite') ||
    localStorage.getItem('boplan_pending_invite_code') ||
    ''
  ).trim();
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

function getOrgPathLabel(unit) {
  const names = unit?.path_names || unit?.org_path_names || [];
  return names.length > 0 ? names.join(' > ') : unit?.name || '-';
}

export default function RoleRequestPage({ user }) {
  const [myRequest, setMyRequest] = useState(null);
  const [myRole, setMyRole] = useState('agent');
  const [allRequests, setAllRequests] = useState([]);
  const [registrationRequests, setRegistrationRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    userName: user?.user_metadata?.display_name || '',
    requestedRole: 'team_member',
    companyName: '',
    organization: '',
    branch: '',
    office: '',
    team: '',
  });

  const [saving, setSaving] = useState(false);
  const [companySearching, setCompanySearching] = useState(false);
  const [companyResults, setCompanyResults] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [orgSearch, setOrgSearch] = useState('');
  const [orgUnits, setOrgUnits] = useState([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [selectedOrgUnitId, setSelectedOrgUnitId] = useState('');
  const [registrationForm, setRegistrationForm] = useState({
    requestedName: '',
    businessRegistrationNumber: '',
    representativeName: '',
    contactEmail: user?.email || '',
  });
  const [registrationSaving, setRegistrationSaving] = useState(false);
  const [myRegistrationRequests, setMyRegistrationRequests] = useState([]);
  const [reviewingRegistrationId, setReviewingRegistrationId] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteSaving, setInviteSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const pendingInviteCode = getPendingInviteCode();
    if (pendingInviteCode) setInviteCode(pendingInviteCode);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [myReq, role, myOrgRequests] = await Promise.all([
        roleService.getMyRequest().catch(() => null),
        noticeService.getMyRole().catch(() => 'agent'),
        organizationService.listMyRegistrationRequests().catch(() => []),
      ]);

      setMyRequest(myReq);
      setMyRole(role || 'agent');
      setMyRegistrationRequests(myOrgRequests || []);

      if (isAdminRole(role)) {
        const all = await roleService.listAll().catch(() => []);
        setAllRequests(all);
      }

      if (role === 'superadmin') {
        const registrations = await organizationService
          .listRegistrationRequests('pending')
          .catch(() => []);
        setRegistrationRequests(registrations || []);
      } else {
        setRegistrationRequests([]);
      }
    } finally {
      setLoading(false);
    }
  }

  const hasActiveRequest =
    myRequest && (myRequest.status === 'pending' || myRequest.status === 'approved');

  const canShowForm = !hasActiveRequest && !isAdminRole(myRole);
  const selectedOrgUnit =
    orgUnits.find((unit) => unit.id === selectedOrgUnitId) || selectedCompany;

  async function handleCompanySearch() {
    const query = form.companyName.trim();

    if (!query) {
      setError('회사명을 입력하세요');
      return;
    }

    setCompanySearching(true);
    setError('');
    setSuccess('');

    try {
      const results = await organizationService.searchCompanies(query);
      setCompanyResults(results);
      setSelectedCompany(null);
      setSelectedOrgUnitId('');
      setOrgUnits([]);
      setRegistrationForm((prev) => ({
        ...prev,
        requestedName: query,
      }));

      if (results.length === 0) {
        setSuccess('검색 결과가 없습니다. 새 회사 등록 요청을 진행할 수 있습니다.');
      }
    } catch (e) {
      setError(e.message || '회사 검색에 실패했습니다.');
    } finally {
      setCompanySearching(false);
    }
  }

  async function handleSelectCompany(company) {
    setSelectedCompany(company);
    setCompanyResults([]);
    setSelectedOrgUnitId(company.id);
    setForm((prev) => ({
      ...prev,
      companyName: company.name,
      organization: company.name,
      branch: '',
      office: '',
      team: '',
    }));
    await loadCompanyOrganizations(company.id);
  }

  async function loadCompanyOrganizations(rootOrgUnitId, query = orgSearch) {
    if (!rootOrgUnitId) return;

    setOrgLoading(true);
    setError('');

    try {
      const units = await organizationService.listCompanyOrganizations(rootOrgUnitId, query);
      setOrgUnits(units);
      if (!selectedOrgUnitId && units[0]?.id) {
        setSelectedOrgUnitId(units[0].id);
      }
    } catch (e) {
      setError(e.message || '회사 조직을 불러오지 못했습니다.');
      setOrgUnits([]);
    } finally {
      setOrgLoading(false);
    }
  }

  async function handleSubmit() {
    if (!form.userName.trim()) {
      setError('이름을 입력하세요');
      return;
    }

    if (!selectedCompany?.id) {
      setError('먼저 회사를 검색하고 선택해주세요.');
      return;
    }

    if (!selectedOrgUnit?.id) {
      setError('신청할 조직을 선택해주세요.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await roleService.request({
        ...form,
        companyName: form.companyName.trim(),
        organization: selectedOrgUnit.name || form.organization.trim(),
        branch: form.branch.trim(),
        office: form.office.trim(),
        team: form.team.trim(),
        companyOrgUnitId: selectedCompany.id,
        requestedOrgUnitId: selectedOrgUnit.id,
      });
      setSuccess('권한 신청이 완료되었습니다! 관리자 승인 후 적용됩니다.');
      await load();
    } catch (e) {
      setError(e.message || '신청 실패');
    } finally {
      setSaving(false);
    }
  }

  async function handleRequestCompanyRegistration() {
    if (!registrationForm.requestedName.trim()) {
      setError('회사명을 입력해주세요.');
      return;
    }

    setRegistrationSaving(true);
    setError('');
    setSuccess('');

    try {
      await organizationService.requestRegistration(registrationForm);
      setSuccess('새 회사 등록 요청이 접수되었습니다. 최고관리자 승인 후 이용할 수 있습니다.');
      const myOrgRequests = await organizationService.listMyRegistrationRequests().catch(() => []);
      setMyRegistrationRequests(myOrgRequests || []);
    } catch (e) {
      setError(e.message || '회사 등록 요청에 실패했습니다.');
    } finally {
      setRegistrationSaving(false);
    }
  }

  async function handleAcceptInvite() {
    const code = inviteCode.trim();

    if (!code) {
      setError('초대코드를 입력해주세요.');
      return;
    }

    setInviteSaving(true);
    setError('');
    setSuccess('');

    try {
      const result = await inviteService.acceptInviteCode(code);
      setInviteCode('');
      localStorage.removeItem('boplan_pending_invite_code');
      setSuccess(`${result?.org_unit_name || '조직'}에 가입되었습니다.`);
      await load();
    } catch (e) {
      setError(e.message || '초대코드 가입에 실패했습니다.');
    } finally {
      setInviteSaving(false);
    }
  }

 async function handleApprove(req) {
  try {
    await roleService.approve(req.id);

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

  async function handleApproveRegistration(request) {
    setReviewingRegistrationId(request.id);

    try {
      await organizationService.approveRegistrationRequest(request.id);
      alert('회사 등록 요청을 승인했습니다.');
      await load();
    } catch (e) {
      alert(e.message || '회사 등록 요청 승인에 실패했습니다.');
    } finally {
      setReviewingRegistrationId('');
    }
  }

  async function handleRejectRegistration(request) {
    const reason = window.prompt('거절 사유를 입력해주세요. 비워도 됩니다.', '');
    if (reason === null) return;

    setReviewingRegistrationId(request.id);

    try {
      await organizationService.rejectRegistrationRequest(request.id, reason);
      alert('회사 등록 요청을 거절했습니다.');
      await load();
    } catch (e) {
      alert(e.message || '회사 등록 요청 거절에 실패했습니다.');
    } finally {
      setReviewingRegistrationId('');
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
            <div style={{ fontWeight: 800, fontSize: 15, color: COLORS.text, marginBottom: 8 }}>
              초대코드로 조직 가입
            </div>
            <div style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 14, lineHeight: 1.5 }}>
              관리자가 발급한 초대코드가 있으면 권한신청 없이 바로 팀원으로 연결됩니다.
            </div>

            <Field
              icon="#"
              placeholder="초대코드 입력"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />

            <button
              type="button"
              onClick={handleAcceptInvite}
              disabled={inviteSaving}
              style={{
                width: '100%',
                padding: '13px 0',
                borderRadius: 12,
                border: 'none',
                background: COLORS.primary,
                color: '#fff',
                fontSize: 15,
                fontWeight: 700,
                cursor: inviteSaving ? 'default' : 'pointer',
                opacity: inviteSaving ? 0.7 : 1,
              }}
            >
              {inviteSaving ? '가입 처리 중...' : '초대코드로 가입'}
            </button>
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
              placeholder="회사명을 입력하고 검색하세요"
              value={form.companyName}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  companyName: e.target.value,
                }))
              }
            />
            <button
              type="button"
              onClick={handleCompanySearch}
              disabled={companySearching}
              style={{
                width: '100%',
                padding: '12px 0',
                borderRadius: 12,
                border: 'none',
                background: COLORS.primaryBg,
                color: COLORS.primary,
                fontSize: 14,
                fontWeight: 800,
                cursor: companySearching ? 'default' : 'pointer',
                opacity: companySearching ? 0.7 : 1,
                marginBottom: 14,
              }}
            >
              {companySearching ? '회사 검색 중...' : '회사 검색'}
            </button>

            {companyResults.length > 0 && (
              <div
                style={{
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 14,
                  overflow: 'hidden',
                  marginBottom: 14,
                }}
              >
                {companyResults.map((company) => (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => handleSelectCompany(company)}
                    style={{
                      width: '100%',
                      border: 'none',
                      borderBottom: `1px solid ${COLORS.border}`,
                      background: selectedCompany?.id === company.id ? COLORS.primaryBg : '#fff',
                      color: COLORS.text,
                      padding: 12,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{company.name}</div>
                    <div style={{ fontSize: 12, color: COLORS.textGray, marginTop: 3 }}>
                      기존 등록 회사
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedCompany && (
              <div
                style={{
                  background: '#EEF2FF',
                  border: `1px solid ${COLORS.primaryBg}`,
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 14,
                  color: COLORS.text,
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                선택한 회사: {selectedCompany.name}
              </div>
            )}

            {!selectedCompany && form.companyName.trim() && companyResults.length === 0 && (
              <div
                style={{
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 16,
                  background: '#FFFBEB',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.text, marginBottom: 6 }}>
                  찾는 회사가 없나요?
                </div>
                <div style={{ fontSize: 12, color: COLORS.textGray, lineHeight: 1.5, marginBottom: 12 }}>
                  새 회사/GA 등록 요청을 보내면 최고관리자가 확인 후 회사 조직을 생성합니다.
                </div>
                <Field
                  icon="🏢"
                  placeholder="회사명"
                  value={registrationForm.requestedName}
                  onChange={(e) =>
                    setRegistrationForm((p) => ({ ...p, requestedName: e.target.value }))
                  }
                />
                <Field
                  icon="#"
                  placeholder="사업자등록번호 선택"
                  value={registrationForm.businessRegistrationNumber}
                  onChange={(e) =>
                    setRegistrationForm((p) => ({
                      ...p,
                      businessRegistrationNumber: e.target.value,
                    }))
                  }
                />
                <Field
                  icon="👤"
                  placeholder="대표자명 선택"
                  value={registrationForm.representativeName}
                  onChange={(e) =>
                    setRegistrationForm((p) => ({ ...p, representativeName: e.target.value }))
                  }
                />
                <Field
                  icon="✉️"
                  placeholder="연락처 이메일 선택"
                  value={registrationForm.contactEmail}
                  onChange={(e) =>
                    setRegistrationForm((p) => ({ ...p, contactEmail: e.target.value }))
                  }
                />
                <button
                  type="button"
                  onClick={handleRequestCompanyRegistration}
                  disabled={registrationSaving}
                  style={{
                    width: '100%',
                    padding: '12px 0',
                    borderRadius: 12,
                    border: 'none',
                    background: '#F59E0B',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: registrationSaving ? 'default' : 'pointer',
                    opacity: registrationSaving ? 0.7 : 1,
                  }}
                >
                  {registrationSaving ? '등록 요청 중...' : '새 회사 등록 요청'}
                </button>
              </div>
            )}

            {myRegistrationRequests.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.text, marginBottom: 8 }}>
                  내 회사 등록 요청
                </div>
                {myRegistrationRequests.slice(0, 3).map((request) => (
                  <div
                    key={request.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '9px 10px',
                      borderRadius: 12,
                      background: '#F8FAFC',
                      marginBottom: 6,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: COLORS.text, fontWeight: 700 }}>
                      {request.requested_name}
                    </span>
                    <span style={{ color: COLORS.textGray }}>
                      {ORG_REQUEST_STATUS_LABELS[request.status] || request.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <span style={{ fontSize: 13, color: COLORS.textGray, marginBottom: 6, display: 'block' }}>
              하위 조직 검색/선택
            </span>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                value={orgSearch}
                onChange={(e) => setOrgSearch(e.target.value)}
                placeholder="조직명 검색"
                disabled={!selectedCompany}
                style={{
                  flex: 1,
                  border: `1.5px solid ${COLORS.border}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                  fontSize: 14,
                  minWidth: 0,
                }}
              />
              <button
                type="button"
                onClick={() => loadCompanyOrganizations(selectedCompany?.id, orgSearch)}
                disabled={!selectedCompany || orgLoading}
                style={{
                  border: 'none',
                  borderRadius: 12,
                  padding: '0 14px',
                  background: COLORS.primaryBg,
                  color: COLORS.primary,
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: !selectedCompany || orgLoading ? 'default' : 'pointer',
                  opacity: !selectedCompany || orgLoading ? 0.6 : 1,
                }}
              >
                검색
              </button>
            </div>

            <select
              value={selectedOrgUnitId}
              onChange={(e) => {
                const unit = orgUnits.find((item) => item.id === e.target.value);
                setSelectedOrgUnitId(e.target.value);
                if (unit) {
                  setForm((p) => ({
                    ...p,
                    organization: unit.name,
                  }));
                }
              }}
              disabled={!selectedCompany || orgUnits.length === 0}
              style={{
                width: '100%',
                border: `1.5px solid ${COLORS.border}`,
                background: selectedCompany && orgUnits.length > 0 ? '#fff' : '#F3F4F6',
                borderRadius: 12,
                padding: '12px 14px',
                marginBottom: 14,
                fontSize: 15,
                minHeight: 48,
                color: COLORS.text,
                boxSizing: 'border-box',
              }}
            >
              <option value="">
                {selectedCompany ? '신청할 조직을 선택하세요' : '회사를 먼저 선택하세요'}
              </option>
              {orgUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {getOrgPathLabel(unit)}
                </option>
              ))}
            </select>

            {selectedOrgUnit && (
              <div style={{ fontSize: 12, color: COLORS.textGray, lineHeight: 1.5, marginBottom: 14 }}>
                선택 조직: {getOrgPathLabel(selectedOrgUnit)}
              </div>
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

        {myRole === 'superadmin' && (
          <Card>
            <div style={{ fontWeight: 800, fontSize: 15, color: COLORS.text, marginBottom: 16 }}>
              회사 등록 요청 관리
            </div>

            {registrationRequests.length === 0 ? (
              <div style={{ fontSize: 13, color: COLORS.textGray }}>
                대기 중인 회사 등록 요청이 없습니다
              </div>
            ) : (
              registrationRequests.map((request, i) => (
                <div
                  key={request.id}
                  style={{
                    padding: '14px 0',
                    borderBottom:
                      i < registrationRequests.length - 1 ? `1px solid ${COLORS.border}` : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: COLORS.text }}>
                        {displayValue(request.requested_name)}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: COLORS.textGray,
                          marginTop: 3,
                          wordBreak: 'break-all',
                        }}
                      >
                        신청자: {displayValue(request.requester_email)}
                      </div>
                    </div>

                    <span
                      style={{
                        background: STATUS_COLORS[request.status]?.bg || '#F3F4F6',
                        color: STATUS_COLORS[request.status]?.color || COLORS.text,
                        borderRadius: 999,
                        padding: '4px 12px',
                        fontSize: 12,
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        alignSelf: 'flex-start',
                      }}
                    >
                      {ORG_REQUEST_STATUS_LABELS[request.status] || request.status}
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
                    <RequestInfo label="사업자번호" value={request.business_registration_number} />
                    <RequestInfo label="대표자명" value={request.representative_name} />
                    <RequestInfo label="연락처 이메일" value={request.contact_email} />
                    <RequestInfo label="신청일시" value={formatRequestDate(request.created_at)} />
                  </div>

                  {request.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button
                        onClick={() => handleApproveRegistration(request)}
                        disabled={reviewingRegistrationId === request.id}
                        style={{
                          flex: 1,
                          padding: '8px 0',
                          borderRadius: 10,
                          border: 'none',
                          background: '#DCFCE7',
                          color: '#16A34A',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: reviewingRegistrationId === request.id ? 'default' : 'pointer',
                          opacity: reviewingRegistrationId === request.id ? 0.7 : 1,
                        }}
                      >
                        승인
                      </button>
                      <button
                        onClick={() => handleRejectRegistration(request)}
                        disabled={reviewingRegistrationId === request.id}
                        style={{
                          flex: 1,
                          padding: '8px 0',
                          borderRadius: 10,
                          border: 'none',
                          background: '#FEE2E2',
                          color: '#DC2626',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: reviewingRegistrationId === request.id ? 'default' : 'pointer',
                          opacity: reviewingRegistrationId === request.id ? 0.7 : 1,
                        }}
                      >
                        거절
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
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
                    <RequestInfo label="조직명" value={req.organization} />
                    <RequestInfo label="지점/하위조직" value={req.office || req.branch || req.team} />
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
