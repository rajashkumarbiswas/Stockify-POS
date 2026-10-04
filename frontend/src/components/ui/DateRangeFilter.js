'use client';

import { useState } from 'react';
import { DATE_RANGE_OPTIONS } from '@/lib/constants';
import Field from '@/components/ui/Field';
import Select from '@/components/ui/Select';

/**
 * Date filter (Today / Yesterday / This week / This month / Custom range).
 * Calls onChange({ range, from, to }) with the values to send to the API.
 * Place it inside a flex row of filters.
 */
export default function DateRangeFilter({ onChange, className }) {
  const [choice, setChoice] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');

  const applyCustom = (nextFrom, nextTo) => {
    setError('');
    if (!nextFrom || !nextTo) return; // wait until both dates are chosen
    if (nextFrom > nextTo) {
      setError('The start date must not be after the end date');
      return;
    }
    onChange({ range: 'custom', from: nextFrom, to: nextTo });
  };

  const handleChoice = (value) => {
    setChoice(value);
    setError('');
    if (value === 'custom') {
      onChange({ range: '', from: '', to: '' });
      applyCustom(from, to);
    } else {
      onChange({ range: value, from: '', to: '' });
    }
  };

  return (
    <>
      <Select
        aria-label="Filter by date"
        placeholder="All time"
        options={DATE_RANGE_OPTIONS}
        value={choice}
        onChange={(e) => handleChoice(e.target.value)}
        className={className}
      />
      {choice === 'custom' && (
        <>
          <Field
            aria-label="From date"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              applyCustom(e.target.value, to);
            }}
            className="lg:w-44"
          />
          <Field
            aria-label="To date"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              applyCustom(from, e.target.value);
            }}
            className="lg:w-44"
          />
        </>
      )}
      {error && (
        <p role="alert" className="self-center text-sm text-red-600">
          {error}
        </p>
      )}
    </>
  );
}