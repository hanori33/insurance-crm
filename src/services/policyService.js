
import { supabase } from '../supabaseClient';

const policyService = {
  async listByCustomer(customerId) {
    const { data, error } = await supabase
      .from('policies').select('*').eq('customer_id', customerId)
      .order('start_date', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async create(payload) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('policies').insert({ ...payload, user_id: user.id }).select().single();
    if (error) throw error;
    return data;
  },

  async update(id, payload) {
    const { data, error } = await supabase
      .from('policies').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async remove(id) {
    const { error } = await supabase.from('policies').delete().eq('id', id);
    if (error) throw error;
  },
};

export default policyService;