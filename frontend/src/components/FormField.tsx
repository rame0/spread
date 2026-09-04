import React from 'react';
import { Stack, TextField, Typography, type SxProps, type TextFieldProps, type Theme } from '@mui/material';

export function FormField({
  label,
  children,
  sx,
}: {
  label: string;
  children: React.ReactNode;
  sx?: SxProps<Theme>;
}) {
  return (
    <Stack spacing={0.75} sx={sx}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      {children}
    </Stack>
  );
}

export function LabeledTextField({ label, inputProps, ...props }: TextFieldProps & { label: string }) {
  return (
    <FormField label={label}>
      <TextField {...props} inputProps={{ 'aria-label': label, ...inputProps }} />
    </FormField>
  );
}
