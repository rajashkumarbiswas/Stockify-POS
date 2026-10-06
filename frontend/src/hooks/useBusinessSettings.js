'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/** Loads the business info (name, address, tax rate, invoice footer) once. Returns null until it arrives. */
export default function useBusinessSettings() {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    let active = true;
    api
      .get('/settings')
      .then((res) => active && setSettings(res.data))
      .catch(() => {}); // the invoice still works with the sale data alone
    return () => {
      active = false;
    };
  }, []);

  return settings;
}