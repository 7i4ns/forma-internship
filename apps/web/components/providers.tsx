'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { api, ApiError, type User } from '../lib/api';
const theme = createTheme({
  palette: { primary: { main: '#176b56', dark: '#0d493c', light: '#e7f3ed' }, secondary: { main: '#c5a36b' }, background: { default: '#f7f9f8', paper: '#ffffff' }, text: { primary: '#182e28', secondary: '#6a7973' }, divider: '#e4ebe7' },
  typography: { fontFamily: 'Arial, "PingFang SC", "Microsoft YaHei", sans-serif', h3: { fontWeight: 700, letterSpacing: '-1.2px' }, h4: { fontWeight: 700, letterSpacing: '-.7px' }, h5: { fontWeight: 700 }, button: { textTransform: 'none', fontWeight: 600 } },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { minHeight: 44, borderRadius: 9 } } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 9 } } },
    MuiPaper: { defaultProps: { elevation: 0 } },
  },
});
type Session = { user: User | null; loading: boolean; error: string; refresh: () => Promise<void>; setUser: (user: User | null) => void };
const SessionContext = createContext<Session | null>(null);
export function useSession() { const context = useContext(SessionContext); if (!context) throw new Error('Session provider missing'); return context; }
export default function Providers({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try { const data = await api<{ user: User }>('/auth/me'); setUser(data.user); }
    catch (error) { setUser(null); if (!(error instanceof ApiError && error.status === 401)) setError(error instanceof Error ? error.message : '加载失败'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return <ThemeProvider theme={theme}><CssBaseline /><SessionContext.Provider value={{ user, loading, error, refresh, setUser }}>{children}</SessionContext.Provider></ThemeProvider>;
}
