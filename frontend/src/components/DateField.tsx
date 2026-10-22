import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, isValid, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '../i18n';
import { FormField } from './FormField';

/** Labelled date picker for forms that keep dates as `yyyy-MM-dd` strings ('' when empty). */
export default function DateField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const { i18n } = useTranslation();
  const date = value ? parseISO(value) : null;

  return (
    <FormField label={label}>
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={getDateFnsLocale(i18n.language)}>
        <DatePicker
          value={date && isValid(date) ? date : null}
          onChange={(next) => onChange(next && isValid(next) ? format(next, 'yyyy-MM-dd') : '')}
          slotProps={{ textField: { fullWidth: true, required, inputProps: { 'aria-label': label } } }}
        />
      </LocalizationProvider>
    </FormField>
  );
}
