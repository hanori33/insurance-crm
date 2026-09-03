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
      address: { page: 0, formPage: '1/4', x: 170, y: 646, width: 345, height: 17, fontSize: 9 },
      phone: { page: 0, formPage: '1/4', x: 150, y: 600, width: 84, height: 15, fontSize: 9 },
      accidentYear: { page: 0, formPage: '1/4', x: 106, y: 458, width: 36, height: 15, fontSize: 10 },
      accidentMonth: { page: 0, formPage: '1/4', x: 168, y: 458, width: 26, height: 15, fontSize: 10 },
      accidentDay: { page: 0, formPage: '1/4', x: 198, y: 458, width: 30, height: 15, fontSize: 10 },
      diagnosis: { page: 0, formPage: '1/4', x: 390, y: 458, width: 140, height: 15, fontSize: 10 },
      claimDescription: { page: 0, formPage: '1/4', x: 106, y: 386, width: 410, height: 36, fontSize: 9 },
      accountNumber: { page: 0, formPage: '1/4', x: 170, y: 276, width: 170, height: 15, fontSize: 10 },
      bank: { page: 0, formPage: '1/4', x: 410, y: 276, width: 70, height: 15, fontSize: 10 },
      accountHolder: { page: 0, formPage: '1/4', x: 500, y: 276, width: 48, height: 15, fontSize: 9 },
      writtenYear: { page: 0, formPage: '1/4', x: 74, y: 139, width: 38, height: 15, fontSize: 10 },
      writtenMonth: { page: 0, formPage: '1/4', x: 141, y: 139, width: 24, height: 15, fontSize: 10 },
      writtenDay: { page: 0, formPage: '1/4', x: 192, y: 139, width: 30, height: 15, fontSize: 10 },
      signatureName: { page: 0, formPage: '1/4', x: 420, y: 139, width: 82, height: 15, fontSize: 9 },
      signature: { page: 0, formPage: '1/4', x: 502, y: 140, width: 48, height: 24 },
      consentWrittenYear: { page: 5, formPage: '4/4', x: 81, y: 115, width: 38, height: 15, fontSize: 10 },
      consentWrittenMonth: { page: 5, formPage: '4/4', x: 150, y: 115, width: 24, height: 15, fontSize: 10 },
      consentWrittenDay: { page: 5, formPage: '4/4', x: 202, y: 115, width: 30, height: 15, fontSize: 10 },
      consentSignatureName: { page: 5, formPage: '4/4', x: 420, y: 115, width: 82, height: 15, fontSize: 9 },
      consentSignature: { page: 5, formPage: '4/4', x: 506, y: 116, width: 48, height: 26 },
      beneficiaryName: { page: 5, formPage: '4/4', x: 420, y: 72, width: 82, height: 15, fontSize: 9 },
      beneficiarySignature: { page: 5, formPage: '4/4', x: 506, y: 74, width: 48, height: 24 },
    },
    checkboxes: {
      claimType: {
        injury: { page: 0, formPage: '1/4', x: 126, y: 490, size: 8 },
        disease: { page: 0, formPage: '1/4', x: 166, y: 490, size: 8 },
        traffic: { page: 0, formPage: '1/4', x: 206, y: 490, size: 8 },
        other: { page: 0, formPage: '1/4', x: 247, y: 490, size: 8 },
      },
    },
    consents: {
      collectUniqueId: {
        label: '고유식별정보 수집·이용 동의',
        page: 3,
        formPage: '2/4',
        agree: { x: 543, y: 437, size: 6 },
      },
      collectSensitive: {
        label: '민감정보 수집·이용 동의',
        page: 3,
        formPage: '2/4',
        agree: { x: 543, y: 342, size: 6 },
      },
      collectPersonalCredit: {
        label: '개인(신용)정보 수집·이용 동의',
        page: 3,
        formPage: '2/4',
        agree: { x: 543, y: 260, size: 6 },
      },
      provideUniqueId: {
        label: '고유식별정보 제공 동의',
        page: 4,
        formPage: '3/4',
        agree: { x: 543, y: 404, size: 6 },
      },
      provideSensitive: {
        label: '민감정보 제공 동의',
        page: 4,
        formPage: '3/4',
        agree: { x: 543, y: 307, size: 6 },
      },
      providePersonalCredit: {
        label: '개인(신용)정보 제공 동의',
        page: 4,
        formPage: '3/4',
        agree: { x: 543, y: 184, size: 6 },
      },
      providePersonalCreditContinued: {
        label: '개인(신용)정보 제공 동의',
        page: 5,
        formPage: '4/4',
        agree: { x: 543, y: 632, size: 6 },
      },
      queryUniqueId: {
        label: '고유식별정보 조회 동의',
        page: 5,
        formPage: '4/4',
        agree: { x: 543, y: 357, size: 6 },
      },
      querySensitive: {
        label: '민감정보 조회 동의',
        page: 5,
        formPage: '4/4',
        agree: { x: 543, y: 287, size: 6 },
      },
      queryPersonalCredit: {
        label: '개인(신용)정보 조회 동의',
        page: 5,
        formPage: '4/4',
        agree: { x: 543, y: 166, size: 6 },
      },
    },
  },
};

export function getClaimFormTemplateByCompany(companyName) {
  return Object.values(CLAIM_FORM_TEMPLATES).find((template) => template.companyName === companyName) || null;
}
