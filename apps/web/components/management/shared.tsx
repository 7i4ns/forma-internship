'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { api, ApiError } from '../../lib/api';
import { useSession } from '../providers';
export type Company = { id: string; external_id: string | null; name: string; level: string; country: string; city: string | null; founded_year: number | null; supplying_since: string | null; annual_revenue: number | null; employees: number | null; efficiency: number | null };
export type ManagedUser = { id: string; name: string; email: string; role: string; status: 'active' | 'inactive'; created_at: string };
export function useList<T>(resource: 'users' | 'companies', search: string, filters: string[], page: number, limit: number) {
  const [data, setData] = useState<{ items: T[]; total: number; roles?: string[]; levels?: string[] }>({ items: [], total: 0 });
  const [busy, setBusy] = useState(true); const [error, setError] = useState(''); const [revision, setRevision] = useState(0);
  const { setUser } = useSession(); const router = useRouter();
  const key = JSON.stringify(filters);
  useEffect(() => {
    const controller = new AbortController(); setBusy(true); setError('');
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ search, page: String(page), limit: String(limit) });
      for (const value of JSON.parse(key) as string[]) params.append(resource === 'users' ? 'roles' : 'levels', value);
      api<typeof data>(`/${resource}?${params}`, { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setData(result); }).catch(error => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) { setUser(null); router.replace('/login'); }
        else setError(error instanceof Error ? error.message : '加载失败，请重试');
      }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [resource, search, key, page, limit, revision, setUser, router]);
  return { ...data, busy, error, reload: () => setRevision(value => value + 1) };
}
export function Filters({ search, onSearch, selected, onSelect, options, type }: { search: string; onSearch: (v: string) => void; selected: string[]; onSelect: (v: string[]) => void; options: string[]; type: 'user' | 'company' }) {
  return <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ p: 3 }}><Autocomplete multiple options={[...new Set([...options, ...selected])]} value={selected} onChange={(_, value) => onSelect(value)} renderInput={params => <TextField {...params} label={type === 'user' ? '职位 / 角色' : '公司等级'} placeholder={selected.length ? '' : '全部'} size="small" />} sx={{ width: { xs: '100%', sm: 300 }, flexShrink: 0 }} /><TextField size="small" fullWidth label={type === 'user' ? '按姓名搜索' : '按公司名搜索'} placeholder={type === 'user' ? '输入用户姓名…' : '输入公司名称…'} value={search} onChange={e => onSearch(e.target.value)} inputProps={{ maxLength: 200 }} />{(search || selected.length > 0) && <Button onClick={() => { onSearch(''); onSelect([]); }} sx={{ flexShrink: 0 }}>清除筛选</Button>}</Stack>;
}
export function PageHeader({ title, description, action, onAdd }: { title: string; description: string; action: string; onAdd: () => void }) {
  return <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}><Box><Typography fontSize={11} letterSpacing={1.5} color="text.secondary" sx={{ mb: 1 }}>WORKSPACE / MANAGEMENT</Typography><Typography component="h1" variant="h4">{title}</Typography><Typography fontSize={14} color="text.secondary" sx={{ mt: 1 }}>{description}</Typography></Box><Button variant="contained" onClick={onAdd} sx={{ flexShrink: 0 }}>＋ {action}</Button></Stack>;
}
export function ConfirmDelete({ open, busy, error, title, description, onClose, onConfirm }: { open: boolean; busy: boolean; error: string; title: string; description: string; onClose: () => void; onConfirm: () => void }) {
  return <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs" aria-labelledby="delete-title"><DialogTitle id="delete-title">{title}</DialogTitle><DialogContent>{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}<Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{description}</Typography><Typography color="error" fontSize={13} sx={{ mt: 2 }}>删除后无法恢复。</Typography></DialogContent><DialogActions sx={{ p: 3 }}><Button disabled={busy} onClick={onClose}>取消</Button><Button variant="contained" color="error" disabled={busy} onClick={onConfirm}>{busy ? '删除中…' : '确认删除'}</Button></DialogActions></Dialog>;
}
export function EmptyRows({ search, columns }: { search: boolean; columns: number }) { return <Box component="tr"><Box component="td" colSpan={columns} sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}><Typography fontWeight={600}>{search ? '未找到匹配结果' : '暂无数据'}</Typography><Typography fontSize={13} sx={{ mt: 1 }}>{search ? '尝试更改关键词或清除筛选。' : '点击右上角按钮添加第一条记录。'}</Typography></Box></Box>; }
export const number = (value: number | null) => value === null ? '—' : new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value);
