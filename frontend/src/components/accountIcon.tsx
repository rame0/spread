import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import LockClockOutlinedIcon from '@mui/icons-material/LockClockOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded';
import type { AccountKind } from '../types/v2';

const icons: Record<AccountKind, React.ReactElement> = {
  debit: <CreditCardOutlinedIcon />,
  cash: <PaymentsOutlinedIcon />,
  savings: <SavingsOutlinedIcon />,
  deposit: <LockClockOutlinedIcon />,
  brokerage: <ShowChartRoundedIcon />,
  property: <HomeOutlinedIcon />,
  other: <AccountBalanceOutlinedIcon />,
};

export const accountIcon = (kind: AccountKind) => icons[kind];
