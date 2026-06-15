// src/pages/FaxClaimPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { COLORS } from '../constants';
import { Card, LoadingSpinner } from '../components/Common';
import customerService from '../services/customerService';
import faxHistoryService from '../services/faxHistoryService';
import consultationService from '../services/consultationService';
import { supabase } from '../supabaseClient';

const STORAGE_KEY = 'boplan_fax_claims';

const CLAIM_TYPES = ['실손', '진단비', '수술비', '입원비', '운전자', '치아', '기타'];

const REQUIRED_DOCS = {
  실손: ['진료비영수증', '진료비세부내역서', '처방전'],
  진단비: ['진료비영수증', '진료비세부내역서', '진단서', '검사결과지'],
  수술비: ['진료비영수증', '진료비세부내역서', '수술확인서', '수술기록지'],
  입원비: ['입퇴원확인서'],
  운전자: ['사고확인서', '진단서 또는 치료확인서'],
  치아: ['치과치료확인서', '치과진료기록', '파노라마 X-ray'],
  기타: ['기타 증빙서류'],
};

const INSURANCE_COMPANIES = [
  { name: '메리츠화재', type: '손해보험', faxType: 'auto', fax: '0505-021-3400', customerCenter: '1566-7711', pdf: '/insurance-forms/메리츠화재.pdf' },
  { name: 'DB손해보험', type: '손해보험', faxType: 'auto', fax: '0505-181-4862', customerCenter: '1588-0100', pdf: '/insurance-forms/DB손해보험금청구서.pdf' },
  { name: 'KB손해보험', type: '손해보험', faxType: 'auto', fax: '0505-136-6500', customerCenter: '1544-0114', pdf: '/insurance-forms/KB손해.pdf' },
  { name: '현대해상', type: '손해보험', faxType: 'auto', fax: '0507-774-6060', customerCenter: '1588-5656', pdf: '/insurance-forms/현대해상 청구.pdf' },
  { name: '한화손해보험', type: '손해보험', faxType: 'auto', fax: '0502-779-1004', customerCenter: '1566-8000', pdf: '/insurance-forms/한화손해.pdf' },
  { name: '흥국화재', type: '손해보험', faxType: 'auto', fax: '0504-800-0700', customerCenter: '1688-1688', pdf: '/insurance-forms/흥국화재.pdf' },
  { name: '롯데손해보험', type: '손해보험', faxType: 'auto', fax: '0507-333-9999', customerCenter: '1588-3344', pdf: '/insurance-forms/롯데손해.pdf' },
  { name: '삼성화재', type: '손해보험', faxType: 'auto', fax: '0505-161-1166', customerCenter: '1588-5114', pdf: '/insurance-forms/삼성화재.pdf' },
  { name: '하나손해보험', type: '손해보험', faxType: 'manual', fax: '', customerCenter: '1566-3000', pdf: '' },
  { name: '삼성생명', type: '생명보험', faxType: 'auto', fax: '0505-161-6000', customerCenter: '1588-3114', pdf: '/insurance-forms/삼성생명.pdf' },
  { name: '한화생명', type: '생명보험', faxType: 'auto', fax: '0503-8863-6363', customerCenter: '1588-6363', pdf: '/insurance-forms/한화생명.pdf' },
  { name: '흥국생명', type: '생명보험', faxType: 'manual', fax: '', customerCenter: '1588-2288', pdf: '/insurance-forms/흥국생명.pdf' },
  { name: '교보생명', type: '생명보험', faxType: 'auto', fax: '0505-181-0033', customerCenter: '1588-1001', pdf: '/insurance-forms/교보청구서류.pdf' },
  { name: 'ABL생명', type: '생명보험', faxType: 'manual', fax: '', customerCenter: '1588-6500', pdf: '/insurance-forms/ABL 사고보험금청구서.pdf' },
  { name: '하나생명', type: '생명보험', faxType: 'manual', fax: '', customerCenter: '1577-1112', pdf: '' },
];

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
}

