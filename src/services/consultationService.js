// src/services/consultationService.js
import { supabase } from '../supabaseClient';

const consultationService = {
  async list() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('consultations')
      .select('*')
      .eq('user_id', user.id)
      .order('consulted_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async listByCustomer(customerId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('consultations')
      .select('*')
      .eq('user_id', user.id)
      .eq('customer_id', customerId)
      .order('consulted_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async create(payload) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    const cleanPayload = {
      user_id: user.id,
      customer_id: payload.customer_id || null,
      customer_name: payload.customer_name || '',
      content: payload.content || '',
      category: payload.category || '상담',
      next_action: payload.next_action || '',
      consulted_at: payload.consulted_at || new Date().toISOString(),

      disclosure_info: payload.disclosure_info || {},
      medical_history: payload.medical_history || [],
      exclusions: payload.exclusions || [],
    };

    const { data, error } = await supabase
      .from('consultations')
      .insert(cleanPayload)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id, payload) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    const cleanPayload = {
      customer_id: payload.customer_id || null,
      customer_name: payload.customer_name || '',
      content: payload.content || '',
      category: payload.category || '상담',
      next_action: payload.next_action || '',

      disclosure_info: payload.disclosure_info || {},
      medical_history: payload.medical_history || [],
      exclusions: payload.exclusions || [],
    };

    const { data, error } = await supabase
      .from('consultations')
      .update(cleanPayload)
      .eq('user_id', user.id)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async remove(id) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    const { error } = await supabase
      .from('consultations')
      .delete()
      .eq('user_id', user.id)
      .eq('id', id);

    if (error) throw error;
  },
};

export default consultationService;