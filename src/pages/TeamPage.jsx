import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

const COLORS = {
  primary: "#7C3AED",
  primaryDark: "#5B21B6",
  light: "#F5F3FF",
  bg: "#F8F7FC",
  white: "#FFFFFF",
  text: "#111827",
  sub: "#6B7280",
  border: "#E5E7EB",
  blue: "#2563EB",
  green: "#16A34A",
  orange: "#F97316",
  red: "#EF4444",
};

const STATUS_LIST = [
  { key: "상담중", icon: "💬", color: "#16A34A", bg: "#DCFCE7" },
  { key: "통화중", icon: "📞", color: "#7C3AED", bg: "#F3E8FF" },
  { key: "상담기록중", icon: "📝", color: "#2563EB", bg: "#DBEAFE" },
  { key: "설계중", icon: "📋", color: "#0891B2", bg: "#CFFAFE" },
  { key: "미팅중", icon: "👥", color: "#F97316", bg: "#FFEDD5" },
  { key: "외근중", icon: "🚗", color: "#2563EB", bg: "#DBEAFE" },
  { key: "점심중", icon: "☕", color: "#D97706", bg: "#FEF3C7" },
  { key: "계약직전", icon: "🎯", color: "#DC2626", bg: "#FEE2E2" },
  { key: "불타는중", icon: "🔥", color: "#EA580C", bg: "#FFEDD5" },
  { key: "멘붕", icon: "😵", color: "#9333EA", bg: "#F3E8FF" },
  { key: "퇴근", icon: "🌙", color: "#4B5563", bg: "#F3F4F6" },
];

const EMOJIS = ["🐰", "🐻", "🐥", "🐶", "🐱", "🦊", "🐼", "🐯", "🐸", "🐹", "🐷", "🐵"];

function getStatusMeta(status) {
  return STATUS_LIST.find((s) => s.key === status) || STATUS_LIST[0];
}

function TeamPage({ onBack }) {
  const [activeTab, setActiveTab] = useState("status");
  const [members, setMembers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [myRole, setMyRole] = useState("");
  const [myBranchId, setMyBranchId] = useState(null);

  const [missionText, setMissionText] = useState("기존 고객 5명 안부연락");
  const [teamMessage, setTeamMessage] = useState("오늘도 화이팅! 목표 30건 가즈아 💪");

  const [editingMission, setEditingMission] = useState(false);
  const [editingMessage, setEditingMessage] = useState(false);

  const [draftMissionText, setDraftMissionText] = useState("");
  const [draftTeamMessage, setDraftTeamMessage] = useState("");

  const [ladderSelected, setLadderSelected] = useState([]);
  const [ladderEmojiMap, setLadderEmojiMap] = useState({});
  const [penalty, setPenalty] = useState("커피 사기");
  const [ladderLines, setLadderLines] = useState([]);
  const [runner, setRunner] = useState(null);
  const [ladderRunning, setLadderRunning] = useState(false);
  const [ladderResult, setLadderResult] = useState(null);
  const [liveLadderResults, setLiveLadderResults] = useState({});
  const [showConfetti, setShowConfetti] = useState(false);

  const [rouletteItems, setRouletteItems] = useState(["김치찌개", "돈까스", "쌀국수", "초밥", "마라탕"]);
  const [rouletteInput, setRouletteInput] = useState("");
  const [rouletteDeg, setRouletteDeg] = useState(0);
  const [rouletteResult, setRouletteResult] = useState(null);
  const [rouletteRunning, setRouletteRunning] = useState(false);

  const isManager = myRole === "manager" || myRole === "admin";
  const [isPhone, setIsPhone] = useState(
  typeof window !== "undefined" ? window.innerWidth <= 768 : false
);

useEffect(() => {
  const handleResize = () => {
    setIsPhone(window.innerWidth <= 768);
  };

  handleResize();
  window.addEventListener("resize", handleResize);

  return () => window.removeEventListener("resize", handleResize);
}, []);

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) return;

      setCurrentUserId(user.id);

      const { data: myProfile, error: myProfileError } = await supabase
        .from("profiles")
        .select("id, user_id, name, role, branch_id, status")
        .eq("user_id", user.id)
        .single();

      if (myProfileError) throw myProfileError;

      setMyRole(myProfile.role || "");
      setMyBranchId(myProfile.branch_id || null);

      if (!myProfile?.branch_id) {
        setMembers([]);
        setLadderSelected([]);
        return;
      }

      await loadBranchSettings(myProfile.branch_id);

      const { data: branchData, error: branchError } = await supabase
        .from("branches")
        .select("id, name, division")
        .eq("id", myProfile.branch_id)
        .single();

      if (branchError) throw branchError;

      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, name, role, branch_id, status, created_at")
        .eq("branch_id", myProfile.branch_id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const mapped = (data || []).map((m) => ({
        id: m.id,
        user_id: m.user_id,
        name: m.name || "이름없음",
        role: m.role === "admin" ? "관리자" : m.role === "manager" ? "지점장" : "팀원",
        branch: branchData?.name || "소속지점",
        division: branchData?.division || "소속사업단",
        status: m.status || "상담중",
        phone: "",
        consultCount: 0,
        scheduleCount: 0,
        customerCount: 0,
        profile: (m.name || "?").charAt(0),
        lastSeen: m.user_id === user.id ? "접속중" : "미접속",
        branch_id: m.branch_id,
      }));

      setMembers(mapped);
      setLadderSelected(mapped.map((m) => m.id));

      setLadderEmojiMap((prev) => {
        const next = { ...prev };
        mapped.forEach((m, index) => {
          if (!next[m.id]) next[m.id] = EMOJIS[index % EMOJIS.length];
        });
        return next;
      });
    } catch (err) {
      console.error("팀원 불러오기 실패:", err);
      alert("팀원 불러오기 실패: " + err.message);
    }
  }

  async function loadBranchSettings(branchId) {
    if (!branchId) return;

    const { data, error } = await supabase
      .from("branch_settings")
      .select("mission_text, team_message")
      .eq("branch_id", branchId)
      .maybeSingle();

    if (error) {
      console.error("팀 설정 불러오기 실패:", error);
      return;
    }

    if (data) {
      setMissionText(data.mission_text || "기존 고객 5명 안부연락");
      setTeamMessage(data.team_message || "오늘도 화이팅! 목표 30건 가즈아 💪");
    }
  }

  async function saveBranchSettings(nextMission, nextMessage) {
    if (!myBranchId) return false;

    const { error } = await supabase
      .from("branch_settings")
      .upsert(
        {
          branch_id: myBranchId,
          mission_text: nextMission,
          team_message: nextMessage,
          updated_by: currentUserId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "branch_id" }
      );

    if (error) {
      console.error("팀 설정 저장 실패:", error);
      alert("팀 설정 저장 실패: " + error.message);
      return false;
    }

    return true;
  }
