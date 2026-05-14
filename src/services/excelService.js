import * as XLSX from "xlsx";

function getValue(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && String(row[name]).trim() !== "") {
      return String(row[name]).trim();
    }
  }
  return "";
}

function birthFromFront6(value) {
  const raw = String(value || "").replace(/[^0-9]/g, "").slice(0, 6);
  if (raw.length !== 6) return "";

  const yy = Number(raw.slice(0, 2));
  const mm = raw.slice(2, 4);
  const dd = raw.slice(4, 6);

  const year = yy >= 30 ? `19${raw.slice(0, 2)}` : `20${raw.slice(0, 2)}`;
  return `${year}-${mm}-${dd}`;
}

export function downloadCustomerTemplate() {
  const rows = [
    {
      이름: "홍길동",
      연락처: "01012345678",
      주민번호앞6자리: "900629",
      주소: "경기도 시흥시",
      상령일: "2026-06-29",
      직업: "회사원",
      이체은행: "국민은행",
      자동이체일: "25",
      펫이름: "",
      "태명&아기이름": "",
      차량번호: "12가3456",
      자동차만기일: "2026-12-31",
      생년월일: "1990-06-29",
      이메일: "test@example.com",
      상태: "가망",
      고객유형: "일반",
      메모: "예시 고객",
    },
  ];

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "고객업로드양식");
  XLSX.writeFile(wb, "보플랜_고객업로드양식.xlsx");
}

export async function parseCustomerExcel(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return rows
    .map((row, idx) => {
      const name = getValue(row, ["이름", "고객명"]);
      const phone = getValue(row, ["연락처", "전화번호", "휴대폰"]);
      const residentFront = getValue(row, ["주민번호앞6자리", "생년월일6자리", "주민번호", "주민등록번호"]);
      const birth = getValue(row, ["생년월일", "생일"]) || birthFromFront6(residentFront);

      const petName = getValue(row, ["펫이름", "강아지이름", "반려동물명"]);
      const babyName = getValue(row, ["태명&아기이름", "태명", "아기이름"]);
      const rawType = getValue(row, ["고객유형", "유형"]);

      const customerType =
        rawType || (petName ? "펫" : babyName ? "태아" : "일반");

      return {
        tempId: Date.now() + idx,
        name,
        phone,
        birth,
        address: getValue(row, ["주소"]),
        age_date: getValue(row, ["상령일"]),
        job: getValue(row, ["직업"]),
        bank_name: getValue(row, ["이체은행", "자동이체은행", "은행명"]),
        transfer_day: getValue(row, ["자동이체일", "이체일", "이체일자"]),
        pet_name: petName,
        baby_name: babyName,
        car_number: getValue(row, ["차량번호", "차번호"]),
        car_expiry: getValue(row, ["자동차만기일", "자동차 만기일", "자동차만기", "차량만기"]),
        email: getValue(row, ["이메일", "email"]),
        status: getValue(row, ["상태"]) || "가망",
        customer_type: customerType,
        memo: getValue(row, ["메모", "비고"]),
      };
    })
    .filter((item) => item.name && item.phone);
}