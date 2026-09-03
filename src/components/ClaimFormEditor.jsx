import React, { useEffect, useMemo, useRef, useState } from 'react';
import { COLORS } from '../constants';
import ClaimPdfPreview from './ClaimPdfPreview';
import { generateClaimFormPdf } from '../services/claimFormTemplateService';

const CLAIM_TYPE_OPTIONS = [
  { value: 'disease', label: '질병' },
  { value: 'injury', label: '상해' },
  { value: 'traffic', label: '교통사고' },
];

const REQUIRED_CONSENT_OPTIONS = [
  { key: 'collectUniqueId', label: '고유식별정보 수집·이용 동의' },
  { key: 'collectSensitive', label: '민감정보 수집·이용 동의' },
  { key: 'collectPersonalCredit', label: '개인(신용)정보 수집·이용 동의' },
  { key: 'provideUniqueId', label: '고유식별정보 제공 동의' },
  { key: 'provideSensitive', label: '민감정보 제공 동의' },
  { key: 'providePersonalCredit', label: '개인(신용)정보 제공 동의' },
  { key: 'queryUniqueId', label: '고유식별정보 조회 동의' },
  { key: 'querySensitive', label: '민감정보 조회 동의' },
  { key: 'queryPersonalCredit', label: '개인(신용)정보 조회 동의' },
];

function createInitialConsents() {
  return REQUIRED_CONSENT_OPTIONS.reduce((acc, option) => {
    acc[option.key] = false;
    return acc;
  }, {});
}

function normalizeBirth(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/[^\d-]/g, '').slice(0, 10);
}

function createInitialValues(customer) {
  return {
    insuredName: customer?.name || '',
    birth: normalizeBirth(customer?.birth),
    ssn: '',
    phone: customer?.phone || '',
    job: customer?.job || '',
    address: customer?.address || '',
    claimType: 'disease',
    accidentDate: '',
    diagnosis: '',
    claimDescription: '',
    accountHolder: customer?.name || '',
    bank: '',
    accountNumber: '',
    receiveSamePerson: true,
    beneficiarySameAsInsured: true,
    beneficiaryName: customer?.name || '',
  };
}

