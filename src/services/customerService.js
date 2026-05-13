import { supabase } from '../supabaseClient';

const customerService = {
  async list({ status, search } = {}) {
    let q = supabase
      .from('customers')
      .select('id, name, phone, status, birth, email, memo, customer_type, address, job, created_at, updated_at, app_customer_id')
      .order('created_at', { ascending: false });
    if (status && status !== '전체') q = q.eq('status', status);
    if (search) q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },
  async get(id) {
    const { data, error } = await supabase.from('customers').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },
  async create(payload) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('customers').insert({ ...payload, user_id: user.id }).select().single();
    if (error) throw error;
    return data;
  },
  async update(id, payload) {
    const { data, error } = await supabase.from('customers').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) throw error;
  },
  async recent(limit = 3) {
    const { data, error } = await supabase.from('customers').select('id, name, phone, status, birth, updated_at, created_at').order('updated_at', { ascending: false, nullsFirst: false }).limit(limit);
    if (error) throw error;
    return data || [];
  },
  async statusCounts() {
    const { data, error } = await supabase.from('customers').select('status');
    if (error) throw error;
    const counts = {};
    (data || []).forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
    return counts;
  },
};

export default customerService;
export const getCustomers   = (f)     => customerService.list(f);
export const addCustomer    = (p)     => customerService.create(p);
export const updateCustomer = (id, p) => customerService.update(id, p);
export const deleteCustomer = (id)    => customerService.remove(id);