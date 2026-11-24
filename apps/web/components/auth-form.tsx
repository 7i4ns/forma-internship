'use client';
import { useEffect, useState, type FormEvent } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Box, Button, CircularProgress, Divider, IconButton, InputAdornment, Link, Paper, Stack, TextField, Typography } from '@mui/material';
import Brand from './brand';
import { useSession } from './providers';
import { api, ApiError, type User } from '../lib/api';
export default function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const signup = mode === 'signup';
  const router = useRouter();
  const { user, setUser, loading } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!loading && user) router.replace('/dashboard'); }, [loading, user, router]);
  function validate(field: 'email' | 'password', value: string) {
    if (!value.trim()) return field === 'email' ? '请输入电子邮箱' : '请输入密码';
    if (field === 'email') return value.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? '请输入有效的电子邮箱地址' : '';
    if (value.length < 8 || value.length > 128) return '密码长度需要为 8–128 位';
    if (!/^(?=.*[A-Za-z])(?=.*[0-9])[^\s\x00-\x1f\x7f]+$/.test(value)) return '密码须包含字母和数字，不能包含空格或控制字符';
    return '';
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || success) return;
    const nextErrors = { email: validate('email', email), password: validate('password', password) };
    setErrors(nextErrors); setMessage('');
    if (Object.values(nextErrors).some(Boolean)) return;
    setBusy(true);
    try {
      const data = await api<{ user: User; message: string }>(`/auth/${mode}`, { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) });
      setPassword('');
      if (signup) setSuccess(data.message);
      else { setUser(data.user); router.replace('/dashboard'); }
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.field ? { [error.field]: error.message } : error.errors);
        setMessage(error.field || Object.keys(error.errors).length ? '' : error.message);
      } else setMessage('发生意外错误，请稍后重试');
    } finally { setBusy(false); }
  }
  return <Box sx={{ minHeight: '100dvh', display: 'grid', gridTemplateColumns: { xs: '1fr', md: '44% 56%' }, bgcolor: 'white' }}>
    <Box sx={{ display: { xs: 'none', md: 'flex' }, bgcolor: '#163f33', color: 'white', p: { md: 5, lg: 7 }, position: 'relative', overflow: 'hidden', flexDirection: 'column', justifyContent: 'space-between' }}>
      <Brand light />
      <Box sx={{ position: 'absolute', width: 440, height: 440, border: '1px solid #ffffff12', borderRadius: '50%', top: '25%', left: '30%' }} /><Box sx={{ position: 'absolute', width: 320, height: 320, border: '1px solid #ffffff18', borderRadius: '50%', top: '33%', left: '43%' }} />
      <Box sx={{ position: 'relative', my: 8, maxWidth: 390 }}><Typography sx={{ color: '#bdd4a1', fontSize: 12, fontWeight: 700, letterSpacing: 3, mb: 3 }}>YOUR SPACE TO GROW</Typography><Typography variant="h3" sx={{ fontSize: { md: 44, lg: 54 }, lineHeight: 1.2, mb: 3 }}>让每一步，<br />都有条不紊。</Typography><Typography sx={{ color: '#b6cdc2', lineHeight: 1.9 }}>从一个工作空间开始，连接你的团队、业务与日常。</Typography>
      <Paper sx={{ mt: 5, p: 3, bgcolor: '#ffffff0c', border: '1px solid #ffffff1f', color: 'white', borderRadius: 3 }}><Stack direction="row" alignItems="center" spacing={1.5}><Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: '#d8eab6', color: '#163f33', display: 'grid', placeItems: 'center' }}>✓</Box><Box><Typography fontWeight={600} fontSize={14}>专注当下，轻松协作</Typography><Typography sx={{ color: '#b6cdc2', fontSize: 12, mt: .5 }}>一个账号，开启你的工作空间</Typography></Box></Stack><Divider sx={{ my: 2.5, borderColor: '#ffffff1a' }} /><Stack direction="row" spacing={1}>{['Dashboard', 'Company', 'Order', 'User'].map(label => <Box key={label} sx={{ px: 1, py: .6, border: '1px solid #ffffff22', borderRadius: 1, fontSize: 11, color: '#c8d9d0' }}>{label}</Box>)}</Stack></Paper></Box>
      <Typography sx={{ color: '#9cb9ab', fontSize: 12 }}>FORMA WORKSPACE · 为有序工作而设计</Typography>
    </Box>
    <Stack sx={{ px: { xs: 3, sm: 6 }, py: 4, minHeight: '100dvh' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center"><Box sx={{ display: { md: 'none' } }}><Brand /></Box><Box sx={{ ml: 'auto' }}><Typography variant="body2" color="text.secondary">{signup ? '已有账号？' : '还没有账号？'} <Link component={NextLink} href={signup ? '/login' : '/signup'} underline="hover" fontWeight={700}>{signup ? '登录' : '创建账号'} →</Link></Typography></Box></Stack>
      <Box sx={{ width: '100%', maxWidth: 400, m: 'auto', py: 7 }}>
        <Typography sx={{ color: 'primary.main', fontSize: 12, fontWeight: 700, letterSpacing: 2, mb: 2 }}>{signup ? 'GET STARTED' : 'WELCOME BACK'}</Typography><Typography component="h1" variant="h4" sx={{ mb: 1.5 }}>{signup ? '创建你的账号' : '欢迎回来'}</Typography><Typography color="text.secondary" sx={{ mb: 4, fontSize: 14 }}>{signup ? '填写以下信息，开启你的工作空间。' : '登录 Forma，继续今天的工作。'}</Typography>
        {success ? <Stack spacing={3}><Alert severity="success">{success}</Alert><Button component={NextLink} href="/login" variant="contained" fullWidth>前往登录 →</Button></Stack> : <Box component="form" onSubmit={submit} noValidate aria-label={signup ? '注册表单' : '登录表单'}><Stack spacing={2.6}>
          {message && <Alert severity="error">{message}</Alert>}
          <TextField id="email" label="电子邮箱" placeholder="you@company.com" type="email" autoComplete="email" required fullWidth value={email} disabled={busy} error={!!errors.email} helperText={errors.email} onBlur={() => setErrors(old => ({ ...old, email: validate('email', email) }))} onChange={event => { setEmail(event.target.value); setErrors(old => ({ ...old, email: '' })); setMessage(''); }} inputProps={{ maxLength: 254 }} />
          <TextField id="password" label="密码" placeholder="请输入密码" type={showPassword ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} required fullWidth value={password} disabled={busy} error={!!errors.password} helperText={errors.password || (signup ? '8–128 位，包含字母和数字，不含空白字符' : undefined)} onBlur={() => setErrors(old => ({ ...old, password: validate('password', password) }))} onChange={event => { setPassword(event.target.value); setErrors(old => ({ ...old, password: '' })); setMessage(''); }} inputProps={{ maxLength: 128 }} InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? '隐藏密码' : '显示密码'} aria-pressed={showPassword} disabled={busy}><Typography fontSize={12}>{showPassword ? '隐藏' : '显示'}</Typography></IconButton></InputAdornment> }} />
          <Button type="submit" fullWidth variant="contained" size="large" disabled={busy} sx={{ mt: 1, height: 49 }}>{busy ? <><CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />正在处理…</> : signup ? '创建账号 →' : '登录 →'}</Button>
        </Stack></Box>}
        <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 4 }}><Typography sx={{ color: 'text.secondary', fontSize: 12 }}>◇</Typography><Typography sx={{ color: 'text.secondary', fontSize: 12 }}>密码采用加盐哈希，安全存储</Typography></Stack>
      </Box>
      <Typography textAlign="center" color="text.secondary" fontSize={11}>© {new Date().getFullYear()} Forma Workspace</Typography>
    </Stack>
  </Box>;
}
