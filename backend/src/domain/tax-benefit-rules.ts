/**
 * Rules of the long-term savings program (ПДС) and individual investment accounts (ИИС).
 *
 * Two layers:
 * - a ruleset is fixed when the account is opened: the account stores its id, and later
 *   changes of the law come as new rulesets for accounts opened from their date on;
 * - tax-year rules apply to every account in a calendar year: the deduction limit, the
 *   income tax scale and the co-financing tiers.
 *
 * A published ruleset or tax year never changes (a snapshot test guards it): a correction
 * is a new entry. Pure domain.
 */
import { addMonths } from './savings';

export type BenefitAccountKind = 'pds' | 'iis';
export const BENEFIT_KINDS: readonly string[] = ['pds', 'iis'];

interface RulesetBase {
  id: string;
  kind: BenefitAccountKind;
  /** Opening dates the ruleset covers, inclusive; null for an open end. */
  openedFrom: string;
  openedTo: string | null;
  /** Years the money stays locked, by the year the account was opened. */
  lockYears: Array<{ fromYear: number; years: number }>;
  /** Own contributions reduce the income tax base (Tax Code art. 219.1, 219.2). */
  contributionDeduction: boolean;
  sources: string[];
}

export interface PdsRuleset extends RulesetBase {
  kind: 'pds';
  /** Years of state co-financing from the year after the first own contribution. */
  cofinancingYears: number;
}

export interface IisRuleset extends RulesetBase {
  kind: 'iis';
  variant: 'a' | 'b' | 'iis3';
  /** Investment income is exempt on closing after the term; null for no cap. */
  incomeExemption: boolean;
  incomeExemptionCap: number | null;
  /** Yearly cap of contributions; null for none. */
  contributionCap: number | null;
  /** Only one such account per person, and no other ИИС next to it. */
  single: boolean;
}

export type Ruleset = PdsRuleset | IisRuleset;

export const RULESETS: readonly Ruleset[] = [
  {
    id: 'pds-2024',
    kind: 'pds',
    openedFrom: '2024-01-01',
    openedTo: null,
    // Payouts from 15 years of the contract, or from the age of 55/60 if that comes first.
    lockYears: [{ fromYear: 2024, years: 15 }],
    contributionDeduction: true,
    cofinancingYears: 10,
    sources: [
      'Федеральный закон 75-ФЗ, ст. 36.40, 36.41, 36.44 (ред. 177-ФЗ, 124-ФЗ)',
      'НК РФ, ст. 219.2 (ред. 418-ФЗ)',
    ],
  },
  {
    id: 'iis-a-2015',
    kind: 'iis',
    variant: 'a',
    openedFrom: '2015-01-01',
    openedTo: '2023-12-31',
    lockYears: [{ fromYear: 2015, years: 3 }],
    contributionDeduction: true,
    incomeExemption: false,
    incomeExemptionCap: null,
    contributionCap: 1_000_000,
    single: true,
    sources: ['НК РФ, ст. 219.1', 'Федеральный закон 39-ФЗ, ст. 10.2-1 (ред. до 2024 года)', 'Федеральный закон 600-ФЗ, ст. 4'],
  },
  {
    id: 'iis-b-2015',
    kind: 'iis',
    variant: 'b',
    openedFrom: '2015-01-01',
    openedTo: '2023-12-31',
    lockYears: [{ fromYear: 2015, years: 3 }],
    contributionDeduction: false,
    incomeExemption: true,
    incomeExemptionCap: null,
    contributionCap: 1_000_000,
    single: true,
    sources: ['НК РФ, ст. 219.1', 'Федеральный закон 39-ФЗ, ст. 10.2-1 (ред. до 2024 года)', 'Федеральный закон 600-ФЗ, ст. 4'],
  },
  {
    id: 'iis3-2024',
    kind: 'iis',
    variant: 'iis3',
    openedFrom: '2024-01-01',
    openedTo: null,
    lockYears: [
      { fromYear: 2024, years: 5 },
      { fromYear: 2027, years: 6 },
      { fromYear: 2028, years: 7 },
      { fromYear: 2029, years: 8 },
      { fromYear: 2030, years: 9 },
      { fromYear: 2031, years: 10 },
    ],
    contributionDeduction: true,
    incomeExemption: true,
    incomeExemptionCap: 30_000_000,
    contributionCap: null,
    single: false,
    sources: ['НК РФ, ст. 219.2, п. 3–4', 'Федеральный закон 39-ФЗ, ст. 10.2-1'],
  },
];