export default function ClaimFormEditor({ visible, onClose, customer, company, onAddFile }) {
  const [values, setValues] = useState(() => createInitialValues(customer));
  const [consents, setConsents] = useState(() => createInitialConsents());
  const [previewFile, setPreviewFile] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const canvasRef = useRef(null);
  const beneficiaryCanvasRef = useRef(null);
  const drawingRef = useRef(false);
  const hasSignatureRef = useRef(false);
  const hasBeneficiarySignatureRef = useRef(false);

  const companyName = company?.name || 'DB손해보험';

  useEffect(() => {
    if (!visible) return;
    setValues(createInitialValues(customer));
    setConsents(createInitialConsents());
    setPreviewFile(null);
    hasSignatureRef.current = false;
    hasBeneficiarySignatureRef.current = false;
    window.setTimeout(() => {
      clearSignature('insured');
      clearSignature('beneficiary');
    }, 0);
  }, [visible, customer]);

  useEffect(() => {
    if (!visible) return undefined;
    const handleHardwareBack = (event) => {
      if (event.defaultPrevented) return;
      event.preventDefault();
    };
    window.addEventListener('boplan:hardware-back', handleHardwareBack);
    return () => window.removeEventListener('boplan:hardware-back', handleHardwareBack);
  }, [visible]);

  useEffect(() => {
    if (visible) return;
    setValues(createInitialValues(customer));
    setConsents(createInitialConsents());
    setPreviewFile(null);
    hasSignatureRef.current = false;
    hasBeneficiarySignatureRef.current = false;
  }, [visible, customer]);

  const canPreview = useMemo(() => values.insuredName.trim().length > 0, [values.insuredName]);
  const allRequiredConsentsChecked = useMemo(
    () => REQUIRED_CONSENT_OPTIONS.every((option) => consents[option.key]),
    [consents]
  );

  if (!visible) return null;

  function updateField(name, value) {
    setValues((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'insuredName' && prev.beneficiarySameAsInsured) {
        next.beneficiaryName = value;
      }
      if (name === 'beneficiarySameAsInsured' && value) {
        next.beneficiaryName = prev.insuredName;
      }
      return next;
    });
    setPreviewFile(null);
  }

  function updateConsent(key, checked) {
    setConsents((prev) => ({ ...prev, [key]: checked }));
    setPreviewFile(null);
  }

  function toggleAllConsents(checked) {
    setConsents(
      REQUIRED_CONSENT_OPTIONS.reduce((acc, option) => {
        acc[option.key] = checked;
        return acc;
      }, {})
    );
    setPreviewFile(null);
  }

  function prepareCanvas(type = 'insured') {
    const canvas = type === 'beneficiary' ? beneficiaryCanvasRef.current : canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    if (canvas.width !== Math.floor(rect.width * ratio) || canvas.height !== Math.floor(rect.height * ratio)) {
      canvas.width = Math.floor(rect.width * ratio);
      canvas.height = Math.floor(rect.height * ratio);
      const ctx = canvas.getContext('2d');
      ctx.scale(ratio, ratio);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = '#111827';
    }
    return canvas;
  }

  function pointFromEvent(event, type = 'insured') {
    const canvas = prepareCanvas(type);
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const point = event.touches?.[0] || event;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  }

  function startSignature(event, type = 'insured') {
    event.preventDefault();
    const canvas = prepareCanvas(type);
    const point = pointFromEvent(event, type);
    if (!canvas || !point) return;
    const ctx = canvas.getContext('2d');
    drawingRef.current = type;
    if (type === 'beneficiary') {
      hasBeneficiarySignatureRef.current = true;
    } else {
      hasSignatureRef.current = true;
    }
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  }

  function drawSignature(event, type = 'insured') {
    if (drawingRef.current !== type) return;
    event.preventDefault();
    const canvas = prepareCanvas(type);
    const point = pointFromEvent(event, type);
    if (!canvas || !point) return;
    const ctx = canvas.getContext('2d');
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }

  function endSignature(event) {
    event?.preventDefault?.();
    drawingRef.current = false;
  }

  function clearSignature(type = 'insured') {
    const canvas = prepareCanvas(type);
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (type === 'beneficiary') {
      hasBeneficiarySignatureRef.current = false;
    } else {
      hasSignatureRef.current = false;
    }
    setPreviewFile(null);
  }

  async function handlePreview() {
    if (!canPreview) {
      alert('이름을 입력해주세요.');
      return;
    }

    setIsGenerating(true);
    try {
      const canvas = prepareCanvas();
      const beneficiaryCanvas = prepareCanvas('beneficiary');
      const signatureDataUrl = hasSignatureRef.current && canvas ? canvas.toDataURL('image/png') : '';
      const beneficiarySignatureDataUrl =
        !values.beneficiarySameAsInsured && hasBeneficiarySignatureRef.current && beneficiaryCanvas
          ? beneficiaryCanvas.toDataURL('image/png')
          : '';
      const file = await generateClaimFormPdf({
        companyName,
        values: {
          ...values,
          beneficiaryName: values.beneficiarySameAsInsured ? values.insuredName : values.beneficiaryName,
          consents,
        },
        signatureDataUrl,
        beneficiarySignatureDataUrl: values.beneficiarySameAsInsured ? signatureDataUrl : beneficiarySignatureDataUrl,
      });
      setPreviewFile(file);
    } catch (error) {
      console.error('청구서 PDF 생성 실패:', error);
      alert(error.message || '청구서 PDF 생성에 실패했습니다.');
    } finally {
      setIsGenerating(false);
    }
  }

  function handleClose() {
    setValues(createInitialValues(customer));
    setConsents(createInitialConsents());
    setPreviewFile(null);
    hasSignatureRef.current = false;
    hasBeneficiarySignatureRef.current = false;
    clearSignature('insured');
    clearSignature('beneficiary');
    onClose();
  }

  async function handleAddFile(file) {
    if (!allRequiredConsentsChecked) {
      alert('보험금 청구에 필요한 필수 동의 항목을 확인해주세요.');
      return;
    }
    await onAddFile(file);
    setPreviewFile(null);
    handleClose();
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.dialog}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>DB손해보험 청구서 작성</div>
            <div style={styles.subtitle}>입력값은 작성 중 화면에서만 사용되며, 별도 저장하지 않습니다.</div>
          </div>
          <button type="button" onClick={handleClose} style={styles.closeButton} aria-label="닫기">
            ✕
          </button>
        </div>

        <div style={styles.notice}>
          주민등록번호, 계좌번호, 진단명, 사고내용, 서명은 CRM/DB에 저장하지 않습니다. 미리보기 후 작성본 PDF를 팩스 첨부파일로만 추가합니다.
        </div>

        <div style={styles.formGrid}>
          <Section title="피보험자 정보">
            <Field label="이름" value={values.insuredName} onChange={(v) => updateField('insuredName', v)} />
            <Field label="생년월일" value={values.birth} onChange={(v) => updateField('birth', v)} placeholder="예: 880606 또는 1988-06-06" />
            <Field label="주민등록번호" value={values.ssn} onChange={(v) => updateField('ssn', v)} placeholder="필요 시 직접 입력" />
            <Field label="연락처" value={values.phone} onChange={(v) => updateField('phone', v)} />
            <Field label="직업" value={values.job} onChange={(v) => updateField('job', v)} />
            <Field label="주소" value={values.address} onChange={(v) => updateField('address', v)} multiline />
          </Section>

          <Section title="청구 정보">
            <div style={styles.fieldBlock}>
              <div style={styles.label}>청구유형</div>
              <div style={styles.segmented}>
                {CLAIM_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateField('claimType', option.value)}
                    style={{
                      ...styles.segmentButton,
                      background: values.claimType === option.value ? COLORS.primary : '#fff',
                      color: values.claimType === option.value ? '#fff' : COLORS.primary,
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <Field label="사고 또는 발병일" value={values.accidentDate} onChange={(v) => updateField('accidentDate', v)} placeholder="예: 2026-09-01" />
            <Field label="진단명" value={values.diagnosis} onChange={(v) => updateField('diagnosis', v)} />
            <Field label="사고내용 또는 청구내용" value={values.claimDescription} onChange={(v) => updateField('claimDescription', v)} multiline rows={5} />
          </Section>

          <Section title="보험금 수령">
            <label style={styles.checkRow}>
              <input
                type="checkbox"
                checked={values.receiveSamePerson}
                onChange={(e) => updateField('receiveSamePerson', e.target.checked)}
              />
              <span>피보험자 계좌와 동일 표시</span>
            </label>
            <Field label="예금주" value={values.accountHolder} onChange={(v) => updateField('accountHolder', v)} />
            <Field label="은행" value={values.bank} onChange={(v) => updateField('bank', v)} />
            <Field label="계좌번호" value={values.accountNumber} onChange={(v) => updateField('accountNumber', v)} />
          </Section>

          <Section title="보험수익자">
            <label style={styles.checkRow}>
              <input
                type="radio"
                name="beneficiaryType"
                checked={values.beneficiarySameAsInsured}
                onChange={() => updateField('beneficiarySameAsInsured', true)}
              />
              <span>피보험자와 동일</span>
            </label>
            <label style={styles.checkRow}>
              <input
                type="radio"
                name="beneficiaryType"
                checked={!values.beneficiarySameAsInsured}
                onChange={() => updateField('beneficiarySameAsInsured', false)}
              />
              <span>별도 보험수익자</span>
            </label>
            <Field
              label="보험수익자 성명"
              value={values.beneficiarySameAsInsured ? values.insuredName : values.beneficiaryName}
              onChange={(v) => updateField('beneficiaryName', v)}
              placeholder="보험수익자 성명"
              disabled={values.beneficiarySameAsInsured}
            />
            {!values.beneficiarySameAsInsured && (
              <>
                <div style={styles.label}>보험수익자 서명</div>
                <div style={styles.signatureBox}>
                  <canvas
                    ref={beneficiaryCanvasRef}
                    style={styles.signatureCanvas}
                    onMouseDown={(event) => startSignature(event, 'beneficiary')}
                    onMouseMove={(event) => drawSignature(event, 'beneficiary')}
                    onMouseUp={endSignature}
                    onMouseLeave={endSignature}
                    onTouchStart={(event) => startSignature(event, 'beneficiary')}
                    onTouchMove={(event) => drawSignature(event, 'beneficiary')}
                    onTouchEnd={endSignature}
                  />
                </div>
                <button type="button" onClick={() => clearSignature('beneficiary')} style={styles.secondaryButton}>
                  보험수익자 서명 지우기
                </button>
              </>
            )}
          </Section>

          <Section title="보험금 청구 필수 동의">
            <label style={{ ...styles.checkRow, ...styles.consentAllRow }}>
              <input
                type="checkbox"
                checked={allRequiredConsentsChecked}
                onChange={(e) => toggleAllConsents(e.target.checked)}
              />
              <span>필수 동의 전체 선택</span>
            </label>
            <div style={styles.consentList}>
              {REQUIRED_CONSENT_OPTIONS.map((option) => (
                <label key={option.key} style={styles.consentRow}>
                  <input
                    type="checkbox"
                    checked={Boolean(consents[option.key])}
                    onChange={(e) => updateConsent(option.key, e.target.checked)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </Section>

          <Section title="서명">
            <div style={styles.signatureBox}>
              <canvas
                ref={canvasRef}
                style={styles.signatureCanvas}
                onMouseDown={startSignature}
                onMouseMove={drawSignature}
                onMouseUp={endSignature}
                onMouseLeave={endSignature}
                onTouchStart={startSignature}
                onTouchMove={drawSignature}
                onTouchEnd={endSignature}
              />
            </div>
            <button type="button" onClick={clearSignature} style={styles.secondaryButton}>
              서명 지우기
            </button>
          </Section>
        </div>

        <div style={styles.footer}>
          <button type="button" onClick={handlePreview} disabled={isGenerating} style={{ ...styles.primaryButton, opacity: isGenerating ? 0.65 : 1 }}>
            {isGenerating ? 'PDF 생성 중...' : '청구서 미리보기'}
          </button>
          <button type="button" onClick={handleClose} style={styles.secondaryButton}>
            닫기
          </button>
        </div>

        <ClaimPdfPreview file={previewFile} onClose={() => setPreviewFile(null)} onAddFile={handleAddFile} />
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={styles.section}>
      <div style={styles.sectionTitle}>{title}</div>
      <div style={styles.sectionBody}>{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, placeholder = '', multiline = false, rows = 3, disabled = false }) {
  return (
    <label style={styles.fieldBlock}>
      <span style={styles.label}>{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          style={{ ...styles.textarea, opacity: disabled ? 0.75 : 1 }}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          style={{ ...styles.input, opacity: disabled ? 0.75 : 1 }}
        />
      )}
    </label>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 999998,
    background: 'rgba(17, 24, 39, 0.58)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    boxSizing: 'border-box',
  },
  dialog: {
    width: 'min(1040px, 100%)',
    maxHeight: '90vh',
    overflowY: 'auto',
    background: '#fff',
    borderRadius: 24,
    padding: 20,
    boxSizing: 'border-box',
    boxShadow: '0 24px 80px rgba(0,0,0,0.32)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: 900,
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 5,
    fontSize: 13,
    color: COLORS.textGray,
  },
  closeButton: {
    border: 'none',
    background: 'transparent',
    color: COLORS.textGray,
    fontSize: 24,
    lineHeight: 1,
    cursor: 'pointer',
  },
  notice: {
    background: '#FFF7ED',
    border: '1px solid #FED7AA',
    color: '#9A3412',
    borderRadius: 14,
    padding: 12,
    fontSize: 13,
    lineHeight: 1.55,
    marginBottom: 16,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 14,
  },
  section: {
    border: `1px solid ${COLORS.border}`,
    borderRadius: 18,
    padding: 14,
    background: '#FAFAFF',
    minWidth: 0,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 900,
    color: COLORS.text,
    marginBottom: 12,
  },
  sectionBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  fieldBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minWidth: 0,
  },
  label: {
    fontSize: 12,
    fontWeight: 900,
    color: COLORS.textGray,
  },
  input: {
    width: '100%',
    border: `1.5px solid ${COLORS.border}`,
    background: '#fff',
    borderRadius: 12,
    padding: '11px 12px',
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
    padding: '11px 12px',
    fontSize: 14,
    outline: 'none',
    color: COLORS.text,
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  segmented: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  segmentButton: {
    border: `1px solid ${COLORS.border}`,
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
    color: COLORS.text,
    fontSize: 13,
    fontWeight: 800,
  },
  consentAllRow: {
    padding: '10px 12px',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    background: '#fff',
  },
  consentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  consentRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.45,
    background: '#fff',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    padding: '9px 10px',
  },
  signatureBox: {
    border: `1.5px dashed ${COLORS.border}`,
    background: '#fff',
    borderRadius: 14,
    padding: 8,
  },
  signatureCanvas: {
    display: 'block',
    width: '100%',
    height: 120,
    touchAction: 'none',
    cursor: 'crosshair',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 16,
  },
  primaryButton: {
    border: 'none',
    background: COLORS.primary,
    color: '#fff',
    borderRadius: 999,
    padding: '11px 16px',
    fontSize: 14,
    fontWeight: 900,
    cursor: 'pointer',
  },
  secondaryButton: {
    border: `1px solid ${COLORS.border}`,
    background: '#fff',
    color: COLORS.primary,
    borderRadius: 999,
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer',
  },
};
