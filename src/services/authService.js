import { supabase } from '../supabaseClient';
import { validateSignupName } from '../utils';

const PUBLIC_SITE_URL = (process.env.REACT_APP_PUBLIC_SITE_URL || 'https://www.boplan.kr').replace(/\/$/, '');

function getAuthRedirectUrl(path = '') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${PUBLIC_SITE_URL}${normalizedPath}`;
}

export function getKoreanAuthErrorMessage(error) {
  const message = String(error?.message || error || '');
  const lowerMessage = message.toLowerCase();

  if (!message) return '인증 처리 중 오류가 발생했습니다.';
  if (lowerMessage.includes('invalid login credentials')) return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (lowerMessage.includes('email not confirmed')) return '이메일 인증 후 로그인해주세요.';
  if (lowerMessage.includes('user already registered') || lowerMessage.includes('already registered')) return '이미 가입된 이메일입니다.';
  if (lowerMessage.includes('password should be') || lowerMessage.includes('weak password')) return '비밀번호는 8자 이상으로 입력해주세요.';
  if (lowerMessage.includes('invalid email')) return '이메일 형식이 올바르지 않습니다.';
  if (lowerMessage.includes('email rate limit') || lowerMessage.includes('rate limit')) return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
  if (lowerMessage.includes('signup is disabled')) return '현재 회원가입이 비활성화되어 있습니다.';
  if (lowerMessage.includes('network') || lowerMessage.includes('failed to fetch')) return '네트워크 연결을 확인한 뒤 다시 시도해주세요.';

  return message;
}

const authService = {
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(getKoreanAuthErrorMessage(error));
    return data;
  },
  async signUp(email, password, displayName) {
    const nameValidation = validateSignupName(displayName, email);
    if (!nameValidation.valid) throw new Error(nameValidation.error);

    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: getAuthRedirectUrl('/'),
        data: { display_name: nameValidation.name },
      },
    });
    if (error) throw new Error(getKoreanAuthErrorMessage(error));
    return data;
  },
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
  async resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthRedirectUrl('/reset-password'),
    });
    if (error) throw new Error(getKoreanAuthErrorMessage(error));
  },
  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },
  async getUser() {
    const { data } = await supabase.auth.getUser();
    return data.user;
  },
  onAuthStateChange(cb) {
    return supabase.auth.onAuthStateChange(cb);
  },
};

export default authService;

// ── 기존 named export 호환 ──────────────────────
export const signIn           = (e,p)   => authService.signIn(e, p);
export const signUp           = (e,p,n) => authService.signUp(e, p, n);
export const signOut          = ()      => authService.signOut();
export const resetPassword    = (e)     => authService.resetPassword(e);
export const getSession       = ()      => authService.getSession();
export const getUser          = ()      => authService.getUser();
export const onAuthStateChange = (cb)   => authService.onAuthStateChange(cb);
