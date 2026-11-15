'use client';

import { useState, useEffect } from 'react';
import { App } from '../../App.js';

export default function OpenRevitLinkPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return <App />;
}
