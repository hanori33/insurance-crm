import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import inviteService from "../services/inviteService";

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

const INVITE_ROLE_OPTIONS = [
  { value: "team_member", label: "팀원" },
  { value: "member", label: "일반 구성원" },
  { value: "agent", label: "설계사" },
  { value: "staff", label: "스태프" },
];

const INVITE_EXPIRE_OPTIONS = [
  { value: "1", label: "1일" },
  { value: "7", label: "7일" },
  { value: "14", label: "14일" },
  { value: "30", label: "30일" },
];

const INVITE_MAX_USES_LIMIT = 1000;
const INVITE_UNLIMITED_VALUE = "unlimited";
const KAKAO_SDK_URL = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.5/kakao.min.js";

function getStatusMeta(status) {
  return STATUS_LIST.find((s) => s.key === status) || STATUS_LIST[0];
}

function getDescendantUserIds(items, rootUserId, includeRoot = true) {
  if (!rootUserId) return [];

  const childrenMap = {};

  (items || []).forEach((item) => {
    const parentId = item.parent_user_id || item.parentUserId || null;
    if (!parentId) return;

    if (!childrenMap[parentId]) childrenMap[parentId] = [];
    childrenMap[parentId].push(item.user_id || item.userId);
  });

  const result = [];
  const queue = includeRoot ? [rootUserId] : childrenMap[rootUserId] || [];
  const visited = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;

    visited.add(current);
    result.push(current);

    (childrenMap[current] || []).forEach((childId) => {
      if (childId && !visited.has(childId)) queue.push(childId);
    });
  }

  return result;
}

function getRootUserId(items, userId) {
  if (!userId) return null;

  const byUserId = {};
  (items || []).forEach((item) => {
    if (item.user_id || item.userId) byUserId[item.user_id || item.userId] = item;
  });

  let currentId = userId;
  const visited = new Set();

  while (currentId && byUserId[currentId] && !visited.has(currentId)) {
    visited.add(currentId);
    const parentId = byUserId[currentId].parent_user_id || byUserId[currentId].parentUserId;
    if (!parentId || !byUserId[parentId]) break;
    currentId = parentId;
  }

  return currentId || userId;
}


function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const yyyy = start.getFullYear();
  const mm = String(start.getMonth() + 1).padStart(2, "0");
  const dd = String(start.getDate()).padStart(2, "0");

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    todayStr: `${yyyy}-${mm}-${dd}`,
  };
}

function increaseCount(map, userId, key) {
  if (!userId) return;

  if (!map[userId]) {
    map[userId] = {
      consultCount: 0,
      scheduleCount: 0,
      customerCount: 0,
    };
  }

  map[userId][key] += 1;
}

async function fetchRowsSafely(label, queryBuilder) {
  try {
    const { data, error } = await queryBuilder();

    if (error) {
      console.warn(`${label} 집계 실패:`, error.message);
      return [];
    }

    return data || [];
  } catch (error) {
    console.warn(`${label} 집계 예외:`, error.message);
    return [];
  }
}

async function loadTodayActivityCounts(userIds) {
  const ids = (userIds || []).filter(Boolean);

  const emptyResult = {
    byUserId: {},
    total: {
      consultCount: 0,
      scheduleCount: 0,
      customerCount: 0,
    },
  };

  if (ids.length === 0) return emptyResult;

  const { startIso, endIso, todayStr } = getTodayRange();
  const byUserId = {};

  const consultationRows = await fetchRowsSafely("상담기록", () =>
    supabase
      .from("consultations")
      .select("id, user_id, created_at")
      .in("user_id", ids)
      .gte("created_at", startIso)
      .lt("created_at", endIso)
  );

  consultationRows.forEach((row) => {
    increaseCount(byUserId, row.user_id, "consultCount");
  });

  let scheduleRows = await fetchRowsSafely("일정", () =>
    supabase
      .from("schedules")
      .select("id, user_id, scheduled_at")
      .in("user_id", ids)
      .gte("scheduled_at", startIso)
      .lt("scheduled_at", endIso)
  );

  if (scheduleRows.length === 0) {
    const fallbackScheduleRows = await fetchRowsSafely("일정(date fallback)", () =>
      supabase
        .from("schedules")
        .select("id, user_id, date")
        .in("user_id", ids)
        .eq("date", todayStr)
    );

    scheduleRows = fallbackScheduleRows;
  }

  scheduleRows.forEach((row) => {
    increaseCount(byUserId, row.user_id, "scheduleCount");
  });

  const customerRows = await fetchRowsSafely("고객등록", () =>
    supabase
      .from("customers")
      .select("id, user_id, created_at")
      .in("user_id", ids)
      .gte("created_at", startIso)
      .lt("created_at", endIso)
  );

  customerRows.forEach((row) => {
    increaseCount(byUserId, row.user_id, "customerCount");
  });

  const total = Object.values(byUserId).reduce(
    (acc, count) => ({
      consultCount: acc.consultCount + count.consultCount,
      scheduleCount: acc.scheduleCount + count.scheduleCount,
      customerCount: acc.customerCount + count.customerCount,
    }),
    {
      consultCount: 0,
      scheduleCount: 0,
      customerCount: 0,
    }
  );

  return {
    byUserId,
    total,
  };
}

