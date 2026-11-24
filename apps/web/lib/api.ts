export type User = { id: string; email: string; created_at: string; name: string; role: string; status: string };
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public errors: Record<string, string> = {}, public field?: string) { super(message); }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { ...options, credentials: 'same-origin', cache: 'no-store', headers: { ...(typeof FormData !== 'undefined' && options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers } });
  } catch { throw new ApiError(0, 'NETWORK_ERROR', '无法连接服务器，请检查网络后重试'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, data.code || 'SERVER_ERROR', response.status >= 500 ? '服务器暂时不可用，请稍后重试' : data.message || '请求失败，请重试', data.errors, data.field);
  return data as T;
}
