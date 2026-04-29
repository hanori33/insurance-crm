import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "./supabaseClient";

const STORAGE_KEY = "insurance_crm_data_v4";

const initialData = {
  customers: [],
  consultations: [],
  policies: [],
  schedules: [],
  notes: [],
  sales: [],
};

const inp = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #c9c9c9",
  background: "#fff",
  color: "#222",
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
  marginBottom: 10,
};

const btn = (color = "#185FA5") => ({
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  background: color,
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
});

const card = {
  background: "#fff",
  border: "1px solid #ddd",
  borderRadius: 14,
  padding: "16px 20px",
  marginBottom: 12,
};

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...initialData, ...JSON.parse(saved) } : initialData;
  } catch {
    return initialData;
  }
}

function saveLocal(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

function todayText() {
  return new Date().toISOString().slice(0, 10);
}

function money(n) {
  return (Number(n) || 0).toLocaleString();
}

function getDday(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / 86400000);
}

function statusBadge(status) {
  return {
    marginLeft: 8,
    padding: "2px 8px",
    borderRadius: 6,
    fontSize: 11,
    color: "#fff",
    background:
      status === "가입" ? "#4CAF50" : status === "보류" ? "#BA7517" : "#999",
  };
}

function customerIcon(c) {
  if (c.customerType === "펫") return "🐶";
  if (c.customerType === "태아") return "👶";
  return c.name?.[0] || "?";
}

function normalizeHeaderValue(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return String(row[key]).trim();
  }
  return "";
}

