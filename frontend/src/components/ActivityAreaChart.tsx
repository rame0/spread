import React, { useId } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format, type Locale } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '../i18n';
import { formatMoney } from '../formatMoney';
import type { ActivityChartGranularity, ActivityChartPoint } from '../types/v2';

type ActivityAreaChartProps = {
  data: ActivityChartPoint[];
  color: string;
  granularity: ActivityChartGranularity;
};

function asLocalDate(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

function formatPointLabel(point: ActivityChartPoint, granularity: ActivityChartGranularity, locale: Locale): string {
  const start = asLocalDate(point.startDate);
  if (granularity === 'day') return format(start, 'd MMMM yyyy', { locale });

  const end = asLocalDate(point.endDate);
  if (granularity === 'month') return format(start, 'LLLL yyyy', { locale });
  return `${format(start, 'd MMM', { locale })} — ${format(end, 'd MMM yyyy', { locale })}`;
}

function formatTick(value: string, granularity: ActivityChartGranularity, locale: Locale): string {
  const date = asLocalDate(value);
  if (granularity === 'day') return format(date, 'd MMM', { locale });
  if (granularity === 'week') return format(date, 'd MMM', { locale });
  return format(date, 'LLL yy', { locale });
}

function formatAxisAmount(value: number, language: string): string {
  return new Intl.NumberFormat(language.startsWith('ru') ? 'ru-RU' : 'en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export default function ActivityAreaChart({ data, color, granularity }: ActivityAreaChartProps) {
  const { i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  const gradientId = `activity-gradient-${useId().replace(/:/g, '')}`;

  return (
    <Box sx={{ height: { xs: 260, md: 300 }, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.42} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="startDate"
            axisLine={false}
            tickLine={false}
            minTickGap={36}
            padding={{ left: 8, right: 8 }}
            tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
            tickFormatter={(value) => formatTick(value, granularity, locale)}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={62}
            domain={[0, 'auto']}
            tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
            tickFormatter={(value) => formatAxisAmount(Number(value), i18n.language)}
          />
          <Tooltip
            cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '3 3' }}
            content={<ActivityTooltip granularity={granularity} locale={locale} />}
            allowEscapeViewBox={{ x: false, y: false }}
          />
          <Area
            type="linear"
            dataKey="amount"
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            activeDot={{ r: 4, fill: color, stroke: 'var(--surface)', strokeWidth: 2 }}
            dot={data.length === 1 ? { r: 4, fill: color, stroke: 'var(--surface)', strokeWidth: 2 } : false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
}

function ActivityTooltip({
  active,
  payload,
  granularity,
  locale,
}: {
  active?: boolean;
  payload?: Array<{ payload: ActivityChartPoint }>;
  granularity: ActivityChartGranularity;
  locale: Locale;
}) {
  if (!active || !payload?.[0]) return null;
  const point = payload[0].payload;

  return (
    <Paper sx={{ px: 1.5, py: 1, borderColor: 'divider', boxShadow: '0 8px 24px rgba(0, 0, 0, .24)' }}>
      <Typography variant="caption" color="text.secondary" display="block">
        {formatPointLabel(point, granularity, locale)}
      </Typography>
      <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {formatMoney(point.amount)}
      </Typography>
    </Paper>
  );
}

export { formatAxisAmount, formatPointLabel, formatTick };
