import { supabase } from '../supabaseClient';

const BUCKET = 'policy-files';

const policyFileService = {
  async listByCustomer(customerId) {
    const { data, error } = await supabase
      .from('policy_files')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data || [];
  },

  async upload(customerId, file) {
    const ext = file.name.split('.').pop() || 'file';

    const safeFileName = `${Date.now()}.${ext}`;

    const filePath = `${customerId}/${safeFileName}`;

    const { error: uploadError } =
      await supabase.storage
        .from(BUCKET)
        .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data, error } =
      await supabase
        .from('policy_files')
        .insert({
          customer_id: customerId,
          file_name: file.name,
          file_url: filePath,
        })
        .select()
        .single();

    if (error) throw error;

    return data;
  },

  async getSignedUrl(filePath) {
    const { data, error } =
      await supabase.storage
        .from(BUCKET)
        .createSignedUrl(filePath, 3600);

    if (error) throw error;

    return data?.signedUrl;
  },

  async remove(id, filePath) {
    const { error: storageError } =
      await supabase.storage
        .from(BUCKET)
        .remove([filePath]);

    if (storageError) throw storageError;

    const { error } =
      await supabase
        .from('policy_files')
        .delete()
        .eq('id', id);

    if (error) throw error;
  },
};

export default policyFileService;