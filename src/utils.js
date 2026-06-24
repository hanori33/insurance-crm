export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function formatDueDateWithDDay(dueDate, now = new Date()) {
  const dateText = String(dueDate || '').trim();

  let year;
  let month;
  let day;

  const compactMatch = dateText.match(/^(\d{4})(\d{2})(\d{2})$/);
  const dashedMatch = dateText.match(/^(\d{4})([-./])(\d{1,2})\2(\d{1,2})$/);

  if (compactMatch) {
    year = Number(compactMatch[1]);
    month = Number(compactMatch[2]);
    day = Number(compactMatch[3]);
  } else if (dashedMatch) {
    year = Number(dashedMatch[1]);
    month = Number(dashedMatch[3]);
    day = Number(dashedMatch[4]);
  } else {
    return dateText;
  }

  const dueDay = Date.UTC(year, month - 1, day);
  const parsedDueDate = new Date(dueDay);

  if (
    parsedDueDate.getUTCFullYear() !== year ||
    parsedDueDate.getUTCMonth() !== month - 1 ||
    parsedDueDate.getUTCDate() !== day
  ) {
    return dateText;
  }

  const nowInKorea = new Date(now.getTime() + KST_OFFSET_MS);
  const todayInKorea = Date.UTC(
    nowInKorea.getUTCFullYear(),
    nowInKorea.getUTCMonth(),
    nowInKorea.getUTCDate()
  );

  const daysLeft = Math.round((dueDay - todayInKorea) / DAY_IN_MS);

  const dDay =
    daysLeft === 0
      ? 'D-DAY'
      : daysLeft > 0
      ? `D-${daysLeft}`
      : `D+${Math.abs(daysLeft)}`;

  const prettyDate = `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`;

  return `${prettyDate} · ${dDay}`;
}

export function getProStatusLabel(profile, now = new Date()) {
  if (profile?.pro_plan !== true) return '무료회원';
  if (!profile.pro_expire_at) return 'PRO 이용중';

  const expiresAt = new Date(profile.pro_expire_at);
  if (Number.isNaN(expiresAt.getTime())) return 'PRO 이용중';
  if (expiresAt.getTime() <= now.getTime()) return 'PRO 만료';

  const expiryInKorea = new Date(expiresAt.getTime() + KST_OFFSET_MS);
  const nowInKorea = new Date(now.getTime() + KST_OFFSET_MS);

  const expiryDay = Date.UTC(
    expiryInKorea.getUTCFullYear(),
    expiryInKorea.getUTCMonth(),
    expiryInKorea.getUTCDate()
  );

  const today = Date.UTC(
    nowInKorea.getUTCFullYear(),
    nowInKorea.getUTCMonth(),
    nowInKorea.getUTCDate()
  );

  const daysLeft = Math.max(0, Math.round((expiryDay - today) / DAY_IN_MS));

  return daysLeft === 0 ? 'PRO D-DAY' : `PRO D-${daysLeft}`;
}

export function formatDateKorean(dateStr) {
  const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
  const d = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(d)) return '';
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS[d.getDay()]})`;
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatNumber(n) {
  return Number(n || 0).toLocaleString('ko-KR');
}

export function buildCalendarMatrix(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const matrix = [];
  let week = Array(firstDay).fill(null);

  for (let d = 1; d <= lastDate; d++) {
    week.push(d);
    if (week.length === 7) {
      matrix.push(week);
      week = [];
    }
  }

  if (week.length) {
    while (week.length < 7) week.push(null);
    matrix.push(week);
  }

  return matrix;
}

export function getInitial(name = '') {
  return name.charAt(0) || '?';
}

export function isEmpty(v) {
  return v === null || v === undefined || v === '';
}

export function validateSignupName(value, email = '') {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  const compactName = name.replace(/\s/g, '');

  if (!name || Array.from(compactName).length < 2) {
    return { valid: false, name, error: '이름은 실제 이름으로 입력해주세요.' };
  }

  if (/\d/.test(name) || name.includes('@')) {
    return {
      valid: false,
      name,
      error: '숫자나 이메일 형식은 이름으로 사용할 수 없습니다.',
    };
  }

  const emailLocalPart = String(email || '').trim().split('@')[0].toLowerCase();
  if (emailLocalPart && compactName.toLowerCase() === emailLocalPart) {
    return { valid: false, name, error: '이름은 실제 이름으로 입력해주세요.' };
  }

  const isKoreanName = /^[가-힣]+(?: [가-힣]+)*$/.test(name);
  const isEnglishName = /^[A-Za-z]+(?: [A-Za-z]+)*$/.test(name);

  if (!isKoreanName && !isEnglishName) {
    return { valid: false, name, error: '이름은 실제 이름으로 입력해주세요.' };
  }

  return { valid: true, name, error: '' };
}

export function toTimeStr(value) {
  if (!value) return '';

  const str = String(value);
  const match = str.match(/(\d{2}):(\d{2})/);

  if (match) return `${match[1]}:${match[2]}`;

  return '';
}

export function money(n) {
  return formatNumber(n) + '천원';
}

export function calculateRetentionRate(counts = {}) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const active = (counts['유지중'] || 0) + (counts['계약중'] || 0);
  return total > 0 ? Math.round((active / total) * 100) : 0;
}

export function getSilsonGeneration() {
  return 1;
}

export function birthFromFront6(front6) {
  if (!front6 || front6.length < 6) return null;
  const yy = front6.slice(0, 2);
  const mm = front6.slice(2, 4);
  const dd = front6.slice(4, 6);
  const year = parseInt(yy) > 24 ? `19${yy}` : `20${yy}`;
  return `${year}.${mm}.${dd}`;
}