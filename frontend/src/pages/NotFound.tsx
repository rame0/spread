import { Link } from 'react-router-dom';
import { Box, Button, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <Stack spacing={2} alignItems="center" sx={{ py: 10, textAlign: 'center' }}>
      <Box component="img" src="/logo.svg" alt="" sx={{ width: 72, height: 72, opacity: 0.8 }} />
      <Typography variant="h5">{t('notFound.title')}</Typography>
      <Button component={Link} to="/" variant="outlined">
        {t('notFound.back')}
      </Button>
    </Stack>
  );
}
