// src/services/faxHistoryService.js
import { supabase } from '../supabaseClient';

const faxHistoryService = {
  async list() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return [];

    const { data, error } = await supabase
      .from('fax_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async create(payload) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error('로그인이 필요합니다.');

    const cleanPayload = {
      user_id: user.id,
      customer_id: payload.customer_id || null,
      customer_name: payload.customer_name || '',
      insurance_company: payload.insurance_company || '',
      fax_number: payload.fax_number || '',
      files: payload.files || [],
      status: payload.status || '대기',
      provider: payload.provider || 'manual',
      provider_receipt_id: payload.provider_receipt_id || null,
      error_message: payload.error_message || null,
      sent_at: payload.sent_at || null,
    };

    const { data, error } = await supabase
      .from('fax_history')
      .insert(cleanPayload)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id, payload) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error('로그인이 필요합니다.');

    const { data, error } = await supabase
      .from('fax_history')
      .update(payload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async remove(id) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error('로그인이 필요합니다.');

    const { error } = await supabase
      .from('fax_history')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
  },
};

export default faxHistoryService;