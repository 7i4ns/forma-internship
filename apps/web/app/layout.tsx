import type { ReactNode } from 'react';
import Providers from '../components/providers';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
export const metadata = { title: 'Forma · 工作空间', description: '团队工作空间与账号中心' };
export default function Layout({ children }: { children: ReactNode }) { return <html lang="zh-CN"><body><AppRouterCacheProvider><Providers>{children}</Providers></AppRouterCacheProvider></body></html>; }
