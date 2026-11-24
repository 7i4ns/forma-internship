'use client';
import { useEffect, useState, type ReactNode } from 'react';
import NextLink from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Alert, Avatar, Box, Button, CircularProgress, Divider, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Paper, Stack, Typography } from '@mui/material';
import Brand from './brand';
import GlobalChat from '../modules/ai-agent/components/global-chat';
import { useSession } from './providers';
import { api } from '../lib/api';
import { navigation } from '../lib/navigation';
export default function Workspace({ children }: { children: ReactNode }) {
  const { user, loading, error, refresh, setUser } = useSession();
  const pathname = usePathname(); const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false); const [busy, setBusy] = useState(false); const [logoutError, setLogoutError] = useState('');
  useEffect(() => { if (!loading && !user && !error) router.replace('/login'); }, [loading, user, error, router]);
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);
  async function logout() {
    setBusy(true); setLogoutError('');
    try { await api('/auth/logout', { method: 'POST' }); setUser(null); router.replace('/login'); }
    catch (error) { setLogoutError(error instanceof Error ? error.message : '退出失败，请重试'); }
    finally { setBusy(false); }
  }
  if ((loading && !user) || (!user && !error)) return <Stack sx={{ minHeight: '100dvh' }} alignItems="center" justifyContent="center" spacing={2}><CircularProgress size={28} /><Typography color="text.secondary">正在加载工作空间…</Typography></Stack>;
  if (error) return <Stack sx={{ minHeight: '100dvh', p: 4 }} alignItems="center" justifyContent="center" spacing={2}><Alert severity="error">{error}</Alert><Button onClick={() => void refresh()}>重新连接</Button></Stack>;
  if (!user) return null;
  const side = <Stack sx={{ height: '100%', p: 3 }}><Box sx={{ mb: 4 }}><Brand /></Box><Paper variant="outlined" sx={{ p: 1.6, mb: 4, bgcolor: '#f7f9f8' }}><Stack direction="row" spacing={1.3} alignItems="center"><Avatar variant="rounded" sx={{ width: 32, height: 32, fontSize: 15, bgcolor: '#dcebe2', color: 'primary.main' }}>F</Avatar><Box><Typography fontSize={13} fontWeight={700}>我的工作空间</Typography><Typography color="text.secondary" fontSize={11}>Personal workspace</Typography></Box></Stack></Paper><Typography sx={{ px: 1.5, mb: 1.5, color: '#8b9891', fontSize: 10, fontWeight: 700, letterSpacing: 1.5 }}>WORKSPACE</Typography><List disablePadding>{navigation.map(item => <ListItemButton key={item.href} component={NextLink} href={item.href} selected={pathname === item.href} aria-current={pathname === item.href ? 'page' : undefined} sx={{ borderRadius: 2, mb: .8, minHeight: 47, '&.Mui-selected': { bgcolor: '#e7f3ed', color: 'primary.main' }, '&.Mui-selected:hover': { bgcolor: '#dceee5' } }}><ListItemIcon sx={{ minWidth: 34, color: 'inherit', fontSize: 21 }}><span aria-hidden>{item.symbol}</span></ListItemIcon><ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: pathname === item.href ? 700 : 500 }} /></ListItemButton>)}</List><Box sx={{ mt: 'auto', pt: 3 }}><Divider sx={{ mb: 2 }} /><Stack direction="row" spacing={1.2} alignItems="center"><Avatar sx={{ width: 32, height: 32, bgcolor: '#eee8da', color: '#826a3f', fontSize: 13 }}>{user.email[0].toUpperCase()}</Avatar><Box sx={{ minWidth: 0 }}><Typography noWrap fontSize={12} fontWeight={600}>{user.email}</Typography><Typography fontSize={10} color="text.secondary">个人账号</Typography></Box></Stack></Box></Stack>;
  const current = navigation.find(item => item.href === pathname);
  return <Box sx={{ display: 'flex', minHeight: '100dvh' }}><Box component="nav" aria-label="主导航" sx={{ width: { md: 252 }, flexShrink: { md: 0 } }}><Drawer variant="permanent" sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { width: 252, boxSizing: 'border-box', borderRight: '1px solid #e4ebe7' } }}>{side}</Drawer><Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} sx={{ display: { md: 'none' }, '& .MuiDrawer-paper': { width: 252 } }}>{side}</Drawer></Box><Box sx={{ flex: 1, minWidth: 0 }}><Stack component="header" direction="row" alignItems="center" justifyContent="space-between" sx={{ height: 80, px: { xs: 2.5, md: 5 }, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'white' }}><Stack direction="row" spacing={2} alignItems="center"><IconButton aria-label="打开导航菜单" onClick={() => setMobileOpen(true)} sx={{ display: { md: 'none' } }}>☰</IconButton><Typography fontSize={13} color="text.secondary">工作空间<Box component="span" sx={{ mx: 1.5, color: '#b4beb8' }}>/</Box><Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>{current?.label}</Box></Typography></Stack><Stack direction="row" spacing={2} alignItems="center"><Typography sx={{ display: { xs: 'none', sm: 'block' }, fontSize: 12, color: 'text.secondary' }}>你好，{user.email.split('@')[0]}</Typography><Button variant="outlined" size="small" onClick={() => void logout()} disabled={busy} sx={{ minHeight: 34, px: 2 }}>{busy ? '退出中…' : '退出登录'}</Button></Stack></Stack><Box component="main" sx={{ p: { xs: 3, md: 5 }, maxWidth: 1360, mx: 'auto' }}>{logoutError && <Alert severity="error" sx={{ mb: 3 }}>{logoutError}</Alert>}{children}</Box></Box><GlobalChat key={user.id} userId={user.id} /></Box>;
}