function startEditMission() {
  setDraftMissionText(missionText);
  setEditingMission(true);
}

function cancelEditMission() {
  setDraftMissionText("");
  setEditingMission(false);
}

async function saveMission() {
  const nextMission = draftMissionText.trim() || "기존 고객 5명 안부연락";

  const ok = await saveBranchSettings(nextMission, teamMessage);
  if (!ok) return;

  setMissionText(nextMission);
  setEditingMission(false);
}
function startEditMessage() {
  setDraftTeamMessage(teamMessage);
  setEditingMessage(true);
}

function cancelEditMessage() {
  setDraftTeamMessage("");
  setEditingMessage(false);
}

async function saveMessage() {
  const nextMessage = draftTeamMessage.trim() || "오늘도 화이팅! 목표 30건 가즈아 💪";

  const ok = await saveBranchSettings(missionText, nextMessage);
  if (!ok) return;

  setTeamMessage(nextMessage);
  setEditingMessage(false);
}
  const selectedMembers = members.filter((m) => ladderSelected.includes(m.id));

  const ranking = useMemo(() => {
    return [...members]
      .map((m) => ({
        ...m,
        point: m.consultCount * 5 + m.scheduleCount * 3 + m.customerCount * 10,
      }))
      .sort((a, b) => b.point - a.point);
  }, [members]);

  const activitySummary = useMemo(() => {
    const consult = members.reduce((sum, m) => sum + m.consultCount, 0);
    const schedule = members.reduce((sum, m) => sum + m.scheduleCount, 0);
    const customer = members.reduce((sum, m) => sum + m.customerCount, 0);
    return {
      consult,
      schedule,
      customer,
      total: consult + schedule + customer,
    };
  }, [members]);

  const statusSummary = useMemo(() => {
    return STATUS_LIST.map((status) => ({
      ...status,
      count: members.filter((m) => m.status === status.key).length,
    })).filter((s) => s.count > 0);
  }, [members]);

  const updateStatus = async (id, status) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));

    const { error } = await supabase
      .from("profiles")
      .update({ status })
      .eq("id", id);

    if (error) {
      console.error("상태 저장 실패:", error);
      alert("상태 저장에 실패했어. 다시 시도해줘.");
    }
  };

  const toggleLadderMember = (id) => {
    setLadderSelected((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  const changeLadderEmoji = (id, emoji) => {
    setLadderEmojiMap((prev) => ({ ...prev, [id]: emoji }));
  };

  const createLadder = (count) => {
    const rows = [18, 31, 44, 57, 70, 83];
    const lines = [];

    rows.forEach((y, rowIndex) => {
      for (let col = 0; col < count - 1; col++) {
        if ((rowIndex + col) % 2 === 0 || Math.random() > 0.45) {
          lines.push({ y, from: col, to: col + 1 });
          col++;
        }
      }
    });

    return lines;
  };

  const getPath = (startCol, lines) => {
    let col = startCol;
    const path = [{ col, y: 5 }];
    const sorted = [...lines].sort((a, b) => a.y - b.y);

    sorted.forEach((line) => {
      path.push({ col, y: line.y });

      if (line.from === col) {
        col = line.to;
        path.push({ col, y: line.y });
      } else if (line.to === col) {
        col = line.from;
        path.push({ col, y: line.y });
      }
    });

    path.push({ col, y: 95 });
    return { path, endCol: col };
  };

  const drawLadder = () => {
    if (selectedMembers.length < 2) {
      alert("참가자는 2명 이상 선택해줘!");
      return;
    }

    const lines = createLadder(selectedMembers.length);

    const allResults = selectedMembers.map((member, startCol) => {
      const result = getPath(startCol, lines);
      return {
        member,
        endCol: result.endCol,
        path: result.path,
      };
    });

    const winnerIndex = Math.floor(Math.random() * selectedMembers.length);
    const winner = selectedMembers[winnerIndex];

    setLadderLines(lines);
    setLadderResult(null);
    setLiveLadderResults({});
    setRunner(null);
    setLadderRunning(true);

    let runnerIndex = 0;
    let pathIndex = 0;

    const timer = setInterval(() => {
      const current = allResults[runnerIndex];

      if (!current) {
        clearInterval(timer);
        setRunner(null);
        setLadderRunning(false);

        setLadderResult({
          winner,
          survivors: selectedMembers.filter((m) => m.id !== winner.id),
          penalty: penalty || "커피 사기",
          allResults,
        });

        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 1800);
        return;
      }

      const point = current.path[pathIndex];

      if (point) {
        setRunner({
          emoji: ladderEmojiMap[current.member.id],
          x: point.col,
          y: point.y,
        });

        pathIndex += 1;
        return;
      }

      const arrivedMember = selectedMembers[current.endCol];

      if (arrivedMember) {
        setLiveLadderResults((prev) => ({
          ...prev,
          [arrivedMember.id]: arrivedMember.id === winner.id ? "winner" : "safe",
        }));
      }

      runnerIndex += 1;
      pathIndex = 0;
      setRunner(null);
    }, 180);
  };

  const addRouletteItem = () => {
    const value = rouletteInput.trim();
    if (!value) return;
    setRouletteItems((prev) => [...prev, value]);
    setRouletteInput("");
  };

  const removeRouletteItem = (index) => {
    setRouletteItems((prev) => prev.filter((_, i) => i !== index));
  };

  const spinRoulette = () => {
    if (rouletteItems.length < 2) {
      alert("룰렛 항목은 2개 이상 넣어줘!");
      return;
    }

    setRouletteRunning(true);
    setRouletteResult(null);

    const pickedIndex = Math.floor(Math.random() * rouletteItems.length);
    const slice = 360 / rouletteItems.length;
    const targetDeg = 360 * 7 + (360 - pickedIndex * slice - slice / 2);
    const nextDeg = rouletteDeg + targetDeg;

    setRouletteDeg(nextDeg);

    setTimeout(() => {
      setRouletteRunning(false);
      setRouletteResult(rouletteItems[pickedIndex]);
    }, 3300);
  };

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg) scale(0.7); opacity: 0; }
        }
      `}</style>

      {showConfetti && (
        <div style={styles.confettiWrap}>
          {Array.from({ length: 28 }).map((_, i) => (
            <span
              key={i}
              style={{
                ...styles.confetti,
                left: `${(i * 37) % 100}%`,
                animationDelay: `${(i % 8) * 0.08}s`,
              }}
            >
              🎉
            </span>
          ))}
        </div>
      )}

      <div style={styles.header}>
        <div>
          <div style={styles.title}>팀관리</div>
          <div style={styles.subtitle}>팀 현황 · 랭킹 · 사다리 · 룰렛</div>
        </div>
      </div>

      <div style={styles.tabWrap}>
        {[
          ["status", "현황"],
          ["ranking", "랭킹"],
          ["ladder", "사다리"],
          ["roulette", "룰렛"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            style={activeTab === key ? styles.activeTab : styles.tab}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "status" && (
        <>
          <section style={styles.summaryGrid}>
            {statusSummary.map((status) => (
              <div key={status.key} style={styles.summaryCard}>
                <div style={{ ...styles.summaryIcon, background: status.bg, color: status.color }}>
                  {status.icon}
                </div>
                <div>
                  <div style={styles.summaryLabel}>{status.key}</div>
                  <div style={styles.summaryCount}>{status.count}명</div>
                </div>
              </div>
            ))}

            <div style={styles.summaryCard}>
              <div style={{ ...styles.summaryIcon, background: COLORS.light, color: COLORS.primary }}>👥</div>
              <div>
                <div style={styles.summaryLabel}>전체 팀원</div>
                <div style={styles.summaryCount}>{members.length}명</div>
              </div>
            </div>
          </section>

          <section style={styles.statusLayout}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <div style={styles.sectionTitle}>팀원 현황</div>
                  <div style={styles.sectionSub}>현재 접속 {members.length}명</div>
                </div>
              </div>

              <div style={styles.memberList}>
                {members.map((member) => {
                  const meta = getStatusMeta(member.status);

                  return (
                    <div key={member.id} style={styles.memberRow}>
                      <div style={styles.profileAvatar}>{member.profile}</div>

                      <div style={styles.memberInfo}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={styles.memberName}>{member.name}</div>

                          <span style={styles.roleBadge}>
                            {member.role}
                          </span>
                        </div>

                        <div style={styles.memberRole}>
                          <div>🏢 {member.division}</div>
                          <div>📍 {member.branch}</div>
                        </div>
                      </div>

                      <div style={styles.statusLine}>
                        {member.user_id === currentUserId ? (
                          <div style={styles.statusSelectWrap}>
                            <select
                              value={member.status}
                              onChange={(e) => updateStatus(member.id, e.target.value)}
                              style={{
                                ...styles.statusSelect,
                                background: meta.bg,
                                color: meta.color,
                              }}
                            >
                              {STATUS_LIST.map((status) => (
                                <option
  key={status.key}
  value={status.key}
  style={{ textAlign: "center" }}
>
  {status.icon} {status.key}
</option>
                              ))}
                            </select>

                            <span style={styles.statusArrow}>⌄</span>
                          </div>
                        ) : (
                          <div
                            style={{
                              ...styles.statusViewOnly,
                              background: meta.bg,
                              color: meta.color,
                            }}
                          >
                            {meta.icon} {member.status}
                          </div>
                        )}

                        <div
                          style={{
                            ...styles.lastSeen,
                            color: member.lastSeen === "접속중" ? "#16A34A" : COLORS.sub,
                            fontWeight: member.lastSeen === "접속중" ? 800 : 500,
                          }}
                        >
                          {member.lastSeen === "접속중" ? "🟢 접속중" : "⚫ 미접속"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={styles.sideStack}>
              <div style={styles.card}>
                <div style={styles.sectionTitle}>오늘 활동 요약</div>
                <div style={styles.activityGrid}>
                  <div style={styles.activityCard}>
                    <span>💬</span>
                    <b>{activitySummary.consult}건</b>
                    <small>상담기록</small>
                  </div>
                  <div style={styles.activityCard}>
                    <span>📅</span>
                    <b>{activitySummary.schedule}건</b>
                    <small>일정완료</small>
                  </div>
                  <div style={styles.activityCard}>
                    <span>👤</span>
                    <b>{activitySummary.customer}건</b>
                    <small>고객등록</small>
                  </div>
                  <div style={styles.activityCard}>
                    <span>🚩</span>
                    <b>{activitySummary.total}건</b>
                    <small>전체활동</small>
                  </div>
                </div>
              </div>

              <div style={styles.missionCard}>
                <div style={styles.cardTitleRow}>
                  <div style={styles.sectionTitle}>🎯 오늘의 미션</div>

                  {isManager && !editingMission && (
                    <button
                      type="button"
                      onClick={startEditMission}
                      style={styles.editMiniButtonLight}
                    >
                      수정
                    </button>
                  )}
                </div>

                {editingMission ? (
  <>
    <input
      value={draftMissionText}
      onChange={(e) => setDraftMissionText(e.target.value)}
      style={styles.missionInput}
      placeholder="오늘의 미션을 입력하세요"
    />

    <div style={styles.editButtonRow}>
      <button type="button" onClick={cancelEditMission} style={styles.cancelButton}>
        취소
      </button>

      <button type="button" onClick={saveMission} style={styles.saveButton}>
        저장
      </button>
    </div>
  </>
) : (
  <div style={styles.missionText}>{missionText}</div>
)}

                <div style={styles.missionSub}>완료율 60%</div>
                <div style={styles.progressBg}>
                  <div style={styles.progressBar} />
                </div>
              </div>

              <div style={styles.card}>
                <div style={styles.cardTitleRow}>
                  <div style={styles.sectionTitle}>📢 팀 한마디</div>

                  {isManager && !editingMessage && (
                    <button
                      type="button"
                      onClick={startEditMessage}
                      style={styles.editMiniButton}
                    >
                      수정
                    </button>
                  )}
                </div>

                {editingMessage ? (
                  <>
                    <textarea
                      value={draftTeamMessage}
                      onChange={(e) => setDraftTeamMessage(e.target.value)}
                      style={styles.teamMessageInput}
                      placeholder="팀 한마디를 입력하세요"
                    />

                    <div style={styles.editButtonRow}>
                      <button type="button" onClick={cancelEditMessage} style={styles.cancelButton}>
                        취소
                      </button>

                      <button type="button" onClick={saveMessage} style={styles.saveButton}>
  저장
</button>
                    </div>
                  </>
                ) : (
                  <div style={styles.teamMessage}>{teamMessage}</div>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {activeTab === "ranking" && (
        <section style={styles.card}>
          <div style={styles.sectionTitle}>🏆 오늘의 활동 랭킹</div>
          <div style={styles.sectionSub}>상담기록 + 일정완료 + 고객등록 기준</div>

          {ranking.map((member, index) => (
            <div key={member.id} style={styles.rankItem}>
              <div style={styles.rankNo}>
                {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
              </div>
              <div style={styles.profileAvatarSmall}>{member.profile}</div>
              <div style={{ flex: 1 }}>
                <div>🏢 {member.division}</div>
                <div>📍 {member.branch}</div>
                <div style={styles.memberRole}>
                  상담 {member.consultCount}건 · 일정 {member.scheduleCount}건 · 고객 {member.customerCount}건
                </div>
              </div>
              <div style={styles.rankCount}>{member.point}P</div>
            </div>
          ))}
        </section>
      )}

      {activeTab === "ladder" && (
        <section style={styles.card}>
          <div style={styles.sectionTitle}>🪜 캐릭터 사다리타기</div>
          <div style={styles.sectionSub}>캐릭터가 한 칸씩 움직이면서 내려가요</div>

          <div style={styles.checkList}>
            {members.map((member) => (
              <div key={member.id} style={styles.ladderMemberBox}>
                <label style={styles.checkItem}>
                  <input
                    type="checkbox"
                    checked={ladderSelected.includes(member.id)}
                    onChange={() => toggleLadderMember(member.id)}
                  />
                  <span>{ladderEmojiMap[member.id] || "🐰"} {member.name}</span>
                </label>

                <div style={styles.emojiWrap}>
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      style={ladderEmojiMap[member.id] === emoji ? styles.emojiActive : styles.emojiBtn}
                      onClick={() => changeLadderEmoji(member.id, emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <input
            value={penalty}
            onChange={(e) => setPenalty(e.target.value)}
            placeholder="벌칙 입력 예: 커피 사기"
            style={styles.input}
          />

          <div style={styles.ladderStage}>
            <div style={styles.ladderInner}>
              {selectedMembers.map((member, index) => {
                const left = getColLeft(index, selectedMembers.length);
                return (
                  <React.Fragment key={member.id}>
                    <div style={{ ...styles.ladderName, left: `${left}%` }}>
                      <div>{ladderEmojiMap[member.id] || "🐰"}</div>
                      <b>{member.name}</b>
                    </div>
                    <div style={{ ...styles.ladderVertical, left: `${left}%` }} />
                    <div
                      style={{
                        ...styles.ladderGift,
                        left: `${left}%`,
                        ...(liveLadderResults[member.id] === "winner"
                          ? styles.ladderGiftWinner
                          : liveLadderResults[member.id] === "safe"
                          ? styles.ladderGiftSafe
                          : {}),
                      }}
                    >
                      {liveLadderResults[member.id] === "winner"
                        ? "☠️ 당첨"
                        : liveLadderResults[member.id] === "safe"
                        ? "😆 생존"
                        : "🎁"}
                    </div>
                  </React.Fragment>
                );
              })}

              {ladderLines.map((line, index) => {
                const left1 = getColLeft(line.from, selectedMembers.length);
                const left2 = getColLeft(line.to, selectedMembers.length);
                return (
                  <div
                    key={index}
                    style={{
                      ...styles.ladderHorizontal,
                      left: `${left1}%`,
                      top: `${line.y}%`,
                      width: `${left2 - left1}%`,
                    }}
                  />
                );
              })}

              {runner && (
                <div
                  style={{
                    ...styles.runner,
                    left: `${getColLeft(runner.x, selectedMembers.length)}%`,
                    top: `${runner.y}%`,
                  }}
                >
                  {runner.emoji}
                </div>
              )}
            </div>
          </div>

          <button style={styles.primaryButton} onClick={drawLadder} disabled={ladderRunning}>
            {ladderRunning ? "사다리 타는 중..." : "출발하기"}
          </button>

          {ladderResult && (
            <div style={styles.resultLineBox}>
              ☠️ 오늘의 희생양: <b>{ladderResult.winner.name}</b>
              <span style={styles.resultDivider}>|</span>
              😆 무사생환: <b>{ladderResult.survivors.map((m) => m.name).join(", ") || "없음"}</b>
              <span style={styles.resultDivider}>|</span>
              ☕ <b>{ladderResult.penalty}</b>
            </div>
          )}
        </section>
      )}

      {activeTab === "roulette" && (
        <section style={styles.card}>
          <div style={styles.sectionTitle}>🎰 돌아가는 룰렛</div>
          <div style={styles.sectionSub}>점심메뉴 / 벌칙 / 간식 뽑기용</div>

          <div style={styles.rouletteWrap}>
            <div style={styles.pointer}>▼</div>

            <svg viewBox="0 0 320 320" style={{ ...styles.rouletteSvg, transform: `rotate(${rouletteDeg}deg)` }}>
              <g transform="translate(160 160)">
                {rouletteItems.map((item, index) => {
                  const count = rouletteItems.length;
                  const start = (360 / count) * index - 90;
                  const end = (360 / count) * (index + 1) - 90;
                  const mid = (start + end) / 2;
                  const color = ["#EDE9FE", "#DDD6FE", "#C4B5FD", "#A78BFA", "#F3E8FF", "#D8B4FE"][index % 6];

                  return (
                    <g key={`${item}-${index}`}>
                      <path d={describeArc(0, 0, 145, start, end)} fill={color} stroke="#FFFFFF" strokeWidth="4" />
                      <line
                        x1="0"
                        y1="0"
                        x2={145 * Math.cos((Math.PI / 180) * start)}
                        y2={145 * Math.sin((Math.PI / 180) * start)}
                        stroke="#7C3AED"
                        strokeWidth="1.5"
                        opacity="0.45"
                      />
                      <text
                        x={88 * Math.cos((Math.PI / 180) * mid)}
                        y={88 * Math.sin((Math.PI / 180) * mid)}
                        fill="#5B21B6"
                        fontSize="13"
                        fontWeight="900"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        transform={`rotate(${mid + 90}, ${88 * Math.cos((Math.PI / 180) * mid)}, ${88 * Math.sin((Math.PI / 180) * mid)})`}
                      >
                        {shortText(item)}
                      </text>
                    </g>
                  );
                })}
                <circle cx="0" cy="0" r="42" fill="#FFFFFF" />
                <text x="0" y="5" fill="#7C3AED" fontSize="20" fontWeight="900" textAnchor="middle">Bo</text>
              </g>
            </svg>
          </div>

          <div style={styles.inputRow}>
            <input
              value={rouletteInput}
              onChange={(e) => setRouletteInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addRouletteItem()}
              placeholder="항목 입력"
              style={styles.input}
            />
            <button style={styles.smallButton} onClick={addRouletteItem}>추가</button>
          </div>

          <div style={styles.itemWrap}>
            {rouletteItems.map((item, index) => (
              <button key={`${item}-${index}`} style={styles.itemChip} onClick={() => removeRouletteItem(index)}>
                {item} ✕
              </button>
            ))}
          </div>

          <button style={styles.primaryButton} onClick={spinRoulette} disabled={rouletteRunning}>
            {rouletteRunning ? "돌아가는 중..." : "룰렛 돌리기"}
          </button>

          {rouletteResult && (
            <div style={styles.resultBox}>
              🎉 결과: <b>{rouletteResult}</b>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function getColLeft(index, count) {
  if (count <= 1) return 50;

  const mobile = typeof window !== "undefined" && window.innerWidth <= 480;

  if (mobile) {
    const padding = count <= 3 ? 18 : 10;
    return padding + (index * (100 - padding * 2)) / (count - 1);
  }

  const padding = count <= 3 ? 18 : 8;
  return padding + (index * (100 - padding * 2)) / (count - 1);
}

function polarToCartesian(cx, cy, r, angle) {
  const rad = (Math.PI / 180) * angle;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return ["M", cx, cy, "L", start.x, start.y, "A", r, r, 0, largeArcFlag, 0, end.x, end.y, "Z"].join(" ");
}

function shortText(text) {
  if (!text) return "";
  return text.length > 5 ? text.slice(0, 5) : text;
}

function isPhoneLayout() {
  if (typeof window === "undefined") return false;

  return (
    window.innerWidth <= 768 ||
    /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  );
}

const styles = {
  page: {
    minHeight: "100%",
    background: COLORS.bg,
    padding: 18,
    boxSizing: "border-box",
    color: COLORS.text,
  },

  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },

  backButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.white,
    fontSize: 20,
  },

  title: { fontSize: 22, fontWeight: 900 },
  subtitle: { marginTop: 3, fontSize: 13, color: COLORS.sub },

  tabWrap: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 8,
    marginBottom: 16,
  },

  tab: {
    border: `1px solid ${COLORS.border}`,
    background: COLORS.white,
    color: COLORS.sub,
    padding: "12px 6px",
    borderRadius: 16,
    fontWeight: 800,
    fontSize: 13,
  },

  activeTab: {
    border: `1px solid ${COLORS.primary}`,
    background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`,
    color: COLORS.white,
    padding: "12px 6px",
    borderRadius: 16,
    fontWeight: 900,
    fontSize: 13,
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
    gap: 12,
    marginBottom: 14,
  },

  summaryCard: {
    background: COLORS.white,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 18,
    padding: 14,
    display: "flex",
    alignItems: "center",
    gap: 12,
    boxShadow: "0 8px 20px rgba(17,24,39,0.04)",
  },

  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
  },

  summaryLabel: { fontSize: 13, color: COLORS.sub, fontWeight: 800 },
  summaryCount: { marginTop: 2, fontSize: 22, color: COLORS.text, fontWeight: 900 },

  statusLayout: {
    display: "grid",
    gridTemplateColumns: isPhoneLayout() ? "1fr" : "1.2fr 1fr",
    gap: 14,
  },

  sideStack: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  card: {
    background: COLORS.white,
    borderRadius: 22,
    padding: 18,
    border: `1px solid ${COLORS.border}`,
    boxShadow: "0 10px 24px rgba(17,24,39,0.06)",
    marginBottom: 0,
  },

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  cardTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },

  sectionTitle: { fontSize: 18, fontWeight: 900 },
  sectionSub: { marginTop: 4, marginBottom: 0, fontSize: 13, color: COLORS.sub },

  memberList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  memberRow: {
    display: "grid",
    gridTemplateColumns: isPhoneLayout() ? "50px 1fr" : "50px 260px 190px 90px",
    alignItems: "center",
    columnGap: 14,
    rowGap: 12,
    padding: 14,
    borderRadius: 18,
    background: "#FAFAFA",
    overflow: "hidden",
  },

  memberInfo: {
    minWidth: 0,
  },

  roleBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: 999,
    background: "#F3E8FF",
    color: "#7C3AED",
    whiteSpace: "nowrap",
  },

  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 18,
    background: COLORS.light,
    color: COLORS.primaryDark,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: 20,
  },

  profileAvatarSmall: {
    width: 38,
    height: 38,
    borderRadius: 14,
    background: COLORS.light,
    color: COLORS.primaryDark,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
  },

  memberName: { fontSize: 16, fontWeight: 900 },
  memberRole: { marginTop: 3, fontSize: 13, color: COLORS.sub },

  statusLine: {
    display: isPhoneLayout() ? "grid" : "flex",
    gridTemplateColumns: isPhoneLayout() ? "165px 78px" : "none",
    alignItems: "center",
    justifyContent: isPhoneLayout() ? "center" : "flex-start",
    columnGap: isPhoneLayout() ? 10 : 18,
    gap: isPhoneLayout() ? 10 : 18,
    gridColumn: isPhoneLayout() ? "1 / 3" : "3 / 5",
    width: isPhoneLayout() ? "100%" : "auto",
    marginTop: isPhoneLayout() ? 10 : 0,
  },

  statusSelectWrap: {
    position: "relative",
    width: isPhoneLayout() ? 165 : 190,
    height: 42,
    flexShrink: 0,
  },

  statusSelect: {
    width: "100%",
    height: "100%",
    padding: isPhoneLayout() ? "0 34px 0 14px" : "0 42px 0 18px",
    borderRadius: 999,
    border: "none",
    fontWeight: 900,
    fontSize: 14,
    outline: "none",
    cursor: "pointer",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    boxSizing: "border-box",
    textAlign: "center",
    textAlignLast: "center",
  },

  statusArrow: {
    position: "absolute",
    right: isPhoneLayout() ? 18 : 25,
    top: "43%",
    transform: "translateY(-50%)",
    fontSize: 12,
    fontWeight: 900,
    color: "#2563EB",
    pointerEvents: "none",
  },

  statusViewOnly: {
    width: isPhoneLayout() ? 165 : 190,
    height: 42,
    padding: "0 18px",
    borderRadius: 999,
    border: "none",
    fontWeight: 900,
    outline: "none",
    fontSize: 14,
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    whiteSpace: "nowrap",
  },

  lastSeen: {
    width: isPhoneLayout() ? 78 : 90,
    minHeight: 42,
    fontSize: isPhoneLayout() ? 13 : 14,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    whiteSpace: "nowrap",
    color: COLORS.sub,
  },

  lastSeenMobile: {
    display: "none",
  },

  activityGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 10,
    marginTop: 14,
  },

  activityCard: {
    border: `1px solid ${COLORS.border}`,
    borderRadius: 16,
    padding: 12,
    textAlign: "center",
    background: "#FAFAFA",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },

  missionCard: {
    background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`,
    color: COLORS.white,
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 10px 24px rgba(124,58,237,0.25)",
  },

  missionText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: 900,
  },

  missionInput: {
    width: "100%",
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.45)",
    background: "rgba(255,255,255,0.18)",
    color: COLORS.white,
    fontSize: 15,
    fontWeight: 900,
    outline: "none",
    boxSizing: "border-box",
  },

  missionSub: {
    marginTop: 6,
    fontSize: 13,
    opacity: 0.9,
  },

  progressBg: {
    marginTop: 12,
    height: 8,
    borderRadius: 999,
    background: "rgba(255,255,255,0.25)",
    overflow: "hidden",
  },

  progressBar: {
    width: "60%",
    height: "100%",
    background: COLORS.white,
    borderRadius: 999,
  },

  teamMessage: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    background: COLORS.light,
    color: COLORS.primaryDark,
    fontWeight: 800,
  },

  teamMessageInput: {
    width: "100%",
    minHeight: 74,
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.light,
    color: COLORS.primaryDark,
    fontWeight: 800,
    outline: "none",
    resize: "vertical",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },

  editMiniButton: {
    border: "none",
    borderRadius: 999,
    padding: "5px 11px",
    height: 30,
    background: COLORS.primary,
    color: COLORS.white,
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    flexShrink: 0,
  },

  editMiniButtonLight: {
    border: "none",
    borderRadius: 999,
    padding: "5px 11px",
    height: 30,
    background: COLORS.white,
    color: COLORS.primaryDark,
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    flexShrink: 0,
  },

  editButtonRow: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 10,
  },

  cancelButton: {
    border: `1px solid ${COLORS.border}`,
    background: COLORS.white,
    color: COLORS.sub,
    borderRadius: 999,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },

  saveButton: {
    border: "none",
    background: COLORS.primary,
    color: COLORS.white,
    borderRadius: 999,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },

  rankItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 13,
    borderRadius: 16,
    background: COLORS.bg,
    marginBottom: 10,
  },

  rankNo: {
    width: 38,
    height: 38,
    borderRadius: 14,
    background: COLORS.white,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
  },

  rankCount: {
    fontWeight: 900,
    color: COLORS.primary,
    fontSize: 16,
  },

  checkList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
    marginBottom: 14,
  },

  ladderMemberBox: {
    padding: 12,
    borderRadius: 16,
    background: COLORS.bg,
  },

  checkItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 800,
  },

  emojiWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },

  emojiBtn: {
    border: `1px solid ${COLORS.border}`,
    background: COLORS.white,
    borderRadius: 999,
    padding: "6px 8px",
    fontSize: 17,
  },

  emojiActive: {
    border: `2px solid ${COLORS.primary}`,
    background: COLORS.light,
    borderRadius: 999,
    padding: "6px 8px",
    fontSize: 17,
  },

  input: {
    width: "100%",
    padding: "13px 14px",
    borderRadius: 15,
    border: `1px solid ${COLORS.border}`,
    boxSizing: "border-box",
  },

  primaryButton: {
    width: "100%",
    marginTop: 12,
    padding: "14px 16px",
    borderRadius: 17,
    border: "none",
    background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`,
    color: COLORS.white,
    fontWeight: 900,
    fontSize: 15,
  },

  smallButton: {
    minWidth: 68,
    borderRadius: 15,
    border: "none",
    background: COLORS.primary,
    color: COLORS.white,
    fontWeight: 900,
  },

  resultBox: {
    marginTop: 14,
    padding: 16,
    borderRadius: 18,
    background: COLORS.light,
    color: COLORS.primaryDark,
    fontSize: 16,
    lineHeight: 1.7,
    textAlign: "center",
  },

  resultLineBox: {
    marginTop: 14,
    padding: "13px 16px",
    borderRadius: 16,
    background: COLORS.light,
    color: COLORS.primaryDark,
    fontSize: 15,
    fontWeight: 800,
    textAlign: "center",
    lineHeight: 1.6,
    wordBreak: "keep-all",
  },

  resultDivider: {
    margin: "0 10px",
    color: "#A78BFA",
  },

  confettiWrap: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: 9999,
    overflow: "hidden",
  },

  confetti: {
    position: "absolute",
    top: "-30px",
    fontSize: 28,
    animation: "confettiFall 1.8s ease-out forwards",
  },

  ladderStage: {
    width: "100%",
    overflowX: "hidden",
    marginTop: 20,
    padding: "14px 0",
  },

  ladderInner: {
    position: "relative",
    width: "100%",
    height: 560,
    margin: "0 auto",
    borderRadius: 22,
    background: "#FFFFFF",
    overflow: "hidden",
  },

  ladderName: {
    position: "absolute",
    top: 0,
    transform: "translateX(-50%)",
    textAlign: "center",
    fontSize: 15,
    lineHeight: 1.4,
  },

  ladderVertical: {
    position: "absolute",
    top: "12%",
    height: "74%",
    width: 7,
    transform: "translateX(-50%)",
    background: COLORS.primary,
    borderRadius: 999,
  },

  ladderHorizontal: {
    position: "absolute",
    height: 7,
    background: COLORS.primary,
    borderRadius: 999,
    transform: "translateY(-50%)",
  },

  ladderGift: {
    position: "absolute",
    bottom: 0,
    transform: "translateX(-50%)",
    fontSize: 24,
    minWidth: 54,
    height: 34,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
  },

  ladderGiftWinner: {
    fontSize: 12,
    fontWeight: 900,
    color: "#DC2626",
    background: "#FEE2E2",
    padding: "6px 8px",
    borderRadius: 999,
    minWidth: 62,
    boxSizing: "border-box",
  },

  ladderGiftSafe: {
    fontSize: 12,
    fontWeight: 900,
    color: "#16A34A",
    background: "#DCFCE7",
    padding: "6px 8px",
    borderRadius: 999,
    minWidth: 62,
    boxSizing: "border-box",
  },

  runner: {
    position: "absolute",
    transform: "translate(-50%, -50%)",
    fontSize: 34,
    zIndex: 5,
    transition: "left 0.35s ease, top 0.35s ease",
  },

  rouletteWrap: {
    position: "relative",
    width: 360,
    maxWidth: "100%",
    height: 390,
    margin: "0 auto 18px",
  },

  pointer: {
    position: "absolute",
    top: 0,
    left: "50%",
    transform: "translateX(-50%)",
    color: COLORS.primaryDark,
    fontSize: 34,
    zIndex: 3,
  },

  rouletteSvg: {
    position: "absolute",
    top: 42,
    left: "50%",
    marginLeft: -160,
    width: 320,
    height: 320,
    borderRadius: "50%",
    filter: "drop-shadow(0 12px 28px rgba(124,58,237,0.24))",
    transition: "transform 3.3s cubic-bezier(.12,.76,.25,1)",
  },

  inputRow: {
    display: "flex",
    gap: 8,
    marginBottom: 12,
  },

  itemWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },

  itemChip: {
    padding: "9px 12px",
    borderRadius: 999,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.white,
    fontWeight: 800,
  },
};

export default TeamPage;
