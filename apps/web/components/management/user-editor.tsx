'use client';
import { useState } from 'react';
import { Alert, Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from '@mui/material';
import { api, ApiError } from '../../lib/api';
import type { ManagedUser } from './shared';
export default function UserEditor({ user, roles, onClose, onSaved }: { user: ManagedUser | null; roles: string[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', role: user?.role || 'Member', status: user?.status || 'active', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({}); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const change = (key: keyof typeof form, value: string) => { setForm(old => ({ ...old, [key]: value })); setErrors(old => ({ ...old, [key]: '' })); };
  async function save() {
    const next: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length > 100 || /[\x00-\x1f\x7f]/.test(form.name)) next.name = '姓名必填，最多 100 字符，不可含控制字符';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) || form.email.trim().length > 254) next.email = '请输入有效的电子邮箱';
    if (!form.role.trim() || form.role.trim().length > 80) next.role = '请填写职位 / 角色，最多 80 字符';
    if (!user && (form.password.length < 8 || form.password.length > 128 || !/^(?=.*[A-Za-z])(?=.*[0-9])[^\s\x00-\x1f\x7f]+$/.test(form.password))) next.password = '8–128 位，包含字母和数字，不含空白或控制字符';
    setErrors(next); if (Object.keys(next).length) return;
    setBusy(true); setError('');
    try {
      const { password, ...rest } = form;
      await api(user ? `/users/${user.id}` : '/users', { method: user ? 'PATCH' : 'POST', body: JSON.stringify({ ...rest, ...(!user ? { password } : {}) }) });
      onSaved();
    } catch (e) { if (e instanceof ApiError) setErrors(e.errors); setError(e instanceof Error ? e.message : '保存失败'); }
    finally { setBusy(false); }
  }
  return <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="user-editor-title"><DialogTitle id="user-editor-title">{user ? '编辑用户' : '添加用户'}</DialogTitle><DialogContent><Stack component="form" noValidate onSubmit={event => { event.preventDefault(); void save(); }} spacing={2.5} sx={{ pt: 1 }}>{error && <Alert severity="error">{error}</Alert>}<TextField label="姓名" required value={form.name} disabled={busy} onChange={e => change('name', e.target.value)} error={!!errors.name} helperText={errors.name} inputProps={{ maxLength: 100 }} /><TextField label="电子邮箱" type="email" required value={form.email} disabled={busy} onChange={e => change('email', e.target.value)} error={!!errors.email} helperText={errors.email} inputProps={{ maxLength: 254 }} /><Autocomplete freeSolo options={[...new Set(['Member', ...roles])]} inputValue={form.role} onInputChange={(_, value) => change('role', value)} disabled={busy} renderInput={params => <TextField {...params} label="职位 / 角色" required error={!!errors.role} helperText={errors.role || '可选择已有职位，或输入新职位'} />} /><TextField select label="状态" value={form.status} disabled={busy} onChange={e => change('status', e.target.value)}><MenuItem value="active">正常 · Active</MenuItem><MenuItem value="inactive">停用 · Inactive</MenuItem></TextField>{!user && <TextField label="初始密码" type="password" autoComplete="new-password" required value={form.password} disabled={busy} onChange={e => change('password', e.target.value)} error={!!errors.password} helperText={errors.password || '8–128 位，包含字母和数字'} inputProps={{ maxLength: 128 }} />}<Button type="submit" sx={{ display: 'none' }}>保存</Button></Stack></DialogContent><DialogActions sx={{ p: 3 }}><Button onClick={onClose} disabled={busy}>取消</Button><Button onClick={() => void save()} variant="contained" disabled={busy}>{busy ? '保存中…' : '保存用户'}</Button></DialogActions></Dialog>;
}
