import { Box } from '@mui/material';
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, YAxis } from 'recharts';
import { useId } from 'react';

/** Small area chart without axes; a dashed line marks zero when the values cross it. */
export default function Sparkline({
  values,
  color,
  height = 64,
}: {
  values: number[];
  color: string;
  height?: number | string;
}) {
  const gradientId = useId().replace(/:/g, '');
  const data = values.map((value, index) => ({ index, value }));
  const crossesZero = values.some((value) => value < 0);
  return (
    <Box sx={{ height, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          {crossesZero && <ReferenceLine y={0} stroke="var(--status-danger)" strokeDasharray="4 4" />}
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
}
