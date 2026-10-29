import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Transaction } from '@/lib/types';
import { dateKey, formatDate } from '@/lib/format';

interface Props {
  transactions: Transaction[];
  onDateClick?: (date: Date) => void;
  selectedDate?: Date | null;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function TransactionCalendar({ transactions, onDateClick, selectedDate }: Props) {
  const [cursor, setCursor] = useState(() => new Date());

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions) {
      const k = dateKey(new Date(t.txn_date));
      map.set(k, (map.get(k) ?? 0) + 1);
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
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{monthLabel}</h3>
        <div className="flex gap-1">
          <button
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="rounded-lg px-2 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
          >
            Today
          </button>
          <button
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-semibold uppercase text-gray-400">{d}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const k = dateKey(d);
          const count = counts.get(k) ?? 0;
          const isToday = k === todayKey;
          const isSelected = k === selectedKey;
          return (
            <button
              key={i}
              onClick={() => onDateClick?.(d)}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-xs transition ${
                isSelected
                  ? 'bg-emerald-600 text-white'
                  : isToday
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'
              }`}
              title={count > 0 ? `${count} transaction(s) on ${formatDate(d.toISOString())}` : formatDate(d.toISOString())}
            >
              <span className="font-medium">{d.getDate()}</span>
              {count > 0 && (
                <span
                  className={`absolute bottom-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ${
                    isSelected ? 'bg-white/30 text-white' : 'bg-emerald-500 text-white'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-gray-400">
        Numbers show transactions per day. Click a date to filter.
      </p>
    </div>
  );
}
