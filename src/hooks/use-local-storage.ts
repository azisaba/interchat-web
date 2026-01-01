"use client";

import {useEffect, useState} from 'react'

export default function useLocalStorage(key: string) {
  const [state, setState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const value = localStorage.getItem(key);
    if (value !== null) {
      return value;
    }

    return null;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (state === null) {
      localStorage.removeItem(key);
      window.dispatchEvent(new Event("storage"));
      return;
    }

    localStorage.setItem(key, state);
    window.dispatchEvent(new Event("storage"));
  }, [key, state]);

  useEffect(() => {
    const listenStorageChange = () => {
      setState(() => {
        if (typeof window === "undefined") return null;
        const value = localStorage.getItem(key);
        if (value !== null) {
          return value;
        }

        return null;
      });
    };
    window.addEventListener("storage", listenStorageChange);
    return () => window.removeEventListener("storage", listenStorageChange);
  }, [key]);

  return [state, setState] as const;
}
