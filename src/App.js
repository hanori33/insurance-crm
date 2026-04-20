import React, { useState, useEffect } from "react";

export default function App() {
  const [clients, setClients] = useState([]);
  const [tab, setTab] = useState("전체");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    company: "",
    product: "",
    memo: "",
    contactDate: "",
    carExpire: "",
    birthday: ""
  });

  useEffect(() => {
    const saved = localStorage.getItem("clients");
    if (saved) setClients(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("clients", JSON.stringify(clients));
  }, [clients]);

  const addClient = () => {
    if (!form.name) return alert("이름 입력");
    setClients([...clients, { ...form, id: Date.now() }]);
    setForm({
      name: "",
      phone: "",
      company: "",
      product: "",
      memo: "",
      contactDate: "",
      carExpire: "",
      birthday: ""
    });
  };

  const deleteClient = (id) => {
    setClients(clients.filter((c) => c.id !== id));
  };

  const today = new Date().toISOString().slice(0, 10);

  const filtered = clients.filter((c) => {
    const matchSearch = (c.name + c.phone + c.memo)
      .toLowerCase()
      .includes(search.toLowerCase());

    if (tab === "오늘연락") return c.contactDate === today && matchSearch;
    if (tab === "자동차만기") return c.carExpire && matchSearch;
    if (tab === "생일") return c.birthday && matchSearch;

    return matchSearch;
  });

  const exportData = () => {
    const blob = new Blob([JSON.stringify(clients)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "clients.json";
    a.click();
  };

  const importData = (e) => {
    const reader = new FileReader();
    reader.onload = () => {
      setClients(JSON.parse(reader.result));
    };
    reader.readAsText(e.target.files[0]);
  };

  return (
    <div style={{ padding: 20, maxWidth: 500, margin: "auto" }}>
      <h2>보험 CRM</h2>

      <input
        placeholder="검색 (이름/메모)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
      />

      {/* 탭 */}
      <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
        {["전체", "오늘연락", "자동차만기", "생일"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              background: tab === t ? "#333" : "#ddd",
              color: tab === t ? "#fff" : "#000"
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* 입력폼 */}
      <div style={{ marginBottom: 20 }}>
        <input placeholder="이름" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="전화번호" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input placeholder="보험사" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
        <input placeholder="상품명" value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} />
        <input placeholder="메모" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />

        <div>연락 예정일</div>
        <input type="date" value={form.contactDate} onChange={(e) => setForm({ ...form, contactDate: e.target.value })} />

        <div>자동차 만기</div>
        <input type="date" value={form.carExpire} onChange={(e) => setForm({ ...form, carExpire: e.target.value })} />

        <div>생일</div>
        <input type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} />

        <button onClick={addClient} style={{ width: "100%", marginTop: 10 }}>
          고객 추가
        </button>
      </div>

      {/* 백업 */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={exportData}>백업</button>
        <input type="file" onChange={importData} />
      </div>

      {/* 리스트 */}
      {filtered.map((c) => (
        <div key={c.id} style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10, borderRadius: 10 }}>
          <b>{c.name}</b>
          <div>{c.phone}</div>
          <div>{c.company} / {c.product}</div>
          <div>{c.memo}</div>
          <div>연락: {c.contactDate}</div>
          <div>차만기: {c.carExpire}</div>
          <div>생일: {c.birthday}</div>
          <button onClick={() => deleteClient(c.id)}>삭제</button>
        </div>
      ))}
    </div>
  );
}
