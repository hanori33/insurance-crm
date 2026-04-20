import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "insurance_crm_data";

const initialData = {
  customers: [
    {
      id: 1,
      name: "김민준",
      phone: "010-1234-5678",
      birth: "1985-04-25",
      email: "minjun@email.com",
      memo: "VIP 고객, 가족 소개 多",
      createdAt: "2024-01-10",
    },
    {
      id: 2,
      name: "이서연",
      phone: "010-9876-5432",
      birth: "1990-05-03",
      email: "seoyeon@email.com",
      memo: "직장인, 저녁 연락 선호",
      createdAt: "2024-02-05",
    },
  ],
  consultations: [
    {
      id: 1,
      customerId: 1,
      date: "2024-03-10",
      type: "방문",
      content: "종신보험 관심 표명, 다음달 재상담 예정",
      nextDate: "2024-04-10",
    },
    {
      id: 2,
      customerId: 1,
      date: "2024-04-10",
      type: "전화",
      content: "보험료 부담 언급, 저렴한 상품 안내",
      nextDate: "2024-05-01",
    },
    {
      id: 3,
      customerId: 2,
      date: "2024-02-20",
      type: "방문",
      content: "실손보험 문의, 건강 이력 확인 필요",
      nextDate: "2024-03-05",
    },
  ],
  policies: [
    {
      id: 1,
      customerId: 1,
      company: "삼성생명",
      product: "삼성 종신보험",
      type: "종신",
      startDate: "2024-05-01",
      endDate: "2054-05-01",
      premium: 120000,
      status: "유지",
    },
    {
      id: 2,
      customerId: 2,
      company: "현대해상",
      product: "굿앤굿실손보험",
      type: "실손",
      startDate: "2024-03-15",
      endDate: "2025-03-15",
      premium: 45000,
      status: "유지",
    },
    {
      id: 3,
      customerId: 1,
      company: "DB손해보험",
      product: "다이렉트자동차보험",
      type: "자동차",
      startDate: "2024-05-01",
      endDate: "2026-05-10",
      premium: 60000,
      status: "유지",
    },
  ],
  schedules: [
    { id: 1, customerId: 1, date: "2025-05-15", title: "갱신 안내 연락", done: false },
    { id: 2, customerId: 2, date: "2025-05-20", title: "추가 상품 상담", done: false },
  ],
  notes: [
    {
      id: 1,
      customerId: 1,
      content: "고객 성격 급한 편, 결론 먼저 말하는 방식 선호",
      createdAt: "2024-03-10",
      updatedAt: "2024-03-10",
    },
    {
      id: 2,
      customerId: 1,
      content: "배우자도 보험 관심 있음 — 별도 상담 필요",
      createdAt: "2024-04-10",
      updatedAt: "2024-04-10",
    },
  ],
};

function loadData() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : initialData;
  } catch {
    return initialData;
  }
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

const statusColor = { 유지: "#1D9E75", 실효: "#E24B4A", 만기: "#888780" };
const typeColor = { 방문: "#185FA5", 전화: "#BA7517", 화상: "#533AB7" };

const inp = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1.5px solid #b0b0b0",
  background: "#ffffff",
  color: "#222222",
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
  marginBottom: 10,
};

const btn = (color = "#185FA5") => ({
  padding: "8px 16px",
  borderRadius: 8,
  border: "none",
  background: color,
  color: "#fff",
  fontSize: 13,
  cursor: "pointer",
  fontWeight: 500,
});

const card = {
  background: "#ffffff",
  border: "0.5px solid #d9d9d9",
  borderRadius: 12,
  padding: "16px 20px",
  marginBottom: 12,
};

function getDaysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function getNextBirthday(birthStr) {
  if (!birthStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const b = new Date(birthStr);
  let next = new Date(today.getFullYear(), b.getMonth(), b.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  const days = Math.round((next - today) / 86400000);
  return { date: next.toISOString().slice(0, 10), days };
}

function daysLabel(days) {
  if (days === 0) return "오늘";
  if (days < 0) return `${Math.abs(days)}일 지남`;
  return `D-${days}`;
}

function daysColor(days) {
  if (days <= 7) return "#E24B4A";
  if (days <= 30) return "#BA7517";
  return "#1D9E75";
}

export default function App() {
  const [data, setData] = useState(loadData);
  const [view, setView] = useState("dashboard");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [editingNote, setEditingNote] = useState(null);
  const [noteInput, setNoteInput] = useState("");
  const [scheduleTab, setScheduleTab] = useState("schedule");
  const fileInputRef = useRef(null);

  useEffect(() => {
    saveData(data);
  }, [data]);

  const updateData = (fn) =>
    setData((prev) => {
      const next = fn(prev);
      saveData(next);
      return next;
    });

  const customers = data.customers.filter(
    (c) =>
      c.name.includes(search) ||
      c.phone.includes(search) ||
      (c.memo || "").includes(search) ||
      (c.email || "").includes(search)
  );

  const getCustomer = (id) => data.customers.find((c) => c.id === id);

  const getConsultations = (id) =>
    (data.consultations || [])
      .filter((c) => c.customerId === id)
      .sort((a, b) => b.date.localeCompare(a.date));

  const getPolicies = (id) => (data.policies || []).filter((p) => p.customerId === id);

  const getSchedules = (id) =>
    (data.schedules || [])
      .filter((s) => s.customerId === id && !s.done)
      .sort((a, b) => a.date.localeCompare(b.date));

  const getNotes = (id) =>
    (data.notes || [])
      .filter((n) => n.customerId === id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const allUpcoming = (data.schedules || [])
    .filter((s) => !s.done)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const totalPremium = (data.policies || [])
    .filter((p) => p.status === "유지")
    .reduce((s, p) => s + (p.premium || 0), 0);

  const birthdayList = data.customers
    .map((c) => {
      const bd = getNextBirthday(c.birth);
      return bd ? { customer: c, ...bd } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.days - b.days);

  const carExpireList = (data.policies || [])
    .filter((p) => p.type === "자동차" && p.status === "유지")
    .map((p) => ({ policy: p, customer: getCustomer(p.customerId), days: getDaysUntil(p.endDate) }))
    .sort((a, b) => a.days - b.days);

  function openModal(type, defaults = {}) {
    setModal(type);
    setForm(defaults);
  }

  function closeModal() {
    setModal(null);
    setForm({});
  }

  function saveCustomer() {
    if (!form.name || !form.phone) {
      alert("이름과 연락처는 필수예요.");
      return;
    }

    if (form.id) {
      updateData((d) => ({
        ...d,
        customers: d.customers.map((c) => (c.id === form.id ? { ...c, ...form } : c)),
      }));
    } else {
      updateData((d) => ({
        ...d,
        customers: [
          ...d.customers,
          {
            ...form,
            id: Date.now(),
            createdAt: new Date().toISOString().slice(0, 10),
          },
        ],
      }));
    }

    closeModal();
    setSelectedCustomer(null);
    setEditingNote(null);
    setView("customers");
  }

  function deleteCustomer(id) {
    updateData((d) => ({
      ...d,
      customers: d.customers.filter((c) => c.id !== id),
      consultations: d.consultations.filter((c) => c.customerId !== id),
      policies: d.policies.filter((p) => p.customerId !== id),
      schedules: d.schedules.filter((s) => s.customerId !== id),
      notes: (d.notes || []).filter((n) => n.customerId !== id),
    }));
    setSelectedCustomer(null);
    setView("customers");
  }

  function saveConsultation() {
    if (!form.date || !form.content) return;

    if (form.id) {
      updateData((d) => ({
        ...d,
        consultations: d.consultations.map((c) => (c.id === form.id ? { ...c, ...form } : c)),
      }));
    } else {
      updateData((d) => ({
        ...d,
        consultations: [...d.consultations, { ...form, id: Date.now(), customerId: selectedCustomer }],
      }));

      if (form.nextDate) {
        updateData((d) => ({
          ...d,
          schedules: [
            ...d.schedules,
            {
              id: Date.now() + 1,
              customerId: selectedCustomer,
              date: form.nextDate,
              title: "재상담 예정",
              done: false,
            },
          ],
        }));
      }
    }
    closeModal();
  }

  function savePolicy() {
    if (!form.company || !form.product) return;

    if (form.id) {
      updateData((d) => ({
        ...d,
        policies: d.policies.map((p) => (p.id === form.id ? { ...p, ...form } : p)),
      }));
    } else {
      updateData((d) => ({
        ...d,
        policies: [
          ...d.policies,
          { ...form, id: Date.now(), customerId: selectedCustomer, premium: Number(form.premium) || 0 },
        ],
      }));
    }
    closeModal();
  }

  function saveSchedule() {
    if (!form.date || !form.title) return;

    updateData((d) => ({
      ...d,
      schedules: [
        ...d.schedules,
        {
          ...form,
          id: Date.now(),
          customerId: selectedCustomer || form.customerId,
          done: false,
        },
      ],
    }));
    closeModal();
  }

  function toggleSchedule(id) {
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

  function saveNote() {
    if (!noteInput.trim()) return;
    const now = new Date().toISOString().slice(0, 10);

    if (editingNote === "new") {
      updateData((d) => ({
        ...d,
        notes: [
          ...(d.notes || []),
          {
            id: Date.now(),
            customerId: selectedCustomer,
            content: noteInput.trim(),
            createdAt: now,
            updatedAt: now,
          },
        ],
      }));
    } else {
      updateData((d) => ({
        ...d,
        notes: (d.notes || []).map((n) =>
          n.id === editingNote ? { ...n, content: noteInput.trim(), updatedAt: now } : n
        ),
      }));
    }

    setEditingNote(null);
    setNoteInput("");
  }

  function deleteNote(id) {
    updateData((d) => ({
      ...d,
      notes: (d.notes || []).filter((n) => n.id !== id),
    }));
  }

  function exportBackup() {
    try {
      const backup = {
        ...data,
        exportedAt: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `insurance-crm-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("백업 파일 생성 중 오류가 발생했습니다.");
    }
  }

  function importBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);

        if (
          !parsed ||
          !Array.isArray(parsed.customers) ||
          !Array.isArray(parsed.consultations) ||
          !Array.isArray(parsed.policies) ||
          !Array.isArray(parsed.schedules) ||
          !Array.isArray(parsed.notes)
        ) {
          alert("올바른 백업 파일이 아닙니다.");
          return;
        }

        setData({
          customers: parsed.customers || [],
          consultations: parsed.consultations || [],
          policies: parsed.policies || [],
          schedules: parsed.schedules || [],
          notes: parsed.notes || [],
        });

        alert("백업 파일을 불러왔습니다.");
      } catch {
        alert("JSON 파일을 읽는 중 오류가 발생했습니다.");
      } finally {
        event.target.value = "";
      }
    };

    reader.readAsText(file);
  }

  const nav = [
    { key: "dashboard", label: "홈" },
    { key: "customers", label: "고객 목록" },
    { key: "schedules", label: "일정 관리" },
  ];

  const schedTabs = [
    { key: "schedule", label: "일정" },
    { key: "birthday", label: "생일" },
    { key: "car", label: "자동차 만기" },
  ];

  return (
    <div style={{ fontFamily: "sans-serif", color: "#222", minHeight: 600, background: "#f7f8fa" }}>
      <div style={{ borderBottom: "0.5px solid #ddd", background: "#ffffff" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 24px 12px",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 20, fontWeight: 500 }}>보험 CRM</div>
            <div style={{ fontSize: 13, color: "#666" }}>보험 설계사 고객관리</div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={exportBackup} style={{ ...btn("#533AB7"), padding: "8px 12px", fontSize: 12 }}>
              백업 저장
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ ...btn("#185FA5"), padding: "8px 12px", fontSize: 12 }}
            >
              파일 업로드
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              style={{ display: "none" }}
              onChange={importBackup}
            />
          </div>
        </div>

        <div style={{ display: "flex", padding: "0 16px" }}>
          {nav.map((n) => {
            const isActive = view === n.key && selectedCustomer === null;
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
                  fontWeight: isActive ? 500 : 400,
                  background: "transparent",
                  border: "none",
                  borderBottom: isActive ? "3px solid #185FA5" : "3px solid transparent",
                  color: isActive ? "#185FA5" : "#666",
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
                { label: "유지 계약", value: (data.policies || []).filter((p) => p.status === "유지").length + "건" },
                { label: "월 보험료 합계", value: (totalPremium / 10000).toFixed(1) + "만원" },
                { label: "예정 일정", value: (data.schedules || []).filter((s) => !s.done).length + "건" },
              ].map((m) => (
                <div key={m.label} style={{ background: "#eef2f7", borderRadius: 8, padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 500 }}>{m.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>다가오는 일정</div>
                {allUpcoming.length === 0 && <div style={{ fontSize: 13, color: "#666" }}>예정 일정이 없습니다</div>}
                {allUpcoming.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 0",
                      borderBottom: "0.5px solid #eee",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {getCustomer(s.customerId)?.name} — {s.title}
                      </div>
                      <div style={{ fontSize: 12, color: "#666" }}>{s.date}</div>
                    </div>
                    <button onClick={() => toggleSchedule(s.id)} style={{ ...btn("#1D9E75"), padding: "4px 10px", fontSize: 12 }}>
                      완료
                    </button>
                  </div>
                ))}
              </div>

              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>최근 등록 고객</div>
                {data.customers.slice(-4).reverse().map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSelectedCustomer(c.id);
                      setView("detail");
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 0",
                      borderBottom: "0.5px solid #eee",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        background: "#B5D4F4",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#0C447C",
                        flexShrink: 0,
                      }}
                    >
                      {c.name[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
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
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름 또는 연락처 검색"
                style={{ ...inp, marginBottom: 0, flex: 1 }}
              />
              <button onClick={() => openModal("customer")} style={btn()}>
                + 고객 등록
              </button>
            </div>

            {customers.length === 0 && <div style={{ color: "#666", fontSize: 14 }}>고객이 없습니다.</div>}

            {customers.map((c) => (
              <div
                key={c.id}
                style={{ ...card, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                onClick={() => {
                  setSelectedCustomer(c.id);
                  setView("detail");
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: "#B5D4F4",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 17,
                      fontWeight: 500,
                      color: "#0C447C",
                    }}
                  >
                    {c.name[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{c.name}</div>
                    <div style={{ fontSize: 13, color: "#666" }}>{c.phone} · {c.birth}</div>
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

        {view === "detail" &&
          selectedCustomer &&
          (() => {
            const c = getCustomer(selectedCustomer);
            if (!c) return null;

            const cons = getConsultations(selectedCustomer);
            const pols = getPolicies(selectedCustomer);
            const scheds = getSchedules(selectedCustomer);
            const notes = getNotes(selectedCustomer);

            return (
              <div>
                <button
                  onClick={() => {
                    setView("customers");
                    setSelectedCustomer(null);
                    setEditingNote(null);
                  }}
                  style={{ ...btn("transparent"), color: "#666", border: "0.5px solid #bbb", marginBottom: 16 }}
                >
                  ← 목록으로
                </button>

                <div style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: "50%",
                        background: "#B5D4F4",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                        fontWeight: 500,
                        color: "#0C447C",
                      }}
                    >
                      {c.name[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 500 }}>{c.name}</div>
                      <div style={{ fontSize: 13, color: "#666" }}>{c.phone} · {c.birth}</div>
                      {c.email && <div style={{ fontSize: 13, color: "#666" }}>{c.email}</div>}
                      {c.memo && <div style={{ fontSize: 13, marginTop: 4 }}>{c.memo}</div>}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => openModal("customer", { ...c })} style={{ ...btn("#888780"), padding: "6px 12px", fontSize: 12 }}>
                      수정
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm("삭제하시겠습니까?")) deleteCustomer(c.id);
                      }}
                      style={{ ...btn("#E24B4A"), padding: "6px 12px", fontSize: 12 }}
                    >
                      삭제
                    </button>
                  </div>
                </div>

                {scheds.length > 0 && (
                  <div style={{ ...card, background: "#E6F1FB", borderColor: "#B5D4F4" }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#0C447C", marginBottom: 8 }}>예정 일정</div>
                    {scheds.map((s) => (
                      <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                        <span>
                          {s.date} — {s.title}
                        </span>
                        <button onClick={() => toggleSchedule(s.id)} style={{ ...btn("#1D9E75"), padding: "3px 10px", fontSize: 12 }}>
                          완료
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, marginTop: 4 }}>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>메모 정리</div>
                  {editingNote === null && (
                    <button onClick={startNewNote} style={{ ...btn("#533AB7"), padding: "6px 14px", fontSize: 12 }}>
                      + 메모 추가
                    </button>
                  )}
                </div>

                {editingNote === "new" && (
                  <div style={{ ...card, border: "1.5px solid #AFA9EC", background: "#EEEDFE" }}>
                    <div style={{ fontSize: 12, color: "#3C3489", marginBottom: 6, fontWeight: 500 }}>새 메모</div>
                    <textarea
                      autoFocus
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder="고객에 대한 메모를 자유롭게 입력하세요..."
                      style={{ ...inp, height: 100, resize: "vertical", background: "#fff", border: "1.5px solid #AFA9EC", marginBottom: 10 }}
                    />
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button onClick={cancelNote} style={{ ...btn("#888780"), padding: "6px 14px", fontSize: 12 }}>
                        취소
                      </button>
                      <button onClick={saveNote} style={{ ...btn("#533AB7"), padding: "6px 14px", fontSize: 12 }}>
                        저장
                      </button>
                    </div>
                  </div>
                )}

                {notes.length === 0 && editingNote === null && (
                  <div style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>메모가 없습니다. 추가해 보세요!</div>
                )}

                {notes.map((n) => (
                  <div
                    key={n.id}
                    style={{ ...card, border: editingNote === n.id ? "1.5px solid #AFA9EC" : "0.5px solid #d9d9d9" }}
                  >
                    {editingNote === n.id ? (
                      <>
                        <textarea
                          autoFocus
                          value={noteInput}
                          onChange={(e) => setNoteInput(e.target.value)}
                          style={{ ...inp, height: 90, resize: "vertical", background: "#fff", border: "1.5px solid #AFA9EC", marginBottom: 10 }}
                        />
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button onClick={cancelNote} style={{ ...btn("#888780"), padding: "6px 14px", fontSize: 12 }}>
                            취소
                          </button>
                          <button onClick={saveNote} style={{ ...btn("#533AB7"), padding: "6px 14px", fontSize: 12 }}>
                            저장
                          </button>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{n.content}</div>
                          <div style={{ fontSize: 11, color: "#666", marginTop: 6 }}>
                            {n.updatedAt !== n.createdAt ? `수정됨 ${n.updatedAt}` : `작성 ${n.createdAt}`}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button onClick={() => startEditNote(n)} style={{ ...btn("#888780"), padding: "4px 10px", fontSize: 12 }}>
                            수정
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm("삭제하시겠습니까?")) deleteNote(n.id);
                            }}
                            style={{ ...btn("#E24B4A"), padding: "4px 10px", fontSize: 12 }}
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, marginTop: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>상담 방문 기록</div>
                  <button onClick={() => openModal("consultation", { type: "방문" })} style={{ ...btn(), padding: "6px 14px", fontSize: 12 }}>
                    + 기록 추가
                  </button>
                </div>

                {cons.length === 0 && <div style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>상담 기록이 없습니다.</div>}

                {cons.map((cn) => (
                  <div key={cn.id} style={card}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span
                          style={{
                            fontSize: 12,
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: typeColor[cn.type] + "22",
                            color: typeColor[cn.type],
                            fontWeight: 500,
                          }}
                        >
                          {cn.type}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{cn.date}</span>
                      </div>
                      {cn.nextDate && <span style={{ fontSize: 12, color: "#666" }}>재상담: {cn.nextDate}</span>}
                    </div>
                    <div style={{ fontSize: 13 }}>{cn.content}</div>
                  </div>
                ))}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, marginTop: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>보험 가입 이력</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => openModal("policy", { type: "자동차", status: "유지" })}
                      style={{ ...btn("#185FA5"), padding: "6px 14px", fontSize: 12, background: "#E6F1FB", color: "#185FA5", border: "1px solid #B5D4F4" }}
                    >
                      🚗 자동차 등록
                    </button>
                    <button onClick={() => openModal("policy", { type: "종신", status: "유지" })} style={{ ...btn(), padding: "6px 14px", fontSize: 12 }}>
                      + 계약 추가
                    </button>
                  </div>
                </div>

                {pols.length === 0 && <div style={{ fontSize: 13, color: "#666" }}>가입 이력이 없습니다.</div>}

                {pols.map((p) => (
                  <div key={p.id} style={card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 500 }}>{p.product}</span>
                          <span
                            style={{
                              fontSize: 11,
                              padding: "2px 8px",
                              borderRadius: 6,
                              background: statusColor[p.status] + "22",
                              color: statusColor[p.status],
                              fontWeight: 500,
                            }}
                          >
                            {p.status}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: "#666" }}>
                          {p.company} · {p.type}보험
                        </div>
                        <div style={{ fontSize: 12, color: "#666" }}>
                          {p.startDate} ~ {p.endDate}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 15, fontWeight: 500 }}>{(p.premium || 0).toLocaleString()}원</div>
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
            <div style={{ display: "flex", gap: 0, marginBottom: 20, border: "0.5px solid #ccc", borderRadius: 10, overflow: "hidden" }}>
              {schedTabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setScheduleTab(t.key)}
                  style={{
                    flex: 1,
                    padding: "13px 8px",
                    fontSize: 15,
                    fontWeight: scheduleTab === t.key ? 500 : 400,
                    border: "none",
                    cursor: "pointer",
                    background: scheduleTab === t.key ? "#185FA5" : "#f2f3f5",
                    color: scheduleTab === t.key ? "#fff" : "#666",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {scheduleTab === "schedule" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontSize: 16, fontWeight: 500 }}>상담 일정</div>
                  <button onClick={() => openModal("schedule", {})} style={btn()}>
                    + 일정 추가
                  </button>
                </div>

                {(data.schedules || [])
                  .filter((s) => !s.done)
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((s) => {
                    const days = getDaysUntil(s.date);
                    return (
                      <div key={s.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div
                            style={{
                              minWidth: 44,
                              textAlign: "center",
                              padding: "4px 8px",
                              borderRadius: 8,
                              background: daysColor(days) + "18",
                              color: daysColor(days),
                              fontSize: 13,
                              fontWeight: 500,
                            }}
                          >
                            {daysLabel(days)}
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 500 }}>
                              {getCustomer(s.customerId)?.name} — {s.title}
                            </div>
                            <div style={{ fontSize: 12, color: "#666" }}>{s.date}</div>
                          </div>
                        </div>
                        <button onClick={() => toggleSchedule(s.id)} style={{ ...btn("#1D9E75"), padding: "8px 16px", fontSize: 13 }}>
                          완료
                        </button>
                      </div>
                    );
                  })}

                {(data.schedules || []).filter((s) => !s.done).length === 0 && <div style={{ fontSize: 13, color: "#666" }}>예정 일정이 없습니다.</div>}

                <div style={{ fontSize: 14, fontWeight: 500, margin: "20px 0 10px", color: "#666" }}>완료된 일정</div>

                {(data.schedules || [])
                  .filter((s) => s.done)
                  .map((s) => (
                    <div key={s.id} style={{ ...card, opacity: 0.5 }}>
                      <div style={{ fontSize: 13, textDecoration: "line-through" }}>
                        {getCustomer(s.customerId)?.name} — {s.title}
                      </div>
                      <div style={{ fontSize: 12, color: "#666" }}>{s.date}</div>
                    </div>
                  ))}
              </div>
            )}

            {scheduleTab === "birthday" && (
              <div>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>고객 생일 현황</div>
                {birthdayList.length === 0 && <div style={{ fontSize: 13, color: "#666" }}>등록된 생일이 없습니다.</div>}

                {birthdayList.map(({ customer: c, date, days }) => (
                  <div
                    key={c.id}
                    style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    onClick={() => {
                      setSelectedCustomer(c.id);
                      setView("detail");
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: "50%",
                          background: "#FAEEDA",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 20,
                        }}
                      >
                        🎂
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 500 }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: "#666" }}>
                          {c.birth?.slice(5).replace("-", "월 ")}일 · {date}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        minWidth: 52,
                        textAlign: "center",
                        padding: "6px 12px",
                        borderRadius: 8,
                        background: daysColor(days) + "18",
                        color: daysColor(days),
                        fontSize: 14,
                        fontWeight: 500,
                      }}
                    >
                      {daysLabel(days)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {scheduleTab === "car" && (
              <div>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>자동차보험 만기 현황</div>
                {carExpireList.length === 0 && <div style={{ fontSize: 13, color: "#666" }}>자동차보험 계약이 없습니다.</div>}

                {carExpireList.map(({ policy: p, customer: c, days }) => (
                  <div
                    key={p.id}
                    style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    onClick={() => {
                      if (c) {
                        setSelectedCustomer(c.id);
                        setView("detail");
                      }
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: "50%",
                          background: "#E6F1FB",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 20,
                        }}
                      >
                        🚗
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 500 }}>
                          {c?.name} — {p.product}
                        </div>
                        <div style={{ fontSize: 12, color: "#666" }}>{p.company} · 만기 {p.endDate}</div>
                        <div style={{ fontSize: 12, color: "#666" }}>월 {(p.premium || 0).toLocaleString()}원</div>
                      </div>
                    </div>

                    <div
                      style={{
                        minWidth: 52,
                        textAlign: "center",
                        padding: "6px 12px",
                        borderRadius: 8,
                        background: daysColor(days) + "18",
                        color: daysColor(days),
                        fontSize: 14,
                        fontWeight: 500,
                      }}
                    >
                      {daysLabel(days)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {modal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 16,
              padding: 28,
              width: 440,
              maxWidth: "95vw",
              maxHeight: "85vh",
              overflowY: "auto",
              border: "1.5px solid #d0d0d0",
              boxShadow: "0 8px 32px rgba(0,0,0,0.13)",
            }}
          >
            {modal === "customer" && (
              <>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>{form.id ? "고객 수정" : "고객 등록"}</div>
                {[["name", "이름*"], ["phone", "연락처*"], ["birth", "생년월일 (YYYY-MM-DD)"], ["email", "이메일"], ["memo", "메모"]].map(
                  ([k, l]) => (
                    <div key={k}>
                      <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>{l}</div>
                      <input
                        style={inp}
                        value={form[k] || ""}
                        onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                      />
                    </div>
                  )
                )}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={closeModal} style={btn("#888780")}>
                    취소
                  </button>
                  <button onClick={saveCustomer} style={btn()}>
                    저장
                  </button>
                </div>
              </>
            )}

            {modal === "consultation" && (
              <>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>상담 기록 추가</div>
                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>상담일자*</div>
                <input
                  type="date"
                  style={inp}
                  value={form.date || ""}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>방문 방식</div>
                <select
                  style={inp}
                  value={form.type || "방문"}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                >
                  {["방문", "전화", "화상"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>상담 내용*</div>
                <textarea
                  style={{ ...inp, height: 80, resize: "vertical" }}
                  value={form.content || ""}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                />
                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>재상담 예정일</div>
                <input
                  type="date"
                  style={inp}
                  value={form.nextDate || ""}
                  onChange={(e) => setForm((f) => ({ ...f, nextDate: e.target.value }))}
                />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={closeModal} style={btn("#888780")}>
                    취소
                  </button>
                  <button onClick={saveConsultation} style={btn()}>
                    저장
                  </button>
                </div>
              </>
            )}

            {modal === "policy" && (
              <>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>보험 계약 추가</div>
                {[["company", "보험사*"], ["product", "상품명*"]].map(([k, l]) => (
                  <div key={k}>
                    <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>{l}</div>
                    <input
                      style={inp}
                      value={form[k] || ""}
                      onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                    />
                  </div>
                ))}
                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>보험 종류</div>
                <select
                  style={inp}
                  value={form.type || "종신"}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                >
                  {["종신", "실손", "연금", "건강", "자동차", "화재", "기타"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>가입일</div>
                    <input
                      type="date"
                      style={{ ...inp, marginBottom: 0 }}
                      value={form.startDate || ""}
                      onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>만기일</div>
                    <input
                      type="date"
                      style={{ ...inp, marginBottom: 0 }}
                      value={form.endDate || ""}
                      onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>월 보험료 (원)</div>
                  <input
                    type="number"
                    style={inp}
                    value={form.premium || ""}
                    onChange={(e) => setForm((f) => ({ ...f, premium: e.target.value }))}
                  />
                </div>

                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>상태</div>
                <select
                  style={inp}
                  value={form.status || "유지"}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  {["유지", "실효", "만기"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={closeModal} style={btn("#888780")}>
                    취소
                  </button>
                  <button onClick={savePolicy} style={btn()}>
                    저장
                  </button>
                </div>
              </>
            )}

            {modal === "schedule" && (
              <>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>일정 추가</div>
                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>고객 선택</div>
                <select
                  style={inp}
                  value={form.customerId || ""}
                  onChange={(e) => setForm((f) => ({ ...f, customerId: Number(e.target.value) }))}
                >
                  <option value="">-- 선택 --</option>
                  {data.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>일정 제목*</div>
                <input
                  style={inp}
                  value={form.title || ""}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="예: 갱신 상담, 팔로업 전화"
                />

                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>일정 날짜*</div>
                <input
                  type="date"
                  style={inp}
                  value={form.date || ""}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={closeModal} style={btn("#888780")}>
                    취소
                  </button>
                  <button onClick={saveSchedule} style={btn()}>
                    저장
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
