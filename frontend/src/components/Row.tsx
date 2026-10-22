import React from 'react';
import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '../i18n';

/** Day of month over a short month name, as in a calendar. */
export function DateBadge({ date }: { date: string }) {
  const { i18n } = useTranslation();
  const day = new Date(`${date.slice(0, 10)}T12:00:00`);
  return (
    <Box sx={{ width: 40, textAlign: 'center', flex: 'none' }}>
      <Typography sx={{ fontSize: 17, fontWeight: 600, lineHeight: 1.1 }}>{day.getDate()}</Typography>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '.04em' }}>
        {format(day, 'LLL', { locale: getDateFnsLocale(i18n.language) }).replace('.', '')}
      </Typography>
    </Box>
  );
}

/** Square icon tile at the start of a row. */
export function RowIcon({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <Box
      sx={{
        width: 34,
        height: 34,
        borderRadius: '9px',
        flex: 'none',
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'var(--surface-2)',
        color: color ?? 'text.secondary',
        '& svg': { fontSize: 18 },
      }}
    >
      {children}
    </Box>
  );
}

/** Rows with dividers between them. */
export function Rows({ children }: { children: React.ReactNode }) {
  return <Box sx={{ '& > * + *': { borderTop: '1px solid var(--border)' } }}>{children}</Box>;
}

/** Dense list row: leading badge or icon, title with a meta line, trailing amount. */
export function Row({
  leading,
  title,
  meta,
  metaColor,
  trailing,
  onClick,
  alignWithLinks,
}: {
  leading?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  metaColor?: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
  /** Leaves room for the arrow so amounts line up with clickable rows. */
  alignWithLinks?: boolean;
}) {
  const content = (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%', py: 1.25, textAlign: 'left' }}>
      {leading}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 500 }} noWrap>
          {title}
        </Typography>
        {meta && (
          <Typography variant="caption" sx={{ color: metaColor ?? 'text.secondary', display: 'block' }} noWrap>
            {meta}
          </Typography>
        )}
      </Box>
      {trailing !== undefined && (
        <Typography sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{trailing}</Typography>
      )}
      {onClick && <ChevronRightRoundedIcon sx={{ color: 'text.disabled', fontSize: 20, mr: -0.5 }} />}
      {!onClick && alignWithLinks && <Box sx={{ width: 20, mr: -0.5, flex: 'none' }} />}
    </Stack>
  );
  const sx = { display: 'flex', width: '100%' };
  return onClick ? (
    <ButtonBase onClick={onClick} sx={{ ...sx, borderRadius: 1, justifyContent: 'flex-start' }}>
      {content}
    </ButtonBase>
  ) : (
    <Box sx={sx}>{content}</Box>
  );
}
