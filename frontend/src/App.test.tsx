import { render, screen } from '@testing-library/react';
import { Button, Chip, ThemeProvider } from '@mui/material';
import { describe, expect, it } from 'vitest';
import { theme } from './App';

describe('application theme', () => {
  it('renders components that derive shades from palette colors', () => {
    render(
      <ThemeProvider theme={theme}>
        <Button variant="contained">Save</Button>
        <Chip color="primary" label="Active" />
      </ThemeProvider>
    );

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});
