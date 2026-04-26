import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

const STORAGE_KEY = "insurance_crm_data_v2";

const initialData = {
  customers: [],
  consultations: [],
  policies: [],
  schedules: [],
  notes: [],
};

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : initialData;
  } catch {
    return initialData;
  }
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

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
  fontWeight: 500,
  cursor: "pointer",
});

const card = {
  background: "#fff",
  border: "1px solid #ddd",
  borderRadius: 14,
  padding: "16px 20px",
  marginBottom: 12,
};

const statusBadge = (status) => ({
  marginLeft: 8,
  padding: "2px 8px",
  borderRadius: 6,
  fontSize: 11,
  color: "#fff",
  background:
    status === "가입" ? "#4CAF50" : status === "보류" ? "#BA7517" : "#999",
});

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
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const fileInputRef = useRef(null);

  const updateData = (fn) =>
    setData((prev) => {
      const next = fn(prev);
      saveData(next);
      return next;
    });

  useEffect(() => {
    saveData(data);
  }, [data]);

  useEffect(() => {
    async function getCurrentSession() {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error("세션 확인 실패:", error);
        return;
      }
      setSession(data.session);
    }

    getCurrentSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function fetchCustomers() {
      if (!session?.user?.id) return;

      const { data: customersFromDb, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("고객 불러오기 실패:", error);
        return;
      }

      setData((prev) => ({
        ...prev,
        customers: (customersFromDb || []).map((c) => ({
          id: c.app_customer_id,
          name: c.name || "",
          phone: c.phone || "",
          birth: c.birth || "",
          email: c.email || "",
          memo: c.memo || "",
          status: c.status || "가망",
          createdAt: c.created_at || "",
        })),
      }));
    }

    fetchCustomers();
  }, [session]);

  async function handleAuthSubmit() {
    const name = (authForm.name || "").trim();
    const email = (authForm.email || "").trim();
    const password = (authForm.password || "").trim();

    if (!email || !password) {
      alert("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    if (authMode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        alert("회원가입 실패: " + error.message);
        return;
      }

      alert("회원가입 완료! 이메일 인증 후 로그인하세요.");
      setAuthMode("login");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("로그인 실패: " + error.message);
      return;
    }

    alert("로그인 성공!");
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert("로그아웃 실패: " + error.message);
      return;
    }
    alert("로그아웃 완료!");
  }

  function openModal(type, defaults = {}) {
    setModal(type);
    setForm(defaults);
  }

  function closeModal() {
    setModal(null);
    setForm({});
  }

  async function saveCustomer() {
    if (!form.name || !form.phone) {
      alert("이름과 연락처는 필수예요.");
      return;
    }

    const savedCustomerId = form.id || Date.now();

    const payload = {
      app_customer_id: savedCustomerId,
      name: form.name || "",
      phone: form.phone || "",
      birth: form.birth || "",
      email: form.email || "",
      memo: form.memo || "",
      status: form.status || "가망",
      created_at: form.createdAt || new Date().toISOString(),
    };

    let error = null;

    if (form.id) {
      const result = await supabase
        .from("customers")
        .update({
          name: payload.name,
          phone: payload.phone,
          birth: payload.birth,
          email: payload.email,
          memo: payload.memo,
          status: payload.status,
        })
        .eq("app_customer_id", form.id);

      error = result.error;
    } else {
      const result = await supabase.from("customers").insert([payload]);
      error = result.error;
    }

    if (error) {
      alert("DB 저장 실패: " + error.message);
      return;
    }

    if (form.id) {
      updateData((d) => ({
        ...d,
        customers: d.customers.map((c) =>
          c.id === form.id
            ? {
                ...c,
                name: payload.name,
                phone: payload.phone,
                birth: payload.birth,
                email: payload.email,
                memo: payload.memo,
                status: payload.status,
              }
            : c
        ),
      }));
    } else {
      updateData((d) => ({
        ...d,
        customers: [
          ...d.customers,
          {
            id: savedCustomerId,
            name: payload.name,
            phone: payload.phone,
            birth: payload.birth,
            email: payload.email,
            memo: payload.memo,
            status: payload.status,
            createdAt: payload.created_at,
          },
        ],
      }));
    }

    closeModal();
  }

  async function deleteCustomer(id) {
    const ok = window.confirm("삭제하시겠습니까?");
    if (!ok) return;

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("app_customer_id", id);

    if (error) {
      alert("DB 삭제 실패: " + error.message);
      return;
    }

    updateData((d) => ({
      ...d,
      customers: d.customers.filter((c) => c.id !== id),
      consultations: d.consultations.filter((c) => c.customerId !== id),
      policies: d.policies.filter((p) => p.customerId !== id),
      schedules: d.schedules.filter((s) => s.customerId !== id),
      notes: d.notes.filter((n) => n.customerId !== id),
    }));

    setSelectedCustomer(null);
    setView("customers");
  }

  async function convertToContract(c) {
    const { error } = await supabase
      .from("customers")
      .update({ status: "가입" })
      .eq("app_customer_id", c.id);

    if (error) {
      alert("상태 변경 실패: " + error.message);
      return;
    }

    updateData((d) => ({
      ...d,
      customers: d.customers.map((item) =>
        item.id === c.id ? { ...item, status: "가입" } : item
      ),
      consultations: [
        ...d.consultations,
        {
          id: Date.now(),
          customerId: c.id,
          date: new Date().toISOString().slice(0, 10),
          type: "전화",
          content: "가입 전환 완료",
          nextDate: "",
        },
      ],
    }));

    alert("가입 고객으로 변경 완료!");
  }

  function saveConsultation() {
    if (!form.date || !form.content) {
      alert("상담일자와 내용은 필수예요.");
      return;
    }

    updateData((d) => ({
      ...d,
      consultations: [
        ...d.consultations,
        {
          id: Date.now(),
          customerId: selectedCustomer,
          date: form.date,
          type: form.type || "방문",
          content: form.content,
          nextDate: form.nextDate || "",
        },
      ],
    }));

    closeModal();
  }

  function savePolicy() {
    if (!form.company || !form.product) {
      alert("보험사와 상품명은 필수예요.");
      return;
    }

    updateData((d) => ({
      ...d,
      policies: [
        ...d.policies,
        {
          id: Date.now(),
          customerId: selectedCustomer,
          company: form.company,
          product: form.product,
          type: form.type || "종신",
          startDate: form.startDate || "",
          endDate: form.endDate || "",
          premium: Number(form.premium) || 0,
          status: form.status || "유지",
        },
      ],
    }));

    closeModal();
  }

  function saveSchedule() {
    if (!form.date || !form.title) {
      alert("일정 날짜와 제목은 필수예요.");
      return;
    }

    updateData((d) => ({
      ...d,
      schedules: [
        ...d.schedules,
        {
          id: Date.now(),
          customerId: selectedCustomer || form.customerId,
          date: form.date,
          title: form.title,
          done: false,
        },
      ],
    }));

    closeModal();
  }

  function toggleSchedule(id) {
    updateData((d) => ({
      ...d,
      schedules: d.schedules.map((s) =>
        s.id === id ? { ...s, done: !s.done } : s
      ),
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
          ...d.notes,
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
        notes: d.notes.map((n) =>
          n.id === editingNote
            ? { ...n, content: noteInput.trim(), updatedAt: now }
            : n
        ),
      }));
    }

    setEditingNote(null);
    setNoteInput("");
  }

  function deleteNote(id) {
    updateData((d) => ({
      ...d,
      notes: d.notes.filter((n) => n.id !== id),
    }));
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `insurance-crm-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
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

        setData(parsed);
        alert("백업 파일을 불러왔습니다.");
      } catch {
        alert("백업 파일 읽기 실패");
      } finally {
        event.target.value = "";
      }
    };

    reader.readAsText(file);
  }

  const getCustomer = (id) => data.customers.find((c) => c.id === id);

  const getConsultations = (id) =>
    data.consultations
      .filter((c) => c.customerId === id)
      .sort((a, b) => b.date.localeCompare(a.date));

  const getPolicies = (id) => data.policies.filter((p) => p.customerId === id);

  const getSchedules = (id) =>
    data.schedules
      .filter((s) => s.customerId === id && !s.done)
      .sort((a, b) => a.date.localeCompare(b.date));

  const getNotes = (id) =>
    data.notes
      .filter((n) => n.customerId === id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const customers = (data.customers || [])
    .filter((c) => {
      const matchesSearch =
        !search ||
        (c.name || "").includes(search) ||
        (c.phone || "").includes(search) ||
        (c.email || "").includes(search) ||
        (c.memo || "").includes(search);

      const matchesStatus =
        statusFilter === "전체"
          ? true
          : (c.status || "가망") === statusFilter;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ko-KR"));

  const allUpcoming = data.schedules
    .filter((s) => !s.done)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const nav = [
    { key: "dashboard", label: "홈" },
    { key: "customers", label: "고객 목록" },
    { key: "schedules", label: "일정 관리" },
  ];

  if (!session) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f8fa",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            width: 360,
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
            보험 CRM
          </div>
          <div style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>
            {authMode === "login" ? "로그인" : "회원가입"}
          </div>

          {authMode === "signup" && (
            <>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>
                이름
              </div>
              <input
                style={inp}
                value={authForm.name}
                onChange={(e) =>
                  setAuthForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </>
          )}

          <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>
            이메일
          </div>
          <input
            style={inp}
            value={authForm.email}
            onChange={(e) =>
              setAuthForm((f) => ({ ...f, email: e.target.value }))
            }
          />

          <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>
            비밀번호
          </div>
          <input
            type="password"
            style={inp}
            value={authForm.password}
            onChange={(e) =>
              setAuthForm((f) => ({ ...f, password: e.target.value }))
            }
          />

          <button
            onClick={handleAuthSubmit}
            style={{ ...btn(), width: "100%", marginBottom: 10 }}
          >
            {authMode === "login" ? "로그인" : "회원가입"}
          </button>

          <button
            onClick={() =>
              setAuthMode((m) => (m === "login" ? "signup" : "login"))
            }
            style={{ ...btn("#888780"), width: "100%" }}
          >
            {authMode === "login" ? "회원가입으로" : "로그인으로"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        fontFamily: "sans-serif",
        color: "#222",
        minHeight: "100vh",
        background: "#f7f8fa",
      }}
    >
      <div style={{ borderBottom: "1px solid #ddd", background: "#fff" }}>
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
            <div style={{ fontSize: 20, fontWeight: 700 }}>보험 CRM</div>
            <div style={{ fontSize: 13, color: "#666" }}>
              {session?.user?.user_metadata?.name
                ? `${session.user.user_metadata.name} 설계사님`
                : "보험 설계사 고객관리"}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={exportBackup}
              style={{ ...btn("#533AB7"), padding: "8px 12px", fontSize: 12 }}
            >
              백업 저장
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ ...btn("#185FA5"), padding: "8px 12px", fontSize: 12 }}
            >
              파일 업로드
            </button>

            <button
              onClick={handleLogout}
              style={{ ...btn("#888780"), padding: "8px 12px", fontSize: 12 }}
            >
              로그아웃
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
                  if (n.key === "customers") {
                    setStatusFilter("전체");
                    setSearch("");
                  }
                }}
                style={{
                  flex: 1,
                  padding: "14px 8px",
                  fontSize: 16,
                  fontWeight: isActive ? 600 : 400,
                  background: "transparent",
                  border: "none",
                  borderBottom: isActive
                    ? "3px solid #185FA5"
                    : "3px solid transparent",
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
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: 12,
                marginBottom: 20,
              }}
            >
              {[
                { label: "전체 고객", value: data.customers.length + "명" },
                {
                  label: "가망 고객",
                  value:
                    data.customers.filter(
                      (c) => (c.status || "가망") === "가망"
                    ).length + "명",
                },
                {
                  label: "가입 고객",
                  value:
                    data.customers.filter((c) => c.status === "가입").length +
                    "명",
                },
                {
                  label: "예정 일정",
                  value:
                    (data.schedules || []).filter((s) => !s.done).length + "건",
                },
              ].map((m) => (
                <div
                  key={m.label}
                  style={{
                    background: "#eef2f7",
                    borderRadius: 8,
                    padding: "14px 16px",
                  }}
                >
                  <div
                    style={{ fontSize: 12, color: "#666", marginBottom: 4 }}
                  >
                    {m.label}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{m.value}</div>
                </div>
              ))}
            </div>

            <div
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
            >
              <div style={card}>
                <div
                  style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}
                >
                  다가오는 일정
                </div>
                {allUpcoming.length === 0 && (
                  <div style={{ fontSize: 13, color: "#666" }}>
                    예정 일정이 없습니다
                  </div>
                )}
                {allUpcoming.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 0",
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {getCustomer(s.customerId)?.name} — {s.title}
                      </div>
                      <div style={{ fontSize: 12, color: "#666" }}>{s.date}</div>
                    </div>
                    <button
                      onClick={() => toggleSchedule(s.id)}
                      style={{ ...btn("#1D9E75"), padding: "4px 10px", fontSize: 12 }}
                    >
                      완료
                    </button>
                  </div>
                ))}
              </div>

              <div style={card}>
                <div
                  style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}
                >
                  최근 등록 고객
                </div>
                {data.customers
                  .slice()
                  .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
                  .slice(0, 4)
                  .map((c) => (
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
                        borderBottom: "1px solid #eee",
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
                          fontWeight: 600,
                          color: "#0C447C",
                          flexShrink: 0,
                        }}
                      >
                        {c.name?.[0]}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
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

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {["전체", "가망", "가입", "보류"].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  style={{
                    ...btn(statusFilter === status ? "#185FA5" : "#888780"),
                    padding: "6px 12px",
                    fontSize: 12,
                  }}
                >
                  {status}
                </button>
              ))}
            </div>

            {customers.length === 0 && (
              <div style={{ color: "#666", fontSize: 14 }}>고객이 없습니다.</div>
            )}

            {customers.map((c) => (
              <div
                key={c.id}
                style={{
                  ...card,
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
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
                      fontWeight: 600,
                      color: "#0C447C",
                    }}
                  >
                    {c.name?.[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>
                      {c.name}
                      <span style={statusBadge(c.status || "가망")}>
                        {c.status || "가망"}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "#666" }}>
                      {c.phone} · {c.birth}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    계약 {getPolicies(c.id).length}건
                  </div>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    상담 {getConsultations(c.id).length}건
                  </div>
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
                  style={{
                    ...btn("transparent"),
                    color: "#666",
                    border: "1px solid #bbb",
                    marginBottom: 16,
                    background: "#fff",
                  }}
                >
                  ← 목록으로
                </button>

                <div
                  style={{
                    ...card,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
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
                        fontWeight: 700,
                        color: "#0C447C",
                      }}
                    >
                      {c.name?.[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>
                        {c.name}
                        <span style={statusBadge(c.status || "가망")}>
                          {c.status || "가망"}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: "#666" }}>
                        {c.phone} · {c.birth}
                      </div>
                      {c.email && (
                        <div style={{ fontSize: 13, color: "#666" }}>{c.email}</div>
                      )}
                      {c.memo && (
                        <div style={{ fontSize: 13, marginTop: 4 }}>{c.memo}</div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => openModal("customer", { ...c })}
                      style={{ ...btn("#888780"), padding: "6px 12px", fontSize: 12 }}
                    >
                      수정
                    </button>

                    <button
                      onClick={() => deleteCustomer(c.id)}
                      style={{ ...btn("#E24B4A"), padding: "6px 12px", fontSize: 12 }}
                    >
                      삭제
                    </button>

                    {(c.status || "가망") !== "가입" && (
                      <button
                        onClick={() => convertToContract(c)}
                        style={{ ...btn("#4CAF50"), padding: "6px 12px", fontSize: 12 }}
                      >
                        가입 전환
                      </button>
                    )}
                  </div>
                </div>

                {scheds.length > 0 && (
                  <div style={{ ...card, background: "#E6F1FB", borderColor: "#B5D4F4" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0C447C", marginBottom: 8 }}>
                      예정 일정
                    </div>
                    {scheds.map((s) => (
                      <div
                        key={s.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 13,
                          marginBottom: 4,
                        }}
                      >
                        <span>
                          {s.date} — {s.title}
                        </span>
                        <button
                          onClick={() => toggleSchedule(s.id)}
                          style={{ ...btn("#1D9E75"), padding: "3px 10px", fontSize: 12 }}
                        >
                          완료
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                    marginTop: 4,
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 700 }}>메모 정리</div>
                  {editingNote === null && (
                    <button
                      onClick={startNewNote}
                      style={{ ...btn("#533AB7"), padding: "6px 14px", fontSize: 12 }}
                    >
                      + 메모 추가
                    </button>
                  )}
                </div>

                {editingNote === "new" && (
                  <div style={{ ...card, border: "1.5px solid #AFA9EC", background: "#EEEDFE" }}>
                    <div style={{ fontSize: 12, color: "#3C3489", marginBottom: 6, fontWeight: 700 }}>
                      새 메모
                    </div>
                    <textarea
                      autoFocus
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder="고객에 대한 메모를 자유롭게 입력하세요..."
                      style={{
                        ...inp,
                        height: 100,
                        resize: "vertical",
                        background: "#fff",
                        border: "1.5px solid #AFA9EC",
                        marginBottom: 10,
                      }}
                    />
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button
                        onClick={cancelNote}
                        style={{ ...btn("#888780"), padding: "6px 14px", fontSize: 12 }}
                      >
                        취소
                      </button>
                      <button
                        onClick={saveNote}
                        style={{ ...btn("#533AB7"), padding: "6px 14px", fontSize: 12 }}
                      >
                        저장
                      </button>
                    </div>
                  </div>
                )}

                {notes.length === 0 && editingNote === null && (
                  <div style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>
                    메모가 없습니다. 추가해 보세요!
                  </div>
                )}

                {notes.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      ...card,
                      border: editingNote === n.id ? "1.5px solid #AFA9EC" : "1px solid #d9d9d9",
                    }}
                  >
                    {editingNote === n.id ? (
                      <>
                        <textarea
                          autoFocus
                          value={noteInput}
                          onChange={(e) => setNoteInput(e.target.value)}
                          style={{
                            ...inp,
                            height: 90,
                            resize: "vertical",
                            background: "#fff",
                            border: "1.5px solid #AFA9EC",
                            marginBottom: 10,
                          }}
                        />
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button
                            onClick={cancelNote}
                            style={{ ...btn("#888780"), padding: "6px 14px", fontSize: 12 }}
                          >
                            취소
                          </button>
                          <button
                            onClick={saveNote}
                            style={{ ...btn("#533AB7"), padding: "6px 14px", fontSize: 12 }}
                          >
                            저장
                          </button>
                        </div>
                      </>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 12,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                            {n.content}
                          </div>
                          <div style={{ fontSize: 11, color: "#666", marginTop: 6 }}>
                            {n.updatedAt !== n.createdAt
                              ? `수정됨 ${n.updatedAt}`
                              : `작성 ${n.createdAt}`}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button
                            onClick={() => startEditNote(n)}
                            style={{ ...btn("#888780"), padding: "4px 10px", fontSize: 12 }}
                          >
                            수정
                          </button>
                          <button
                            onClick={() => deleteNote(n.id)}
                            style={{ ...btn("#E24B4A"), padding: "4px 10px", fontSize: 12 }}
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                    marginTop: 8,
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 700 }}>상담 방문 기록</div>
                  <button
                    onClick={() => openModal("consultation", { type: "방문" })}
                    style={{ ...btn(), padding: "6px 14px", fontSize: 12 }}
                  >
                    + 기록 추가
                  </button>
                </div>

                {cons.length === 0 && (
                  <div style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>
                    상담 기록이 없습니다.
                  </div>
                )}

                {cons.map((cn) => (
                  <div key={cn.id} style={card}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span
                          style={{
                            fontSize: 12,
                            padding: "2px 8px",
                            borderRadius: 6,
                            background:
                              cn.type === "방문"
                                ? "#185FA522"
                                : cn.type === "전화"
                                ? "#BA751722"
                                : "#533AB722",
                            color:
                              cn.type === "방문"
                                ? "#185FA5"
                                : cn.type === "전화"
                                ? "#BA7517"
                                : "#533AB7",
                            fontWeight: 700,
                          }}
                        >
                          {cn.type}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{cn.date}</span>
                      </div>
                      {cn.nextDate && (
                        <span style={{ fontSize: 12, color: "#666" }}>
                          재상담: {cn.nextDate}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13 }}>{cn.content}</div>
                  </div>
                ))}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                    marginTop: 8,
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 700 }}>보험 가입 이력</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => openModal("policy", { type: "자동차", status: "유지" })}
                      style={{
                        ...btn("#E6F1FB"),
                        color: "#185FA5",
                        border: "1px solid #B5D4F4",
                        padding: "6px 14px",
                        fontSize: 12,
                      }}
                    >
                      🚗 자동차 등록
                    </button>
                    <button
                      onClick={() => openModal("policy", { type: "종신", status: "유지" })}
                      style={{ ...btn(), padding: "6px 14px", fontSize: 12 }}
                    >
                      + 계약 추가
                    </button>
                  </div>
                </div>

                {pols.length === 0 && (
                  <div style={{ fontSize: 13, color: "#666" }}>가입 이력이 없습니다.</div>
                )}

                {pols.map((p) => (
                  <div key={p.id} style={card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 700 }}>{p.product}</span>
                          <span
                            style={{
                              fontSize: 11,
                              padding: "2px 8px",
                              borderRadius: 6,
                              background:
                                p.status === "유지"
                                  ? "#1D9E7522"
                                  : p.status === "실효"
                                  ? "#E24B4A22"
                                  : "#88878022",
                              color:
                                p.status === "유지"
                                  ? "#1D9E75"
                                  : p.status === "실효"
                                  ? "#E24B4A"
                                  : "#888780",
                              fontWeight: 700,
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
                        <div style={{ fontSize: 15, fontWeight: 700 }}>
                          {(p.premium || 0).toLocaleString()}원
                        </div>
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>일정 관리</div>
              <button onClick={() => openModal("schedule", {})} style={btn()}>
                + 일정 추가
              </button>
            </div>

            {data.schedules
              .slice()
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((s) => (
                <div
                  key={s.id}
                  style={{
                    ...card,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    opacity: s.done ? 0.55 : 1,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>
                      {getCustomer(s.customerId)?.name || "고객 없음"} — {s.title}
                    </div>
                    <div style={{ fontSize: 12, color: "#666" }}>{s.date}</div>
                  </div>
                  <button
                    onClick={() => toggleSchedule(s.id)}
                    style={{ ...btn(s.done ? "#888780" : "#1D9E75"), padding: "6px 12px", fontSize: 12 }}
                  >
                    {s.done ? "되돌리기" : "완료"}
                  </button>
                </div>
              ))}
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
              background: "#fff",
              borderRadius: 16,
              padding: 28,
              width: 440,
              maxWidth: "95vw",
              maxHeight: "85vh",
              overflowY: "auto",
              border: "1px solid #d0d0d0",
              boxShadow: "0 8px 32px rgba(0,0,0,0.13)",
            }}
          >
            {modal === "customer" && (
              <>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
                  {form.id ? "고객 수정" : "고객 등록"}
                </div>

                {[
                  ["name", "이름*"],
                  ["phone", "연락처*"],
                  ["birth", "생년월일 (YYYY-MM-DD)"],
                  ["email", "이메일"],
                  ["memo", "메모"],
                ].map(([k, l]) => (
                  <div key={k}>
                    <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>{l}</div>
                    <input
                      style={inp}
                      value={form[k] || ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, [k]: e.target.value }))
                      }
                    />
                  </div>
                ))}

                <div>
                  <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>상태</div>
                  <select
                    style={inp}
                    value={form.status || "가망"}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value }))
                    }
                  >
                    <option value="가망">가망</option>
                    <option value="가입">가입</option>
                    <option value="보류">보류</option>
                  </select>
                </div>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={closeModal} style={{ ...btn("#888780") }}>
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
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
                  상담 기록 추가
                </div>

                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>
                  상담일자*
                </div>
                <input
                  type="date"
                  style={inp}
                  value={form.date || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, date: e.target.value }))
                  }
                />

                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>
                  방문 방식
                </div>
                <select
                  style={inp}
                  value={form.type || "방문"}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, type: e.target.value }))
                  }
                >
                  <option value="방문">방문</option>
                  <option value="전화">전화</option>
                  <option value="화상">화상</option>
                </select>

                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>
                  상담 내용*
                </div>
                <textarea
                  style={{ ...inp, height: 90, resize: "vertical" }}
                  value={form.content || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, content: e.target.value }))
                  }
                />

                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>
                  재상담 예정일
                </div>
                <input
                  type="date"
                  style={inp}
                  value={form.nextDate || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nextDate: e.target.value }))
                  }
                />

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={closeModal} style={{ ...btn("#888780") }}>
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
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
                  보험 계약 추가
                </div>

                {[
                  ["company", "보험사*"],
                  ["product", "상품명*"],
                ].map(([k, l]) => (
                  <div key={k}>
                    <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>{l}</div>
                    <input
                      style={inp}
                      value={form[k] || ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, [k]: e.target.value }))
                      }
                    />
                  </div>
                ))}

                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>보험 종류</div>
                <select
                  style={inp}
                  value={form.type || "종신"}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, type: e.target.value }))
                  }
                >
                  {["종신", "실손", "연금", "건강", "자동차", "화재", "기타"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>가입일</div>
                    <input
                      type="date"
                      style={{ ...inp, marginBottom: 0 }}
                      value={form.startDate || ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, startDate: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>만기일</div>
                    <input
                      type="date"
                      style={{ ...inp, marginBottom: 0 }}
                      value={form.endDate || ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, endDate: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>
                    월 보험료 (원)
                  </div>
                  <input
                    type="number"
                    style={inp}
                    value={form.premium || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, premium: e.target.value }))
                    }
                  />
                </div>

                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>
                  상태
                </div>
                <select
                  style={inp}
                  value={form.status || "유지"}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value }))
                  }
                >
                  <option value="유지">유지</option>
                  <option value="실효">실효</option>
                  <option value="만기">만기</option>
                </select>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={closeModal} style={{ ...btn("#888780") }}>
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
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
                  일정 추가
                </div>

                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>
                  고객 선택
                </div>
                <select
                  style={inp}
                  value={form.customerId || selectedCustomer || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, customerId: Number(e.target.value) }))
                  }
                >
                  <option value="">-- 선택 --</option>
                  {data.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>
                  일정 제목*
                </div>
                <input
                  style={inp}
                  value={form.title || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                />

                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>
                  일정 날짜*
                </div>
                <input
                  type="date"
                  style={inp}
                  value={form.date || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, date: e.target.value }))
                  }
                />

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={closeModal} style={{ ...btn("#888780") }}>
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