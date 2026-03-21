import { useEffect, useState } from 'react';

const MAX_POINTS = 60;

export const usePriceHistory = (prices: Record<string, number>) => {
  const [history, setHistory] = useState<Record<string, number[]>>({});

  useEffect(() => {
    setHistory((current) => {
      const next = { ...current };

      Object.entries(prices).forEach(([ticker, price]) => {
        const previous = next[ticker] ?? [];
        next[ticker] = [...previous.slice(-(MAX_POINTS - 1)), price];
      });

      return next;
    });
  }, [prices]);

  return history;
};
