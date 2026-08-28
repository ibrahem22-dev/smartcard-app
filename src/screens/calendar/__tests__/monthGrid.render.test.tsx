import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import React from 'react';
import { act, fireEvent, render, within } from '@testing-library/react-native';

import { useLanguageStore } from '../../../store/useLanguageStore';
import {
  DAY_LETTERS,
  WEEK_ORDER,
  WEEK_STARTS_ON,
} from '../../../utils/calendar';
import { monthGridFor, type MonthGridDay } from '../monthGrid';

const { MonthGrid } = require('../MonthGrid.tsx') as {
  readonly MonthGrid: React.ComponentType<{
    readonly year: number;
    readonly month: number;
    readonly onDayPress?: (day: MonthGridDay) => void;
  }>;
};

const fakeDb = {
  execSync: (): void => { /* this render driver needs no catalog rows */ },
  closeSync: (): void => { /* this render driver owns no native handle */ },
  getFirstSync: <T,>(): T | null => null,
};

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: (): unknown => fakeDb,
}));

const LANGUAGES = ['he', 'ar', 'en'] as const;
const YEAR = 2026;
const MONTH = 8;

function setLanguage(language: (typeof LANGUAGES)[number]): void {
  act(() => {
    useLanguageStore.setState({
      languageChoice: language,
      resolvedLanguage: language,
    });
  });
}

describe('MonthGrid — K1', () => {
  beforeEach(() => {
    setLanguage('en');
  });

  it('lays the columns out in the order WEEK_ORDER declares', () => {
    const weeks = monthGridFor(YEAR, MONTH);

    for (const week of weeks) {
      week.forEach((day, columnIndex) => {
        expect(new Date(`${day.iso}T00:00:00.000Z`).getUTCDay()).toBe(
          WEEK_ORDER[columnIndex],
        );
      });
    }

    const tree = render(<MonthGrid year={YEAR} month={MONTH} />);
    const renderedDays = tree
      .getAllByTestId(/^calendar-day-\d{4}-\d{2}-\d{2}$/)
      .map((node) => node.props.testID);
    expect(renderedDays).toEqual(weeks.flat().map((day) => `calendar-day-${day.iso}`));
  });

  it('renders day letters for he, ar and en', () => {
    for (const language of LANGUAGES) {
      setLanguage(language);
      const tree = render(<MonthGrid year={YEAR} month={MONTH} />);
      const headerCells = tree.getAllByTestId(/^week-header-day-/);

      expect(headerCells).toHaveLength(WEEK_ORDER.length);
      WEEK_ORDER.forEach((dayIndex, columnIndex) => {
        const expectedLetter = DAY_LETTERS[language][dayIndex];
        expect(expectedLetter).toBeDefined();
        expect(
          within(headerCells[columnIndex]).getByText(String(expectedLetter)),
        ).toBeTruthy();
      });
      tree.unmount();
    }
  });

  it('starts the week on Sunday in every language', () => {
    expect(WEEK_ORDER[0]).toBe(WEEK_STARTS_ON);

    for (const language of LANGUAGES) {
      setLanguage(language);
      const tree = render(<MonthGrid year={YEAR} month={MONTH} />);
      const firstHeaderCell = tree.getAllByTestId(/^week-header-day-/)[0];
      const firstDayCell = tree.getAllByTestId(
        /^calendar-day-\d{4}-\d{2}-\d{2}$/,
      )[0];
      const firstIso = String(firstDayCell.props.testID).replace('calendar-day-', '');

      expect(firstHeaderCell.props.testID).toBe(
        `week-header-day-${String(WEEK_STARTS_ON)}`,
      );
      expect(new Date(`${firstIso}T00:00:00.000Z`).getUTCDay()).toBe(
        WEEK_STARTS_ON,
      );
      tree.unmount();
    }
  });

  it('renders a rectangular grid with neighbouring-month days marked', () => {
    const weeks = monthGridFor(YEAR, MONTH);
    const onDayPress = jest.fn<void, [MonthGridDay]>();
    const tree = render(
      <MonthGrid year={YEAR} month={MONTH} onDayPress={onDayPress} />,
    );

    expect(weeks.length).toBeGreaterThan(0);
    expect(weeks.every((week) => week.length === WEEK_ORDER.length)).toBe(true);
    expect(tree.getAllByTestId(/^calendar-week-/)).toHaveLength(weeks.length);

    const outsideDays = weeks.flat().filter((day) => !day.inMonth);
    expect(outsideDays.some((day) => day.iso < `${String(YEAR)}-08-01`)).toBe(true);
    expect(outsideDays.some((day) => day.iso > `${String(YEAR)}-08-31`)).toBe(true);
    for (const day of outsideDays) {
      expect(tree.getByTestId(`calendar-day-${day.iso}`)).toBeTruthy();
      expect(tree.getByTestId(`calendar-day-${day.iso}-outside`)).toBeTruthy();
    }

    fireEvent.press(tree.getByTestId('calendar-day-2026-08-01'));
    expect(onDayPress).toHaveBeenCalledWith({
      iso: '2026-08-01',
      dayOfMonth: 1,
      inMonth: true,
    });
  });

  it('takes its column order from src/utils/calendar rather than its own', () => {
    const source = readFileSync(
      join(process.cwd(), 'src', 'screens', 'calendar', 'monthGrid.ts'),
      'utf8',
    );

    expect(source).toMatch(/import\s*\{\s*WEEK_ORDER\s*\}\s*from\s*['"]\.\.\/\.\.\/utils\/calendar['"]/);
    expect(source).not.toMatch(
      /\[\s*0\s*,\s*1\s*,\s*2\s*,\s*3\s*,\s*4\s*,\s*5\s*,\s*6\s*\]/,
    );
  });
});