export interface TaxYearRules {
  /** First calendar year the rules apply to; they last until the next entry. */
  fromYear: number;
  /** Shared limit of contributions to ПДС, ИИС-3, ИИС type A and НПО (art. 219.1, 219.2). */
  deductionLimit: number;
  /** Income tax on the main base: each rate applies to the part up to `upTo`. */
  taxScale: Array<{ upTo: number | null; rate: number }>;
  cofinancing: {
    /** Per person per year, across all ПДС contracts. */
    cap: number;
    /** Own contributions needed in a year to get anything. */
    minContribution: number;
    /** Share of own contributions paid by the state, by average monthly income. */
    tiers: Array<{ monthlyIncomeUpTo: number | null; ratio: number }>;
  };
  sources: string[];
}

const COFINANCING_2024 = {
  cap: 36_000,
  minContribution: 2_000,
  tiers: [
    { monthlyIncomeUpTo: 80_000, ratio: 1 },
    { monthlyIncomeUpTo: 150_000, ratio: 0.5 },
    { monthlyIncomeUpTo: null, ratio: 0.25 },
  ],
};

export const TAX_YEARS: readonly TaxYearRules[] = [
  {
    fromYear: 2024,
    deductionLimit: 400_000,
    taxScale: [
      { upTo: 5_000_000, rate: 0.13 },
      { upTo: null, rate: 0.15 },
    ],
    cofinancing: COFINANCING_2024,
    sources: ['НК РФ, ст. 224 (ред. до 2025 года)', 'Федеральный закон 75-ФЗ, ст. 36.44'],
  },
  {
    fromYear: 2025,
    deductionLimit: 400_000,
    taxScale: [
      { upTo: 2_400_000, rate: 0.13 },
      { upTo: 5_000_000, rate: 0.15 },
      { upTo: 20_000_000, rate: 0.18 },
      { upTo: 50_000_000, rate: 0.2 },
      { upTo: null, rate: 0.22 },
    ],
    cofinancing: COFINANCING_2024,
    sources: ['НК РФ, ст. 224 (ред. 176-ФЗ)', 'Федеральный закон 75-ФЗ, ст. 36.44'],
  },
];

export function findRuleset(id: string | null | undefined): Ruleset | null {
  return RULESETS.find((ruleset) => ruleset.id === id) ?? null;
}

/** Rulesets an account of the kind opened on the date may follow; the user picks one. */
export function rulesetsFor(kind: string, openedAt: string): Ruleset[] {
  return RULESETS.filter(
    (ruleset) => ruleset.kind === kind && ruleset.openedFrom <= openedAt && (ruleset.openedTo === null || openedAt <= ruleset.openedTo)
  );
}

/** Rules of the tax year: the last entry starting on or before it; null before the first one. */
export function taxYearRules(year: number): TaxYearRules | null {
  let found: TaxYearRules | null = null;
  for (const rules of TAX_YEARS) {
    if (rules.fromYear > year) break;
    found = rules;
  }
  return found;
}

export function lockYears(ruleset: Ruleset, openedAt: string): number {
  const year = Number(openedAt.slice(0, 4));
  let years = ruleset.lockYears[0].years;
  for (const step of ruleset.lockYears) if (step.fromYear <= year) years = step.years;
  return years;
}

/** The day the account can be closed with its benefits kept. */
export function defaultUnlockDate(ruleset: Ruleset, openedAt: string): string {
  return addMonths(openedAt, 12 * lockYears(ruleset, openedAt));
}

/** Income tax on the main base under the scale. */
export function incomeTax(rules: TaxYearRules, income: number): number {
  let tax = 0;
  let lower = 0;
  for (const step of rules.taxScale) {
    const upper = step.upTo ?? Number.POSITIVE_INFINITY;
    if (income <= lower) break;
    tax += (Math.min(income, upper) - lower) * step.rate;
    lower = upper;
  }
  return Math.round(tax * 100) / 100;
}

/** Share of own contributions the state adds for the average monthly income. */
export function cofinancingRatio(rules: TaxYearRules, annualIncome: number): number {
  const monthly = annualIncome / 12;
  const tiers = rules.cofinancing.tiers;
  return (tiers.find((tier) => tier.monthlyIncomeUpTo === null || monthly <= tier.monthlyIncomeUpTo) ?? tiers[tiers.length - 1]).ratio;
}
