import React from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '../i18n';
import { formatAxisAmount } from './ActivityAreaChart';

export type ChartSeries = { key: string; label: string; color: string };

type NetWorthChartProps = {
  data: Array<{ date: string } & Record<string, number | string | null>>;
  series: ChartSeries[];
  formatValue: (value: number) => string;
};

const asLocalDate = (value: string) => new Date(`${value}T12:00:00`);

/** Line chart of values on dates, e.g. assets, debts and net worth at month ends. */
export default function NetWorthChart({ data, series, formatValue }: NetWorthChartProps) {
  const { i18n } = useTranslation();
  const locale = getDateFnsLocale(i18n.language);

  return (
    <Box sx={{ height: { xs: 260, md: 300 }, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            minTickGap={36}
            padding={{ left: 8, right: 8 }}
            tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
            tickFormatter={(value) => format(asLocalDate(value), 'LLL yy', { locale })}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={62}
            tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
            tickFormatter={(value) => formatAxisAmount(Number(value), i18n.language)}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <Paper sx={{ px: 1.5, py: 1, borderColor: 'divider', boxShadow: '0 8px 24px rgba(0, 0, 0, .24)' }}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {format(asLocalDate(String(label)), 'd MMMM yyyy', { locale })}
                  </Typography>
                  {payload.map((item) => (
                    <Stack key={String(item.dataKey)} direction="row" spacing={1.5} justifyContent="space-between">
                      <Typography variant="body2" sx={{ color: item.color }}>
                        {item.name}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {formatValue(Number(item.value))}
                      </Typography>
                    </Stack>
                  ))}
                </Paper>
              );
            }}
          />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {series.map((item) => (
            <Line
              key={item.key}
              type="linear"
              dataKey={item.key}
              name={item.label}
              stroke={item.color}
              strokeWidth={2.5}
              dot={data.length === 1 ? { r: 4, fill: item.color } : false}
              activeDot={{ r: 4, fill: item.color, stroke: 'var(--surface)', strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}
