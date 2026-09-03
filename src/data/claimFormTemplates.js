export const CLAIM_FORM_TEMPLATES = {
  dbInsurance: {
    companyName: 'DB손해보험',
    formUrl: '/insurance-forms/DB손해보험금청구서.pdf',
    outputName: 'DB손해보험_보험금청구서',
    pageSize: { width: 595.276, height: 841.89 },
    // page is pdf-lib's 0-based page index. The DB form's printed pages are not
    // contiguous in the source PDF: printed [1/4] is page 0, [2/4] is page 3,
    // [3/4] is page 4, and [4/4] is page 5.
    fields: {
      insuredName: { page: 0, formPage: '1/4', x: 144, y: 690, width: 95, height: 15, fontSize: 10 },
      ssn: { page: 0, formPage: '1/4', x: 308, y: 690, width: 108, height: 15, fontSize: 10 },
      job: { page: 0, formPage: '1/4', x: 478, y: 668, width: 68, height: 15, fontSize: 9 },
      address: { page: 0, formPage: '1/4', x: 170, y: 642, width: 345, height: 17, fontSize: 9 },
      phone: { page: 0, formPage: '1/4', x: 150, y: 600, width: 84, height: 15, fontSize: 9 },
      accidentYear: { page: 0, formPage: '1/4', x: 106, y: 458, width: 36, height: 15, fontSize: 10 },
      accidentMonth: { page: 0, formPage: '1/4', x: 168, y: 458, width: 26, height: 15, fontSize: 10 },
      accidentDay: { page: 0, formPage: '1/4', x: 198, y: 458, width: 30, height: 15, fontSize: 10 },
      accidentHour: { page: 0, formPage: '1/4', x: 226, y: 458, width: 24, height: 15, fontSize: 10 },
      accidentMinute: { page: 0, formPage: '1/4', x: 268, y: 458, width: 24, height: 15, fontSize: 10 },
      diagnosis: { page: 0, formPage: '1/4', x: 390, y: 458, width: 140, height: 15, fontSize: 10 },
      treatmentHospital: { page: 0, formPage: '1/4', x: 390, y: 430, width: 140, height: 15, fontSize: 10 },
      claimDescription: { page: 0, formPage: '1/4', x: 106, y: 386, width: 410, height: 36, fontSize: 9 },
      accountNumber: { page: 0, formPage: '1/4', x: 170, y: 276, width: 170, height: 15, fontSize: 10 },
      bank: { page: 0, formPage: '1/4', x: 410, y: 276, width: 70, height: 15, fontSize: 10 },
      accountHolder: { page: 0, formPage: '1/4', x: 510, y: 276, width: 42, height: 15, fontSize: 9 },
      writtenYear: { page: 0, formPage: '1/4', x: 74, y: 139, width: 38, height: 15, fontSize: 10 },
      writtenMonth: { page: 0, formPage: '1/4', x: 141, y: 139, width: 24, height: 15, fontSize: 10 },
      writtenDay: { page: 0, formPage: '1/4', x: 192, y: 139, width: 30, height: 15, fontSize: 10 },
      signatureName: { page: 0, formPage: '1/4', x: 420, y: 139, width: 82, height: 15, fontSize: 9 },
      signature: { page: 0, formPage: '1/4', x: 502, y: 140, width: 48, height: 24 },
      consentWrittenYear: { page: 5, formPage: '4/4', x: 76, y: 115, width: 38, height: 15, fontSize: 10 },
      consentWrittenMonth: { page: 5, formPage: '4/4', x: 145, y: 115, width: 24, height: 15, fontSize: 10 },
      consentWrittenDay: { page: 5, formPage: '4/4', x: 196, y: 115, width: 30, height: 15, fontSize: 10 },
      consentSignatureName: { page: 5, formPage: '4/4', x: 420, y: 115, width: 82, height: 15, fontSize: 9 },
      consentSignature: { page: 5, formPage: '4/4', x: 506, y: 116, width: 48, height: 26 },
      beneficiaryName: { page: 5, formPage: '4/4', x: 420, y: 72, width: 82, height: 15, fontSize: 9 },
      beneficiarySignature: { page: 5, formPage: '4/4', x: 506, y: 74, width: 48, height: 24 },
      noticeOtherName: { page: 0, formPage: '1/4', x: 272, y: 622, width: 90, height: 15, fontSize: 9 },
      noticeOtherRelation: { page: 0, formPage: '1/4', x: 470, y: 622, width: 62, height: 15, fontSize: 9 },
    },
    checkboxes: {
      claimType: {
        injury: { page: 0, formPage: '1/4', x: 126, y: 490, size: 8 },
        disease: { page: 0, formPage: '1/4', x: 166, y: 490, size: 8 },
        traffic: { page: 0, formPage: '1/4', x: 206, y: 490, size: 8 },
        other: { page: 0, formPage: '1/4', x: 247, y: 490, size: 8 },
      },
      receiptType: {
        initial: { page: 0, formPage: '1/4', x: 408, y: 490, size: 8 },
        additional: { page: 0, formPage: '1/4', x: 468, y: 490, size: 8 },
      },
      noticeRecipient: {
        policyholder: { page: 0, formPage: '1/4', x: 119, y: 622, size: 8 },
        insured: { page: 0, formPage: '1/4', x: 170, y: 622, size: 8 },
        other: { page: 0, formPage: '1/4', x: 222, y: 622, size: 8 },
      },
    },
    consents: {
      collectUniqueId: {
        label: '고유식별정보 수집·이용 동의',
        page: 3,
        formPage: '2/4',
        agree: { x: 542, y: 437.5, size: 7 },
      },
      collectSensitive: {
        label: '민감정보 수집·이용 동의',
        page: 3,
        formPage: '2/4',
        agree: { x: 542, y: 342.5, size: 7 },
      },
      collectPersonalCredit: {
        label: '개인(신용)정보 수집·이용 동의',
        page: 3,
        formPage: '2/4',
        agree: { x: 542, y: 256.5, size: 7 },
      },
      provideUniqueId: {
        label: '고유식별정보 제공 동의',
        page: 4,
        formPage: '3/4',
        agree: { x: 542, y: 404.5, size: 7 },
      },
      provideSensitive: {
        label: '민감정보 제공 동의',
        page: 4,
        formPage: '3/4',
        agree: { x: 542, y: 307.5, size: 7 },
      },
      providePersonalCredit: {
        label: '개인(신용)정보 제공 동의',
        page: 4,
        formPage: '3/4',
        agree: { x: 542, y: 184.5, size: 7 },
      },
      providePersonalCreditContinued: {
        label: '개인(신용)정보 제공 동의',
        page: 5,
        formPage: '4/4',
        agree: { x: 542, y: 632.5, size: 7 },
      },
      queryUniqueId: {
        label: '고유식별정보 조회 동의',
        page: 5,
        formPage: '4/4',
        agree: { x: 542, y: 357.5, size: 7 },
      },
      querySensitive: {
        label: '민감정보 조회 동의',
        page: 5,
        formPage: '4/4',
        agree: { x: 542, y: 287.5, size: 7 },
      },
      queryPersonalCredit: {
        label: '개인(신용)정보 조회 동의',
        page: 5,
        formPage: '4/4',
        agree: { x: 542, y: 166.5, size: 7 },
      },
    },
  },
};

export function getClaimFormTemplateByCompany(companyName) {
  return Object.values(CLAIM_FORM_TEMPLATES).find((template) => template.companyName === companyName) || null;
}
