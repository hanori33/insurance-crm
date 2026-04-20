import React, { useState, useEffect } from "react";

export default function App() {
  const [clients, setClients] = useState([]);
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
  const [search, setSearch] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("clients");
    if (saved) setClients(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("clients", JSON.stringify(clients));
  }, [clients]);

  const addClient = () => {
    if (!form.name) return alert("이름은 필수");
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

  const filtered = clients.filter((c) =>
    (c.name + c.phone + c.company + c.product + c.memo)
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const exportData = () => {
    const blob = new Blob([JSON.stringify(clients)], {
      type: "application/json"
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "clients.json";
    a.click();
  };

  const importData = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      setClients(JSON.parse(reader.result));
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>보험 CRM</h1>

      <input
        placeholder="검색 (이름/전화/메모)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
      />

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

        <button onClick={addClient}>고객 추가</button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <button onClick={exportData}>백업 (JSON)</button>
        <input type="file" onChange={importData} />
      </div>

      {filtered.map((c) => (
        <div key={c.id} style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10 }}>
          <div><b>{c.name}</b></div>
          <div>{c.phone}</div>
          <div>{c.company} / {c.product}</div>
          <div>{c.memo}</div>
          <div>연락: {c.contactDate}</div>
          <div>차 만기: {c.carExpire}</div>
          <div>생일: {c.birthday}</div>
          <button onClick={() => deleteClient(c.id)}>삭제</button>
        </div>
      ))}
    </div>
  );
}
