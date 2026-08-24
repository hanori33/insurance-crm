import { supabase } from '../supabaseClient';

function normalizeText(value) {
  return String(value || '').trim();
}

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data?.user?.id) throw new Error('로그인이 만료되었습니다. 다시 로그인 후 이용해주세요.');
  return data.user.id;
}

function normalizeManagerPayload(payload, userId) {
  return {
    user_id: userId,
    insurance_company: normalizeText(payload.insurance_company),
    name: normalizeText(payload.name),
    phone: normalizeText(payload.phone) || null,
    specialty: normalizeText(payload.specialty) || null,
    memo: normalizeText(payload.memo) || null,
    is_active: payload.is_active !== false,
  };
}

function makeManagerSnapshot(manager, fallback = {}) {
  return {
    manager_company_snapshot: normalizeText(manager?.insurance_company || fallback.insurance_company),
    manager_name_snapshot: normalizeText(manager?.name || fallback.manager_name),
    manager_phone_snapshot: normalizeText(manager?.phone || fallback.manager_phone) || null,
    manager_specialty_snapshot: normalizeText(manager?.specialty || fallback.manager_specialty) || null,
  };
}

const designRequestService = {
  async listManagers({ includeInactive = false } = {}) {
    const userId = await getCurrentUserId();
    let query = supabase
      .from('design_managers')
      .select('*')
      .eq('user_id', userId)
      .order('is_active', { ascending: false })
      .order('insurance_company', { ascending: true })
      .order('name', { ascending: true });

    if (!includeInactive) query = query.eq('is_active', true);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async createManager(payload) {
    const userId = await getCurrentUserId();
    const nextPayload = normalizeManagerPayload(payload, userId);

    if (!nextPayload.insurance_company) throw new Error('보험회사를 입력해주세요.');
    if (!nextPayload.name) throw new Error('매니저 이름을 입력해주세요.');

    const { data, error } = await supabase
      .from('design_managers')
      .insert(nextPayload)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateManager(id, payload) {
    const userId = await getCurrentUserId();
    const nextPayload = normalizeManagerPayload(payload, userId);

    if (!nextPayload.insurance_company) throw new Error('보험회사를 입력해주세요.');
    if (!nextPayload.name) throw new Error('매니저 이름을 입력해주세요.');

    const { data, error } = await supabase
      .from('design_managers')
      .update(nextPayload)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async setManagerActive(id, isActive) {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('design_managers')
      .update({ is_active: Boolean(isActive) })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async listRequestsByCustomer(customerId) {
    if (!customerId) return [];
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('design_requests')
      .select('*')
      .eq('user_id', userId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createRequest({ customerId, manager, managerFallback, requestMessage, includedSections, status = 'sent', memo }) {
    const userId = await getCurrentUserId();
    const snapshot = makeManagerSnapshot(manager, managerFallback);
    const cleanMessage = normalizeText(requestMessage);

    if (!customerId) throw new Error('고객 정보가 없습니다.');
    if (!snapshot.manager_company_snapshot) throw new Error('보험회사를 선택하거나 입력해주세요.');
    if (!snapshot.manager_name_snapshot) throw new Error('매니저를 선택하거나 이름을 입력해주세요.');
    if (!cleanMessage) throw new Error('설계의뢰 메시지를 입력해주세요.');

    const { data, error } = await supabase
      .from('design_requests')
      .insert({
        user_id: userId,
        customer_id: customerId,
        manager_id: manager?.id || null,
        ...snapshot,
        request_message: cleanMessage,
        included_sections: includedSections || {},
        status,
        sent_at: status === 'sent' ? new Date().toISOString() : null,
        memo: normalizeText(memo) || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateRequestStatus(id, status) {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('design_requests')
      .update({ status })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

export default designRequestService;
