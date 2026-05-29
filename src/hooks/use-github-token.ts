"use client";

import { useCallback, useEffect, useState } from "react";

const CLIENT_ID_KEY = "github-agent-client-id";

function generateClientId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useGitHubToken() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [clientId, setClientId] = useState<string>("");

  useEffect(() => {
    let cid = localStorage.getItem(CLIENT_ID_KEY);
    if (!cid) {
      cid = generateClientId();
      localStorage.setItem(CLIENT_ID_KEY, cid);
    }
    setClientId(cid);
    setIsLoaded(true);
  }, []);

  const resetClientId = useCallback(() => {
    const newCid = generateClientId();
    localStorage.setItem(CLIENT_ID_KEY, newCid);
    setClientId(newCid);
  }, []);

  return { clientId, resetClientId, isLoaded };
}
