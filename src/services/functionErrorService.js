import { FunctionsHttpError } from '@supabase/supabase-js';

const DEFAULT_MESSAGE =
  'AI 기능 처리 중 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.';

const ERROR_MESSAGES = {
  PRO_REQUIRED:
    'AI 기능은 PRO 회원 또는 무료체험 회원만 이용할 수 있습니다.\n설정에서 이용 상태를 확인해주세요.',
  AUTH_REQUIRED:
    '로그인이 만료되었습니다.\n다시 로그인 후 이용해주세요.',
  INVALID_AUTH_TOKEN:
    '로그인이 만료되었습니다.\n다시 로그인 후 이용해주세요.',
  UNAUTHORIZED_NO_AUTH_HEADER:
    '로그인이 만료되었습니다.\n다시 로그인 후 이용해주세요.',
  ROLE_REQUIRED: '관리자 권한이 필요한 기능입니다.',
  PROFILE_REQUIRED:
    '회원 정보 확인이 필요합니다.\n다시 로그인하거나 관리자에게 문의해주세요.',
};

function isAuthMessage(message) {
  if (!message) return false;

  const normalized = String(message).toLowerCase();
  return (
    normalized.includes('invalid jwt') ||
    normalized.includes('authorization') ||
    normalized.includes('auth token') ||
    normalized.includes('로그인이 만료')
  );
}

export async function getFunctionErrorMessage(error) {
  let payload = null;
  let status = error?.context?.status;

  if (error instanceof FunctionsHttpError && error.context) {
    try {
      payload = await error.context.clone().json();
    } catch {
      payload = null;
    }
  }

  const code = payload?.code;
  const responseMessage = payload?.message || payload?.error || error?.message;

  if (code && ERROR_MESSAGES[code]) {
    return ERROR_MESSAGES[code];
  }

  if (status === 401 || Number(code) === 401 || isAuthMessage(responseMessage)) {
    return ERROR_MESSAGES.AUTH_REQUIRED;
  }

  return DEFAULT_MESSAGE;
}

export default getFunctionErrorMessage;