export default function App() {
  const [data, setData] = useState(loadData);
  const [view, setView] = useState("dashboard");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("전체");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [editingNote, setEditingNote] = useState(null);
  const [noteInput, setNoteInput] = useState("");
  const [scheduleTab, setScheduleTab] = useState("schedule");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [salesMonth, setSalesMonth] = useState(todayText().slice(0, 7));

  const backupInputRef = useRef(null);
  const excelInputRef = useRef(null);

  const updateData = (fn) => {
    setData((prev) => {
      const next = fn(prev);
      saveLocal(next);
      return next;
    });
  };

  useEffect(() => {
    saveLocal(data);
  }, [data]);

  useEffect(() => {
    async function initSession() {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
    }

    initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetchAllFromDb();
  }, [session]);

  async function fetchAllFromDb() {
    const userId = session.user.id;

    const [customersRes, consultationsRes, policiesRes, schedulesRes, notesRes, salesRes] =
      await Promise.all([
        supabase.from("customers").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("consultations").select("*").eq("user_id", userId),
        supabase.from("policies").select("*").eq("user_id", userId),
        supabase.from("schedules").select("*").eq("user_id", userId),
        supabase.from("notes").select("*").eq("user_id", userId),
        supabase.from("sales").select("*").eq("user_id", userId),
      ]);

    const next = {
      customers: (customersRes.data || []).map((c) => ({
        id: c.app_customer_id,
        name: c.name || "",
        phone: c.phone || "",
        ssn: c.ssn || "",
        address: c.address || "",
        birth: c.birth || "",
        ageDate: c.age_date || "",
        job: c.job || "",
        transferDay: c.transfer_day || "",
        bankAccount: c.bank_account || "",
        carNumber: c.car_number || "",
        email: c.email || "",
        memo: c.memo || "",
        status: c.status || "가망",
        customerType: c.customer_type || "일반",
        petName: c.pet_name || "",
        babyName: c.baby_name || "",
        createdAt: c.created_at || "",
      })),
      consultations: (consultationsRes.data || []).map((c) => ({
        id: c.app_consultation_id,
        customerId: c.customer_app_id,
        date: c.date || "",
        type: c.type || "방문",
        content: c.content || "",
        nextDate: c.next_date || "",
      })),
      policies: (policiesRes.data || []).map((p) => ({
        id: p.app_policy_id,
        customerId: p.customer_app_id,
        type: p.type || "종신",
        status: p.status || "유지",
        company: p.company || "",
        product: p.product || "",
        premium: Number(p.premium) || 0,
        startDate: p.start_date || "",
        endDate: p.end_date || "",
      })),
      schedules: (schedulesRes.data || []).map((s) => ({
        id: s.app_schedule_id,
        customerId: s.customer_app_id,
        date: s.date || "",
        time: s.time || "",
        title: s.title || "",
        icon: s.icon || "🔔",
        memo: s.memo || "",
        done: !!s.done,
      })),
      notes: (notesRes.data || []).map((n) => ({
        id: n.app_note_id,
        customerId: n.customer_app_id,
        content: n.content || "",
        createdAt: n.created_at_text || todayText(),
        updatedAt: n.updated_at_text || todayText(),
      })),
      sales: (salesRes.data || []).map((s) => ({
        id: s.id,
        customerId: s.customer_id,
        contractDate: s.contract_date || "",
        company: s.company || "",
        product: s.product || "",
        premium: Number(s.premium) || 0,
        firstCommission: Number(s.first_commission) || 0,
        fifteenthCommission: Number(s.fifteenth_commission) || 0,
        incentive: Number(s.incentive) || 0,
        memo: s.memo || "",
      })),
    };

    setData(next);
    saveLocal(next);
  }

  async function handleAuthSubmit() {
    const name = authForm.name.trim();
    const email = authForm.email.trim();
    const password = authForm.password.trim();

    if (authMode === "reset") {
      if (!email) return alert("이메일을 입력해주세요.");
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) return alert("비밀번호 찾기 실패: " + error.message);
      return alert("비밀번호 재설정 메일을 보냈어요.");
    }

    if (!email || !password) return alert("이메일과 비밀번호를 입력해주세요.");

    if (authMode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name }, emailRedirectTo: window.location.origin },
      });
      if (error) return alert("회원가입 실패: " + error.message);
      alert("회원가입 완료! 이메일 인증 후 로그인하세요.");
      setAuthMode("login");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return alert("로그인 실패: " + error.message);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setSession(null);
  }

  function openModal(type, defaults = {}) {
    setModal(type);
    setForm(defaults);
  }

  function closeModal() {
    setModal(null);
    setForm({});
  }

  const getCustomer = (id) => data.customers.find((c) => c.id === id);
  const getConsultations = (id) =>
    data.consultations.filter((c) => c.customerId === id).sort((a, b) => b.date.localeCompare(a.date));
  const getPolicies = (id) => data.policies.filter((p) => p.customerId === id);
  const getSchedules = (id) =>
    data.schedules.filter((s) => s.customerId === id && !s.done).sort((a, b) => a.date.localeCompare(b.date));
  const getNotes = (id) =>
    data.notes.filter((n) => n.customerId === id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  function makeCustomerPayload(id) {
    return {
      user_id: session.user.id,
      app_customer_id: id,
      name: form.name || "",
      phone: form.phone || "",
      ssn: form.ssn || "",
      address: form.address || "",
      birth: form.birth || "",
      age_date: form.ageDate || "",
      job: form.job || "",
      transfer_day: form.transferDay || "",
      bank_account: form.bankAccount || "",
      car_number: form.carNumber || "",
      email: form.email || "",
      memo: form.memo || "",
      status: form.status || "가망",
      customer_type: form.customerType || "일반",
      pet_name: form.petName || "",
      baby_name: form.babyName || "",
    };
  }

  function payloadToCustomer(payload, createdAt = new Date().toISOString()) {
    return {
      id: payload.app_customer_id,
      name: payload.name,
      phone: payload.phone,
      ssn: payload.ssn,
      address: payload.address,
      birth: payload.birth,
      ageDate: payload.age_date,
      job: payload.job,
      transferDay: payload.transfer_day,
      bankAccount: payload.bank_account,
      carNumber: payload.car_number,
      email: payload.email,
      memo: payload.memo,
      status: payload.status,
      customerType: payload.customer_type,
      petName: payload.pet_name,
      babyName: payload.baby_name,
      createdAt,
    };
  }

  async function saveCustomer() {
    if (!form.name || !form.phone) return alert("이름과 연락처는 필수예요.");
    const id = form.id || Date.now();
    const payload = makeCustomerPayload(id);

    const res = form.id
      ? await supabase.from("customers").update(payload).eq("user_id", session.user.id).eq("app_customer_id", id)
      : await supabase.from("customers").insert([payload]);

    if (res.error) return alert("DB 저장 실패: " + res.error.message);

    const item = payloadToCustomer(payload, form.createdAt || new Date().toISOString());

    updateData((d) =>
      form.id
        ? { ...d, customers: d.customers.map((c) => (c.id === id ? item : c)) }
        : { ...d, customers: [...d.customers, item] }
    );

    closeModal();
  }

  async function deleteCustomer(id) {
    if (!window.confirm("삭제하시겠습니까?")) return;

    await supabase.from("customers").delete().eq("user_id", session.user.id).eq("app_customer_id", id);

    updateData((d) => ({
      ...d,
      customers: d.customers.filter((c) => c.id !== id),
      consultations: d.consultations.filter((c) => c.customerId !== id),
      policies: d.policies.filter((p) => p.customerId !== id),
      schedules: d.schedules.filter((s) => s.customerId !== id),
      notes: d.notes.filter((n) => n.customerId !== id),
      sales: d.sales.filter((s) => s.customerId !== id),
    }));

    setSelectedCustomer(null);
    setView("customers");
  }

  async function convertToContract(c) {
    await supabase.from("customers").update({ status: "가입" }).eq("user_id", session.user.id).eq("app_customer_id", c.id);

    updateData((d) => ({
      ...d,
      customers: d.customers.map((item) => (item.id === c.id ? { ...item, status: "가입" } : item)),
      consultations: [
        ...d.consultations,
        { id: Date.now(), customerId: c.id, date: todayText(), type: "전화", content: "가입 전환 완료", nextDate: "" },
      ],
    }));
  }

  async function saveConsultation() {
    if (!form.date || !form.content) return alert("상담일자와 내용은 필수예요.");
    const item = {
      id: Date.now(),
      customerId: selectedCustomer,
      date: form.date,
      type: form.type || "방문",
      content: form.content,
      nextDate: form.nextDate || "",
    };

    await supabase.from("consultations").insert([{
      user_id: session.user.id,
      app_consultation_id: item.id,
      customer_app_id: item.customerId,
      date: item.date,
      type: item.type,
      content: item.content,
      next_date: item.nextDate,
    }]);

    updateData((d) => ({ ...d, consultations: [...d.consultations, item] }));
    closeModal();
  }

  async function savePolicy() {
    if (!form.company || !form.product) return alert("보험사와 상품명은 필수예요.");
    const item = {
      id: Date.now(),
      customerId: selectedCustomer,
      company: form.company,
      product: form.product,
      type: form.type || "종신",
      startDate: form.startDate || "",
      endDate: form.endDate || "",
      premium: Number(form.premium) || 0,
      status: form.status || "유지",
    };

    await supabase.from("policies").insert([{
      user_id: session.user.id,
      app_policy_id: item.id,
      customer_app_id: item.customerId,
      type: item.type,
      status: item.status,
      company: item.company,
      product: item.product,
      premium: item.premium,
      start_date: item.startDate,
      end_date: item.endDate,
    }]);

    updateData((d) => ({ ...d, policies: [...d.policies, item] }));
    closeModal();
  }

  async function saveSchedule() {
    if (!form.date || !form.title) return alert("일정 날짜와 제목은 필수예요.");
    const item = {
      id: Date.now(),
      customerId: selectedCustomer || form.customerId || null,
      date: form.date,
      time: form.time || "",
      title: form.title,
      icon: form.icon || "🔔",
      memo: form.memo || "",
      done: false,
    };

    await supabase.from("schedules").insert([{
      user_id: session.user.id,
      app_schedule_id: item.id,
      customer_app_id: item.customerId,
      date: item.date,
      time: item.time,
      title: item.title,
      icon: item.icon,
      memo: item.memo,
      done: item.done,
    }]);

    updateData((d) => ({ ...d, schedules: [...d.schedules, item] }));
    closeModal();
  }

  async function toggleSchedule(id) {
    const target = data.schedules.find((s) => s.id === id);
    if (!target) return;

    await supabase.from("schedules").update({ done: !target.done }).eq("user_id", session.user.id).eq("app_schedule_id", id);

    updateData((d) => ({
      ...d,
      schedules: d.schedules.map((s) => (s.id === id ? { ...s, done: !s.done } : s)),
    }));
  }

  function startNewNote() {
    setEditingNote("new");
    setNoteInput("");
  }

  function startEditNote(n) {
    setEditingNote(n.id);
    setNoteInput(n.content);
  }

  function cancelNote() {
    setEditingNote(null);
    setNoteInput("");
  }

  async function saveNote() {
    if (!noteInput.trim()) return;
    const now = todayText();

    if (editingNote === "new") {
      const item = { id: Date.now(), customerId: selectedCustomer, content: noteInput.trim(), createdAt: now, updatedAt: now };
      await supabase.from("notes").insert([{
        user_id: session.user.id,
        app_note_id: item.id,
        customer_app_id: item.customerId,
        content: item.content,
        created_at_text: item.createdAt,
        updated_at_text: item.updatedAt,
      }]);
      updateData((d) => ({ ...d, notes: [...d.notes, item] }));
    } else {
      await supabase.from("notes").update({ content: noteInput.trim(), updated_at_text: now }).eq("user_id", session.user.id).eq("app_note_id", editingNote);
      updateData((d) => ({
        ...d,
        notes: d.notes.map((n) => (n.id === editingNote ? { ...n, content: noteInput.trim(), updatedAt: now } : n)),
      }));
    }

    setEditingNote(null);
    setNoteInput("");
  }

  async function deleteNote(id) {
    await supabase.from("notes").delete().eq("user_id", session.user.id).eq("app_note_id", id);
    updateData((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) }));
  }

  async function saveSale() {
    if (!form.contractDate || !form.product) return alert("계약일과 상품명은 필수예요.");

    const payload = {
      user_id: session.user.id,
      customer_id: form.customerId || null,
      contract_date: form.contractDate,
      company: form.company || "",
      product: form.product || "",
      premium: Number(form.premium) || 0,
      first_commission: Number(form.firstCommission) || 0,
      fifteenth_commission: Number(form.fifteenthCommission) || 0,
      incentive: Number(form.incentive) || 0,
      memo: form.memo || "",
    };

    const { data: saved, error } = await supabase.from("sales").insert([payload]).select().single();
    if (error) return alert("매출 저장 실패: " + error.message);

    updateData((d) => ({
      ...d,
      sales: [
        ...d.sales,
        {
          id: saved.id,
          customerId: payload.customer_id,
          contractDate: payload.contract_date,
          company: payload.company,
          product: payload.product,
          premium: payload.premium,
          firstCommission: payload.first_commission,
          fifteenthCommission: payload.fifteenth_commission,
          incentive: payload.incentive,
          memo: payload.memo,
        },
      ],
    }));

    closeModal();
  }

  async function deleteSale(id) {
    await supabase.from("sales").delete().eq("user_id", session.user.id).eq("id", id);
    updateData((d) => ({ ...d, sales: d.sales.filter((s) => s.id !== id) }));
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `insurance-crm-backup-${todayText()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        setData({ ...initialData, ...parsed });
        alert("백업 파일을 불러왔습니다.");
      } catch {
        alert("백업 파일 읽기 실패");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  function downloadExcelTemplate() {
    const rows = [
      {
        이름: "홍길동",
        연락처: "01012345678",
        주민번호: "900101-1234567",
        주소: "경기도 시흥시 배곧",
        상령일: "2026-01-01",
        직업: "사무직",
        이체일자: "25",
        자동이체은행계좌: "국민 123456-78-901234",
        펫이름: "",
        "태명&아기이름": "",
        차량번호: "12가3456",
        생년월일: "1990-01-01",
        이메일: "test@example.com",
        상태: "가망",
        고객유형: "일반",
        메모: "예시 고객",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "고객업로드양식");
    XLSX.writeFile(wb, "보험CRM_고객업로드양식.xlsx");
  }

  async function uploadExcelCustomers(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (!rows.length) {
        alert("엑셀에 고객 데이터가 없습니다.");
        return;
      }

      const userId = session.user.id;
      let currentCustomers = [...data.customers];
      const inserts = [];
      const updates = [];

      rows.forEach((r, idx) => {
        const phone = normalizeHeaderValue(r, ["연락처", "전화번호", "휴대폰"]);
        const name = normalizeHeaderValue(r, ["이름", "고객명"]);

        if (!phone || !name) return;

        const petName = normalizeHeaderValue(r, ["펫이름", "강아지이름", "강아지 이름"]);
        const babyName = normalizeHeaderValue(r, ["태명&아기이름", "태명아기이름", "태명/아기이름", "태명", "아기이름"]);
        const customerTypeRaw = normalizeHeaderValue(r, ["고객유형", "유형"]);
        const customerType =
          customerTypeRaw || (petName ? "펫" : babyName ? "태아" : "일반");

        const existing = currentCustomers.find((c) => c.phone === phone);
        const id = existing?.id || Date.now() + idx;

        const item = {
          id,
          name,
          phone,
          ssn: normalizeHeaderValue(r, ["주민번호", "주민등록번호"]),
          address: normalizeHeaderValue(r, ["주소"]),
          birth: normalizeHeaderValue(r, ["생년월일", "생일"]),
          ageDate: normalizeHeaderValue(r, ["상령일"]),
          job: normalizeHeaderValue(r, ["직업"]),
          transferDay: normalizeHeaderValue(r, ["이체일자", "자동이체일자"]),
          bankAccount: normalizeHeaderValue(r, ["자동이체은행계좌", "자동이체 은행계좌", "계좌", "은행계좌"]),
          carNumber: normalizeHeaderValue(r, ["차량번호", "차번호"]),
          email: normalizeHeaderValue(r, ["이메일", "email"]),
          status: normalizeHeaderValue(r, ["상태"]) || "가망",
          customerType,
          petName,
          babyName,
          memo: normalizeHeaderValue(r, ["메모", "비고"]),
          createdAt: existing?.createdAt || new Date().toISOString(),
        };

        const payload = {
          user_id: userId,
          app_customer_id: item.id,
          name: item.name,
          phone: item.phone,
          ssn: item.ssn,
          address: item.address,
          birth: item.birth,
          age_date: item.ageDate,
          job: item.job,
          transfer_day: item.transferDay,
          bank_account: item.bankAccount,
          car_number: item.carNumber,
          email: item.email,
          memo: item.memo,
          status: item.status,
          customer_type: item.customerType,
          pet_name: item.petName,
          baby_name: item.babyName,
        };

        if (existing) {
          updates.push(payload);
          currentCustomers = currentCustomers.map((c) => (c.id === existing.id ? item : c));
        } else {
          inserts.push(payload);
          currentCustomers.push(item);
        }
      });

      if (!inserts.length && !updates.length) {
        alert("업로드할 고객이 없습니다. 이름과 연락처는 필수입니다.");
        return;
      }

      for (const payload of updates) {
        const { error } = await supabase
          .from("customers")
          .update(payload)
          .eq("user_id", userId)
          .eq("app_customer_id", payload.app_customer_id);
        if (error) throw error;
      }

      if (inserts.length) {
        const { error } = await supabase.from("customers").insert(inserts);
        if (error) throw error;
      }

      updateData((d) => ({ ...d, customers: currentCustomers }));
      alert(`엑셀 업로드 완료! 신규 ${inserts.length}명 / 업데이트 ${updates.length}명`);
    } catch (e) {
      alert("엑셀 업로드 실패: " + (e.message || "파일을 확인해주세요."));
    } finally {
      event.target.value = "";
    }
  }

  function requestNotificationPermission() {
    if (!("Notification" in window)) return alert("이 브라우저는 알림을 지원하지 않아요.");
    Notification.requestPermission().then((p) => {
      alert(p === "granted" ? "알림 허용 완료!" : "알림이 허용되지 않았어요.");
    });
  }

  function showTestNotification() {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      new Notification("보험 CRM 일정 알림", { body: "일정 알림 테스트입니다." });
    } else {
      alert("먼저 알림 허용을 눌러주세요.");
    }
  }

  const customers = data.customers
    .filter((c) => {
      const q = search.trim();
      const searchOk =
        !q ||
        c.name.includes(q) ||
        c.phone.includes(q) ||
        c.ssn?.includes(q) ||
        c.address?.includes(q) ||
        c.job?.includes(q) ||
        c.carNumber?.includes(q) ||
        c.email?.includes(q) ||
        c.memo?.includes(q) ||
        c.petName?.includes(q) ||
        c.babyName?.includes(q);

      const statusOk = statusFilter === "전체" ? true : (c.status || "가망") === statusFilter;
      return searchOk && statusOk;
    })
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ko-KR"));

  const allUpcoming = data.schedules.filter((s) => !s.done).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);

  const calendarYear = calendarDate.getFullYear();
  const calendarMonth = calendarDate.getMonth();
  const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
  const lastDate = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const calendarDays = [...Array(firstDay).fill(null), ...Array.from({ length: lastDate }, (_, i) => i + 1)];

  const birthdayList = data.customers
    .filter((c) => c.birth)
    .map((c) => {
      const raw = c.birth.replaceAll("-", "");
      const month = raw.slice(4, 6);
      const day = raw.slice(6, 8);
      const next = new Date(new Date().getFullYear(), Number(month) - 1, Number(day));
      if (next < new Date()) next.setFullYear(new Date().getFullYear() + 1);
      return {
        ...c,
        birthdayText: `${month}월 ${day}일`,
        nextBirthday: next.toISOString().slice(0, 10),
        dday: getDday(next.toISOString().slice(0, 10)),
      };
    })
    .sort((a, b) => a.dday - b.dday);

  const carPolicies = data.policies
    .filter((p) => p.type === "자동차" && p.endDate)
    .sort((a, b) => a.endDate.localeCompare(b.endDate));

  const monthSales = data.sales.filter((s) => (s.contractDate || "").startsWith(salesMonth));
  const monthlyPremium = monthSales.reduce((sum, s) => sum + Number(s.premium || 0), 0);
  const monthlyFirst = monthSales.reduce((sum, s) => sum + Number(s.firstCommission || 0), 0);
  const monthlyFifteenth = monthSales.reduce((sum, s) => sum + Number(s.fifteenthCommission || 0), 0);
  const monthlyIncentive = monthSales.reduce((sum, s) => sum + Number(s.incentive || 0), 0);

  const nav = [
    { key: "dashboard", label: "홈" },
    { key: "customers", label: "고객 목록" },
    { key: "schedules", label: "일정 관리" },
    { key: "sales", label: "매출 관리" },
  ];

  if (!session) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f8fa", fontFamily: "sans-serif" }}>
        <div style={{ width: 360, background: "#fff", border: "1px solid #ddd", borderRadius: 16, padding: 24, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>보험 CRM</div>
          <div style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>
            {authMode === "login" ? "로그인" : authMode === "signup" ? "회원가입" : "비밀번호 찾기"}
          </div>

          {authMode === "signup" && (
            <>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>이름</div>
              <input style={inp} value={authForm.name} onChange={(e) => setAuthForm((f) => ({ ...f, name: e.target.value }))} />
            </>
          )}

          <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>이메일</div>
          <input style={inp} value={authForm.email} onChange={(e) => setAuthForm((f) => ({ ...f, email: e.target.value }))} />

          {authMode !== "reset" && (
            <>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>비밀번호</div>
              <input type="password" style={inp} value={authForm.password} onChange={(e) => setAuthForm((f) => ({ ...f, password: e.target.value }))} />
            </>
          )}

          <button onClick={handleAuthSubmit} style={{ ...btn(), width: "100%", marginBottom: 10 }}>
            {authMode === "login" ? "로그인" : authMode === "signup" ? "회원가입" : "재설정 메일 보내기"}
          </button>

          <button onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")} style={{ ...btn("#888780"), width: "100%", marginBottom: 8 }}>
            {authMode === "login" ? "회원가입으로" : "로그인으로"}
          </button>

          {authMode === "login" && (
            <button onClick={() => setAuthMode("reset")} style={{ ...btn("#BA7517"), width: "100%" }}>
              비밀번호 찾기
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "sans-serif", color: "#222", minHeight: "100vh", background: "#f7f8fa" }}>
      <div style={{ borderBottom: "1px solid #ddd", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px 12px", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>보험 CRM</div>
            <div style={{ fontSize: 13, color: "#666" }}>
              {session?.user?.user_metadata?.name ? `${session.user.user_metadata.name} 설계사님` : "보험 설계사 고객관리"}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={exportBackup} style={{ ...btn("#533AB7"), padding: "8px 12px", fontSize: 12 }}>백업 저장</button>
            <button onClick={() => backupInputRef.current?.click()} style={{ ...btn("#185FA5"), padding: "8px 12px", fontSize: 12 }}>백업 불러오기</button>
            <button onClick={handleLogout} style={{ ...btn("#888780"), padding: "8px 12px", fontSize: 12 }}>로그아웃</button>
            <input ref={backupInputRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={importBackup} />
            <input ref={excelInputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={uploadExcelCustomers} />
          </div>
        </div>

        <div style={{ display: "flex", padding: "0 16px" }}>
          {nav.map((n) => {
            const active = view === n.key && selectedCustomer === null;
            return (
              <button
                key={n.key}
                onClick={() => {
                  setView(n.key);
                  setSelectedCustomer(null);
                  setEditingNote(null);
                }}
                style={{
                  flex: 1,
                  padding: "14px 8px",
                  fontSize: 16,
                  fontWeight: active ? 700 : 400,
                  background: "transparent",
                  border: "none",
                  borderBottom: active ? "3px solid #185FA5" : "3px solid transparent",
                  color: active ? "#185FA5" : "#666",
                  cursor: "pointer",
                }}
              >
                {n.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "20px 24px" }}>
        {view === "dashboard" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
              {[
                { label: "전체 고객", value: data.customers.length + "명" },
                { label: "가망 고객", value: data.customers.filter((c) => (c.status || "가망") === "가망").length + "명" },
                { label: "가입 고객", value: data.customers.filter((c) => c.status === "가입").length + "명" },
                { label: "이번달 매출", value: money(monthlyPremium) + "원" },
              ].map((m) => (
                <div key={m.label} style={{ background: "#eef2f7", borderRadius: 8, padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{m.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>다가오는 일정</div>
                {allUpcoming.length === 0 && <div style={{ fontSize: 13, color: "#666" }}>예정 일정이 없습니다</div>}
                {allUpcoming.map((s) => (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #eee" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{getCustomer(s.customerId)?.name || "고객 없음"} — {(s.icon || "🔔") + " " + s.title}</div>
                      <div style={{ fontSize: 12, color: "#666" }}>{s.date} {s.time}</div>
                    </div>
                    <button onClick={() => toggleSchedule(s.id)} style={{ ...btn("#1D9E75"), padding: "4px 10px", fontSize: 12 }}>완료</button>
                  </div>
                ))}
              </div>

              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>최근 등록 고객</div>
                {data.customers.slice().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 4).map((c) => (
                  <div key={c.id} onClick={() => { setSelectedCustomer(c.id); setView("detail"); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #eee", cursor: "pointer" }}>
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#B5D4F4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#0C447C" }}>
                      {customerIcon(c)}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: "#666" }}>{c.phone}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === "customers" && (
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="이름, 연락처, 주민번호, 주소, 차량번호 검색" style={{ ...inp, marginBottom: 0, flex: 1 }} />
              <button onClick={() => openModal("customer", { customerType: "일반", status: "가망" })} style={btn()}>+ 고객 등록</button>
            </div>

            <div style={{ ...card, background: "#F7FBFF", borderColor: "#CFE5FF", marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>📋 엑셀로 고객 일괄 등록</div>
                  <div style={{ fontSize: 13, color: "#666" }}>
                    필수 헤더: 이름, 연락처, 주민번호, 주소, 상령일, 직업, 이체일자, 자동이체은행계좌, 펫이름, 태명&아기이름, 차량번호
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={downloadExcelTemplate} style={btn("#1D9E75")}>📥 양식 다운로드</button>
                  <button onClick={() => excelInputRef.current?.click()} style={btn("#185FA5")}>📂 엑셀 업로드</button>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {["전체", "가망", "가입", "보류"].map((status) => (
                <button key={status} onClick={() => setStatusFilter(status)} style={{ ...btn(statusFilter === status ? "#185FA5" : "#888780"), padding: "6px 12px", fontSize: 12 }}>{status}</button>
              ))}
            </div>

            {customers.length === 0 && <div style={{ color: "#666", fontSize: 14 }}>고객이 없습니다.</div>}

            {customers.map((c) => (
              <div key={c.id} style={{ ...card, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }} onClick={() => { setSelectedCustomer(c.id); setView("detail"); }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#B5D4F4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 700, color: "#0C447C" }}>
                    {customerIcon(c)}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>
                      {c.name}
                      <span style={statusBadge(c.status || "가망")}>{c.status || "가망"}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "#666" }}>{c.phone} · {c.birth}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>
                      주민번호 {c.ssn || "-"} · 주소 {c.address || "-"} · 차량 {c.carNumber || "-"}
                    </div>
                    <div style={{ fontSize: 12, color: "#666" }}>
                      상령일 {c.ageDate || "-"} · 직업 {c.job || "-"} · 이체일 {c.transferDay || "-"}
                    </div>
                    <div style={{ fontSize: 12, color: "#666" }}>
                      자동이체 {c.bankAccount || "-"}
                    </div>
                    {c.customerType === "펫" && <div style={{ fontSize: 13, color: "#666" }}>🐶 {c.petName}</div>}
                    {c.customerType === "태아" && <div style={{ fontSize: 13, color: "#666" }}>👶 {c.babyName}</div>}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, color: "#666" }}>계약 {getPolicies(c.id).length}건</div>
                  <div style={{ fontSize: 12, color: "#666" }}>상담 {getConsultations(c.id).length}건</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {view === "detail" && selectedCustomer && (() => {
          const c = getCustomer(selectedCustomer);
          if (!c) return null;
          const cons = getConsultations(selectedCustomer);
          const pols = getPolicies(selectedCustomer);
          const scheds = getSchedules(selectedCustomer);
          const notes = getNotes(selectedCustomer);

          return (
            <div>
              <button onClick={() => { setView("customers"); setSelectedCustomer(null); setEditingNote(null); }} style={{ ...btn("transparent"), color: "#666", border: "1px solid #bbb", marginBottom: 16, background: "#fff" }}>← 목록으로</button>

              <div style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#B5D4F4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "#0C447C" }}>
                    {customerIcon(c)}
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{c.name}<span style={statusBadge(c.status || "가망")}>{c.status || "가망"}</span></div>
                    <div style={{ fontSize: 13, color: "#666" }}>{c.phone} · {c.birth}</div>
                    {c.email && <div style={{ fontSize: 13, color: "#666" }}>{c.email}</div>}
                    <div style={{ fontSize: 13, color: "#666" }}>주민번호: {c.ssn || "-"} / 주소: {c.address || "-"}</div>
                    <div style={{ fontSize: 13, color: "#666" }}>상령일: {c.ageDate || "-"} / 직업: {c.job || "-"}</div>
                    <div style={{ fontSize: 13, color: "#666" }}>이체일자: {c.transferDay || "-"} / 자동이체: {c.bankAccount || "-"}</div>
                    <div style={{ fontSize: 13, color: "#666" }}>차량번호: {c.carNumber || "-"}</div>
                    {c.customerType === "펫" && <div style={{ fontSize: 13 }}>🐶 펫이름: {c.petName}</div>}
                    {c.customerType === "태아" && <div style={{ fontSize: 13 }}>👶 태명&아기이름: {c.babyName}</div>}
                    {c.memo && <div style={{ fontSize: 13, marginTop: 4 }}>{c.memo}</div>}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => openModal("customer", { ...c })} style={{ ...btn("#888780"), padding: "6px 12px", fontSize: 12 }}>수정</button>
                  <button onClick={() => deleteCustomer(c.id)} style={{ ...btn("#E24B4A"), padding: "6px 12px", fontSize: 12 }}>삭제</button>
                  {(c.status || "가망") !== "가입" && <button onClick={() => convertToContract(c)} style={{ ...btn("#4CAF50"), padding: "6px 12px", fontSize: 12 }}>가입 전환</button>}
                </div>
              </div>

              {scheds.length > 0 && (
                <div style={{ ...card, background: "#E6F1FB", borderColor: "#B5D4F4" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0C447C", marginBottom: 8 }}>예정 일정</div>
                  {scheds.map((s) => (
                    <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span>{s.date} {s.time} — {(s.icon || "🔔") + " " + s.title}</span>
                      <button onClick={() => toggleSchedule(s.id)} style={{ ...btn("#1D9E75"), padding: "3px 10px", fontSize: 12 }}>완료</button>
                    </div>
                  ))}
                </div>
              )}

              <SectionTitle title="메모 정리" button="+ 메모 추가" onClick={startNewNote} />
              {editingNote === "new" && <EditorCard value={noteInput} setValue={setNoteInput} save={saveNote} cancel={cancelNote} />}
              {notes.length === 0 && editingNote === null && <div style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>메모가 없습니다.</div>}
              {notes.map((n) => (
                <div key={n.id} style={card}>
                  {editingNote === n.id ? (
                    <EditorCard value={noteInput} setValue={setNoteInput} save={saveNote} cancel={cancelNote} />
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{n.content}</div>
                        <div style={{ fontSize: 11, color: "#666", marginTop: 6 }}>작성 {n.createdAt} / 수정 {n.updatedAt}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => startEditNote(n)} style={{ ...btn("#888780"), padding: "4px 10px", fontSize: 12 }}>수정</button>
                        <button onClick={() => deleteNote(n.id)} style={{ ...btn("#E24B4A"), padding: "4px 10px", fontSize: 12 }}>삭제</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <SectionTitle title="상담 방문 기록" button="+ 기록 추가" onClick={() => openModal("consultation", { type: "방문" })} />
              {cons.length === 0 && <div style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>상담 기록이 없습니다.</div>}
              {cons.map((cn) => (
                <div key={cn.id} style={card}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{cn.date} · {cn.type}</div>
                  <div style={{ fontSize: 13, marginTop: 6 }}>{cn.content}</div>
                  {cn.nextDate && <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>재상담: {cn.nextDate}</div>}
                </div>
              ))}

              <SectionTitle title="보험 가입 이력" button="+ 계약 추가" onClick={() => openModal("policy", { type: "종신", status: "유지" })} />
              <button onClick={() => openModal("policy", { type: "자동차", status: "유지" })} style={{ ...btn("#E6F1FB"), color: "#185FA5", border: "1px solid #B5D4F4", marginBottom: 10 }}>🚗 자동차 등록</button>
              {pols.length === 0 && <div style={{ fontSize: 13, color: "#666" }}>가입 이력이 없습니다.</div>}
              {pols.map((p) => (
                <div key={p.id} style={card}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{p.product} <span style={statusBadge(p.status)}>{p.status}</span></div>
                      <div style={{ fontSize: 12, color: "#666" }}>{p.company} · {p.type}보험</div>
                      <div style={{ fontSize: 12, color: "#666" }}>{p.startDate} ~ {p.endDate}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700 }}>{money(p.premium)}원</div>
                      <div style={{ fontSize: 12, color: "#666" }}>월 보험료</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {view === "schedules" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", marginBottom: 20, border: "1px solid #ddd", borderRadius: 10, overflow: "hidden" }}>
              {[["schedule", "일정"], ["birthday", "생일"], ["car", "자동차 만기"]].map(([key, label]) => (
                <button key={key} onClick={() => setScheduleTab(key)} style={{ padding: 14, border: "none", background: scheduleTab === key ? "#185FA5" : "#fff", color: scheduleTab === key ? "#fff" : "#333", fontWeight: 700 }}>{label}</button>
              ))}
            </div>

            {scheduleTab === "schedule" && (
              <div>
                <div style={{ ...card, marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <button onClick={() => setCalendarDate(new Date(calendarYear, calendarMonth - 1, 1))} style={btn("#888780")}>이전달</button>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{calendarYear}년 {calendarMonth + 1}월</div>
                    <button onClick={() => setCalendarDate(new Date(calendarYear, calendarMonth + 1, 1))} style={btn("#888780")}>다음달</button>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <button onClick={requestNotificationPermission} style={{ ...btn("#1D9E75"), padding: "6px 12px", fontSize: 12 }}>알림 허용</button>
                    <button onClick={showTestNotification} style={{ ...btn("#BA7517"), padding: "6px 12px", fontSize: 12 }}>알림 테스트</button>
                  </div>

                  <div style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>날짜를 누르면 일정 등록창이 떠요.</div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
                    {["일", "월", "화", "수", "목", "금", "토"].map((d) => <div key={d} style={{ textAlign: "center", fontWeight: 700 }}>{d}</div>)}
                    {calendarDays.map((day, idx) => {
                      const dateStr = day ? `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
                      const daySchedules = data.schedules.filter((s) => s.date === dateStr);
                      return (
                        <div key={idx} onClick={() => day && openModal("schedule", { date: dateStr, icon: "🔔" })} style={{ minHeight: 86, background: day ? "#fff" : "#f0f0f0", border: "1px solid #d6d6d6", borderRadius: 10, padding: 8, cursor: day ? "pointer" : "default" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{day}</div>
                          {daySchedules.slice(0, 2).map((s) => (
                            <div key={s.id} style={{ fontSize: 11, background: "#E6F1FB", color: "#185FA5", borderRadius: 6, padding: "2px 5px", marginBottom: 3, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                              {(s.icon || "🔔") + " " + s.title}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>전체 일정</div>
                {data.schedules.length === 0 && <div style={{ fontSize: 13, color: "#666" }}>등록된 일정이 없습니다.</div>}
                {data.schedules.slice().sort((a, b) => a.date.localeCompare(b.date)).map((s) => (
                  <div key={s.id} style={{ ...card, display: "flex", justifyContent: "space-between", opacity: s.done ? 0.55 : 1 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{getCustomer(s.customerId)?.name || "미지정 고객"} — {(s.icon || "🔔") + " " + s.title}</div>
                      <div style={{ fontSize: 12, color: "#666" }}>{s.date} {s.time}</div>
                      {s.memo && <div style={{ fontSize: 12, marginTop: 4 }}>{s.memo}</div>}
                    </div>
                    <button onClick={() => toggleSchedule(s.id)} style={{ ...btn(s.done ? "#888780" : "#1D9E75"), padding: "6px 12px", fontSize: 12 }}>{s.done ? "되돌리기" : "완료"}</button>
                  </div>
                ))}
              </div>
            )}

            {scheduleTab === "birthday" && (
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>고객 생일 현황</div>
                {birthdayList.map((c) => (
                  <div key={c.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#FFF1D8", display: "flex", alignItems: "center", justifyContent: "center" }}>🎂</div>
                      <div>
                        <div style={{ fontWeight: 700 }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: "#666" }}>{c.birthdayText} · {c.nextBirthday}</div>
                      </div>
                    </div>
                    <div style={{ ...btn(c.dday <= 30 ? "#BA7517" : "#1D9E75"), cursor: "default" }}>D-{c.dday}</div>
                  </div>
                ))}
              </div>
            )}

            {scheduleTab === "car" && (
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>자동차보험 만기 현황</div>
                {carPolicies.length === 0 && <div style={{ fontSize: 13, color: "#666" }}>자동차보험 계약이 없습니다.</div>}
                {carPolicies.map((p) => (
                  <div key={p.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{getCustomer(p.customerId)?.name || "고객 없음"} — {p.product}</div>
                      <div style={{ fontSize: 12, color: "#666" }}>{p.company} · 만기일 {p.endDate}</div>
                    </div>
                    <button style={{ ...btn("#185FA5"), cursor: "default" }}>자동차</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === "sales" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>매출 관리</div>
                <input type="month" value={salesMonth} onChange={(e) => setSalesMonth(e.target.value)} style={{ ...inp, width: 180, marginTop: 8 }} />
              </div>
              <button onClick={() => openModal("sale", { contractDate: todayText() })} style={btn()}>+ 매출 등록</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
              {[
                ["월 보험료", monthlyPremium],
                ["초회 수수료", monthlyFirst],
                ["15회차 예상", monthlyFifteenth],
                ["시책 예상", monthlyIncentive],
              ].map(([label, value]) => (
                <div key={label} style={{ ...card, background: "#eef2f7" }}>
                  <div style={{ fontSize: 12, color: "#666" }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{money(value)}원</div>
                </div>
              ))}
            </div>

            <div style={card}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>이번달 계약 그래프</div>
              {monthSales.length === 0 && <div style={{ fontSize: 13, color: "#666" }}>등록된 매출이 없습니다.</div>}
              {monthSales.map((s) => {
                const max = Math.max(...monthSales.map((x) => Number(x.premium) || 0), 1);
                return (
                  <div key={s.id} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 13 }}>{s.product} · {money(s.premium)}원</div>
                    <div style={{ height: 10, background: "#eee", borderRadius: 8 }}>
                      <div style={{ height: 10, width: `${Math.min(100, (Number(s.premium) / max) * 100)}%`, background: "#185FA5", borderRadius: 8 }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {monthSales.map((s) => (
              <div key={s.id} style={{ ...card, display: "flex", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{s.product}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{s.contractDate} · {s.company} · {getCustomer(s.customerId)?.name || "고객 미지정"}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>15회차 {money(s.fifteenthCommission)}원 · 시책 {money(s.incentive)}원</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700 }}>{money(s.premium)}원</div>
                  <button onClick={() => deleteSale(s.id)} style={{ ...btn("#E24B4A"), padding: "4px 10px", fontSize: 12, marginTop: 6 }}>삭제</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 520, maxWidth: "95vw", maxHeight: "85vh", overflowY: "auto", border: "1px solid #d0d0d0", boxShadow: "0 8px 32px rgba(0,0,0,0.13)" }}>
            {modal === "customer" && (
              <>
                <ModalTitle title={form.id ? "고객 수정" : "고객 등록"} />
                <Field label="이름*" k="name" form={form} setForm={setForm} />
                <Field label="연락처*" k="phone" form={form} setForm={setForm} />
                <Field label="주민번호" k="ssn" form={form} setForm={setForm} />
                <Field label="주소" k="address" form={form} setForm={setForm} />
                <Field label="생년월일 (YYYY-MM-DD)" k="birth" form={form} setForm={setForm} />
                <Field label="상령일" k="ageDate" form={form} setForm={setForm} />
                <Field label="직업" k="job" form={form} setForm={setForm} />
                <Field label="이체일자" k="transferDay" form={form} setForm={setForm} />
                <Field label="자동이체 은행계좌" k="bankAccount" form={form} setForm={setForm} />
                <Field label="차량번호" k="carNumber" form={form} setForm={setForm} />
                <Field label="이메일" k="email" form={form} setForm={setForm} />
                <SelectField label="상태" k="status" form={form} setForm={setForm} options={["가망", "가입", "보류"]} />
                <SelectField label="고객 유형" k="customerType" form={form} setForm={setForm} options={["일반", "펫", "태아"]} />
                {form.customerType === "펫" && <Field label="펫이름" k="petName" form={form} setForm={setForm} />}
                {form.customerType === "태아" && <Field label="태명&아기이름" k="babyName" form={form} setForm={setForm} />}
                <TextAreaField label="메모" k="memo" form={form} setForm={setForm} />
                <ModalButtons save={saveCustomer} cancel={closeModal} />
              </>
            )}

            {modal === "consultation" && (
              <>
                <ModalTitle title="상담 기록 추가" />
                <Field label="상담일자*" k="date" form={form} setForm={setForm} type="date" />
                <SelectField label="방문 방식" k="type" form={form} setForm={setForm} options={["방문", "전화", "화상"]} />
                <TextAreaField label="상담 내용*" k="content" form={form} setForm={setForm} />
                <Field label="재상담 예정일" k="nextDate" form={form} setForm={setForm} type="date" />
                <ModalButtons save={saveConsultation} cancel={closeModal} />
              </>
            )}

            {modal === "policy" && (
              <>
                <ModalTitle title="보험 계약 추가" />
                <Field label="보험사*" k="company" form={form} setForm={setForm} />
                <Field label="상품명*" k="product" form={form} setForm={setForm} />
                <SelectField label="보험 종류" k="type" form={form} setForm={setForm} options={["종신", "실손", "연금", "건강", "자동차", "화재", "펫", "태아", "기타"]} />
                <Field label="가입일" k="startDate" form={form} setForm={setForm} type="date" />
                <Field label="만기일" k="endDate" form={form} setForm={setForm} type="date" />
                <Field label="월 보험료" k="premium" form={form} setForm={setForm} type="number" />
                <SelectField label="상태" k="status" form={form} setForm={setForm} options={["유지", "실효", "만기"]} />
                <ModalButtons save={savePolicy} cancel={closeModal} />
              </>
            )}

            {modal === "schedule" && (
              <>
                <ModalTitle title="일정 등록" />
                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>연결 고객</div>
                <select style={inp} value={form.customerId || selectedCustomer || ""} onChange={(e) => setForm((f) => ({ ...f, customerId: Number(e.target.value) }))}>
                  <option value="">미지정 고객</option>
                  {data.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div style={{ fontSize: 12, color: "#555", marginBottom: 8 }}>아이콘 선택</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 12 }}>
                  {[["전화", "📞"], ["미팅", "💬"], ["생일", "🎂"], ["서류", "📄"], ["자동차", "🚗"], ["기본", "🔔"], ["보험료", "💰"], ["보장점검", "🩺"]].map(([label, icon]) => (
                    <button key={label} type="button" onClick={() => setForm((f) => ({ ...f, icon }))} style={{ padding: "10px 6px", borderRadius: 10, border: form.icon === icon ? "2px solid #185FA5" : "1px solid #ddd", background: form.icon === icon ? "#E6F1FB" : "#fff", cursor: "pointer" }}>
                      <div style={{ fontSize: 20 }}>{icon}</div>
                      <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>{label}</div>
                    </button>
                  ))}
                </div>
                <Field label="일정 제목*" k="title" form={form} setForm={setForm} />
                <Field label="날짜*" k="date" form={form} setForm={setForm} type="date" />
                <Field label="시간" k="time" form={form} setForm={setForm} type="time" />
                <TextAreaField label="메모" k="memo" form={form} setForm={setForm} />
                <ModalButtons save={saveSchedule} cancel={closeModal} />
              </>
            )}

            {modal === "sale" && (
              <>
                <ModalTitle title="매출 등록" />
                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>고객 선택</div>
                <select style={inp} value={form.customerId || ""} onChange={(e) => setForm((f) => ({ ...f, customerId: Number(e.target.value) }))}>
                  <option value="">고객 미지정</option>
                  {data.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <Field label="계약일*" k="contractDate" form={form} setForm={setForm} type="date" />
                <Field label="보험사" k="company" form={form} setForm={setForm} />
                <Field label="상품명*" k="product" form={form} setForm={setForm} />
                <Field label="월 보험료" k="premium" form={form} setForm={setForm} type="number" />
                <Field label="초회 수수료" k="firstCommission" form={form} setForm={setForm} type="number" />
                <Field label="15회차 예상 수수료" k="fifteenthCommission" form={form} setForm={setForm} type="number" />
                <Field label="시책 예상" k="incentive" form={form} setForm={setForm} type="number" />
                <TextAreaField label="메모" k="memo" form={form} setForm={setForm} />
                <ModalButtons save={saveSale} cancel={closeModal} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ModalTitle({ title }) {
  return <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{title}</div>;
}

function Field({ label, k, form, setForm, type = "text" }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>{label}</div>
      <input type={type} style={inp} value={form[k] || ""} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
    </div>
  );
}

function TextAreaField({ label, k, form, setForm }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>{label}</div>
      <textarea style={{ ...inp, height: 80, resize: "vertical" }} value={form[k] || ""} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
    </div>
  );
}

function SelectField({ label, k, form, setForm, options }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>{label}</div>
      <select style={inp} value={form[k] || options[0]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function ModalButtons({ save, cancel }) {
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
      <button onClick={cancel} style={{ ...btn("#888780") }}>취소</button>
      <button onClick={save} style={btn()}>저장</button>
    </div>
  );
}

function SectionTitle({ title, button, onClick }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, marginTop: 8 }}>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
      {button && <button onClick={onClick} style={{ ...btn("#533AB7"), padding: "6px 14px", fontSize: 12 }}>{button}</button>}
    </div>
  );
}

function EditorCard({ value, setValue, save, cancel }) {
  return (
    <div style={{ ...card, border: "1.5px solid #AFA9EC", background: "#EEEDFE" }}>
      <textarea autoFocus value={value} onChange={(e) => setValue(e.target.value)} style={{ ...inp, height: 100, resize: "vertical", background: "#fff", border: "1.5px solid #AFA9EC", marginBottom: 10 }} />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={cancel} style={{ ...btn("#888780"), padding: "6px 14px", fontSize: 12 }}>취소</button>
        <button onClick={save} style={{ ...btn("#533AB7"), padding: "6px 14px", fontSize: 12 }}>저장</button>
      </div>
    </div>
  );
}