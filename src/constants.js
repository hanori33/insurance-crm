// src/constants.js
export const COLORS = {
  primary:        '#7C5CFC',
  primaryDark:    '#6B46F5',
  primaryLight:   '#A78BFA',
  primaryLighter: '#C4B5FD',
  primaryBg:      '#F3EEFF',
  bg:             '#F5F3FF',
  bgGray:         '#F8F8FC',
  white:          '#FFFFFF',
  text:           '#1A1A2E',
  textGray:       '#8B8BA7',
  textLight:      '#B8B8CC',
  border:         '#E8E4F8',
  green:          '#22C55E',
  greenBg:        '#DCFCE7',
  blue:           '#3B82F6',
  blueBg:         '#DBEAFE',
  red:            '#EF4444',
  redBg:          '#FEE2E2',
  shadow:         'rgba(124,92,252,0.10)',
};

// DB에 실제 저장된 status 값에 맞게 설정
export const STATUS_CONFIG = {
  '상담중': { bg: '#EDE9FF', color: '#7C5CFC', label: '상담중' },
  '계약중': { bg: '#DBEAFE', color: '#3B82F6', label: '계약중' },
  '유지중': { bg: '#DCFCE7', color: '#16A34A', label: '유지중' },
  '해지':   { bg: '#FEE2E2', color: '#DC2626', label: '해지'   },
  '가망':   { bg: '#FEF3C7', color: '#D97706', label: '가망'   },
  '가망고객': { bg: '#FEF3C7', color: '#D97706', label: '가망고객' },
  '기존':   { bg: '#DCFCE7', color: '#16A34A', label: '기존'   },
  '기존고객': { bg: '#DCFCE7', color: '#16A34A', label: '기존고객' },
};

export const TAB_LIST = [
  { id: 'home',      label: '홈',      icon: '🏠' },
  { id: 'customers', label: '고객',    icon: '👥' },
  { id: 'schedule',  label: '일정',    icon: '📅' },
  { id: 'tree',      label: '소개트리', icon: '🌳' },
  { id: 'more',      label: '더보기',  icon: '···' },
];

export const CUSTOMER_STATUSES = ['상담중', '계약중', '유지중', '해지', '가망'];
export const CUSTOMER_FILTERS  = ['전체', ...CUSTOMER_STATUSES];

// 호환용
export const CUSTOMER_STATUS   = CUSTOMER_STATUSES;
export const PLAN_RULES        = {};
export const MESSAGE_TEMPLATES = {};