
import * as XLSX from 'xlsx';

const excelService = {
  exportCustomers(customers) {
    const rows = customers.map(c => ({
      이름: c.name, 전화번호: c.phone, 상태: c.status,
      최근상담: c.last_contact || '', 메모: c.memo || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '고객목록');
    XLSX.writeFile(wb, `보플랜_고객목록_${new Date().toISOString().slice(0,10)}.xlsx`);
  },

  async importCustomers(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          resolve(XLSX.utils.sheet_to_json(ws));
        } catch(err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsBinaryString(file);
    });
  },
};

export default excelService;