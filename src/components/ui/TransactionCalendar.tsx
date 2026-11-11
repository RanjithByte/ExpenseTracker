import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Transaction } from '@/lib/types';
import { dateKey, formatDate } from '@/lib/format';

interface Props {
  transactions: Transaction[];
  onDateClick?: (date: Date) => void;
  selectedDate?: Date | null;
}

interface DayCounts {
  income: number;
  expense: number;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function TransactionCalendar({ transactions, onDateClick, selectedDate }: Props) {
  const [cursor, setCursor] = useState(() => new Date());

  const countsByDay = useMemo(() => {
    const map = new Map<string, DayCounts>();
    for (const t of transactions) {
      const k = dateKey(new Date(t.txn_date));
      const entry = map.get(k) ?? { income: 0, expense: 0 };
      if (t.type === 'income') entry.income += 1;
      else entry.expense += 1;
      map.set(k, entry);
    }
    return map;
  }, [transactions]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = dateKey(new Date());
  const selectedKey = selectedDate ? dateKey(selectedDate) : null;
  const monthLabel = cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">{monthLabel}</h3>
        <div className="flex gap-1">
          <button
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 dark:hover:bg-white/10"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="rounded-lg px-2 py-1.5 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
          >
            Today
          </button>
          <button
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 dark:hover:bg-white/10"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="pb-1 text-center text-[11px] font-semibold uppercase text-gray-400">{d}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const k = dateKey(d);
          const counts = countsByDay.get(k);
          const isToday = k === todayKey;
          const isSelected = k === selectedKey;
          return (
            <button
              key={i}
              onClick={() => onDateClick?.(d)}
              className={`flex min-h-[64px] flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-sm transition sm:min-h-[76px] ${
                isSelected
                  ? 'bg-emerald-600 text-white'
                  : isToday
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'
              }`}
              title={formatDate(d.toISOString())}
            >
              <span className="font-semibold">{d.getDate()}</span>
              {counts && (
                <span className="flex items-center justify-center gap-1.5 leading-tight">
                  {counts.income > 0 && (
                    <span className={`text-[11px] font-bold ${isSelected ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {counts.income}
                    </span>
                  )}
                  {counts.expense > 0 && (
                    <span className={`text-[11px] font-bold ${isSelected ? 'text-white' : 'text-rose-600 dark:text-rose-400'}`}>
                      {counts.expense}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        Green numbers are income, red are expenses. Click a date to filter.
      </p>
    </div>
  );
}
