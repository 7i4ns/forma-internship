'use client';
import { useEffect, useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Box, Button, Chip, LinearProgress, Paper, Skeleton, Stack, SvgIcon, Tooltip, Typography } from '@mui/material';
import { api, ApiError } from '../../lib/api';
import { compactNumber, type DashboardData } from '../../lib/dashboard';
import { useSession } from '../providers';
import { CompanyGrowth, LevelDistribution } from './charts';
import CompanyBars from './company-bars';
import { Metric } from './metric';
export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null); const [busy, setBusy] = useState(true); const [error, setError] = useState(''); const [revision, setRevision] = useState(0);
  const { setUser } = useSession(); const router = useRouter();
  useEffect(() => {
    let alive = true; let controller: AbortController | null = null; let inFlight = false;
    async function load() {
      if (inFlight) return; inFlight = true; controller = new AbortController(); setBusy(true);
      try {
        const value = await api<DashboardData>('/dashboard', { signal: controller.signal });
        if (alive) { setData(value); setError(''); }
      } catch (error) {
        if (!alive) return;
        if (error instanceof ApiError && error.status === 401) { setUser(null); router.replace('/login'); }
        else setError(error instanceof Error ? error.message : '加载失败，请重试');
      } finally { inFlight = false; if (alive) setBusy(false); }
    }
    void load();
    const interval = setInterval(() => { if (!document.hidden) void load(); }, 30000);
    const focus = () => { void load(); }; window.addEventListener('focus', focus);
    return () => { alive = false; controller?.abort(); clearInterval(interval); window.removeEventListener('focus', focus); };
  }, [revision, setUser, router]);
  return <Stack spacing={3} aria-busy={busy}><Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={2}><Box><Typography color="text.secondary" fontSize={10} letterSpacing={2} sx={{ mb: 1 }}>COMPANY INTELLIGENCE</Typography><Typography component="h1" variant="h4">Dashboard</Typography><Typography color="text.secondary" fontSize={13} sx={{ mt: 1 }}>供应链网络概览，掌握公司的规模、分布与增长。</Typography></Box><Stack direction="row" spacing={1} alignItems="center"><Chip size="small" label="全部公司" variant="outlined" sx={{ fontSize: 11 }} /><Button variant="outlined" size="small" disabled={busy} onClick={() => setRevision(value => value+1)}>{busy ? '更新中…' : '刷新数据'}</Button></Stack></Stack>
    {error && <Alert severity={data ? 'warning' : 'error'} action={<Button onClick={() => setRevision(value => value+1)} disabled={busy}>重试</Button>}>{data ? '刷新失败，当前仍显示上次成功获取的数据。' : ''}{error}</Alert>}
    {busy && data && <LinearProgress sx={{ borderRadius: 1 }} />}
    {!data && busy && <><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4,1fr)' }, gap: 2.5 }}>{[0,1,2,3].map(i => <Skeleton key={i} variant="rounded" height={165} />)}</Box><Skeleton variant="rounded" height={450} /></>}
    {data && <><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4,1fr)' }, gap: 2.5 }}><Metric label="公司数量" value={data.summary.companyCount} suffix="家" caption="供应链网络中的全部公司" icon={0} tint="#e8f1e7" /><Metric label="总收入" value={data.summary.totalRevenue} suffix="" caption={`年营收合计 · ${data.summary.revenueReported}/${data.summary.companyCount} 家已提供`} icon={1} tint="#f5efdf" /><Metric label="覆盖国家" value={data.summary.countryCount} suffix="个" caption="去除空白与大小写差异后去重" icon={2} tint="#e6eff1" /><Metric label="员工数量" value={data.summary.totalEmployees} suffix="人" caption={`已知员工合计 · ${data.summary.employeesReported}/${data.summary.companyCount} 家已提供`} icon={3} tint="#eeeaf3" /></Box>
    {data.summary.companyCount === 0 && <Alert severity="info" action={<Button component={NextLink} href="/company">添加公司</Button>}>暂无公司数据。添加或导入公司后，数据卡与图表会自动更新。</Alert>}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0,1.25fr) minmax(0,1fr)' }, gap: 3, alignItems: 'start' }}><CompanyGrowth data={data} /><LevelDistribution data={data} /></Box>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}><Typography color="text.secondary" fontSize={10}>收入按 annual_revenue 原值合计，使用原始金额单位，未做币种换算。</Typography><Typography color="text.secondary" fontSize={10}>每 30 秒更新 · 最近更新 {new Date(data.generatedAt).toLocaleTimeString('zh-CN', { hour12: false })}</Typography></Stack></>}
    <CompanyBars refreshKey={revision} />
  </Stack>;
}
