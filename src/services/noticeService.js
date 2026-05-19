// src/services/noticeService.js
import { supabase } from '../supabaseClient';

const noticeService = {
  list: async () => {
    const { data, error } = await supabase
      .from('notices')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  create: async (notice) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    const { data, error } = await supabase
      .from('notices')
      .insert([{
        title: notice.title,
        content: notice.content,
        author_id: user.id,
        author_name: notice.author_name,
        author_role: notice.author_role,
        target_roles: notice.target_roles,
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  remove: async (id) => {
    const { error } = await supabase
      .from('notices')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  markAsRead: async (noticeId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('notice_reads')
      .upsert([{ notice_id: noticeId, user_id: user.id }]);
    if (error) throw error;
  },

  getReadIds: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('notice_reads')
      .select('notice_id')
      .eq('user_id', user.id);
    if (error) throw error;
    return (data || []).map(r => r.notice_id);
  },

  getMyRole: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    if (user.email === 'gksmf629@naver.com') return 'superadmin';

    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    if (error) return 'agent';
    return data?.role || 'agent';
  },
};

export default noticeService;