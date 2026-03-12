import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const ADJECTIVES = [
  "Atomic", "Neon", "Hyper", "Phantom", "Rogue", "Cryo", "Void",
  "Apex", "Drift", "Static", "Solar", "Dark", "Flux", "Echo",
];
const NOUNS = [
  "Sentinel", "Vector", "Nexus", "Cipher", "Pulse", "Node",
  "Reactor", "Shield", "Gate", "Core", "Flare", "Beacon",
];

function generateSuggestions(count = 6): string[] {
  const out: string[] = [];
  const used = new Set<string>();
  while (out.length < count) {
    const adj  = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const num  = Math.floor(Math.random() * 99) + 1;
    const name = `${adj}${noun}${num}`;
    if (!used.has(name)) { used.add(name); out.push(name); }
  }
  return out;
}

export type UsernameStatus =
  | "idle" | "checking" | "available" | "taken"
  | "invalid" | "saving" | "saved" | "error";

export function useUsername(walletAddress: string | undefined) {
  const [username, setUsername]     = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [status, setStatus]         = useState<UsernameStatus>("idle");
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading]   = useState(false);

  // Load existing username for this wallet
  useEffect(() => {
    if (!walletAddress) return;
    setIsLoading(true);
    supabase
      .from("usernames")
      .select("username")
      .eq("wallet_address", walletAddress.toLowerCase())
      .maybeSingle()
      .then(({ data }) => {
        if (data?.username) {
          setUsername(data.username);
          setInputValue(data.username);
        }
        setIsLoading(false);
        setSuggestions(generateSuggestions(6));
      });
  }, [walletAddress]);

  const checkAvailability = useCallback(async (value: string) => {
    const clean = value.trim();
    if (clean.length < 3)  { setStatus("invalid"); setErrorMsg("Minimum 3 characters"); return; }
    if (clean.length > 20) { setStatus("invalid"); setErrorMsg("Maximum 20 characters"); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
      setStatus("invalid");
      setErrorMsg("Letters, numbers and underscores only");
      return;
    }
    setStatus("checking");
    setErrorMsg(null);
    const { data } = await supabase
      .from("usernames")
      .select("username")
      .eq("username", clean)
      .maybeSingle();
    if (data) { setStatus("taken"); setErrorMsg("Username already taken"); }
    else      { setStatus("available"); setErrorMsg(null); }
  }, []);

  const saveUsername = useCallback(
    async (value: string): Promise<boolean> => {
      if (!walletAddress) return false;
      const clean = value.trim();
      setStatus("saving");
      setErrorMsg(null);
      try {
        const { error } = await supabase.from("usernames").upsert(
          {
            wallet_address: walletAddress.toLowerCase(),
            username: clean,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "wallet_address" }
        );
        if (error) {
          if (error.code === "23505") {
            setStatus("taken");
            setErrorMsg("Username just got taken — try another");
            return false;
          }
          throw error;
        }
        setUsername(clean);
        setStatus("saved");
        return true;
      } catch (err: unknown) {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Failed to save");
        return false;
      }
    },
    [walletAddress]
  );

  return {
    username,
    inputValue,
    setInputValue,
    status,
    errorMsg,
    suggestions,
    isLoading,
    checkAvailability,
    saveUsername,
    refreshSuggestions: () => setSuggestions(generateSuggestions(6)),
    hasUsername: !!username,
  };
}