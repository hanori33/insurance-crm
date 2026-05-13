import { supabase } from '../supabaseClient';

const authService = {
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },
  async signUp(email, password, displayName) {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: displayName } },
    });
    if (error) throw error;
    return data;
  },
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
  async resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
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
