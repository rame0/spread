import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

/** Logo with the app name next to it. */
export function Brand({ size = 28 }: { size?: number }) {
  const { t } = useTranslation();
  return (
    <Stack direction="row" alignItems="center" spacing={1.25}>
      <Box component="img" src="/logo.svg" alt="" sx={{ width: size, height: size, display: 'block' }} />
      <Typography sx={{ fontWeight: 700, fontSize: size * 0.56 }} noWrap>
        {t('app.title')}
      </Typography>
    </Stack>
  );
}

/** Full-screen loading state. */
export function PageLoading() {
  const { t } = useTranslation();
  return (
    <Stack sx={{ minHeight: '60vh' }} alignItems="center" justifyContent="center" spacing={2}>
      <CircularProgress size={28} />
      <Typography color="text.secondary">{t('app.loading')}</Typography>
    </Stack>
  );
}
