'use client';
import { useState } from 'react';
import { Alert, Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';
import { api, ApiError } from '../../lib/api';
import type { Company } from './shared';
export default function CompanyEditor({ company, levels, onClose, onSaved }: { company: Company | null; levels: string[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: company?.name || '', level: company?.level || '', country: company?.country || '', city: company?.city || '', founded_year: company?.founded_year?.toString() || '', supplying_since: company?.supplying_since || '', annual_revenue: company?.annual_revenue?.toString() || '', employees: company?.employees?.toString() || '' });
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [errors, setErrors] = useState<Record<string,string>>({});
  const change = (key: keyof typeof form, value: string) => { setForm(old => ({ ...old, [key]: value })); setErrors(old => ({ ...old, [key]: '' })); };
  async function save() {
    const next: Record<string,string> = {};
    for (const [key, max] of [['name',200],['level',80],['country',100]] as const) if (!form[key].trim() || form[key].trim().length > max) next[key] = `此项必填，最多 ${max} 个字符`;
    if (/[\x00-\x1f\x7f]/.test(form.name)) next.name = '公司名不能包含控制字符';
    if (form.city.length > 120) next.city = '城市最多 120 个字符';
    if (form.founded_year && (!/^\d{4}$/.test(form.founded_year) || Number(form.founded_year) < 1000 || Number(form.founded_year) > new Date().getFullYear())) next.founded_year = '请输入不晚于今年的四位年份';
    if (form.employees && (!/^\d+$/.test(form.employees) || Number(form.employees) > 2147483647)) next.employees = '请输入 0–2147483647 的整数';
    if (form.annual_revenue && (!/^\d+(\.\d{1,2})?$/.test(form.annual_revenue) || Number(form.annual_revenue) > 1e15)) next.annual_revenue = '请输入非负数字，最多两位小数，最大 10¹⁵';
    if (form.supplying_since && !/^\d{4}-\d{2}-\d{2}$/.test(form.supplying_since)) next.supplying_since = '请输入有效日期';
    setErrors(next); if (Object.keys(next).length) return;
    setBusy(true); setError('');
    try {
      const body = { ...form, city: form.city || null, founded_year: form.founded_year ? Number(form.founded_year) : null, employees: form.employees ? Number(form.employees) : null, annual_revenue: form.annual_revenue ? Number(form.annual_revenue) : null, supplying_since: form.supplying_since || null };
      await api(company ? `/companies/${company.id}` : '/companies', { method: company ? 'PATCH' : 'POST', body: JSON.stringify(body) }); onSaved();
    } catch (e) { if (e instanceof ApiError) setErrors(e.errors); setError(e instanceof Error ? e.message : '保存失败'); }
    finally { setBusy(false); }
  }
  const text = (key: keyof typeof form, label: string, required = false, type = 'text') => <TextField label={label} required={required} type={type} value={form[key]} onChange={e => change(key, e.target.value)} disabled={busy} error={!!errors[key]} helperText={errors[key] || (key === 'annual_revenue' ? '使用原数据币种与单位；不代表净利润' : undefined)} fullWidth {...(type === 'date' ? { InputLabelProps: { shrink: true } } : {})} />;
  return <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="company-editor-title"><DialogTitle id="company-editor-title">{company ? '编辑公司' : '添加公司'}</DialogTitle><DialogContent><Stack component="form" noValidate onSubmit={e => { e.preventDefault(); void save(); }} spacing={2.5} sx={{ pt: 1 }}>{error && <Alert severity="error">{error}</Alert>}{text('name','公司名称',true)}<Autocomplete freeSolo options={levels} inputValue={form.level} onInputChange={(_,value) => change('level',value)} disabled={busy} renderInput={params => <TextField {...params} label="公司等级" required error={!!errors.level} helperText={errors.level || '选择已有等级，或输入新等级'} />} /><Stack direction={{xs:'column',sm:'row'}} spacing={2}>{text('country','国家',true)}{text('city','城市')}</Stack><Stack direction={{xs:'column',sm:'row'}} spacing={2}>{text('founded_year','成立年份（Founded year）')}{text('supplying_since','开始供应日期',false,'date')}</Stack>{text('annual_revenue','年营收（Annual revenue）')}{text('employees','员工数量')}<Button type="submit" sx={{ display: 'none' }}>保存</Button></Stack></DialogContent><DialogActions sx={{ p: 3 }}><Button disabled={busy} onClick={onClose}>取消</Button><Button variant="contained" disabled={busy} onClick={() => void save()}>{busy ? '保存中…' : '保存公司'}</Button></DialogActions></Dialog>;
}