function TeamPage({ onBack }) {
  const [activeTab, setActiveTab] = useState("status");
  const [teamManageTab, setTeamManageTab] = useState("members");
  const [viewMode, setViewMode] = useState("myteam");
  const [members, setMembers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [myRole, setMyRole] = useState("");
  const [myBranchId, setMyBranchId] = useState(null);
  const [managedOrgUnits, setManagedOrgUnits] = useState([]);
  const [selectedOrgUnitId, setSelectedOrgUnitId] = useState("");
  const [inviteCodes, setInviteCodes] = useState([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteCreating, setInviteCreating] = useState(false);
  const [inviteDeactivatingId, setInviteDeactivatingId] = useState("");
  const [inviteTargetRole, setInviteTargetRole] = useState("team_member");
  const [inviteExpiresInDays, setInviteExpiresInDays] = useState("14");
  const [inviteMaxUses, setInviteMaxUses] = useState("10");
  const [inviteMaxUsesMode, setInviteMaxUsesMode] = useState("limited");
  const [lastCreatedInvite, setLastCreatedInvite] = useState(null);

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

  const pageRef = useRef(null);
  const [isPhone, setIsPhone] = useState(false);

  useEffect(() => {
    const updateLayoutMode = () => {
      const pageWidth = pageRef.current?.getBoundingClientRect?.().width || 0;
      const viewportWidth =
        window.visualViewport?.width ||
        document.documentElement.clientWidth ||
        window.innerWidth;

      setIsPhone((pageWidth || viewportWidth) <= 768);
    };

    updateLayoutMode();

    const observer =
      typeof ResizeObserver !== "undefined" && pageRef.current
        ? new ResizeObserver(updateLayoutMode)
        : null;

    if (observer && pageRef.current) observer.observe(pageRef.current);

    window.addEventListener("resize", updateLayoutMode);
    window.visualViewport?.addEventListener("resize", updateLayoutMode);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateLayoutMode);
      window.visualViewport?.removeEventListener("resize", updateLayoutMode);
    };
  }, []);

  const pageStyles = useMemo(() => makeStyles(isPhone), [isPhone]);

  useEffect(() => {
    loadMembers();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    loadInviteAdminData();
  }, [currentUserId]);

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
      .select("id, user_id, name, role, role_name, parent_user_id, branch_id, status, photo_url, created_at, last_seen")
      .eq("user_id", user.id)
      .single();

    if (myProfileError) throw myProfileError;

    const { data: myUserRole, error: myUserRoleError } = await supabase
      .from("user_roles")
      .select("user_id, role, organization, branch, office, team")
      .eq("user_id", user.id)
      .maybeSingle();

    if (myUserRoleError) throw myUserRoleError;

    setMyRole(myProfile.role || "");
    setMyBranchId(myProfile.branch_id || null);

    if (myProfile?.branch_id) {
      await loadBranchSettings(myProfile.branch_id);
    }

    let branchData = null;

    if (myProfile?.branch_id) {
      const { data: foundBranch } = await supabase
        .from("branches")
        .select("id, name, division")
        .eq("id", myProfile.branch_id)
        .maybeSingle();

      branchData = foundBranch;
    }

    let scopedRoles = [];

    const { data: allProfilesData, error: allProfilesError } = await supabase
      .from("profiles")
      .select("id, user_id, name, role, role_name, parent_user_id, branch_id, status, photo_url, created_at, last_seen")
      .order("created_at", { ascending: true });

    if (allProfilesError) throw allProfilesError;

    const allProfiles = (allProfilesData || []).filter((m) => m.user_id);
    const rootUserId = getRootUserId(allProfiles, user.id);
    const orgUserIds = getDescendantUserIds(allProfiles, rootUserId, true);

    let profiles = allProfiles.filter((m) => orgUserIds.includes(m.user_id));

    if (profiles.length === 0 && myProfile?.branch_id) {
      profiles = allProfiles.filter((m) => m.branch_id === myProfile.branch_id);
    }

    if (profiles.length === 0) {
      profiles = allProfiles.filter((m) => m.user_id === user.id);
    }

    const profileUserIds = profiles.map((m) => m.user_id).filter(Boolean);

    if (profileUserIds.length > 0) {
      const { data: roleRows, error: roleRowsError } = await supabase
        .from("user_roles")
        .select("user_id, role, organization, branch, office, team")
        .in("user_id", profileUserIds);

      if (roleRowsError) throw roleRowsError;

      scopedRoles = roleRows || [];
    }

    const roleMap = {};
    scopedRoles.forEach((r) => {
      roleMap[r.user_id] = r;
    });

    const getRoleLabel = (profileRole, userRole, roleName) => {
      if (roleName) return roleName;
      if (userRole === "division_head") return "사업단장";
      if (userRole === "branch_head") return "본부장";
      if (userRole === "deputy_branch_head") return "부본부장";
      if (userRole === "office_head") return "지점장";
      if (userRole === "deputy_office_head") return "부지점장";
      if (userRole === "team_leader") return "팀장";
      if (userRole === "team_member") return "팀원";

      if (profileRole === "admin") return "관리자";
      if (profileRole === "manager") return "지점장";
      return "팀원";
    };

    const mapped = profiles.map((m) => {
      const roleInfo = roleMap[m.user_id] || {};

      return {
        id: m.id,
        user_id: m.user_id,
        photoUrl: m.photo_url || "",
        parentUserId: m.parent_user_id || "",
        roleName: m.role_name || "",
        name: m.name || "이름없음",
        role: getRoleLabel(m.role, roleInfo.role, m.role_name),

        division: roleInfo.organization || branchData?.division || "소속사업단",
        headquarters: roleInfo.branch || "",
        branch: roleInfo.office || branchData?.name || "소속지점",
        team: roleInfo.team || "",

        status: m.status || "상담중",
        phone: "",
        consultCount: 0,
        scheduleCount: 0,
        customerCount: 0,
        profile: (m.name || "?").charAt(0),
        lastSeen:
  m.last_seen &&
  Date.now() - new Date(m.last_seen).getTime() < 5 * 60 * 1000
    ? "접속중"
    : "미접속",
        branch_id: m.branch_id,
      };
    });

    const activityCounts = await loadTodayActivityCounts(
      mapped.map((m) => m.user_id)
    );

    const mappedWithActivity = mapped.map((member) => {
      const count = activityCounts.byUserId[member.user_id] || {};

      return {
        ...member,
        consultCount: count.consultCount || 0,
        scheduleCount: count.scheduleCount || 0,
        customerCount: count.customerCount || 0,
      };
    });

    setMembers(mappedWithActivity);
    setLadderSelected(mappedWithActivity.map((m) => m.id));

    setLadderEmojiMap((prev) => {
      const next = { ...prev };

      mappedWithActivity.forEach((m, index) => {
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

  async function loadInviteAdminData(preferredOrgUnitId = selectedOrgUnitId) {
    setInviteLoading(true);

    try {
      const orgUnits = await inviteService.listManagedOrganizationUnits();
      const nextOrgUnitId =
        preferredOrgUnitId && orgUnits.some((unit) => unit.id === preferredOrgUnitId)
          ? preferredOrgUnitId
          : orgUnits[0]?.id || "";

      setManagedOrgUnits(orgUnits);
      setSelectedOrgUnitId(nextOrgUnitId);

      if (nextOrgUnitId) {
        const invites = await inviteService.listInviteCodes(nextOrgUnitId);
        setInviteCodes(invites);
      } else {
        setInviteCodes([]);
      }
    } catch (error) {
      console.warn("초대코드 관리 정보를 불러오지 못했습니다:", error.message);
      setManagedOrgUnits([]);
      setInviteCodes([]);
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleSelectOrgUnit(orgUnitId) {
    setSelectedOrgUnitId(orgUnitId);
    setInviteLoading(true);

    try {
      const invites = orgUnitId ? await inviteService.listInviteCodes(orgUnitId) : [];
      setInviteCodes(invites);
    } catch (error) {
      alert(error.message || "초대코드 목록을 불러오지 못했습니다.");
      setInviteCodes([]);
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleCreateInviteCode() {
    if (!selectedOrgUnitId) {
      alert("초대할 조직을 선택해주세요.");
      return;
    }

    const maxUses =
      inviteMaxUsesMode === INVITE_UNLIMITED_VALUE
        ? null
        : inviteMaxUses.trim()
          ? Number(inviteMaxUses)
          : null;

    if (inviteMaxUsesMode !== INVITE_UNLIMITED_VALUE && maxUses === null) {
      alert("가입 가능 인원을 입력하거나 제한 없음을 선택해주세요.");
      return;
    }

    if (
      maxUses !== null &&
      (!Number.isInteger(maxUses) || maxUses <= 0 || maxUses > INVITE_MAX_USES_LIMIT)
    ) {
      alert(`가입 가능 인원은 1명 이상 ${INVITE_MAX_USES_LIMIT}명 이하로 입력해주세요.`);
      return;
    }

    const expiresAt =
      inviteExpiresInDays === "none"
        ? null
        : new Date(Date.now() + Number(inviteExpiresInDays) * 24 * 60 * 60 * 1000).toISOString();

    setInviteCreating(true);
    setLastCreatedInvite(null);

    try {
      const invite = await inviteService.createInviteCode({
        orgUnitId: selectedOrgUnitId,
        targetRole: inviteTargetRole,
        expiresAt,
        maxUses,
      });

      const selectedUnit = managedOrgUnits.find((unit) => unit.id === selectedOrgUnitId);
      const enrichedInvite = {
        ...invite,
        org_unit_name: selectedUnit?.name || invite?.org_unit_name,
        org_path_names: selectedUnit?.path_names || [],
      };

      setLastCreatedInvite(enrichedInvite);
      await loadInviteAdminData(selectedOrgUnitId);
    } catch (error) {
      alert(error.message || "초대코드를 생성하지 못했습니다.");
    } finally {
      setInviteCreating(false);
    }
  }

  async function copyInviteText(text, successMessage) {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      alert(successMessage);
    } catch (error) {
      window.prompt("아래 내용을 복사해주세요.", text);
    }
  }

  function buildInviteMessage(invite) {
    const orgName = getOrgPathLabel(invite);
    const inviteUrl = buildInviteUrl(invite?.code);

    return [
      "[보플랜 초대]",
      `${orgName}에서 보플랜으로 초대했습니다.`,
      "보플랜은 보험설계사용 고객관리 CRM입니다.",
      "",
      `초대코드: ${invite.code}`,
      `가입 링크: ${inviteUrl}`,
      "",
      "링크로 가입하면 초대코드가 자동 입력됩니다.",
    ].join("\n");
  }

  async function handleShareInviteWithKakao(invite) {
    if (!invite?.code) return;

    const orgName = getOrgPathLabel(invite);
    const inviteUrl = buildInviteUrl(invite.code);
    const message = buildInviteMessage(invite);

    try {
      const canUseKakaoShare = await loadKakaoSdk();

      if (canUseKakaoShare && window.Kakao?.Share) {
        window.Kakao.Share.sendDefault({
          objectType: "feed",
          content: {
            title: "보플랜 조직 초대",
            description: `${orgName}에서 보플랜으로 초대했습니다. 초대코드: ${invite.code}`,
            imageUrl: `${new URL("/boplan512.png", inviteUrl).origin}/boplan512.png`,
            link: {
              mobileWebUrl: inviteUrl,
              webUrl: inviteUrl,
            },
          },
          buttons: [
            {
              title: "초대코드로 가입하기",
              link: {
                mobileWebUrl: inviteUrl,
                webUrl: inviteUrl,
              },
            },
          ],
        });
        return;
      }

      if (navigator.share) {
        await navigator.share({
          title: "보플랜 조직 초대",
          text: message,
          url: inviteUrl,
        });
        return;
      }

      await copyInviteText(message, "카카오톡 공유를 사용할 수 없어 초대 메시지를 복사했습니다.");
    } catch (error) {
      if (String(error?.name || "").toLowerCase().includes("abort")) return;
      await copyInviteText(message, "카카오톡 공유를 사용할 수 없어 초대 메시지를 복사했습니다.");
    }
  }

  async function handleDeactivateInvite(inviteId) {
    if (!window.confirm("이 초대코드를 비활성화할까요? 비활성화 후에는 사용할 수 없습니다.")) {
      return;
    }

    setInviteDeactivatingId(inviteId);

    try {
      await inviteService.deactivateInviteCode(inviteId);
      await loadInviteAdminData(selectedOrgUnitId);
    } catch (error) {
      alert(error.message || "초대코드를 비활성화하지 못했습니다.");
    } finally {
      setInviteDeactivatingId("");
    }
  }

  function renderInviteManagementSection() {
    if (!showInviteManagement) {
      return (
        <div style={pageStyles.card}>
          <div style={pageStyles.sectionTitle}>초대코드 관리</div>
          <div style={pageStyles.emptyInviteBox}>
            초대코드 관리 권한을 확인하는 중이거나 관리 가능한 조직이 없습니다.
          </div>
        </div>
      );
    }

    return (
      <div style={pageStyles.card}>
        <div style={pageStyles.cardTitleRow}>
          <div>
            <div style={pageStyles.sectionTitle}>초대코드 관리</div>
            <div style={pageStyles.sectionSub}>
              내가 관리 가능한 조직에 팀원을 초대합니다.
            </div>
          </div>
          <button
            type="button"
            onClick={() => loadInviteAdminData(selectedOrgUnitId)}
            style={pageStyles.editMiniButton}
            disabled={inviteLoading}
          >
            새로고침
          </button>
        </div>

        {managedOrgUnits.length === 0 ? (
          <div style={pageStyles.emptyInviteBox}>
            {inviteLoading
              ? "초대코드 관리 정보를 불러오는 중입니다."
              : "관리 가능한 조직이 없습니다."}
          </div>
        ) : (
          <>
            <label style={pageStyles.inviteLabel}>대상 조직</label>
            <select
              value={selectedOrgUnitId}
              onChange={(e) => handleSelectOrgUnit(e.target.value)}
              style={pageStyles.inviteSelect}
            >
              {managedOrgUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {getOrgPathLabel(unit)}
                </option>
              ))}
            </select>

            <div style={pageStyles.inviteFormGrid}>
              <div>
                <label style={pageStyles.inviteLabel}>부여 역할</label>
                <select
                  value={inviteTargetRole}
                  onChange={(e) => setInviteTargetRole(e.target.value)}
                  style={pageStyles.inviteSelect}
                >
                  {INVITE_ROLE_OPTIONS.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={pageStyles.inviteLabel}>유효기간</label>
                <select
                  value={inviteExpiresInDays}
                  onChange={(e) => setInviteExpiresInDays(e.target.value)}
                  style={pageStyles.inviteSelect}
                >
                  {INVITE_EXPIRE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label style={pageStyles.inviteLabel}>가입 가능 인원</label>
            <div style={pageStyles.inviteUsageControl}>
              <label style={pageStyles.inviteRadioLabel}>
                <input
                  type="radio"
                  name="inviteMaxUsesMode"
                  checked={inviteMaxUsesMode === "limited"}
                  onChange={() => setInviteMaxUsesMode("limited")}
                  style={{ accentColor: COLORS.primary }}
                />
                인원 지정
              </label>
              <label style={pageStyles.inviteRadioLabel}>
                <input
                  type="radio"
                  name="inviteMaxUsesMode"
                  checked={inviteMaxUsesMode === INVITE_UNLIMITED_VALUE}
                  onChange={() => setInviteMaxUsesMode(INVITE_UNLIMITED_VALUE)}
                  style={{ accentColor: COLORS.primary }}
                />
                제한 없음
              </label>
            </div>

            {inviteMaxUsesMode === "limited" && (
              <input
                type="number"
                min="1"
                max={INVITE_MAX_USES_LIMIT}
                inputMode="numeric"
                value={inviteMaxUses}
                onChange={(e) => setInviteMaxUses(e.target.value)}
                placeholder="예: 10"
                style={pageStyles.input}
              />
            )}

            {inviteMaxUsesMode === INVITE_UNLIMITED_VALUE && (
              <div style={pageStyles.inviteHelpText}>
                가입 인원 제한은 없지만, 선택한 유효기간이 지나면 초대코드는 만료됩니다.
              </div>
            )}

            <button
              type="button"
              onClick={handleCreateInviteCode}
              disabled={inviteCreating}
              style={pageStyles.primaryButton}
            >
              {inviteCreating ? "초대코드 생성 중..." : "초대코드 생성"}
            </button>

            {lastCreatedInvite?.code && (
              <div style={pageStyles.createdInviteBox}>
                <div style={pageStyles.inviteLabel}>생성된 초대코드</div>
                <div style={pageStyles.createdInviteCode}>{lastCreatedInvite.code}</div>
                <div style={pageStyles.createdInviteNotice}>
                  보안을 위해 코드 원문은 지금만 표시됩니다. 목록에서는 다시 조회할 수 없습니다.
                </div>
                <div style={pageStyles.inviteButtonRow}>
                  <button
                    type="button"
                    style={pageStyles.inviteOutlineButton}
                    onClick={() => copyInviteText(lastCreatedInvite.code, "초대코드를 복사했습니다.")}
                  >
                    코드 복사
                  </button>
                  <button
                    type="button"
                    style={pageStyles.inviteKakaoButton}
                    onClick={() => handleShareInviteWithKakao(lastCreatedInvite)}
                  >
                    카카오톡으로 초대
                  </button>
                </div>
              </div>
            )}

            <div style={{ marginTop: 18 }}>
              <div style={pageStyles.cardTitleRow}>
                <div style={pageStyles.sectionTitle}>활성 초대코드 목록</div>
                <div style={pageStyles.sectionSub}>{selectedOrgUnit?.name || ""}</div>
              </div>

              {inviteLoading ? (
                <div style={pageStyles.emptyInviteBox}>초대코드를 불러오는 중입니다.</div>
              ) : inviteCodes.length === 0 ? (
                <div style={pageStyles.emptyInviteBox}>생성된 초대코드가 없습니다.</div>
              ) : (
                <div style={pageStyles.inviteList}>
                  {inviteCodes.map((invite) => {
                    const statusStyle = getInviteStatusStyle(invite.status);

                    return (
                      <div key={invite.id} style={pageStyles.inviteItem}>
                        <div style={pageStyles.inviteItemTop}>
                          <div>
                            <div style={pageStyles.inviteOrgName}>
                              {getOrgPathLabel(invite)}
                            </div>
                            <div style={pageStyles.inviteMeta}>
                              생성 {formatInviteDate(invite.created_at)}
                            </div>
                          </div>
                          <span style={{ ...pageStyles.inviteStatusBadge, ...statusStyle }}>
                            {getInviteStatusLabel(invite.status)}
                          </span>
                        </div>

                        <div style={pageStyles.inviteMetaGrid}>
                          <span>만료: {formatInviteDate(invite.expires_at)}</span>
                          <span>{getInviteUsageLabel(invite)}</span>
                          <span>역할: {invite.target_role}</span>
                        </div>

                        {invite.status === "active" && (
                          <button
                            type="button"
                            style={pageStyles.inviteDangerButton}
                            disabled={inviteDeactivatingId === invite.id}
                            onClick={() => handleDeactivateInvite(invite.id)}
                          >
                            {inviteDeactivatingId === invite.id ? "비활성화 중..." : "초대코드 취소"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
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
  const myTeamMembers = useMemo(() => {
    if (!currentUserId) return members;

    const userIds = getDescendantUserIds(members, currentUserId, true);
    const filtered = members.filter((m) => userIds.includes(m.user_id));

    return filtered.length > 0 ? filtered : members.filter((m) => m.user_id === currentUserId);
  }, [members, currentUserId]);

  const visibleMembers = useMemo(() => {
    return viewMode === "myteam" ? myTeamMembers : members;
  }, [viewMode, myTeamMembers, members]);

  const selectedMembers = visibleMembers.filter((m) => ladderSelected.includes(m.id));

  const ranking = useMemo(() => {
    return [...visibleMembers]
      .map((m) => ({
        ...m,
        point: m.consultCount * 5 + m.scheduleCount * 3 + m.customerCount * 10,
      }))
      .sort((a, b) => b.point - a.point);
  }, [visibleMembers]);

  const activitySummary = useMemo(() => {
    const consult = visibleMembers.reduce((sum, m) => sum + m.consultCount, 0);
    const schedule = visibleMembers.reduce((sum, m) => sum + m.scheduleCount, 0);
    const customer = visibleMembers.reduce((sum, m) => sum + m.customerCount, 0);
    return {
      consult,
      schedule,
      customer,
      total: consult + schedule + customer,
    };
  }, [visibleMembers]);

  const statusSummary = useMemo(() => {
    return STATUS_LIST.map((status) => ({
      ...status,
      count: visibleMembers.filter((m) => m.status === status.key).length,
    })).filter((s) => s.count > 0);
  }, [visibleMembers]);

  const showInviteManagement = inviteLoading || managedOrgUnits.length > 0;
  const selectedOrgUnit = managedOrgUnits.find((unit) => unit.id === selectedOrgUnitId);

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
    <div ref={pageRef} style={pageStyles.page}>
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg) scale(0.7); opacity: 0; }
        }
      `}</style>

      {showConfetti && (
        <div style={pageStyles.confettiWrap}>
          {Array.from({ length: 28 }).map((_, i) => (
            <span
              key={i}
              style={{
                ...pageStyles.confetti,
                left: `${(i * 37) % 100}%`,
                animationDelay: `${(i % 8) * 0.08}s`,
              }}
            >
              🎉
            </span>
          ))}
        </div>
      )}

      <div style={pageStyles.header}>
        <div>
          <div style={pageStyles.title}>팀관리</div>
          <div style={pageStyles.subtitle}>팀 현황 · 랭킹 · 사다리 · 룰렛</div>
        </div>
      </div>

      <div style={pageStyles.tabWrap}>
        {[
          ["status", "현황"],
          ["ranking", "랭킹"],
          ["ladder", "사다리"],
          ["roulette", "룰렛"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            style={activeTab === key ? pageStyles.activeTab : pageStyles.tab}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={pageStyles.scopeToggleWrap}>
        <button
          type="button"
          onClick={() => setViewMode("myteam")}
          style={viewMode === "myteam" ? pageStyles.scopeToggleActive : pageStyles.scopeToggle}
        >
          👥 내 팀 {myTeamMembers.length}명
        </button>

        <button
          type="button"
          onClick={() => setViewMode("org")}
          style={viewMode === "org" ? pageStyles.scopeToggleActive : pageStyles.scopeToggle}
        >
          🏢 전체 조직 {members.length}명
        </button>
      </div>

      {activeTab === "status" && showInviteManagement && (
        <div style={pageStyles.managementTabWrap}>
          <button
            type="button"
            onClick={() => setTeamManageTab("members")}
            style={teamManageTab === "members" ? pageStyles.managementTabActive : pageStyles.managementTab}
          >
            팀원 관리
          </button>
          <button
            type="button"
            onClick={() => setTeamManageTab("invites")}
            style={teamManageTab === "invites" ? pageStyles.managementTabActive : pageStyles.managementTab}
          >
            초대코드 관리
          </button>
        </div>
      )}

      {activeTab === "status" && teamManageTab === "members" && (
        <>
          <section style={pageStyles.summaryGrid}>
            {statusSummary.map((status) => (
              <div key={status.key} style={pageStyles.summaryCard}>
                <div style={{ ...pageStyles.summaryIcon, background: status.bg, color: status.color }}>
                  {status.icon}
                </div>
                <div>
                  <div style={pageStyles.summaryLabel}>{status.key}</div>
                  <div style={pageStyles.summaryCount}>{status.count}명</div>
                </div>
              </div>
            ))}

            <div style={pageStyles.summaryCard}>
              <div style={{ ...pageStyles.summaryIcon, background: COLORS.light, color: COLORS.primary }}>👥</div>
              <div>
                <div style={pageStyles.summaryLabel}>전체 조직</div>
                <div style={pageStyles.summaryCount}>{members.length}명</div>
              </div>
            </div>
          </section>

          <section style={pageStyles.statusLayout}>
            <div style={pageStyles.card}>
              <div style={pageStyles.cardHeader}>
                <div>
                  <div style={pageStyles.sectionTitle}>팀원 현황</div>
                  <div style={pageStyles.sectionSub}>{viewMode === "myteam" ? "내 팀" : "전체 조직"} {visibleMembers.length}명</div>
                </div>
              </div>

              <div style={pageStyles.memberList}>
                {visibleMembers.map((member) => {
                  const meta = getStatusMeta(member.status);

                  return (
                    <div key={member.id} style={pageStyles.memberRow}>
                      <div style={pageStyles.profileAvatar}>
                        {member.photoUrl ? (
                          <img
                            src={member.photoUrl}
                            alt={member.name}
                            style={pageStyles.profileAvatarImage}
                          />
                        ) : (
                          member.profile
                        )}
                      </div>

                      <div style={pageStyles.memberInfo}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={pageStyles.memberName}>{member.name}</div>

                          <span style={pageStyles.roleBadge}>
                            {member.role}
                          </span>
                        </div>

                        <div style={pageStyles.memberRole}>
                          <div>🏢 {member.division}</div>
{member.headquarters && <div>🏬 {member.headquarters}</div>}
<div>📍 {member.branch}</div>

                        </div>

                        <div style={pageStyles.memberActivityLine}>
                          <span>💬 {member.consultCount}</span>
                          <span>📅 {member.scheduleCount}</span>
                          <span>👤 {member.customerCount}</span>
                        </div>
                      </div>

                      <div style={pageStyles.statusLine}>
                        {member.user_id === currentUserId ? (
                          <div style={pageStyles.statusSelectWrap}>
                            <select
                              value={member.status}
                              onChange={(e) => updateStatus(member.id, e.target.value)}
                              style={{
                                ...pageStyles.statusSelect,
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

                            <span style={pageStyles.statusArrow}>⌄</span>
                          </div>
                        ) : (
                          <div
                            style={{
                              ...pageStyles.statusViewOnly,
                              background: meta.bg,
                              color: meta.color,
                            }}
                          >
                            {meta.icon} {member.status}
                          </div>
                        )}

                        <div
                          style={{
                            ...pageStyles.lastSeen,
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

            <div style={pageStyles.sideStack}>
              <div style={pageStyles.card}>
                <div style={pageStyles.sectionTitle}>오늘 활동 요약</div>
                <div style={pageStyles.activityGrid}>
                  <div style={pageStyles.activityCard}>
                    <span>💬</span>
                    <b>{activitySummary.consult}건</b>
                    <small>상담기록</small>
                  </div>
                  <div style={pageStyles.activityCard}>
                    <span>📅</span>
                    <b>{activitySummary.schedule}건</b>
                    <small>일정완료</small>
                  </div>
                  <div style={pageStyles.activityCard}>
                    <span>👤</span>
                    <b>{activitySummary.customer}건</b>
                    <small>고객등록</small>
                  </div>
                  <div style={pageStyles.activityCard}>
                    <span>🚩</span>
                    <b>{activitySummary.total}건</b>
                    <small>전체활동</small>
                  </div>
                </div>
              </div>

              <div style={pageStyles.missionCard}>
                <div style={pageStyles.cardTitleRow}>
                  <div style={pageStyles.sectionTitle}>🎯 오늘의 미션</div>

                  {isManager && !editingMission && (
                    <button
                      type="button"
                      onClick={startEditMission}
                      style={pageStyles.editMiniButtonLight}
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
      style={pageStyles.missionInput}
      placeholder="오늘의 미션을 입력하세요"
    />

    <div style={pageStyles.editButtonRow}>
      <button type="button" onClick={cancelEditMission} style={pageStyles.cancelButton}>
        취소
      </button>

      <button type="button" onClick={saveMission} style={pageStyles.saveButton}>
        저장
      </button>
    </div>
  </>
) : (
  <div style={pageStyles.missionText}>{missionText}</div>
)}

                <div style={pageStyles.missionSub}>완료율 60%</div>
                <div style={pageStyles.progressBg}>
                  <div style={pageStyles.progressBar} />
                </div>
              </div>

              <div style={pageStyles.teamCard}>
                <div style={pageStyles.cardTitleRow}>
                  <div style={pageStyles.sectionTitle}>📢 팀 한마디</div>

                  {isManager && !editingMessage && (
                    <button
                      type="button"
                      onClick={startEditMessage}
                      style={pageStyles.editMiniButton}
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
                      style={pageStyles.teamMessageInput}
                      placeholder="팀 한마디를 입력하세요"
                    />

                    <div style={pageStyles.editButtonRow}>
                      <button type="button" onClick={cancelEditMessage} style={pageStyles.cancelButton}>
                        취소
                      </button>

                      <button type="button" onClick={saveMessage} style={pageStyles.saveButton}>
  저장
</button>
                    </div>
                  </>
                ) : (
                  <div style={pageStyles.teamMessage}>{teamMessage}</div>
                )}
              </div>

              {false && showInviteManagement && (
                <div style={pageStyles.card}>
                  <div style={pageStyles.cardTitleRow}>
                    <div>
                      <div style={pageStyles.sectionTitle}>초대코드 관리</div>
                      <div style={pageStyles.sectionSub}>
                        내가 관리 가능한 조직에 팀원을 초대합니다.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => loadInviteAdminData(selectedOrgUnitId)}
                      style={pageStyles.editMiniButton}
                      disabled={inviteLoading}
                    >
                      새로고침
                    </button>
                  </div>

                  {managedOrgUnits.length === 0 ? (
                    <div style={pageStyles.emptyInviteBox}>
                      {inviteLoading
                        ? "초대코드 관리 정보를 불러오는 중입니다."
                        : "관리 가능한 조직이 없습니다."}
                    </div>
                  ) : (
                    <>
                      <label style={pageStyles.inviteLabel}>대상 조직</label>
                      <select
                        value={selectedOrgUnitId}
                        onChange={(e) => handleSelectOrgUnit(e.target.value)}
                        style={pageStyles.inviteSelect}
                      >
                        {managedOrgUnits.map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {getOrgPathLabel(unit)}
                          </option>
                        ))}
                      </select>

                      <div style={pageStyles.inviteFormGrid}>
                        <div>
                          <label style={pageStyles.inviteLabel}>부여 역할</label>
                          <select
                            value={inviteTargetRole}
                            onChange={(e) => setInviteTargetRole(e.target.value)}
                            style={pageStyles.inviteSelect}
                          >
                            {INVITE_ROLE_OPTIONS.map((role) => (
                              <option key={role.value} value={role.value}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={pageStyles.inviteLabel}>유효기간</label>
                          <select
                            value={inviteExpiresInDays}
                            onChange={(e) => setInviteExpiresInDays(e.target.value)}
                            style={pageStyles.inviteSelect}
                          >
                            {INVITE_EXPIRE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <label style={pageStyles.inviteLabel}>최대 사용 횟수</label>
                      <input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        value={inviteMaxUses}
                        onChange={(e) => setInviteMaxUses(e.target.value)}
                        placeholder="예: 10"
                        style={pageStyles.input}
                      />

                      <button
                        type="button"
                        onClick={handleCreateInviteCode}
                        disabled={inviteCreating}
                        style={pageStyles.primaryButton}
                      >
                        {inviteCreating ? "초대코드 생성 중..." : "초대코드 생성"}
                      </button>

                      {lastCreatedInvite?.code && (
                        <div style={pageStyles.createdInviteBox}>
                          <div style={pageStyles.inviteLabel}>생성된 초대코드</div>
                          <div style={pageStyles.createdInviteCode}>{lastCreatedInvite.code}</div>
                          <div style={pageStyles.createdInviteNotice}>
                            보안을 위해 코드 원문은 지금만 표시됩니다. 목록에서는 다시 조회할 수 없습니다.
                          </div>
                          <div style={pageStyles.inviteButtonRow}>
                            <button
                              type="button"
                              style={pageStyles.inviteOutlineButton}
                              onClick={() => copyInviteText(lastCreatedInvite.code, "초대코드를 복사했습니다.")}
                            >
                              코드 복사
                            </button>
                            <button
                              type="button"
                              style={pageStyles.inviteOutlineButton}
                              onClick={() =>
                                copyInviteText(
                                  buildInviteMessage(lastCreatedInvite),
                                  "초대 메시지를 복사했습니다."
                                )
                              }
                            >
                              초대 메시지 복사
                            </button>
                          </div>
                        </div>
                      )}

                      <div style={{ marginTop: 18 }}>
                        <div style={pageStyles.cardTitleRow}>
                          <div style={pageStyles.sectionTitle}>활성 초대코드 목록</div>
                          <div style={pageStyles.sectionSub}>{selectedOrgUnit?.name || ""}</div>
                        </div>

                        {inviteLoading ? (
                          <div style={pageStyles.emptyInviteBox}>초대코드를 불러오는 중입니다.</div>
                        ) : inviteCodes.length === 0 ? (
                          <div style={pageStyles.emptyInviteBox}>생성된 초대코드가 없습니다.</div>
                        ) : (
                          <div style={pageStyles.inviteList}>
                            {inviteCodes.map((invite) => {
                              const statusStyle = getInviteStatusStyle(invite.status);
                              const maxUsesText = invite.max_uses ?? "무제한";

                              return (
                                <div key={invite.id} style={pageStyles.inviteItem}>
                                  <div style={pageStyles.inviteItemTop}>
                                    <div>
                                      <div style={pageStyles.inviteOrgName}>
                                        {getOrgPathLabel(invite)}
                                      </div>
                                      <div style={pageStyles.inviteMeta}>
                                        생성 {formatInviteDate(invite.created_at)}
                                      </div>
                                    </div>
                                    <span style={{ ...pageStyles.inviteStatusBadge, ...statusStyle }}>
                                      {getInviteStatusLabel(invite.status)}
                                    </span>
                                  </div>

                                  <div style={pageStyles.inviteMetaGrid}>
                                    <span>만료: {formatInviteDate(invite.expires_at)}</span>
                                    <span>
                                      사용: {invite.used_count}/{maxUsesText}
                                    </span>
                                    <span>역할: {invite.target_role}</span>
                                  </div>

                                  {invite.status === "active" && (
                                    <button
                                      type="button"
                                      style={pageStyles.inviteDangerButton}
                                      disabled={inviteDeactivatingId === invite.id}
                                      onClick={() => handleDeactivateInvite(invite.id)}
                                    >
                                      {inviteDeactivatingId === invite.id ? "비활성화 중..." : "초대코드 취소"}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {activeTab === "status" && teamManageTab === "invites" && (
        <section style={pageStyles.inviteManagementLayout}>
          {renderInviteManagementSection()}
        </section>
      )}

      {activeTab === "ranking" && (
        <section style={pageStyles.card}>
          <div style={pageStyles.sectionTitle}>🏆 오늘의 활동 랭킹</div>
          <div style={pageStyles.sectionSub}>상담기록 + 일정완료 + 고객등록 기준</div>

          {ranking.map((member, index) => (
            <div key={member.id} style={pageStyles.rankItem}>
              <div style={pageStyles.rankNo}>
                {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
              </div>
              <div style={pageStyles.profileAvatarSmall}>
                {member.photoUrl ? (
                  <img
                    src={member.photoUrl}
                    alt={member.name}
                    style={pageStyles.profileAvatarSmallImage}
                  />
                ) : (
                  member.profile
                )}
              </div>
             <div style={{ flex: 1, minWidth: 0 }}>
  <div style={pageStyles.rankOrgLine}>
  📍 {member.branch} · {member.name}
</div>

  <div style={pageStyles.memberRole}>
    상담 {member.consultCount}건 · 일정 {member.scheduleCount}건 · 고객 {member.customerCount}건
  </div>
</div>
              <div style={pageStyles.rankCount}>{member.point}P</div>
            </div>
          ))}
        </section>
      )}

      {activeTab === "ladder" && (
        <section style={pageStyles.card}>
          <div style={pageStyles.sectionTitle}>🪜 캐릭터 사다리타기</div>
          <div style={pageStyles.sectionSub}>캐릭터가 한 칸씩 움직이면서 내려가요</div>

          <div style={pageStyles.checkList}>
            {visibleMembers.map((member) => (
              <div key={member.id} style={pageStyles.ladderMemberBox}>
                <label style={pageStyles.checkItem}>
                  <input
                    type="checkbox"
                    checked={ladderSelected.includes(member.id)}
                    onChange={() => toggleLadderMember(member.id)}
                  />
                  <span>{ladderEmojiMap[member.id] || "🐰"} {member.name}</span>
                </label>

                <div style={pageStyles.emojiWrap}>
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      style={ladderEmojiMap[member.id] === emoji ? pageStyles.emojiActive : pageStyles.emojiBtn}
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
            style={pageStyles.input}
          />

          <div style={pageStyles.ladderStage}>
            <div style={pageStyles.ladderInner}>
              {selectedMembers.map((member, index) => {
                const left = getColLeft(index, selectedMembers.length);
                return (
                  <React.Fragment key={member.id}>
                    <div style={{ ...pageStyles.ladderName, left: `${left}%` }}>
                      <div>{ladderEmojiMap[member.id] || "🐰"}</div>
                      <b>{member.name}</b>
                    </div>
                    <div style={{ ...pageStyles.ladderVertical, left: `${left}%` }} />
                    <div
                      style={{
                        ...pageStyles.ladderGift,
                        left: `${left}%`,
                        ...(liveLadderResults[member.id] === "winner"
                          ? pageStyles.ladderGiftWinner
                          : liveLadderResults[member.id] === "safe"
                          ? pageStyles.ladderGiftSafe
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
                      ...pageStyles.ladderHorizontal,
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
                    ...pageStyles.runner,
                    left: `${getColLeft(runner.x, selectedMembers.length)}%`,
                    top: `${runner.y}%`,
                  }}
                >
                  {runner.emoji}
                </div>
              )}
            </div>
          </div>

          <button style={pageStyles.primaryButton} onClick={drawLadder} disabled={ladderRunning}>
            {ladderRunning ? "사다리 타는 중..." : "출발하기"}
          </button>

          {ladderResult && (
            <div style={pageStyles.resultLineBox}>
              ☠️ 오늘의 희생양: <b>{ladderResult.winner.name}</b>
              <span style={pageStyles.resultDivider}>|</span>
              😆 무사생환: <b>{ladderResult.survivors.map((m) => m.name).join(", ") || "없음"}</b>
              <span style={pageStyles.resultDivider}>|</span>
              ☕ <b>{ladderResult.penalty}</b>
            </div>
          )}
        </section>
      )}

      {activeTab === "roulette" && (
        <section style={pageStyles.card}>
          <div style={pageStyles.sectionTitle}>🎰 돌아가는 룰렛</div>
          <div style={pageStyles.sectionSub}>점심메뉴 / 벌칙 / 간식 뽑기용</div>

          <div style={pageStyles.rouletteWrap}>
            <div style={pageStyles.pointer}>▼</div>

            <svg viewBox="0 0 320 320" style={{ ...pageStyles.rouletteSvg, transform: `rotate(${rouletteDeg}deg)` }}>
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

          <div style={pageStyles.inputRow}>
            <input
              value={rouletteInput}
              onChange={(e) => setRouletteInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addRouletteItem()}
              placeholder="항목 입력"
              style={pageStyles.input}
            />
            <button style={pageStyles.smallButton} onClick={addRouletteItem}>추가</button>
          </div>

          <div style={pageStyles.itemWrap}>
            {rouletteItems.map((item, index) => (
              <button key={`${item}-${index}`} style={pageStyles.itemChip} onClick={() => removeRouletteItem(index)}>
                {item} ✕
              </button>
            ))}
          </div>

          <button style={pageStyles.primaryButton} onClick={spinRoulette} disabled={rouletteRunning}>
            {rouletteRunning ? "돌아가는 중..." : "룰렛 돌리기"}
          </button>

          {rouletteResult && (
            <div style={pageStyles.resultBox}>
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

function formatInviteDate(value) {
  if (!value) return "없음";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "없음";

  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInviteStatusLabel(status) {
  if (status === "active") return "사용 가능";
  if (status === "expired") return "만료";
  if (status === "completed") return "사용 완료";
  if (status === "inactive") return "비활성";
  return status || "-";
}

function getInviteStatusStyle(status) {
  if (status === "active") return { background: "#DCFCE7", color: "#16A34A" };
  if (status === "expired") return { background: "#FEF3C7", color: "#D97706" };
  if (status === "completed") return { background: "#DBEAFE", color: "#2563EB" };
  return { background: "#FEE2E2", color: "#DC2626" };
}

function getOrgPathLabel(unit) {
  const names = unit?.path_names || unit?.org_path_names || [];
  return names.length > 0 ? names.join(" > ") : unit?.name || unit?.org_unit_name || "-";
}

function buildInviteUrl(code) {
  const baseUrl =
    process.env.REACT_APP_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "https://www.boplan.kr");
  const url = new URL("/signup", baseUrl);
  if (code) url.searchParams.set("invite", code);
  return url.toString();
}

function getInviteUsageLabel(invite) {
  const usedCount = invite?.used_count ?? 0;
  if (invite?.max_uses == null) return `가입 ${usedCount} / 제한 없음`;
  return `가입 ${usedCount} / ${invite.max_uses}명`;
}

function getKakaoJavascriptKey() {
  return process.env.REACT_APP_KAKAO_JAVASCRIPT_KEY || process.env.REACT_APP_KAKAO_JS_KEY || "";
}

function loadKakaoSdk() {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Kakao?.Share) return Promise.resolve(true);

  const javascriptKey = getKakaoJavascriptKey();
  if (!javascriptKey) return Promise.resolve(false);

  return new Promise((resolve) => {
    const existingScript = document.querySelector(`script[src="${KAKAO_SDK_URL}"]`);
    const initialize = () => {
      try {
        if (window.Kakao && !window.Kakao.isInitialized()) {
          window.Kakao.init(javascriptKey);
        }
        resolve(Boolean(window.Kakao?.Share));
      } catch {
        resolve(false);
      }
    };

    if (existingScript) {
      existingScript.addEventListener("load", initialize, { once: true });
      existingScript.addEventListener("error", () => resolve(false), { once: true });
      initialize();
      return;
    }

    const script = document.createElement("script");
    script.src = KAKAO_SDK_URL;
    script.async = true;
    script.onload = initialize;
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}


const makeStyles = (isPhone) => ({
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

  scopeToggleWrap: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 8,
    marginBottom: 14,
  },

  scopeToggle: {
    border: `1px solid ${COLORS.border}`,
    background: COLORS.white,
    color: COLORS.sub,
    padding: "11px 8px",
    borderRadius: 16,
    fontWeight: 900,
    fontSize: isPhone ? 12 : 13,
    cursor: "pointer",
  },

  scopeToggleActive: {
    border: `1px solid ${COLORS.primary}`,
    background: COLORS.light,
    color: COLORS.primaryDark,
    padding: "11px 8px",
    borderRadius: 16,
    fontWeight: 900,
    fontSize: isPhone ? 12 : 13,
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(124,58,237,0.12)",
  },

  managementTabWrap: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 8,
    marginBottom: 14,
    padding: 4,
    borderRadius: 18,
    background: "#EDE9FE",
  },

  managementTab: {
    border: "none",
    background: "transparent",
    color: COLORS.sub,
    padding: "11px 8px",
    borderRadius: 14,
    fontSize: isPhone ? 12 : 13,
    fontWeight: 900,
    cursor: "pointer",
  },

  managementTabActive: {
    border: "none",
    background: COLORS.white,
    color: COLORS.primaryDark,
    padding: "11px 8px",
    borderRadius: 14,
    fontSize: isPhone ? 12 : 13,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(124,58,237,0.12)",
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
  gridTemplateColumns: isPhone
    ? "1fr"
    : "1.7fr 1fr",
  gap: 14,
},

  inviteManagementLayout: {
    maxWidth: 860,
    margin: "0 auto",
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
   gridTemplateColumns: isPhone
  ? "50px 1fr"
  : "50px 1fr 190px 90px",
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
    overflow: "hidden",
    flexShrink: 0,
  },

  profileAvatarImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
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
    overflow: "hidden",
    flexShrink: 0,
  },

  profileAvatarSmallImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },

  memberName: { fontSize: 16, fontWeight: 900 },
  memberRole: { marginTop: 3, fontSize: 13, color: COLORS.sub },

  memberActivityLine: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
    fontSize: 12,
    fontWeight: 900,
    color: COLORS.primaryDark,
  },

  statusLine: {
    display: isPhone ? "grid" : "flex",
    gridTemplateColumns: isPhone ? "165px 78px" : "none",
    alignItems: "center",
    justifyContent: isPhone ? "center" : "flex-start",
    columnGap: isPhone ? 10 : 18,
    gap: isPhone ? 10 : 18,
    gridColumn: isPhone ? "1 / 3" : "3 / 5",
    width: isPhone ? "100%" : "auto",
    marginTop: isPhone ? 10 : 0,
  },

  statusSelectWrap: {
    position: "relative",
    width: isPhone ? 165 : 190,
    height: 42,
    flexShrink: 0,
  },

  statusSelect: {
    width: "100%",
    height: "100%",
    padding: isPhone ? "0 34px 0 14px" : "0 42px 0 18px",
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
    right: isPhone ? 18 : 25,
    top: "43%",
    transform: "translateY(-50%)",
    fontSize: 12,
    fontWeight: 900,
    color: "#2563EB",
    pointerEvents: "none",
  },

  statusViewOnly: {
    width: isPhone ? 165 : 190,
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
    width: isPhone ? 78 : 90,
    minHeight: 42,
    fontSize: isPhone ? 13 : 14,
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
  gap: 8,
  marginTop: 14,
},

   activityCard: {
  border: `1px solid ${COLORS.border}`,
  borderRadius: 16,
  padding: "10px 6px",
  textAlign: "center",
  background: "#FAFAFA",
  display: "flex",
  flexDirection: "column",
  gap: 4,
  minWidth: 0,
  wordBreak: "keep-all",
  whiteSpace: "nowrap",
},

teamCard: {
  background: "linear-gradient(135deg, #E9D5FF 0%, #D8B4FE 100%)",
  borderRadius: 24,
  padding: 18,
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
  background: "rgba(255,255,255,0.65)",
  color: "#5B21B6",
  fontWeight: 900,
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

  emptyInviteBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    background: COLORS.bg,
    color: COLORS.sub,
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.5,
  },

  inviteLabel: {
    display: "block",
    marginTop: 14,
    marginBottom: 6,
    fontSize: 12,
    color: COLORS.sub,
    fontWeight: 900,
  },

  inviteSelect: {
    width: "100%",
    minHeight: 46,
    padding: "0 12px",
    borderRadius: 14,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.white,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 800,
    outline: "none",
    boxSizing: "border-box",
  },

  inviteFormGrid: {
    display: "grid",
    gridTemplateColumns: isPhone ? "1fr" : "1fr 1fr",
    gap: isPhone ? 0 : 10,
  },

  inviteUsageControl: {
    display: "grid",
    gridTemplateColumns: isPhone ? "1fr" : "1fr 1fr",
    gap: 8,
    marginBottom: 10,
  },

  inviteRadioLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    padding: "0 12px",
    borderRadius: 14,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.white,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },

  inviteHelpText: {
    marginTop: 4,
    marginBottom: 10,
    padding: 12,
    borderRadius: 14,
    background: COLORS.bg,
    color: COLORS.sub,
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.5,
  },

  createdInviteBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    border: "1px solid #C4B5FD",
    background: "#F5F3FF",
  },

  createdInviteCode: {
    padding: "12px 14px",
    borderRadius: 14,
    background: COLORS.white,
    color: COLORS.primaryDark,
    fontSize: 20,
    fontWeight: 900,
    letterSpacing: 1,
    textAlign: "center",
    wordBreak: "break-all",
  },

  createdInviteNotice: {
    marginTop: 8,
    color: COLORS.sub,
    fontSize: 12,
    lineHeight: 1.5,
  },

  inviteButtonRow: {
    display: "grid",
    gridTemplateColumns: isPhone ? "1fr" : "1fr 1fr",
    gap: 8,
    marginTop: 12,
  },

  inviteOutlineButton: {
    border: `1px solid ${COLORS.primary}`,
    background: COLORS.white,
    color: COLORS.primaryDark,
    borderRadius: 14,
    padding: "11px 12px",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },

  inviteKakaoButton: {
    border: "1px solid #FEE500",
    background: "#FEE500",
    color: "#191919",
    borderRadius: 14,
    padding: "11px 12px",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },

  inviteList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginTop: 12,
  },

  inviteItem: {
    border: `1px solid ${COLORS.border}`,
    borderRadius: 16,
    padding: 13,
    background: "#FAFAFA",
  },

  inviteItemTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },

  inviteOrgName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 900,
    lineHeight: 1.4,
  },

  inviteMeta: {
    marginTop: 3,
    color: COLORS.sub,
    fontSize: 12,
    fontWeight: 700,
  },

  inviteMetaGrid: {
    display: "grid",
    gridTemplateColumns: isPhone ? "1fr" : "1fr 1fr",
    gap: 6,
    marginTop: 10,
    color: COLORS.sub,
    fontSize: 12,
    fontWeight: 800,
  },

  inviteStatusBadge: {
    borderRadius: 999,
    padding: "5px 9px",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  inviteDangerButton: {
    width: "100%",
    marginTop: 10,
    border: "none",
    background: "#FEE2E2",
    color: "#DC2626",
    borderRadius: 13,
    padding: "10px 12px",
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

rankOrgLine: {
  fontSize: 14,
  fontWeight: 700,
  color: COLORS.text,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
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
});

export default TeamPage;