function fileSizeText(size) {
  if (!size) return '';
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)}KB`;
  return `${(size / 1024 / 1024).toFixed(1)}MB`;
}

export default function FaxClaimPage({ onBack, profile, setProfile }) {
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [faxNumber, setFaxNumber] = useState('');
  const [claimType, setClaimType] = useState('실손');
  const [memo, setMemo] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);

  const selectedCompanyInfo = INSURANCE_COMPANIES.find((item) => item.name === selectedCompany);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim();

    if (!q) {
      return isMobile ? [] : customers.slice(0, 20);
    }

    return customers
      .filter((c) => {
        const name = c.name || '';
        const phone = c.phone || '';
        return name.includes(q) || phone.includes(q);
      })
      .slice(0, 20);
  }, [customers, customerSearch, isMobile]);

  const requiredDocs = REQUIRED_DOCS[claimType] || REQUIRED_DOCS.기타;
  const showCustomerList = !isMobile || customerSearch.trim().length > 0;

  useEffect(() => {
    loadCustomers();
    loadClaims();
  }, []);

  async function loadCustomers() {
    setLoading(true);
    try {
      const data = await customerService.list({ status: '전체', search: '' });
      setCustomers(data || []);
    } catch (e) {
      console.error(e);
      alert('고객 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function loadClaims() {
  try {
    const data = await faxHistoryService.list();
    setClaims(data || []);
  } catch (e) {
    console.error(e);
    alert('팩스 이력을 불러오지 못했습니다.');
  }
}

  function handleCompanyChange(name) {
    setSelectedCompany(name);
    const found = INSURANCE_COMPANIES.find((item) => item.name === name);

    if (!found) {
      setFaxNumber('');
      return;
    }

    setFaxNumber(found.faxType === 'manual' ? '' : found.fax || '');
  }

 function handleFileChange(e) {
  const files = Array.from(e.target.files || []);
  setSelectedFiles(files);
}

  async function copyFaxNumber() {
    if (!faxNumber) {
      alert('복사할 팩스번호가 없습니다.');
      return;
    }
    try {
      await navigator.clipboard.writeText(faxNumber);
      alert('팩스번호가 복사되었습니다.');
    } catch {
      alert(`팩스번호: ${faxNumber}`);
    }
  }

  function resetForm() {
    setSelectedCustomer(null);
    setCustomerSearch('');
    setSelectedCompany('');
    setFaxNumber('');
    setClaimType('실손');
    setMemo('');
    setSelectedFiles([]);
  }

 async function handleSendFax() {
  if ((profile?.fax_credit ?? 0) <= 0) {
    alert('팩스 크레딧이 부족합니다.');
    return;
  }

  if (!selectedCustomer) {
    alert('고객을 선택해주세요.');
    return;
  }

  if (!selectedCompany) {
    alert('보험사를 선택해주세요.');
    return;
  }
  if (!faxNumber) {
    alert('팩스번호를 입력하거나 보험사를 선택해주세요.');
    return;
  }
  if (selectedFiles.length === 0) {
    alert('팩스로 발송할 첨부파일을 선택해주세요.');
    return;
  }

  if (!window.confirm(`${selectedCompany}로 팩스를 발송할까요?`)) return;

  try {
    const formData = new FormData();
    formData.append('receiverNum', faxNumber);
    formData.append('receiverName', selectedCompany);
    formData.append('title', `${selectedCustomer.name || '고객'} ${claimType} 보험금 청구`);

    selectedFiles.forEach((file) => {
      formData.append('files', file);
    });

    const response = await fetch('/api/send-fax', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || '팩스 발송 실패');
    }

    const now = new Date().toISOString();

    const item = {
      id: `fax-${Date.now()}`,
      customer_id: String(selectedCustomer.db_id || selectedCustomer.id || ''),
      customer_name: selectedCustomer.name || '',
      customer_phone: selectedCustomer.phone || '',
      insurance_company: selectedCompany,
      fax_number: faxNumber,
      claim_type: claimType,
      memo: memo.trim(),
      files: selectedFiles.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type,
      })),
      status: '발송완료',
      receipt_num: result.receiptNum,
      request_num: result.requestNum,
      created_at: now,
      updated_at: now,
    };

   await faxHistoryService.create(item);

await consultationService.create({
  customer_id: item.customer_id,
  customer_name: item.customer_name,
  category: '청구',
  content: `[보험금청구]
