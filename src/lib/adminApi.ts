/**
 * adminApi - helper to call the admin-actions Edge Function
 */
import { supabase } from '@/integrations/supabase/client';

export interface AdminApiResult<T = unknown> {
  data?: T;
  error?: string;
}

export const adminApi = async <T = unknown>(
  adminCode: string,
  action: string,
  payload: Record<string, unknown> = {}
): Promise<AdminApiResult<T>> => {
  try {
    const { data, error } = await supabase.functions.invoke('admin-actions', {
      body: { admin_code: adminCode, action, payload },
    });

    if (error) {
      console.error('Admin API error:', error);
      return { error: error.message || 'حدث خطأ' };
    }

    if (data?.error) {
      return { error: data.error };
    }

    return { data: data as T };
  } catch (err) {
    console.error('Admin API unexpected error:', err);
    return { error: 'حدث خطأ غير متوقع' };
  }
};
