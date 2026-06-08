// src/services/diseaseDictionaryService.js
import { supabase } from '../supabaseClient';

const diseaseDictionaryService = {
  async list({ search = '' } = {}) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    let query = supabase
      .from('disease_dictionary')
      .select('*')
      .or(`user_id.eq.${user.id},is_public.eq.true`)
      .order('created_at', { ascending: false });

    const q = search.trim();

    if (q) {
      query = query.or(
        `disease_name.ilike.%${q}%,disease_code.ilike.%${q}%,summary.ilike.%${q}%`
      );
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  async create(payload) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    const cleanPayload = {
      user_id: user.id,
      disease_name: payload.disease_name || '',
      disease_code: payload.disease_code || '',
      category: payload.category || '일반',
      keywords: payload.keywords || [],
      summary: payload.summary || '',
      check_questions: payload.check_questions || [],
      disclosure_points: payload.disclosure_points || [],
      underwriting_notes: payload.underwriting_notes || [],
      customer_script: payload.customer_script || '',
      company_notes: payload.company_notes || {},
      is_public: false,
    };

    const { data, error } = await supabase
      .from('disease_dictionary')
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
      disease_name: payload.disease_name || '',
      disease_code: payload.disease_code || '',
      category: payload.category || '일반',
      keywords: payload.keywords || [],
      summary: payload.summary || '',
      check_questions: payload.check_questions || [],
      disclosure_points: payload.disclosure_points || [],
      underwriting_notes: payload.underwriting_notes || [],
      customer_script: payload.customer_script || '',
      company_notes: payload.company_notes || {},
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('disease_dictionary')
      .update(cleanPayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async remove(id) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    const { error } = await supabase
      .from('disease_dictionary')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
  },
};

export default diseaseDictionaryService;