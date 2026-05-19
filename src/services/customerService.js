import { supabase } from "../supabaseClient";

function dbToCustomer(c) {
  return {
    id: c.app_customer_id || c.id,
    db_id: c.id,
    app_customer_id: c.app_customer_id,
    name: c.name || "",
    phone: c.phone || "",
    ssn: c.ssn || "",
    birth:
  c.birth ||
  c.birth_date ||
  c.birthday ||
  c.birthDate ||
  (c.ssn ? c.ssn.substring(0, 6) : "") ||
  "",

ssn_masked: c.ssn
  ? `${c.ssn.substring(0, 6)}-${c.ssn.substring(7, 8)}******`
  : "",
    email: c.email || "",
    memo: c.memo || "",
    status: c.status || "가망",
    customer_type: c.customer_type || "일반",
    pet_name: c.pet_name || "",
    baby_name: c.baby_name || "",
    job: c.job || "",
    transfer_day: c.transfer_day || "",
    bank_name: c.bank_name || "",
    address: c.address || "",
    age_date: c.age_date || "",
    car_number: c.car_number || "",
    car_expiry: c.car_expiry || "",
   due_date: c.due_date || '',  // ✅ 추가
    referrer_app_id: c.referrer_app_id || "",
    tags: c.tags || [],
    relation_type: c.relation_type || "",
    policies: Array.isArray(c.policies) ? c.policies : [],
    created_at: c.created_at || "",
  };
}

function customerToDb(userId, customer) {
  return {
    user_id: userId,
    app_customer_id: customer.app_customer_id || customer.id || Date.now(),
    name: customer.name || "",
    phone: customer.phone || "",
    birth: customer.birth || customer.birth_date || customer.birthday || customer.birthDate || "",
    email: customer.email || "",
    memo: customer.memo || "",
    status: customer.status || "가망",
    customer_type: customer.customer_type || "일반",
    pet_name: customer.pet_name || "",
    baby_name: customer.baby_name || "",
    job: customer.job || "",
    transfer_day: customer.transfer_day || "",
    bank_name: customer.bank_name || "",
    address: customer.address || "",
    age_date: customer.age_date || "",
    car_number: customer.car_number || "",
    car_expiry: customer.car_expiry || "",
    due_date: customer.due_date || '',  // ✅ 추가
    referrer_app_id: customer.referrer_app_id || null,
    tags: Array.isArray(customer.tags) ? customer.tags : [],
    relation_type: customer.relation_type || "",
    policies: Array.isArray(customer.policies)
  ? customer.policies
  : [],
  };
}

export async function getCustomers(userId) {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data || []).map(dbToCustomer);
}

export async function addCustomer(customer) {
  const payload = customerToDb(customer.user_id, customer);

  const { data, error } = await supabase
    .from("customers")
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return dbToCustomer(data);
}

export async function updateCustomer(customer) {
  const payload = customerToDb(customer.user_id, customer);

  const { data, error } = await supabase
    .from("customers")
    .update(payload)
    .eq("user_id", customer.user_id)
    .eq("app_customer_id", customer.app_customer_id || customer.id)
    .select()
    .single();

  if (error) throw error;
  return dbToCustomer(data);
}

export async function deleteCustomer(id, userId) {
  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("user_id", userId)
    .eq("app_customer_id", id);

  if (error) throw error;
}

export async function upsertCustomersFromExcel(userId, parsedCustomers, currentCustomers = []) {
  const inserts = [];
  const updates = [];
  let nextCustomers = [...currentCustomers];

  for (const item of parsedCustomers) {
    const existing = nextCustomers.find((c) => c.phone === item.phone);
    const id = existing?.id || item.tempId || Date.now();

    const customer = {
      ...existing,
      ...item,
      id,
      app_customer_id: id,
      user_id: userId,
    };

    const payload = customerToDb(userId, customer);

    if (existing) {
      updates.push(payload);
      nextCustomers = nextCustomers.map((c) => (c.id === existing.id ? customer : c));
    } else {
      inserts.push(payload);
      nextCustomers = [customer, ...nextCustomers];
    }
  }

  for (const payload of updates) {
    const { error } = await supabase
      .from("customers")
      .update(payload)
      .eq("user_id", userId)
      .eq("app_customer_id", payload.app_customer_id);

    if (error) throw error;
  }

  if (inserts.length) {
    const { error } = await supabase.from("customers").insert(inserts);
    if (error) throw error;
  }

  return {
    customers: nextCustomers,
    inserted: inserts.length,
    updated: updates.length,
  };
}

const customerService = {
  create: async (customer) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error('로그인이 필요합니다.');

    const payload = customerToDb(user.id, {
      ...customer,
      app_customer_id: customer.app_customer_id || Date.now(),
    });

    const { data, error } = await supabase
      .from('customers')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return dbToCustomer(data);
  },
  list: async ({ status, search } = {}) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return [];

    let result = await getCustomers(user.id);

    if (status && status !== '전체') {
      result = result.filter(c => c.status === status);
    }

    if (search) {
      result = result.filter(
        c =>
          c.name?.includes(search) ||
          c.phone?.includes(search)
      );
    }

    return result;
  },

 get: async (id) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('로그인이 필요합니다.');

  let query = supabase
    .from('customers')
    .select('*')
    .eq('user_id', user.id);

  if (String(id).includes('-')) {
    query = query.eq('id', id);
  } else {
    query = query.eq('app_customer_id', Number(id));
  }

  const { data, error } = await query.single();

  if (error) throw error;

  return dbToCustomer(data);
},

  bulkCreate: async (customers) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error('로그인이 필요합니다.');

    const current = await getCustomers(user.id);

    return await upsertCustomersFromExcel(
      user.id,
      customers,
      current
    );
  },

update: async (id, payload) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('로그인이 필요합니다.');

  const updatePayload = customerToDb(user.id, payload);

  // app_customer_id는 기존 고객 고유번호라 수정 때 건드리면 안 됨
  delete updatePayload.app_customer_id;

  let query = supabase
    .from('customers')
    .update(updatePayload)
    .eq('user_id', user.id);

  if (String(id).includes('-')) {
    query = query.eq('id', id);
  } else {
    query = query.eq('app_customer_id', Number(id));
  }

  const { data, error } = await query
    .select()
    .single();

  if (error) throw error;

  return dbToCustomer(data);
},

  remove: async (id) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error('로그인이 필요합니다.');

    return await deleteCustomer(id, user.id);
  },

  recent: async (limit = 3) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return [];

    const { data, error } = await supabase
      .from('customers')
      .select('id, name, phone, status, birth, updated_at, created_at')
      .eq('user_id', user.id)
      .order('updated_at', {
        ascending: false,
        nullsFirst: false,
      })
      .limit(limit);

    if (error) throw error;

    return data || [];
  },

  statusCounts: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return {};

    const { data, error } = await supabase
      .from('customers')
      .select('status')
      .eq('user_id', user.id);

    if (error) throw error;

    const counts = {};

    (data || []).forEach(r => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });

    return counts;
  },
};

export default customerService;