보험사: ${selectedCompany}
청구유형: ${claimType}
팩스번호: ${faxNumber}
접수번호: ${result.receiptNum}
메모: ${memo.trim() || '-'}`,
  consulted_at: now,
});
await supabase
  .from('profiles')
  .update({
    fax_credit: Math.max(
      0,
      (profile?.fax_credit ?? 0) - 1
    ),
  })
  .eq(
    'user_id',
    (await supabase.auth.getUser()).data.user.id
  );

setProfile(prev => ({
  ...prev,
  fax_credit: Math.max(
    0,
    (prev?.fax_credit ?? 0) - 1
  ),
}));

await loadClaims();

alert(`팩스 발송 완료!\n접수번호: ${result.receiptNum}`);
resetForm();
  } catch (e) {
    console.error(e);
    alert('팩스 발송 중 오류가 발생했습니다: ' + (e.message || '알 수 없는 오류'));
  }
}

  async function handleDeleteClaim(id) {
  if (!window.confirm('이 청구이력을 삭제할까요?')) return;

  try {
    await faxHistoryService.remove(id);
    await loadClaims();
  } catch (e) {
    console.error(e);
    alert('청구이력 삭제 실패');
  }
}

  function openClaimForm() {
    if (!selectedCompanyInfo?.pdf) {
      alert('등록된 청구서 양식이 없습니다.');
      return;
    }
    window.open(selectedCompanyInfo.pdf, '_blank');
  }

  function renderCustomerCard() {
    return (
      <Card>
        <SectionTitle icon="👤" title="고객 선택" />
        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            <input
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="고객명 또는 전화번호 검색"
              style={styles.input}
            />

            {selectedCustomer && (
              <div style={styles.selectedBox}>
                <div style={{ fontWeight: 900, color: COLORS.primary }}>선택된 고객</div>
                <div style={{ marginTop: 5, fontSize: 14, color: COLORS.text }}>
                  {selectedCustomer.name} · {selectedCustomer.phone || '-'}
                </div>
              </div>
            )}

            {!showCustomerList ? (
              <div style={styles.mobileSearchGuide}>고객명을 검색하면 목록이 표시됩니다.</div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  marginTop: 10,
                  maxHeight: isMobile ? 220 : 300,
                  overflowY: 'auto',
                }}
              >
                {filteredCustomers.length === 0 ? (
                  <div style={styles.emptyText}>검색된 고객이 없습니다.</div>
                ) : (
                  filteredCustomers.map((customer) => {
                    const id = customer.db_id || customer.app_customer_id || customer.id;
                    const active =
                      String(selectedCustomer?.db_id || selectedCustomer?.app_customer_id || selectedCustomer?.id || '') ===
                      String(id);

                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSelectedCustomer(customer)}
                        style={{
                          ...styles.customerButton,
                          borderColor: active ? COLORS.primary : COLORS.border,
                          background: active ? COLORS.primaryBg : '#fff',
                        }}
                      >
                        <div style={{ fontWeight: 900, color: COLORS.text }}>{customer.name}</div>
                        <div style={{ fontSize: 12, color: COLORS.textGray, marginTop: 3 }}>
                          {customer.phone || '-'}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}
      </Card>
    );
  }

  function renderInsuranceCard() {
    return (
      <Card>
        <SectionTitle icon="🏢" title="보험사 / 팩스번호" />
        <select value={selectedCompany} onChange={(e) => handleCompanyChange(e.target.value)} style={styles.input}>
          <option value="">보험사 선택</option>
          {INSURANCE_COMPANIES.map((company) => (
            <option key={company.name} value={company.name}>
              {company.name}
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input
            value={faxNumber}
            onChange={(e) => setFaxNumber(e.target.value)}
            placeholder="팩스번호"
            style={{ ...styles.input, marginTop: 0, flex: 1, minWidth: 0 }}
          />
          <button type="button" onClick={copyFaxNumber} style={styles.copyButton}>
            복사
          </button>
        </div>

        <button type="button" onClick={openClaimForm} style={styles.formButton}>
          📄 청구서 보기
        </button>

        {selectedCompanyInfo?.faxType === 'manual' && (
          <div style={styles.manualNotice}>
            📢 해당 보험사는 보험금 청구용 팩스번호를 고객센터에서 확인 후 이용해주세요.
            <br />
            고객센터 : {selectedCompanyInfo.customerCenter}
            <br />
            안내받은 팩스번호를 직접 입력해주세요.
          </div>
        )}

        <div style={styles.helpText}>※ 보험사 연락처 페이지 데이터와 추후 연결 가능. 현재는 테스트용 기본 목록입니다.</div>
      </Card>
    );
  }

  function renderClaimTypeCard() {
    return (
      <Card>
        <SectionTitle icon="📄" title="청구유형 / 필요서류" />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CLAIM_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setClaimType(type)}
              style={{
                ...styles.chipButton,
                background: claimType === type ? COLORS.primary : COLORS.primaryBg,
                color: claimType === type ? '#fff' : COLORS.primary,
              }}
            >
              {type}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {requiredDocs.map((doc) => (
            <label key={doc} style={styles.checkRow}>
              <input type="checkbox" />
              <span>{doc}</span>
            </label>
          ))}
        </div>
      </Card>
    );
  }

  function renderFileCard() {
    return (
      <Card>
        <SectionTitle icon="📎" title="첨부파일" />
        <input
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={handleFileChange}
          style={styles.fileInput}
        />

        <div style={styles.helpText}>PDF, JPG, PNG 파일을 여러 개 선택할 수 있습니다. 현재는 실제 업로드 없이 파일명만 이력에 저장됩니다.</div>

        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {selectedFiles.length === 0 ? (
            <div style={styles.emptyText}>선택된 파일이 없습니다.</div>
          ) : (
            selectedFiles.map((file, idx) => (
              <div key={`${file.name}-${idx}`} style={styles.fileItem}>
                <span>📎 {file.name}</span>
                <span style={{ color: COLORS.textGray }}>{fileSizeText(file.size)}</span>
              </div>
            ))
          )}
        </div>
      </Card>
    );
  }

  function renderMemoCard() {
    return (
      <Card>
        <SectionTitle icon="📝" title="청구 메모" />
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="청구 메모를 입력하세요. 예: 6/5 고객 서류 수령, 메리츠 실손청구용"
          rows={isMobile ? 5 : 8}
          style={styles.textarea}
        />

        <button type="button" onClick={handleSendFax} style={styles.primaryButton}>
  📠 팩스 발송
</button>

        <div style={styles.helpText}>※ 팩스 발송 완료 후 접수번호와 함께 청구이력이 저장됩니다.</div>
      </Card>
    );
  }

  function renderHistoryCard() {
    return (
      <Card>
        <SectionTitle icon="🗂️" title="청구이력" />
        {claims.length === 0 ? (
          <div style={styles.emptyLarge}>아직 저장된 청구이력이 없습니다.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {claims.map((claim) => (
              <div key={claim.id} style={styles.claimCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 900, color: COLORS.text }}>📠 {claim.customer_name || '고객명 없음'}</div>
                    <div style={{ fontSize: 12, color: COLORS.textGray, marginTop: 3 }}>{claim.customer_phone || '-'}</div>
                  </div>
                  <span style={styles.claimTypeBadge}>{claim.claim_type}</span>
                </div>

                <div style={styles.claimGrid}>
                  <Info label="보험사" value={claim.insurance_company} />
                  <Info label="청구유형" value={claim.claim_type} />
                  <Info label="팩스번호" value={claim.fax_number} />
                  <Info label="등록일" value={formatDateTime(claim.created_at)} />
                </div>

                {claim.memo && <div style={styles.memoBox}>📝 {claim.memo}</div>}

                {claim.files?.length > 0 && (
                  <div style={styles.fileListBox}>
                    {claim.files.map((file, idx) => (
                      <span key={`${claim.id}-${file.name}-${idx}`} style={styles.fileBadge}>
                        📎 {file.name}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  <button type="button" onClick={() => handleDeleteClaim(claim.id)} style={styles.deleteButton}>
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  }

  return (
    <div style={{ minHeight: '100%', background: COLORS.bg, padding: isMobile ? 12 : 16, boxSizing: 'border-box', overflowY: 'auto' }}>
      <div
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          paddingBottom: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: isMobile ? 22 : 22, fontWeight: 900, color: COLORS.text }}>📠 보험팩스청구</div>
            <div style={{ fontSize: 13, color: COLORS.textGray, marginTop: 4 }}>고객별 보험금 청구이력을 저장하고 관리합니다.</div>
          </div>

          {onBack && (
            <button type="button" onClick={onBack} style={styles.ghostButton}>
              ← 홈
            </button>
          )}
        </div>

        <Card>
          <div style={{ background: 'linear-gradient(135deg,#7C3AED,#A78BFA)', color: '#fff', borderRadius: 16, padding: isMobile ? 14 : 16 }}>
           <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 6 }}>
  📠 보험금 팩스청구
</div>
<div style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.95 }}>
  고객 선택, 보험사 선택, 청구서류 첨부 후 팩스를 발송할 수 있습니다.
  발송이 완료되면 청구이력이 자동으로 저장됩니다.
  <br />
  ※ 발송 전 보험사 팩스번호와 첨부서류를 꼭 확인해주세요.
</div>
          </div>
        </Card>

        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {renderCustomerCard()}
            {renderInsuranceCard()}
            {renderClaimTypeCard()}
            {renderFileCard()}
            {renderMemoCard()}
            {renderHistoryCard()}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.52fr) minmax(0, 0.48fr)', gap: 14, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {renderCustomerCard()}
              {renderHistoryCard()}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {renderInsuranceCard()}
              {renderClaimTypeCard()}
              {renderFileCard()}
              {renderMemoCard()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontSize: 16, fontWeight: 900, color: COLORS.text }}>{title}</span>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: COLORS.textGray }}>{label}</div>
      <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 800, marginTop: 3 }}>{value || '-'}</div>
    </div>
  );
}

const styles = {
  input: {
    width: '100%',
    border: `1.5px solid ${COLORS.border}`,
    background: '#fff',
    borderRadius: 12,
    padding: '12px 14px',
    fontSize: 14,
    outline: 'none',
    color: COLORS.text,
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  textarea: {
    width: '100%',
    border: `1.5px solid ${COLORS.border}`,
    background: '#fff',
    borderRadius: 12,
    padding: '12px 14px',
    fontSize: 14,
    outline: 'none',
    color: COLORS.text,
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  fileInput: {
    width: '100%',
    border: `1.5px dashed ${COLORS.border}`,
    background: '#FAFAFF',
    borderRadius: 12,
    padding: 14,
    boxSizing: 'border-box',
    fontSize: 13,
    color: COLORS.text,
  },
  selectedBox: {
    background: COLORS.primaryBg,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  mobileSearchGuide: {
    marginTop: 10,
    background: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: COLORS.textGray,
    textAlign: 'center',
  },
  customerButton: {
    width: '100%',
    textAlign: 'left',
    border: `1.5px solid ${COLORS.border}`,
    borderRadius: 12,
    padding: 12,
    cursor: 'pointer',
  },
  copyButton: {
    border: 'none',
    background: COLORS.primary,
    color: '#fff',
    borderRadius: 12,
    padding: '0 16px',
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer',
    flexShrink: 0,
  },
  formButton: {
    marginTop: 10,
    width: '100%',
    border: 'none',
    background: '#EEF2FF',
    color: COLORS.primary,
    borderRadius: 12,
    padding: '12px 0',
    fontWeight: 900,
    cursor: 'pointer',
  },
  manualNotice: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    background: '#FEF3C7',
    border: '1px solid #F59E0B',
    color: '#92400E',
    fontSize: 13,
    lineHeight: 1.6,
  },
  chipButton: {
    border: 'none',
    borderRadius: 999,
    padding: '8px 13px',
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer',
  },
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#F8FAFC',
    borderRadius: 10,
    padding: '9px 11px',
    fontSize: 13,
    color: COLORS.text,
    fontWeight: 700,
  },
  primaryButton: {
    width: '100%',
    marginTop: 14,
    border: 'none',
    background: COLORS.primary,
    color: '#fff',
    borderRadius: 14,
    padding: '14px 0',
    fontSize: 15,
    fontWeight: 900,
    cursor: 'pointer',
  },
  ghostButton: {
    border: `1px solid ${COLORS.border}`,
    background: '#fff',
    color: COLORS.text,
    borderRadius: 999,
    padding: '8px 13px',
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  deleteButton: {
    border: 'none',
    background: '#FEE2E2',
    color: '#DC2626',
    borderRadius: 999,
    padding: '6px 11px',
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer',
  },
  helpText: {
    fontSize: 12,
    color: COLORS.textGray,
    marginTop: 8,
    lineHeight: 1.5,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textGray,
    padding: '8px 0',
  },
  emptyLarge: {
    background: '#F8FAFC',
    color: COLORS.textGray,
    borderRadius: 14,
    padding: 24,
    textAlign: 'center',
    fontSize: 14,
  },
  fileItem: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 10,
    background: '#F8FAFC',
    borderRadius: 10,
    padding: '9px 11px',
    fontSize: 12,
    color: COLORS.text,
  },
  claimCard: {
    border: `1px solid ${COLORS.border}`,
    background: '#fff',
    borderRadius: 16,
    padding: 14,
  },
  claimGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 10,
    marginTop: 12,
  },
  memoBox: {
    background: COLORS.primaryBg,
    color: COLORS.text,
    borderRadius: 12,
    padding: 10,
    fontSize: 13,
    lineHeight: 1.5,
    marginTop: 12,
  },
  fileListBox: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 10,
  },
  fileBadge: {
    background: '#F3F4F6',
    color: COLORS.textGray,
    borderRadius: 999,
    padding: '5px 9px',
    fontSize: 11,
    fontWeight: 800,
  },
  claimTypeBadge: {
    background: COLORS.primaryBg,
    color: COLORS.primary,
    borderRadius: 999,
    padding: '5px 10px',
    fontSize: 12,
    fontWeight: 900,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
};
