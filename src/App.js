import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "./supabaseClient";

const statusColor = {
  유지: "#1D9E75",
  실효: "#E24B4A",
  만기: "#888780",
};

const consultTypeColor = {
  방문: "#185FA5",
  전화: "#BA7517",
  화상: "#533AB7",
};

const scheduleIconOptions = [
  { value: "📞", label: "전화" },
  { value: "💬", label: "미팅" },
  { value: "🎂", label: "생일" },
  { value: "📄", label: "서류" },
  { value: "🚗", label: "자동차" },
  { value: "🔔", label: "기본" },
  { value: "💰", label: "보험료" },
  { value: "🩺", label: "보장점검" },
];

const emptyData = {
  customers: [],
  consultations: [],
  policies: [],
  schedules: [],
  notes: [],
};

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

const ghostBtn = {
  ...btn("#888780"),
  background: "transparent",
  color: "#666",
  border: "1px solid #bbb",
};

const card = {
  background: "#ffffff",
  border: "0.5px solid #d9d9d9",
  borderRadius: 12,
  padding: "18px 16px",
  marginBottom: 12,
};

function maskSSN(ssn) {
  return ssn || "";
}

function formatDateLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatBirthInput(value) {
  const numbers = String(value || "")
    .replace(/\D/g, "")
    .slice(0, 8);

  if (numbers.length <= 4) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0, 4)}-${numbers.slice(4)}`;
  return `${numbers.slice(0, 4)}-${numbers.slice(4, 6)}-${numbers.slice(6, 8)}`;
}

function formatSSNInput(value) {
  const numbers = String(value || "")
    .replace(/\D/g, "")
    .slice(0, 13);

  if (numbers.length <= 6) return numbers;
  return `${numbers.slice(0, 6)}-${numbers.slice(6)}`;
}

function formatPhoneInput(value) {
  const numbers = String(value || "")
    .replace(/\D/g, "")
    .slice(0, 11);

  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
}

function getMonthMatrix(baseDate) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay();
  const startDate = new Date(year, month, 1 - startDay);
  const days = [];

  for (let i = 0; i < 42; i += 1) {
    const current = new Date(startDate);
    current.setDate(startDate.getDate() + i);
    days.push(current);
  }

  return days;
}

function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function daysLabel(days) {
  if (days === null || days === undefined || Number.isNaN(days)) return "-";
  if (days === 0) return "D-Day";
  if (days < 0) return `${Math.abs(days)}일 지남`;
  return `D-${days}`;
}

function daysColor(days) {
  if (days === null || days === undefined || Number.isNaN(days)) return "#999";
  if (days <= 7) return "#E24B4A";
  if (days <= 30) return "#BA7517";
  return "#1D9E75";
}

function compareDateTime(aDate, aTime = "00:00", bDate, bTime = "00:00") {
  const a = new Date(`${aDate}T${aTime || "00:00"}:00`);
  const b = new Date(`${bDate}T${bTime || "00:00"}:00`);
  return a.getTime() - b.getTime();
}

function getSortedSchedules(list = []) {
  return [...list].sort((a, b) => compareDateTime(a.date, a.time, b.date, b.time));
}

function getNextBirthday(birth) {
  if (!birth) return null;
  let month = "";
  let day = "";

  if (String(birth).includes("-")) {
    const parts = String(birth).split("-");
    if (parts.length !== 3) return null;
    month = parts[1];
    day = parts[2];
  } else if (String(birth).length === 8) {
    month = String(birth).slice(4, 6);
    day = String(birth).slice(6, 8);
  } else {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let nextBirthday = new Date(`${today.getFullYear()}-${month}-${day}`);
  if (isNaN(nextBirthday.getTime())) return null;
  nextBirthday.setHours(0, 0, 0, 0);

  if (nextBirthday < today) {
    nextBirthday = new Date(`${today.getFullYear() + 1}-${month}-${day}`);
    if (isNaN(nextBirthday.getTime())) return null;
    nextBirthday.setHours(0, 0, 0, 0);
  }

  const days = Math.ceil((nextBirthday - today) / 86400000);
  return { date: nextBirthday.toISOString().slice(0, 10), days };
}

function formatBirthLabel(birth) {
  if (!birth) return "";
  if (String(birth).includes("-")) {
    const parts = String(birth).split("-");
    return `${parts[1]}월 ${parts[2]}일`;
  }
  if (String(birth).length === 8) {
    return `${String(birth).slice(4, 6)}월 ${String(birth).slice(6, 8)}일`;
  }
  return birth;
}

export default function App() {
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;

  const [data, setData] = useState(emptyData);
  const [view, setView] = useState("dashboard");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("전체");
  const [recentCustomers, setRecentCustomers] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [editingNote, setEditingNote] = useState(null);
  const [noteInput, setNoteInput] = useState("");
  const [scheduleTab, setScheduleTab] = useState("schedule");
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [excelToast, setExcelToast] = useState(null);
  const [showSSN, setShowSSN] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [isLoadingData, setIsLoadingData] = useState(false);

  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });

  const fileInputRef = useRef(null);
  const excelFileInputRef = useRef(null);

  useEffect(() => {
    async function getCurrentSession() {
      const { data: sessionData, error } = await supabase.auth.getSession();
      if (error) {
        console.error("세션 확인 실패:", error);
        return;
      }
      setSession(sessionData.session);
    }

    getCurrentSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchAllData(userId) {
    setIsLoadingData(true);

    const [customersRes, consultationsRes, policiesRes, schedulesRes, notesRes] = await Promise.all([
      supabase.from("customers").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("consultations").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("policies").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("schedules").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("notes").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);

    if (customersRes.error || consultationsRes.error || policiesRes.error || schedulesRes.error || notesRes.error) {
      console.error(
        customersRes.error ||
          consultationsRes.error ||
          policiesRes.error ||
          schedulesRes.error ||
          notesRes.error
      );
      alert("데이터를 불러오는 중 오류가 발생했습니다.");
      setIsLoadingData(false);
      return;
    }

    setData({
      customers: (customersRes.data || []).map((c) => ({
        id: c.app_customer_id,
        name: c.name || "",
        phone: c.phone || "",
        birth: c.birth || "",
        ssn: c.ssn || "",
        email: c.email || "",
        memo: c.memo || "",
        status: c.status || "가망",
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
        premium: Number(p.premium || 0),
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
        createdAt: n.created_at_text || "",
        updatedAt: n.updated_at_text || "",
      })),
    });

    setIsLoadingData(false);
  }

  useEffect(() => {
    if (!session?.user?.id) {
      setData(emptyData);
      return;
    }
    fetchAllData(session.user.id);
  }, [session]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const checkNotifications = () => {
      const now = new Date();

      (data.schedules || [])
        .filter((s) => !s.done)
        .forEach((s) => {
          if (!s.time) return;

          const scheduleDateTime = new Date(`${s.date}T${s.time}:00`);
          if (isNaN(scheduleDateTime.getTime())) return;

          const diff = scheduleDateTime.getTime() - now.getTime();

          if (diff <= 30000 && diff >= 0) {
            const customerName =
              data.customers.find((c) => c.id === s.customerId)?.name || "미지정 고객";

            new Notification(`${s.icon || "🔔"} ${s.title}`, {
              body: `${customerName}${s.time ? ` · ${s.time}` : ""}`,
            });
          }
        });
    };

    const timer = setInterval(checkNotifications, 30000);
    return () => clearInterval(timer);
  }, [data.schedules, data.customers]);

  function showExcelToast(msg, type = "success") {
    setExcelToast({ msg, type });
    setTimeout(() => setExcelToast(null), 3500);
  }

  async function requestNotificationPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      alert("이 브라우저에서는 알림을 지원하지 않습니다.");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === "granted") {
      alert("브라우저 알림이 허용됐어요.");
    } else {
      alert("알림 허용이 안 되어 있어요.");
    }
  }

  function runSavingAnimation(onDone) {
    setIsSaving(true);
    setSaveProgress(0);
    const steps = [18, 36, 58, 76, 92, 100];
    let index = 0;

    const timer = setInterval(() => {
      setSaveProgress(steps[index]);
      index += 1;
      if (index >= steps.length) {
        clearInterval(timer);
        setTimeout(() => {
          setIsSaving(false);
          setSaveProgress(0);
          onDone?.();
        }, 180);
      }
    }, 120);
  }

  function addRecentCustomer(customer) {
    if (!customer) return;
    setRecentCustomers((prev) => {
      const filtered = prev.filter((c) => c.id !== customer.id);
      return [customer, ...filtered].slice(0, 5);
    });
  }

  function getCustomer(id) {
    return data.customers.find((c) => c.id === id);
  }

  function getConsultations(id) {
    return (data.consultations || [])
      .filter((c) => c.customerId === id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  function getPolicies(id) {
    return (data.policies || []).filter((p) => p.customerId === id);
  }

  function getSchedules(id) {
    return getSortedSchedules((data.schedules || []).filter((s) => s.customerId === id && !s.done));
  }

  function getNotes(id) {
    return (data.notes || [])
      .filter((n) => n.customerId === id)
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  }

  const customers = useMemo(() => {
    return (data.customers || [])
      .filter((c) => {
        const matchesSearch =
          !search ||
          (c.name || "").includes(search) ||
          (c.phone || "").includes(search) ||
          (c.memo || "").includes(search) ||
          (c.email || "").includes(search) ||
          (c.ssn || "").includes(search);

        const customerStatus = c.status || "가망";
        const matchesStatus = statusFilter === "전체" ? true : customerStatus === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ko-KR"));
  }, [data.customers, search, statusFilter]);

  const allUpcoming = getSortedSchedules((data.schedules || []).filter((s) => !s.done)).slice(0, 5);

  const birthdayList = (data.customers || [])
    .map((c) => {
      const bd = getNextBirthday(c.birth);
      return bd ? { customer: c, ...bd } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.days - b.days);

  const carExpireList = (data.policies || [])
    .filter((p) => p.type === "자동차" && p.status === "유지")
    .map((p) => ({
      policy: p,
      customer: getCustomer(p.customerId),
      days: getDaysUntil(p.endDate),
    }))
    .sort((a, b) => (a.days ?? 99999) - (b.days ?? 99999));

  async function handleAuthSubmit() {
    const email = (authForm.email || "").trim();
    const password = (authForm.password || "").trim();

    if (!email || !password) {
      alert("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    if (authMode === "signup") {
      const redirectUrl =
        typeof window !== "undefined" ? `${window.location.origin}` : "http://localhost:3000";

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: authForm.name || "" },
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        alert("회원가입 실패: " + error.message);
        return;
      }

      alert("회원가입 완료! 이메일 인증 후 로그인해주세요.");
      setAuthMode("login");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
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
    if (type === "schedule") {
      setForm({
        date: selectedDate || formatDateLocal(new Date()),
        time: "",
        title: "",
        icon: "🔔",
        customerId: selectedCustomer || "",
        memo: "",
        ...defaults,
      });
    } else if (type === "consultation") {
      setForm({
        date: formatDateLocal(new Date()),
        type: "방문",
        content: "",
        nextDate: "",
        ...defaults,
      });
    } else if (type === "policy") {
      setForm({
        type: "종신",
        status: "유지",
        company: "",
        product: "",
        premium: "",
        startDate: "",
        endDate: "",
        ...defaults,
      });
    } else {
      setForm(defaults);
    }
    setModal(type);
  }

  function closeModal() {
    if (isSaving) return;
    setModal(null);
    setForm({});
  }

  async function saveCustomer() {
    if (!form.name || !form.phone) {
      alert("이름과 연락처는 필수예요.");
      return;
    }

    if (!session?.user?.id) {
      alert("로그인 정보가 없습니다.");
      return;
    }

    const appId = form.id || Date.now();
    const payload = {
      user_id: session.user.id,
      app_customer_id: appId,
      name: form.name || "",
      phone: form.phone || "",
      birth: form.birth || "",
      ssn: form.ssn || "",
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
          ssn: payload.ssn,
          email: payload.email,
          memo: payload.memo,
          status: payload.status,
        })
        .eq("user_id", session.user.id)
        .eq("app_customer_id", form.id);

      error = result.error;
    } else {
      const result = await supabase.from("customers").insert([payload]);
      error = result.error;
    }

    if (error) {
      alert("고객 저장 실패: " + error.message);
      return;
    }

    runSavingAnimation(async () => {
      await fetchAllData(session.user.id);
      setModal(null);
      setForm({});
      setEditingNote(null);
      setSelectedCustomer(appId);
      setView("detail");
    });
  }

  async function deleteCustomer(id) {
    if (!session?.user?.id) return;

    const [r1, r2, r3, r4, r5] = await Promise.all([
      supabase.from("customers").delete().eq("user_id", session.user.id).eq("app_customer_id", id),
      supabase.from("consultations").delete().eq("user_id", session.user.id).eq("customer_app_id", id),
      supabase.from("policies").delete().eq("user_id", session.user.id).eq("customer_app_id", id),
      supabase.from("schedules").delete().eq("user_id", session.user.id).eq("customer_app_id", id),
      supabase.from("notes").delete().eq("user_id", session.user.id).eq("customer_app_id", id),
    ]);

    const error = r1.error || r2.error || r3.error || r4.error || r5.error;
    if (error) {
      alert("고객 삭제 실패: " + error.message);
      return;
    }

    await fetchAllData(session.user.id);
    setSelectedCustomer(null);
    setView("customers");
  }

  async function saveConsultation() {
    if (!form.date || !form.content) {
      alert("상담일자와 상담내용을 입력해주세요.");
      return;
    }

    if (!selectedCustomer || !session?.user?.id) {
      alert("고객 상세에서 상담 기록을 추가해주세요.");
      return;
    }

    const appId = form.id || Date.now();

    let error = null;

    if (form.id) {
      const result = await supabase
        .from("consultations")
        .update({
          date: form.date || "",
          type: form.type || "방문",
          content: form.content || "",
          next_date: form.nextDate || "",
        })
        .eq("user_id", session.user.id)
        .eq("app_consultation_id", form.id);

      error = result.error;
    } else {
      const result = await supabase.from("consultations").insert([
        {
          user_id: session.user.id,
          app_consultation_id: appId,
          customer_app_id: selectedCustomer,
          date: form.date || "",
          type: form.type || "방문",
          content: form.content || "",
          next_date: form.nextDate || "",
        },
      ]);
      error = result.error;

      if (!error && form.nextDate) {
        const scheduleRes = await supabase.from("schedules").insert([
          {
            user_id: session.user.id,
            app_schedule_id: Date.now() + 1,
            customer_app_id: selectedCustomer,
            date: form.nextDate,
            time: "",
            title: "재상담 예정",
            icon: "💬",
            memo: "",
            done: false,
          },
        ]);
        if (scheduleRes.error) error = scheduleRes.error;
      }
    }

    if (error) {
      alert("상담 저장 실패: " + error.message);
      return;
    }

    await fetchAllData(session.user.id);
    closeModal();
  }

  async function savePolicy() {
    if (!form.company || !form.product) {
      alert("보험사와 상품명을 입력해주세요.");
      return;
    }

    if (!selectedCustomer || !session?.user?.id) {
      alert("고객 상세에서 계약을 추가해주세요.");
      return;
    }

    const appId = form.id || Date.now();

    let error = null;

    if (form.id) {
      const result = await supabase
        .from("policies")
        .update({
          type: form.type || "종신",
          status: form.status || "유지",
          company: form.company || "",
          product: form.product || "",
          premium: Number(form.premium) || 0,
          start_date: form.startDate || "",
          end_date: form.endDate || "",
        })
        .eq("user_id", session.user.id)
        .eq("app_policy_id", form.id);

      error = result.error;
    } else {
      const result = await supabase.from("policies").insert([
        {
          user_id: session.user.id,
          app_policy_id: appId,
          customer_app_id: selectedCustomer,
          type: form.type || "종신",
          status: form.status || "유지",
          company: form.company || "",
          product: form.product || "",
          premium: Number(form.premium) || 0,
          start_date: form.startDate || "",
          end_date: form.endDate || "",
        },
      ]);
      error = result.error;
    }

    if (error) {
      alert("계약 저장 실패: " + error.message);
      return;
    }

    await fetchAllData(session.user.id);
    closeModal();
  }

  async function saveSchedule() {
    if (!form.date || !form.title) {
      alert("날짜와 일정명을 입력해주세요.");
      return;
    }

    if (!session?.user?.id) {
      alert("로그인 정보가 없습니다.");
      return;
    }

    const appId = form.id || Date.now();
    const customerIdValue =
      form.customerId === "" || form.customerId === null || form.customerId === undefined
        ? null
        : Number(form.customerId);

    let error = null;

    if (form.id) {
      const result = await supabase
        .from("schedules")
        .update({
          customer_app_id: customerIdValue,
          date: form.date || "",
          time: form.time || "",
          title: form.title || "",
          icon: form.icon || "🔔",
          memo: form.memo || "",
          done: !!form.done,
        })
        .eq("user_id", session.user.id)
        .eq("app_schedule_id", form.id);

      error = result.error;
    } else {
      const result = await supabase.from("schedules").insert([
        {
          user_id: session.user.id,
          app_schedule_id: appId,
          customer_app_id: customerIdValue,
          date: form.date || "",
          time: form.time || "",
          title: form.title || "",
          icon: form.icon || "🔔",
          memo: form.memo || "",
          done: false,
        },
      ]);
      error = result.error;
    }

    if (error) {
      alert("일정 저장 실패: " + error.message);
      return;
    }

    await fetchAllData(session.user.id);
    setSelectedDate(form.date);
    closeModal();
  }

  async function deleteSchedule(id) {
    if (!session?.user?.id) return;

    const { error } = await supabase
      .from("schedules")
      .delete()
      .eq("user_id", session.user.id)
      .eq("app_schedule_id", id);

    if (error) {
      alert("일정 삭제 실패: " + error.message);
      return;
    }

    await fetchAllData(session.user.id);
    closeModal();
  }

  async function toggleSchedule(id) {
    if (!session?.user?.id) return;

    const target = data.schedules.find((s) => s.id === id);
    if (!target) return;

    const { error } = await supabase
      .from("schedules")
      .update({ done: !target.done })
      .eq("user_id", session.user.id)
      .eq("app_schedule_id", id);

    if (error) {
      alert("일정 상태 변경 실패: " + error.message);
      return;
    }

    await fetchAllData(session.user.id);
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
    if (!selectedCustomer || !session?.user?.id) return;

    const now = new Date().toISOString().slice(0, 10);
    let error = null;

    if (editingNote === "new") {
      const appId = Date.now();
      const result = await supabase.from("notes").insert([
        {
          user_id: session.user.id,
          app_note_id: appId,
          customer_app_id: selectedCustomer,
          content: noteInput.trim(),
          created_at_text: now,
          updated_at_text: now,
        },
      ]);
      error = result.error;
    } else {
      const result = await supabase
        .from("notes")
        .update({
          content: noteInput.trim(),
          updated_at_text: now,
        })
        .eq("user_id", session.user.id)
        .eq("app_note_id", editingNote);

      error = result.error;
    }

    if (error) {
      alert("메모 저장 실패: " + error.message);
      return;
    }

    await fetchAllData(session.user.id);
    setEditingNote(null);
    setNoteInput("");
  }

  async function deleteNote(id) {
    if (!session?.user?.id) return;

    const { error } = await supabase
      .from("notes")
      .delete()
      .eq("user_id", session.user.id)
      .eq("app_note_id", id);

    if (error) {
      alert("메모 삭제 실패: " + error.message);
      return;
    }

    await fetchAllData(session.user.id);
  }

  function exportBackup() {
    try {
      const backup = { ...data, exportedAt: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
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

  async function importBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!session?.user?.id) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
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

        await Promise.all([
          supabase.from("customers").delete().eq("user_id", session.user.id),
          supabase.from("consultations").delete().eq("user_id", session.user.id),
          supabase.from("policies").delete().eq("user_id", session.user.id),
          supabase.from("schedules").delete().eq("user_id", session.user.id),
          supabase.from("notes").delete().eq("user_id", session.user.id),
        ]);

        if (parsed.customers.length > 0) {
          await supabase.from("customers").insert(
            parsed.customers.map((c) => ({
              user_id: session.user.id,
              app_customer_id: c.id,
              name: c.name || "",
              phone: c.phone || "",
              birth: c.birth || "",
              ssn: c.ssn || "",
              email: c.email || "",
              memo: c.memo || "",
              status: c.status || "가망",
              created_at: c.createdAt || new Date().toISOString(),
            }))
          );
        }

        if (parsed.consultations.length > 0) {
          await supabase.from("consultations").insert(
            parsed.consultations.map((c) => ({
              user_id: session.user.id,
              app_consultation_id: c.id,
              customer_app_id: c.customerId,
              date: c.date || "",
              type: c.type || "방문",
              content: c.content || "",
              next_date: c.nextDate || "",
            }))
          );
        }

        if (parsed.policies.length > 0) {
          await supabase.from("policies").insert(
            parsed.policies.map((p) => ({
              user_id: session.user.id,
              app_policy_id: p.id,
              customer_app_id: p.customerId,
              type: p.type || "종신",
              status: p.status || "유지",
              company: p.company || "",
              product: p.product || "",
              premium: Number(p.premium) || 0,
              start_date: p.startDate || "",
              end_date: p.endDate || "",
            }))
          );
        }

        if (parsed.schedules.length > 0) {
          await supabase.from("schedules").insert(
            parsed.schedules.map((s) => ({
              user_id: session.user.id,
              app_schedule_id: s.id,
              customer_app_id: s.customerId ?? null,
              date: s.date || "",
              time: s.time || "",
              title: s.title || "",
              icon: s.icon || "🔔",
              memo: s.memo || "",
              done: !!s.done,
            }))
          );
        }

        if (parsed.notes.length > 0) {
          await supabase.from("notes").insert(
            parsed.notes.map((n) => ({
              user_id: session.user.id,
              app_note_id: n.id,
              customer_app_id: n.customerId,
              content: n.content || "",
              created_at_text: n.createdAt || "",
              updated_at_text: n.updatedAt || "",
            }))
          );
        }

        await fetchAllData(session.user.id);
        alert("백업 파일을 불러왔습니다.");
      } catch {
        alert("JSON 파일을 읽는 중 오류가 발생했습니다.");
      } finally {
        event.target.value = "";
      }
    };

    reader.readAsText(file);
  }

  function downloadCustomerTemplate() {
    const wb = XLSX.utils.book_new();
    const header = ["이름", "연락처", "생년월일", "주민번호", "이메일", "메모", "상태"];
    const example = [
      ["홍길동", "010-1234-5678", "1990-01-01", "900101-1234567", "hong@email.com", "VIP 고객", "가망"],
      ["김영희", "010-9876-5432", "1985-05-20", "850520-2345678", "kim@email.com", "", "가입"],
    ];
    const ws = XLSX.utils.aoa_to_sheet([header, ...example]);
    ws["!cols"] = [12, 16, 14, 18, 22, 24, 8].map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, "고객목록");
    XLSX.writeFile(wb, "고객등록_양식.xlsx");
    showExcelToast("📥 양식 다운로드 완료!");
  }

  async function importCustomersFromExcel(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!session?.user?.id) return;

    const ext = file.name.split(".").pop().toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext)) {
      showExcelToast("❌ 엑셀 파일(.xlsx, .xls, .csv)만 업로드 가능합니다.", "error");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (rows.length < 2) {
          showExcelToast("⚠️ 데이터가 없습니다.", "error");
          return;
        }

        const headerMap = {
          이름: "name",
          연락처: "phone",
          생년월일: "birth",
          주민번호: "ssn",
          이메일: "email",
          메모: "memo",
          상태: "status",
        };

        const headers = rows[0].map((h) => String(h).trim());
        const colMap = {};
        headers.forEach((h, i) => {
          if (headerMap[h]) colMap[headerMap[h]] = i;
        });

        const newCustomers = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.every((v) => !v)) continue;

          const c = {};
          Object.entries(colMap).forEach(([key, idx]) => {
            c[key] = String(row[idx] ?? "").trim();
          });

          if (!c.name || !c.phone) continue;

          newCustomers.push({
            id: Date.now() + i,
            name: c.name || "",
            phone: c.phone || "",
            birth: c.birth || "",
            ssn: c.ssn || "",
            email: c.email || "",
            memo: c.memo || "",
            status: c.status || "가망",
            createdAt: new Date().toISOString(),
          });
        }

        if (newCustomers.length === 0) {
          showExcelToast("⚠️ 유효한 데이터가 없습니다.", "error");
          return;
        }

        for (const nc of newCustomers) {
          const existing = data.customers.find((c) => c.phone === nc.phone);

          if (existing) {
            await supabase
              .from("customers")
              .update({
                name: nc.name,
                birth: nc.birth,
                ssn: nc.ssn,
                email: nc.email,
                memo: nc.memo,
                status: nc.status,
                phone: nc.phone,
              })
              .eq("user_id", session.user.id)
              .eq("app_customer_id", existing.id);
          } else {
            await supabase.from("customers").insert([
              {
                user_id: session.user.id,
                app_customer_id: nc.id,
                name: nc.name,
                phone: nc.phone,
                birth: nc.birth,
                ssn: nc.ssn,
                email: nc.email,
                memo: nc.memo,
                status: nc.status,
                created_at: nc.createdAt,
              },
            ]);
          }
        }

        await fetchAllData(session.user.id);
        showExcelToast(`✅ ${newCustomers.length}명 고객이 등록되었습니다!`);
      } catch {
        showExcelToast("❌ 파일을 읽는 중 오류가 발생했습니다.", "error");
      } finally {
        event.target.value = "";
      }
    };

    reader.readAsBinaryString(file);
  }

  const monthDays = getMonthMatrix(calendarMonth);
  const currentMonth = calendarMonth.getMonth();
  const todayStr = formatDateLocal(new Date());

  const selectedSchedules = selectedDate
    ? getSortedSchedules(
        (data.schedules || [])
          .filter((s) => s.date === selectedDate)
          .map((s) => ({
            ...s,
            customerName: getCustomer(s.customerId)?.name || "미지정 고객",
          }))
      )
    : [];

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
          padding: isMobile ? 16 : 0,
        }}
      >
        <div
          style={{
            width: isMobile ? "100%" : 360,
            maxWidth: 360,
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{ fontSize: isMobile ? 24 : 20, fontWeight: 700, marginBottom: 8 }}>보험 CRM</div>
          <div style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>
            {authMode === "login" ? "로그인" : "회원가입"}
          </div>

          {authMode === "signup" && (
            <>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>이름</div>
              <input
                style={inp}
                value={authForm.name}
                onChange={(e) => setAuthForm((f) => ({ ...f, name: e.target.value }))}
              />
            </>
          )}

          <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>이메일</div>
          <input
            style={inp}
            value={authForm.email}
            onChange={(e) => setAuthForm((f) => ({ ...f, email: e.target.value }))}
          />

          <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>비밀번호</div>
          <input
            type="password"
            style={inp}
            value={authForm.password}
            onChange={(e) => setAuthForm((f) => ({ ...f, password: e.target.value }))}
          />

          <button onClick={handleAuthSubmit} style={{ ...btn(), width: "100%", marginBottom: 10 }}>
            {authMode === "login" ? "로그인" : "회원가입"}
          </button>

          <button
            onClick={() => setAuthMode((m) => (m === "login" ? "signup" : "login"))}
            style={{ ...btn("#888780"), width: "100%" }}
          >
            {authMode === "login" ? "회원가입으로" : "로그인으로"}
          </button>
        </div>
      </div>
    );
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
    <div
      style={{
        fontFamily: "sans-serif",
        color: "#222",
        minHeight: "100vh",
        background: "#f7f8fa",
        width: "100%",
        overflowX: "hidden",
      }}
    >
      <div style={{ borderBottom: "0.5px solid #ddd", background: "#ffffff" }}>
        <div
          style={{
            display: "flex",
            alignItems: isMobile ? "flex-start" : "center",
            justifyContent: "space-between",
            padding: isMobile ? "14px 12px 10px" : "18px 24px 12px",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: isMobile ? 24 : 20, fontWeight: 700 }}>보험 CRM</div>
            <div style={{ fontSize: isMobile ? 14 : 13, color: "#666" }}>
              {session?.user?.user_metadata?.name
                ? `${session.user.user_metadata.name} 설계사님`
                : "보험 설계사 고객관리"}
            </div>
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
            <button onClick={handleLogout} style={{ ...btn("#888780"), padding: "8px 12px", fontSize: 12 }}>
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
                  padding: isMobile ? "16px 8px" : "14px 8px",
                  fontSize: isMobile ? 18 : 16,
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

      <div style={{ padding: isMobile ? "12px" : "20px 24px" }}>
        {isLoadingData && (
          <div style={{ ...card, textAlign: "center", fontSize: 14, color: "#666" }}>
            데이터 불러오는 중...
          </div>
        )}

        {!isLoadingData && view === "dashboard" && (
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)",
                gap: 12,
                marginBottom: 20,
              }}
            >
              {[
                { label: "전체 고객", value: data.customers.length + "명" },
                { label: "가망 고객", value: data.customers.filter((c) => (c.status || "가망") === "가망").length + "명" },
                { label: "가입 고객", value: data.customers.filter((c) => c.status === "가입").length + "명" },
                { label: "예정 일정", value: (data.schedules || []).filter((s) => !s.done).length + "건" },
              ].map((m) => (
                <div key={m.label} style={{ background: "#eef2f7", borderRadius: 8, padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 500 }}>{m.value}</div>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: 16,
              }}
            >
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
                      gap: 10,
                      padding: "8px 0",
                      borderBottom: "0.5px solid #eee",
                      flexWrap: isMobile ? "wrap" : "nowrap",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {s.icon || "🔔"} {getCustomer(s.customerId)?.name || "미지정 고객"} — {s.title}
                      </div>
                      <div style={{ fontSize: 12, color: "#666" }}>
                        {s.date}
                        {s.time ? ` ${s.time}` : ""}
                      </div>
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
                      addRecentCustomer(c);
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
                      {c.name?.[0] || "?"}
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

        {!isLoadingData && view === "customers" && (
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름, 연락처, 주민번호 검색"
                style={{ ...inp, marginBottom: 0, flex: 1 }}
              />
              <button onClick={() => openModal("customer")} style={btn()}>
                + 고객 등록
              </button>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                marginBottom: 16,
                padding: "14px 16px",
                background: "#eef6ee",
                border: "1px solid #c3e0c3",
                borderRadius: 10,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1D6B2E", marginBottom: 2 }}>
                  📋 엑셀로 고객 일괄 등록
                </div>
                <div style={{ fontSize: 12, color: "#4a7a4a" }}>
                  양식을 다운받아 작성 후 업로드하면 자동으로 등록돼요. 연락처가 같으면 기존 정보가 업데이트됩니다.
                </div>
              </div>
              <button
                onClick={downloadCustomerTemplate}
                style={{ ...btn("#1D9E75"), padding: "8px 14px", fontSize: 12, whiteSpace: "nowrap" }}
              >
                📥 양식 다운로드
              </button>
              <button
                onClick={() => excelFileInputRef.current?.click()}
                style={{ ...btn("#185FA5"), padding: "8px 14px", fontSize: 12, whiteSpace: "nowrap" }}
              >
                📂 엑셀 업로드
              </button>
              <input
                ref={excelFileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: "none" }}
                onChange={importCustomersFromExcel}
              />
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {["전체", "가망", "가입", "보류"].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  style={{ ...btn(statusFilter === status ? "#185FA5" : "#888780"), padding: "6px 12px", fontSize: 12 }}
                >
                  {status}
                </button>
              ))}
            </div>

            {recentCustomers.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>최근 확인 고객</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {recentCustomers.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        addRecentCustomer(c);
                        setSelectedCustomer(c.id);
                        setView("detail");
                      }}
                      style={{
                        ...btn("#eef2f7"),
                        color: "#185FA5",
                        border: "1px solid #cfd8e3",
                        padding: "6px 12px",
                        fontSize: 12,
                      }}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {customers.length === 0 && <div style={{ color: "#666", fontSize: 14 }}>고객이 없습니다.</div>}

            {customers.map((c) => (
              <div
                key={c.id}
                style={{ ...card, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                onClick={() => {
                  addRecentCustomer(c);
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
                    {c.name?.[0] || "?"}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{c.name}</div>
                    <div style={{ fontSize: 13, color: "#666" }}>
                      {c.phone} · {c.birth}
                    </div>
                    {c.ssn && <div style={{ fontSize: 12, color: "#aaa" }}>주민번호: {maskSSN(c.ssn)}</div>}
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

        {!isLoadingData &&
          view === "detail" &&
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
                  style={{ ...ghostBtn, marginBottom: 16 }}
                >
                  ← 목록으로
                </button>

                <div
                  style={{
                    ...card,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                    flexWrap: isMobile ? "wrap" : "nowrap",
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
                        fontWeight: 500,
                        color: "#0C447C",
                      }}
                    >
                      {c.name?.[0] || "?"}
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 500 }}>
                        {c.name}
                        <span
                          style={{
                            marginLeft: 8,
                            padding: "2px 8px",
                            borderRadius: 6,
                            fontSize: 11,
                            background: c.status === "가입" ? "#4CAF50" : "#999",
                            color: "#fff",
                          }}
                        >
                          {c.status || "가망"}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: "#666" }}>
                        {c.phone} · {c.birth}
                      </div>

                      {c.ssn && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, color: "#555", fontFamily: "monospace" }}>
                            주민번호: {showSSN ? c.ssn : maskSSN(c.ssn)}
                          </span>
                          <button
                            onClick={() => setShowSSN((v) => !v)}
                            style={{
                              fontSize: 11,
                              padding: "2px 8px",
                              borderRadius: 6,
                              border: "1px solid #ccc",
                              background: "#f5f5f5",
                              color: "#555",
                              cursor: "pointer",
                            }}
                          >
                            {showSSN ? "숨기기" : "전체보기"}
                          </button>
                        </div>
                      )}

                      {c.email && <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>{c.email}</div>}
                      {c.memo && <div style={{ fontSize: 13, marginTop: 4 }}>{c.memo}</div>}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
                    {(c.status || "가망") !== "가입" && (
                      <button
                        onClick={async () => {
                          if (!session?.user?.id) return;

                          const { error } = await supabase
                            .from("customers")
                            .update({ status: "가입" })
                            .eq("user_id", session.user.id)
                            .eq("app_customer_id", c.id);

                          if (error) {
                            alert("상태 변경 실패: " + error.message);
                            return;
                          }

                          await supabase.from("consultations").insert([
                            {
                              user_id: session.user.id,
                              app_consultation_id: Date.now(),
                              customer_app_id: c.id,
                              date: new Date().toISOString().slice(0, 10),
                              type: "전화",
                              content: "가입 전환 완료",
                              next_date: "",
                            },
                          ]);

                          await fetchAllData(session.user.id);
                          alert("가입 고객으로 변경 완료!");
                        }}
                        style={{ ...btn("#4CAF50"), padding: "6px 12px", fontSize: 12 }}
                      >
                        가입 전환
                      </button>
                    )}
                  </div>
                </div>

                {scheds.length > 0 && (
                  <div style={{ ...card, background: "#E6F1FB", borderColor: "#B5D4F4" }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#0C447C", marginBottom: 8 }}>예정 일정</div>
                    {scheds.map((s) => (
                      <div
                        key={s.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: 13,
                          marginBottom: 6,
                          gap: 8,
                          flexWrap: isMobile ? "wrap" : "nowrap",
                        }}
                      >
                        <span>
                          {s.icon || "🔔"} {s.date}
                          {s.time ? ` ${s.time}` : ""} — {s.title}
                        </span>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => openModal("schedule", { ...s, customerId: s.customerId ?? "" })}
                            style={{ ...btn("#888780"), padding: "3px 10px", fontSize: 12 }}
                          >
                            수정
                          </button>
                          <button onClick={() => toggleSchedule(s.id)} style={{ ...btn("#1D9E75"), padding: "3px 10px", fontSize: 12 }}>
                            완료
                          </button>
                        </div>
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
                  <div key={n.id} style={{ ...card, border: editingNote === n.id ? "1.5px solid #AFA9EC" : "0.5px solid #d9d9d9" }}>
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
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span
                          style={{
                            fontSize: 12,
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: `${consultTypeColor[cn.type]}22`,
                            color: consultTypeColor[cn.type],
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
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => openModal("policy", { type: "자동차", status: "유지" })}
                      style={{
                        ...btn("#185FA5"),
                        padding: "6px 14px",
                        fontSize: 12,
                        background: "#E6F1FB",
                        color: "#185FA5",
                        border: "1px solid #B5D4F4",
                      }}
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
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: isMobile ? "wrap" : "nowrap" }}>
                      <div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 14, fontWeight: 500 }}>{p.product}</span>
                          <span
                            style={{
                              fontSize: 11,
                              padding: "2px 8px",
                              borderRadius: 6,
                              background: `${statusColor[p.status]}22`,
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
                      <div style={{ textAlign: isMobile ? "left" : "right" }}>
                        <div style={{ fontSize: 15, fontWeight: 500 }}>{(p.premium || 0).toLocaleString()}원</div>
                        <div style={{ fontSize: 12, color: "#666" }}>월 보험료</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

        {!isLoadingData && view === "schedules" && (
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
                <div style={{ ...card, marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <button
                      onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                      style={{ ...btn("#888780"), padding: "6px 12px", fontSize: 12 }}
                    >
                      이전달
                    </button>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>
                      {calendarMonth.getFullYear()}년 {calendarMonth.getMonth() + 1}월
                    </div>
                    <button
                      onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                      style={{ ...btn("#888780"), padding: "6px 12px", fontSize: 12 }}
                    >
                      다음달
                    </button>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 12,
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ fontSize: 13, color: "#666" }}>일정 등록할 날짜를 누르면 바로 입력창이 떠요.</div>
                    <button
                      onClick={requestNotificationPermission}
                      style={{
                        ...btn(notificationPermission === "granted" ? "#1D9E75" : "#533AB7"),
                        padding: "7px 12px",
                        fontSize: 12,
                      }}
                    >
                      {notificationPermission === "granted" ? "알림 허용됨" : "브라우저 알림 켜기"}
                    </button>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(7, 1fr)",
                      gap: 6,
                      marginBottom: 8,
                      fontSize: 12,
                      color: "#666",
                      textAlign: "center",
                      fontWeight: 500,
                    }}
                  >
                    {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
                      <div key={d}>{d}</div>
                    ))}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
                    {monthDays.map((dateObj) => {
                      const dateStr = formatDateLocal(dateObj);
                      const isCurrentMonth = dateObj.getMonth() === currentMonth;
                      const isToday = dateStr === todayStr;
                      const daySchedules = getSortedSchedules(
                        (data.schedules || [])
                          .filter((s) => s.date === dateStr)
                          .map((s) => ({
                            ...s,
                            customerName: getCustomer(s.customerId)?.name || "미지정 고객",
                          }))
                      );

                      return (
                        <div
                          key={dateStr}
                          onClick={() => {
                            setSelectedDate(dateStr);
                            openModal("schedule", { date: dateStr });
                          }}
                          style={{
                            minHeight: isMobile ? 96 : 86,
                            padding: isMobile ? 10 : 8,
                            borderRadius: 10,
                            border: selectedDate === dateStr ? "2px solid #185FA5" : "1px solid #ddd",
                            background: isCurrentMonth ? "#fff" : "#f2f3f5",
                            color: isCurrentMonth ? "#222" : "#aaa",
                            cursor: "pointer",
                            boxSizing: "border-box",
                          }}
                        >
                          <div
                            style={{
                              fontSize: isMobile ? 14 : 12,
                              fontWeight: isToday ? 700 : 500,
                              color: isToday ? "#185FA5" : "inherit",
                              marginBottom: 6,
                            }}
                          >
                            {dateObj.getDate()}
                          </div>

                          {daySchedules.slice(0, 2).map((s) => (
                            <div
                              key={s.id}
                              style={{
                                fontSize: isMobile ? 11 : 10,
                                padding: "2px 4px",
                                borderRadius: 6,
                                background: s.done ? "#d9d9d9" : "#E6F1FB",
                                color: s.done ? "#666" : "#185FA5",
                                marginBottom: 4,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {(s.icon || "🔔") + " " + s.title}
                            </div>
                          ))}

                          {daySchedules.length > 2 && <div style={{ fontSize: 10, color: "#666" }}>+{daySchedules.length - 2}건</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {selectedDate && (
                  <div style={{ ...card, marginBottom: 20 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>{selectedDate} 일정</div>

                    {selectedSchedules.length === 0 ? (
                      <div style={{ fontSize: 13, color: "#666" }}>등록된 일정이 없습니다.</div>
                    ) : (
                      selectedSchedules.map((s) => (
                        <div
                          key={s.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "10px 0",
                            borderBottom: "1px solid #eee",
                            gap: 10,
                            flexWrap: isMobile ? "wrap" : "nowrap",
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 500 }}>
                              {s.icon || "🔔"} {s.customerName} — {s.title}
                            </div>
                            <div style={{ fontSize: 12, color: "#666" }}>
                              {s.time ? `${s.time} · ` : ""}
                              {s.done ? "완료됨" : "예정"}
                              {s.memo ? ` · ${s.memo}` : ""}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            <button
                              onClick={() => openModal("schedule", { ...s, customerId: s.customerId ?? "" })}
                              style={{ ...btn("#888780"), padding: "6px 10px", fontSize: 12 }}
                            >
                              수정
                            </button>
                            {!s.done && (
                              <button onClick={() => toggleSchedule(s.id)} style={{ ...btn("#1D9E75"), padding: "6px 10px", fontSize: 12 }}>
                                완료
                              </button>
                            )}
                            <button onClick={() => deleteSchedule(s.id)} style={{ ...btn("#E24B4A"), padding: "6px 10px", fontSize: 12 }}>
                              삭제
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontSize: 16, fontWeight: 500 }}>상담 일정</div>
                  <button
                    onClick={() =>
                      openModal("schedule", {
                        date: selectedDate || formatDateLocal(new Date()),
                      })
                    }
                    style={btn()}
                  >
                    + 일정 추가
                  </button>
                </div>

                {getSortedSchedules((data.schedules || []).filter((s) => !s.done)).map((s) => {
                  const days = getDaysUntil(s.date);
                  return (
                    <div
                      key={s.id}
                      style={{
                        ...card,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        flexWrap: isMobile ? "wrap" : "nowrap",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div
                          style={{
                            minWidth: 44,
                            textAlign: "center",
                            padding: "4px 8px",
                            borderRadius: 8,
                            background: `${daysColor(days)}18`,
                            color: daysColor(days),
                            fontSize: 13,
                            fontWeight: 500,
                          }}
                        >
                          {daysLabel(days)}
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 500 }}>
                            {s.icon || "🔔"} {getCustomer(s.customerId)?.name || "미지정 고객"} — {s.title}
                          </div>
                          <div style={{ fontSize: 12, color: "#666" }}>
                            {s.date}
                            {s.time ? ` ${s.time}` : ""}
                            {s.memo ? ` · ${s.memo}` : ""}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => openModal("schedule", { ...s, customerId: s.customerId ?? "" })}
                          style={{ ...btn("#888780"), padding: "8px 12px", fontSize: 12 }}
                        >
                          수정
                        </button>
                        <button onClick={() => toggleSchedule(s.id)} style={{ ...btn("#1D9E75"), padding: "8px 12px", fontSize: 12 }}>
                          완료
                        </button>
                      </div>
                    </div>
                  );
                })}

                {(data.schedules || []).filter((s) => !s.done).length === 0 && (
                  <div style={{ fontSize: 13, color: "#666" }}>예정 일정이 없습니다.</div>
                )}

                <div style={{ fontSize: 14, fontWeight: 500, margin: "20px 0 10px", color: "#666" }}>완료된 일정</div>
                {getSortedSchedules((data.schedules || []).filter((s) => s.done)).map((s) => (
                  <div key={s.id} style={{ ...card, opacity: 0.5 }}>
                    <div style={{ fontSize: 13, textDecoration: "line-through" }}>
                      {s.icon || "🔔"} {getCustomer(s.customerId)?.name || "미지정 고객"} — {s.title}
                    </div>
                    <div style={{ fontSize: 12, color: "#666" }}>
                      {s.date}
                      {s.time ? ` ${s.time}` : ""}
                    </div>
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
                    style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
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
                          {formatBirthLabel(c.birth)} · {date}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        minWidth: 52,
                        textAlign: "center",
                        padding: "6px 12px",
                        borderRadius: 8,
                        background: `${daysColor(days)}18`,
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
                    style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
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
                          {c?.name || "미지정 고객"} — {p.product}
                        </div>
                        <div style={{ fontSize: 12, color: "#666" }}>
                          {p.company} · 만기 {p.endDate}
                        </div>
                        <div style={{ fontSize: 12, color: "#666" }}>월 {(p.premium || 0).toLocaleString()}원</div>
                      </div>
                    </div>
                    <div
                      style={{
                        minWidth: 52,
                        textAlign: "center",
                        padding: "6px 12px",
                        borderRadius: 8,
                        background: `${daysColor(days)}18`,
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

      {isSaving && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(255,255,255,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            style={{
              width: isMobile ? "90vw" : 360,
              maxWidth: "88vw",
              background: "#fff",
              borderRadius: 18,
              padding: isMobile ? "18px 16px" : "24px 22px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
              border: "1px solid #d9e4f2",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 600, color: "#185FA5", marginBottom: 8 }}>저장중</div>
            <div style={{ fontSize: 13, color: "#666", marginBottom: 14 }}>고객 정보를 저장하고 있어요.</div>
            <div
              style={{
                width: "100%",
                height: 12,
                borderRadius: 999,
                background: "#eef3f8",
                overflow: "hidden",
                border: "1px solid #d7e2ef",
              }}
            >
              <div
                style={{
                  width: `${saveProgress}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: "linear-gradient(90deg, #7fb8f1 0%, #185FA5 100%)",
                  transition: "width 0.12s ease",
                }}
              />
            </div>
            <div style={{ fontSize: 12, color: "#185FA5", marginTop: 10, textAlign: "right", fontWeight: 500 }}>
              {saveProgress}%
            </div>
          </div>
        </div>
      )}

      {excelToast && (
        <div
          style={{
            position: "fixed",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            background: excelToast.type === "error" ? "#fff1f0" : "#f0fff4",
            border: `1px solid ${excelToast.type === "error" ? "#ffa39e" : "#b7eb8f"}`,
            color: excelToast.type === "error" ? "#cf1322" : "#237804",
            padding: "12px 24px",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            zIndex: 999,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            whiteSpace: "nowrap",
          }}
        >
          {excelToast.msg}
        </div>
      )}

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
            padding: isMobile ? 12 : 0,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 16,
              padding: isMobile ? 18 : 28,
              width: isMobile ? "92vw" : 440,
              maxWidth: "95vw",
              maxHeight: "85vh",
              overflowY: "auto",
              border: "1.5px solid #d0d0d0",
              boxShadow: "0 8px 32px rgba(0,0,0,0.13)",
            }}
          >
            {modal === "customer" && (
              <>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>
                  {form.id ? "고객 수정" : "고객 등록"}
                </div>

                {[
                  ["name", "이름*", "text"],
                  ["phone", "연락처*", "text"],
                  ["birth", "생년월일 (YYYY-MM-DD 또는 YYYYMMDD)", "text"],
                  ["ssn", "주민번호 (예: 9001011234567 또는 900101-1234567)", "text"],
                  ["email", "이메일", "text"],
                  ["memo", "메모", "text"],
                ].map(([k, l, t]) => (
                  <div key={k}>
                    <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>{l}</div>
                    <input
                      style={inp}
                      type={t}
                      value={form[k] || ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          [k]:
                            k === "birth"
                              ? formatBirthInput(e.target.value)
                              : k === "ssn"
                              ? formatSSNInput(e.target.value)
                              : k === "phone"
                              ? formatPhoneInput(e.target.value)
                              : e.target.value,
                        }))
                      }
                    />
                  </div>
                ))}

                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>상태</div>
                <select
                  style={inp}
                  value={form.status || "가망"}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="가망">가망</option>
                  <option value="가입">가입</option>
                  <option value="보류">보류</option>
                </select>

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

                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>다음 상담 예정일</div>
                <input
                  type="date"
                  style={inp}
                  value={form.nextDate || ""}
                  onChange={(e) => setForm((f) => ({ ...f, nextDate: e.target.value }))}
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
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>보험 계약 추가</div>

                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>보험사*</div>
                <input
                  style={inp}
                  value={form.company || ""}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                />

                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>상품명*</div>
                <input
                  style={inp}
                  value={form.product || ""}
                  onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))}
                />

                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>보험 종류</div>
                <select
                  style={inp}
                  value={form.type || "종신"}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                >
                  {["종신", "건강", "실손", "치아", "자동차", "운전자", "기타"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>

                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>상태</div>
                <select
                  style={inp}
                  value={form.status || "유지"}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  {["유지", "실효", "만기"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>

                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>월 보험료</div>
                <input
                  type="number"
                  style={inp}
                  value={form.premium || ""}
                  onChange={(e) => setForm((f) => ({ ...f, premium: e.target.value }))}
                />

                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>시작일</div>
                <input
                  type="date"
                  style={inp}
                  value={form.startDate || ""}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                />

                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>종료일</div>
                <input
                  type="date"
                  style={inp}
                  value={form.endDate || ""}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />

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
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 18, color: "#185FA5" }}>
                  {form.id ? "일정 수정" : "일정 등록"}
                </div>

                <div
                  style={{
                    background: "#f7fbff",
                    border: "1px solid #d9e8f7",
                    borderRadius: 12,
                    padding: "12px 14px",
                    marginBottom: 14,
                    fontSize: 13,
                    color: "#4d6480",
                  }}
                >
                  선택한 날짜에 일정을 등록해요.
                </div>

                <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>아이콘 선택</div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 8,
                    marginBottom: 14,
                  }}
                >
                  {scheduleIconOptions.map((icon) => {
                    const active = (form.icon || "🔔") === icon.value;
                    return (
                      <button
                        key={icon.value}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, icon: icon.value }))}
                        style={{
                          padding: "10px 8px",
                          borderRadius: 10,
                          border: active ? "2px solid #185FA5" : "1px solid #d0d0d0",
                          background: active ? "#E6F1FB" : "#fff",
                          cursor: "pointer",
                          fontSize: 18,
                        }}
                      >
                        <div>{icon.value}</div>
                        <div style={{ fontSize: 11, marginTop: 2, color: "#555" }}>{icon.label}</div>
                      </button>
                    );
                  })}
                </div>

                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>날짜*</div>
                <input
                  type="date"
                  style={inp}
                  value={form.date || ""}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />

                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>시간</div>
                <input
                  type="time"
                  style={inp}
                  value={form.time || ""}
                  onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                />

                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>일정명*</div>
                <input
                  style={inp}
                  value={form.title || ""}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="예: 갱신 안내 연락, 생일 축하 연락, 상담 미팅"
                />

                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>연결 고객 (선택)</div>
                <select
                  style={inp}
                  value={form.customerId ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      customerId: e.target.value === "" ? "" : Number(e.target.value),
                    }))
                  }
                >
                  <option value="">미지정 고객</option>
                  {data.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} / {c.phone}
                    </option>
                  ))}
                </select>

                <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>메모</div>
                <textarea
                  style={{ ...inp, height: 80, resize: "vertical" }}
                  value={form.memo || ""}
                  onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
                  placeholder="필요한 추가 메모를 적어주세요"
                />

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                  {form.id && (
                    <button type="button" onClick={() => deleteSchedule(form.id)} style={{ ...btn("#E24B4A") }}>
                      삭제
                    </button>
                  )}
                  <button type="button" onClick={closeModal} style={{ ...btn("#888780") }}>
                    취소
                  </button>
                  <button type="button" onClick={saveSchedule} style={btn()}>
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