export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

export function formatDateKorean(dateStr) {
  const DAYS = ['일','월','화','수','목','금','토'];
  const d = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(d)) return '';
  return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${DAYS[d.getDay()]})`;
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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
    if (week.length === 7) { matrix.push(week); week = []; }
  }
  if (week.length) {
    while (week.length < 7) week.push(null);
    matrix.push(week);
  }
  return matrix;
}

export function getInitial(name = '') { return name.charAt(0) || '?'; }
export function isEmpty(v) { return v === null || v === undefined || v === ''; }

export function toTimeStr(isoStr) {
  if (!isoStr) return '--:--';
  return new Date(isoStr).toTimeString().slice(0, 5);
}

// ── 기존 파일 호환용 alias ──────────────────────
export function money(n) { return formatNumber(n) + '천원'; }
export function calculateRetentionRate(counts = {}) {
  const total  = Object.values(counts).reduce((a, b) => a + b, 0);
  const active = (counts['유지중'] || 0) + (counts['계약중'] || 0);
  return total > 0 ? Math.round(active / total * 100) : 0;
}
export function getSilsonGeneration() { return 1; }
