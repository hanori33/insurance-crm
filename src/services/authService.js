import { supabase } from '../supabaseClient';
import { validateSignupName } from '../utils';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

const PUBLIC_SITE_URL = (process.env.REACT_APP_PUBLIC_SITE_URL || 'https://www.boplan.kr').replace(/\/$/, '');
const ANDROID_AUTH_CALLBACK_URL = 'kr.boplan.app://auth/callback';

function getAuthRedirectUrl(path = '') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${PUBLIC_SITE_URL}${normalizedPath}`;
}

function getGoogleOAuthRedirectUrl() {
  return Capacitor.isNativePlatform()
    ? ANDROID_AUTH_CALLBACK_URL
    : getAuthRedirectUrl('/auth/callback');
}

function isAlreadyRegisteredSignup(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('user already registered') ||
    message.includes('already registered') ||
    message.includes('already exists')
  );
}

function isWaitingForVerificationSignup(data) {
  return (
    data?.user &&
    !data?.session &&
    Array.isArray(data.user.identities) &&
    data.user.identities.length === 0
  );
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
  if (lowerMessage.includes('cancel') || lowerMessage.includes('access_denied')) return 'Google 로그인이 취소되었습니다.';
  if (lowerMessage.includes('oauth') || lowerMessage.includes('provider')) return 'Google 로그인 처리 중 오류가 발생했습니다.';
  if (lowerMessage.includes('code') && lowerMessage.includes('exchange')) return 'Google 로그인 세션 교환에 실패했습니다.';

  return message;
}

function getOAuthCallbackErrorMessage(url) {
  try {
    const parsed = new URL(url);
    const params = new URLSearchParams(parsed.search || parsed.hash.replace(/^#/, ''));
    const error = params.get('error') || params.get('error_code');
    const description = params.get('error_description') || params.get('message') || '';

    if (!error && !description) return '';
    if (`${error} ${description}`.toLowerCase().includes('access_denied')) {
      return 'Google 로그인이 취소되었습니다.';
    }

    return description || 'Google 로그인 callback 처리 중 오류가 발생했습니다.';
  } catch {
    return 'Google 로그인 callback URL을 확인하지 못했습니다.';
  }
}

const authService = {
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(getKoreanAuthErrorMessage(error));
    return data;
  },
  async signInWithGoogle() {
    const redirectTo = getGoogleOAuthRedirectUrl();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: Capacitor.isNativePlatform(),
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });

    if (error) throw new Error(getKoreanAuthErrorMessage(error));

    if (Capacitor.isNativePlatform()) {
      if (!data?.url) throw new Error('Google 로그인 페이지를 열지 못했습니다.');
      await Browser.open({ url: data.url, windowName: '_self' });
    }

    return data;
  },
  async handleOAuthCallback(url) {
    if (!url) throw new Error('Google 로그인 callback URL이 없습니다.');

    const callbackError = getOAuthCallbackErrorMessage(url);
    if (callbackError) throw new Error(callbackError);

    const { data, error } = await supabase.auth.exchangeCodeForSession(url);
    if (error) throw new Error(getKoreanAuthErrorMessage(error));

    if (Capacitor.isNativePlatform()) {
      await Browser.close().catch(() => {});
    }

    return data?.session || null;
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

    console.log('[BoPlan signUp result]', { data, error });

    if (error) {
      if (isAlreadyRegisteredSignup(error)) {
        return authService.resendSignupVerification(email);
      }

      throw new Error(error.message || String(error));
    }

    if (isWaitingForVerificationSignup(data)) {
      return authService.resendSignupVerification(email);
    }

    return { data, resent: false };
  },
  async resendSignupVerification(email) {
    const { data, error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: getAuthRedirectUrl('/'),
      },
    });

    console.log('[BoPlan signup resend result]', { data, error });

    if (error) throw new Error(error.message || String(error));
    return { data, resent: true };
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
export const signInWithGoogle = ()      => authService.signInWithGoogle();
export const signUp           = (e,p,n) => authService.signUp(e, p, n);
export const signOut          = ()      => authService.signOut();
export const resetPassword    = (e)     => authService.resetPassword(e);
export const getSession       = ()      => authService.getSession();
export const getUser          = ()      => authService.getUser();
export const onAuthStateChange = (cb)   => authService.onAuthStateChange(cb);
