import React from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '../i18n';
import { formatMoneyWhole } from '../formatMoney';

export type Series = { key: string; label: string; color: string };

const CHART_HEIGHT = { xs: 200, md: 220 };
const axisTick = { fill: 'var(--text-secondary)', fontSize: 11 };

const compact = (value: number, language: string) =>
  new Intl.NumberFormat(language.startsWith('ru') ? 'ru-RU' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

/** Short month name; January also shows the year. */
function useMonthLabel() {
  const { i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  return (month: string) => {
    const date = new Date(`${month.slice(0, 7)}-15T12:00:00`);
    return format(date, date.getMonth() === 0 ? 'LLL yy' : 'LLL', { locale }).replace('.', '');
  };
}

function useLongMonthLabel() {
  const { i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);
  return (month: string) => format(new Date(`${month.slice(0, 7)}-15T12:00:00`), 'LLLL yyyy', { locale });
}

/** Tooltip with a colored dot per series; values are shown without their sign when `absolute`. */
function MonthTooltip({ active, payload, label, series, absolute, total }: {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; value?: number | string }>;
  label?: string;
  series: Series[];
  absolute?: boolean;
  total?: string;
}) {
  const longMonth = useLongMonthLabel();
  if (!active || !payload?.length || !label) return null;
  const values = new Map(payload.map((item) => [String(item.dataKey), Number(item.value)]));
  const rows = series.filter((item) => values.has(item.key) && values.get(item.key) !== 0 && !Number.isNaN(values.get(item.key)));
  const sum = rows.reduce((acc, item) => acc + Math.abs(values.get(item.key) ?? 0), 0);
  return (
    <Paper sx={{ px: 1.5, py: 1, minWidth: 180, boxShadow: '0 8px 24px rgba(0, 0, 0, .24)' }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, '&::first-letter': { textTransform: 'uppercase' } }}>
        {longMonth(label)}
      </Typography>
      {rows.map((item) => {
        const value = values.get(item.key) ?? 0;
        return (
          <Stack key={item.key} direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: item.color, flex: 'none' }} />
              <Typography variant="body2">{item.label}</Typography>
            </Stack>
            <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {formatMoneyWhole(absolute ? Math.abs(value) : value)}
            </Typography>
          </Stack>
        );
      })}
      {total && rows.length > 1 && (
        <Stack direction="row" spacing={1.5} justifyContent="space-between" sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid var(--border)' }}>
          <Typography variant="body2" color="text.secondary">{total}</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatMoneyWhole(sum)}</Typography>
        </Stack>
      )}
    </Paper>
  );
}

/** Colored squares with series names under a chart. */
export function ChartLegend({ series, line }: { series: Series[]; line?: Series }) {
  return (
    <Stack direction="row" flexWrap="wrap" useFlexGap columnGap={1.75} rowGap={0.5} sx={{ mt: 1 }}>
      {series.map((item) => (
        <Stack key={item.key} direction="row" spacing={0.75} alignItems="center">
          <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: item.color }} />
          <Typography variant="caption" color="text.secondary">{item.label}</Typography>
        </Stack>
      ))}
      {line && (
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Box sx={{ width: 12, height: 2, borderRadius: 1, bgcolor: line.color }} />
          <Typography variant="caption" color="text.secondary">{line.label}</Typography>
        </Stack>
      )}
    </Stack>
  );
}

/**
 * Monthly stacked bars, positive ones up and negative ones down, with an optional line.
 * The line gets its own axis on the right when its scale differs from the bars.
 */
