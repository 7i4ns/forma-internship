'use client';
import { Box, Stack, Typography } from '@mui/material';
export default function Brand({ light = false }: { light?: boolean }) {
  return <Stack direction="row" spacing={1.2} alignItems="center"><Box aria-hidden sx={{ width: 34, height: 34, bgcolor: light ? '#d8eab6' : 'primary.main', color: light ? '#163d30' : 'white', display: 'grid', placeItems: 'center', borderRadius: '10px', fontSize: 25, fontWeight: 800 }}>f</Box><Typography sx={{ fontSize: 24, fontWeight: 750, letterSpacing: '-1px', color: light ? 'white' : 'text.primary' }}>forma<Box component="span" sx={{ color: light ? '#d8eab6' : 'primary.main' }}>.</Box></Typography></Stack>;
}
