export const CLAIM_FORM_TEMPLATES = {
  dbInsurance: {
    companyName: 'DB손해보험',
    formUrl: '/insurance-forms/DB손해보험금청구서.pdf',
    outputName: 'DB손해보험_보험금청구서',
    pageSize: { width: 595.276, height: 841.89 },
    fields: {
      insuredName: { page: 0, x: 142, y: 690, width: 100, height: 15, fontSize: 11 },
      ssn: { page: 0, x: 306, y: 690, width: 112, height: 15, fontSize: 10 },
      job: { page: 0, x: 475, y: 668, width: 72, height: 15, fontSize: 9 },
      address: { page: 0, x: 104, y: 646, width: 420, height: 17, fontSize: 10 },
      phone: { page: 0, x: 132, y: 590, width: 110, height: 15, fontSize: 10 },
      accidentYear: { page: 0, x: 104, y: 458, width: 38, height: 15, fontSize: 10 },
      accidentMonth: { page: 0, x: 169, y: 458, width: 22, height: 15, fontSize: 10 },
      accidentDay: { page: 0, x: 198, y: 458, width: 30, height: 15, fontSize: 10 },
      diagnosis: { page: 0, x: 390, y: 458, width: 140, height: 15, fontSize: 10 },
      claimDescription: { page: 0, x: 104, y: 386, width: 420, height: 36, fontSize: 9 },
      accountNumber: { page: 0, x: 170, y: 276, width: 170, height: 15, fontSize: 10 },
      bank: { page: 0, x: 410, y: 276, width: 70, height: 15, fontSize: 10 },
      accountHolder: { page: 0, x: 500, y: 276, width: 48, height: 15, fontSize: 9 },
      writtenYear: { page: 0, x: 74, y: 139, width: 38, height: 15, fontSize: 10 },
      writtenMonth: { page: 0, x: 141, y: 139, width: 22, height: 15, fontSize: 10 },
      writtenDay: { page: 0, x: 192, y: 139, width: 30, height: 15, fontSize: 10 },
      signatureName: { page: 0, x: 420, y: 139, width: 62, height: 15, fontSize: 10 },
      signature: { page: 0, x: 494, y: 118, width: 58, height: 33 },
    },
    checkboxes: {
      claimType: {
        disease: { page: 0, x: 166, y: 490, size: 8 },
        injury: { page: 0, x: 197, y: 490, size: 8 },
        traffic: { page: 0, x: 240, y: 490, size: 8 },
      },
    },
  },
};

export function getClaimFormTemplateByCompany(companyName) {
  return Object.values(CLAIM_FORM_TEMPLATES).find((template) => template.companyName === companyName) || null;
}
