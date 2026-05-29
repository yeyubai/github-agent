"use client";

import { useCallback, useEffect, useState } from "react";

const TOKEN_KEY = "github-agent-token";

export function useGitHubToken() {
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(TOKEN_KEY);
      setTokenState(stored);
    } catch {
      // ignore
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const setToken = useCallback((value: string) => {
    localStorage.setItem(TOKEN_KEY, value);
    setTokenState(value);
  }, []);

  const removeToken = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setTokenState(null);
  }, []);

  return { token, setToken, removeToken, isLoaded };
}