export function MonthBars({ data, bars, line, lineAxis = 'left', absolute, total }: {
  data: Array<{ month: string } & Record<string, number | string>>;
  bars: Series[];
  line?: Series;
  lineAxis?: 'left' | 'right';
  absolute?: boolean;
  total?: string;
}) {
  const { i18n } = useTranslation();
  const monthLabel = useMonthLabel();
  const series = line ? [...bars, line] : bars;
  return (
    <Box sx={{ height: CHART_HEIGHT, minWidth: 0, mx: -1 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} stackOffset="sign" margin={{ top: 8, right: lineAxis === 'right' ? 0 : 8, bottom: 0, left: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={axisTick} tickFormatter={monthLabel} interval="preserveStartEnd" minTickGap={8} />
          <YAxis yAxisId="left" axisLine={false} tickLine={false} width={58} tick={axisTick} tickFormatter={(value) => compact(absolute ? Math.abs(Number(value)) : Number(value), i18n.language)} />
          {line && lineAxis === 'right' && (
            <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} width={58} tick={axisTick} domain={[(min: number) => Math.min(0, min), 'auto']} tickFormatter={(value) => compact(Number(value), i18n.language)} />
          )}
          <ReferenceLine yAxisId="left" y={0} stroke="var(--border)" />
          <Tooltip cursor={{ fill: 'color-mix(in srgb, var(--text-primary) 5%, transparent)' }} content={<MonthTooltip series={series} absolute={absolute} total={total} />} />
          {bars.map((item, index) => (
            <Bar
              key={item.key}
              yAxisId="left"
              dataKey={item.key}
              name={item.label}
              stackId="month"
              fill={item.color}
              maxBarSize={28}
              radius={index === bars.length - 1 ? [3, 3, 0, 0] : 0}
              isAnimationActive={false}
            />
          ))}
          {line && (
            <Line
              yAxisId={lineAxis}
              type="monotone"
              dataKey={line.key}
              name={line.label}
              stroke={line.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3.5, fill: line.color, stroke: 'var(--surface)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </Box>
  );
}

/** Two bars side by side per month, e.g. plan and fact. */
export function MonthPairs({ data, bars }: { data: Array<{ month: string } & Record<string, number | string | null>>; bars: [Series, Series] }) {
  const { i18n } = useTranslation();
  const monthLabel = useMonthLabel();
  return (
    <Box sx={{ height: CHART_HEIGHT, minWidth: 0, mx: -1 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={3} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={axisTick} tickFormatter={monthLabel} />
          <YAxis axisLine={false} tickLine={false} width={58} tick={axisTick} tickFormatter={(value) => compact(Number(value), i18n.language)} />
          <ReferenceLine y={0} stroke="var(--border)" />
          <Tooltip cursor={{ fill: 'color-mix(in srgb, var(--text-primary) 5%, transparent)' }} content={<MonthTooltip series={bars} />} />
          {bars.map((item) => (
            <Bar key={item.key} dataKey={item.key} name={item.label} fill={item.color} maxBarSize={22} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </Box>
  );
}

/** Stacked areas of parts over dates with a line for their total. */
export function StackedHistory({ data, areas, line }: { data: Array<{ date: string } & Record<string, number | string>>; areas: Series[]; line: Series }) {
  const { i18n } = useTranslation();
  const monthLabel = useMonthLabel();
  return (
    <Box sx={{ height: { xs: 170, md: 180 }, minWidth: 0, mx: -1 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={axisTick} tickFormatter={monthLabel} interval="preserveStartEnd" minTickGap={16} />
          <YAxis axisLine={false} tickLine={false} width={58} tick={axisTick} tickFormatter={(value) => compact(Number(value), i18n.language)} />
          <Tooltip content={<MonthTooltip series={[...areas, line]} />} />
          {areas.map((item) => (
            <Area key={item.key} type="monotone" dataKey={item.key} name={item.label} stackId="parts" stroke={item.color} strokeWidth={1.5} fill={item.color} fillOpacity={0.22} isAnimationActive={false} />
          ))}
          <Line type="monotone" dataKey={line.key} name={line.label} stroke={line.color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </Box>
  );
}

/** One horizontal bar split into parts, with the parts listed below. */
export function CompositionBar({ parts, formatValue }: { parts: Array<Series & { value: number }>; formatValue: (value: number) => React.ReactNode }) {
  const shown = parts.filter((part) => part.value > 0);
  const total = shown.reduce((sum, part) => sum + part.value, 0);
  if (total <= 0) return null;
  return (
    <Box>
      <Box sx={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', gap: '2px', mb: 1.25 }}>
        {shown.map((part) => (
          <Box key={part.key} sx={{ flex: `${part.value} 0 0`, bgcolor: part.color, minWidth: 3 }} />
        ))}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto auto', columnGap: 1.5, rowGap: 0.5, alignItems: 'center' }}>
        {shown.map((part) => (
          <React.Fragment key={part.key}>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: part.color, flex: 'none' }} />
              <Typography variant="body2" noWrap>{part.label}</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
              {Math.round((part.value / total) * 100)}%
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap' }}>
              {formatValue(part.value)}
            </Typography>
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
}
