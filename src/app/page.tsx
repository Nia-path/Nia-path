// src/app/page.tsx
// This is the PUBLIC landing page — styled as a harmless savings/financial tracker.
// A hidden PIN unlock mechanism reveals the Nia Path platform.

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch } from "@/store/hooks";
import { verifyPin, setupPin } from "@/store/slices/authSlice";
import { getPinHash } from "@/lib/db";
import { cn } from "@/utils";
import { TrendingUp, PiggyBank, ArrowUpRight, ArrowDownRight, Lock } from "lucide-react";

// Fake financial data for the stealth cover
const FAKE_BALANCE = "KSh 47,350";
const FAKE_SAVINGS_GOAL = 85;
const FAKE_TRANSACTIONS = [
  { label: "MPESA Deposit",     amount: "+5,000",  date: "Today",      positive: true },
  { label: "Grocery Shopping",  amount: "-1,200",  date: "Yesterday",  positive: false },
  { label: "MPESA Deposit",     amount: "+3,500",  date: "Mon 9th",    positive: true },
  { label: "Electricity Bill",  amount: "-2,100",  date: "Sun 8th",    positive: false },
  { label: "Side Business",     amount: "+8,000",  date: "Fri 6th",    positive: true },
];

type PinPhase = "idle" | "entering" | "verifying" | "error";

export default function StealthPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [pin, setPin] = useState("");
  const [phase, setPhase] = useState<PinPhase>("idle");
  const [showPinPad, setShowPinPad] = useState(false);
  const [tapCount, setTapCount] = useState(0);

  // Secret: tap the balance 5 times to show PIN pad
  const handleBalanceTap = useCallback(() => {
    const next = tapCount + 1;
    setTapCount(next);
    if (next >= 5) {
      setShowPinPad(true);
      setTapCount(0);
    }
  }, [tapCount]);

  const handlePinDigit = (digit: string) => {
    if (pin.length >= 6) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 6) submitPin(next);
  };

  const submitPin = async (p: string) => {
    setPhase("verifying");
    
    // Check if PIN has been set before
    const existingPin = await getPinHash();
    let result;
    
    if (!existingPin) {
      // First time setup
      result = await dispatch(setupPin(p));
    } else {
      // Verify existing PIN
      result = await dispatch(verifyPin(p));
    }
    
    if (setupPin.fulfilled.match(result) || verifyPin.fulfilled.match(result)) {
      setPhase("idle");
      setShowPinPad(false);
      // Set a cookie to indicate PIN was verified (for development)
      document.cookie = "nia-pin-verified=true; path=/; max-age=28800"; // 8 hours
      router.push("/dashboard");
    } else {
      setPhase("error");
      setPin("");
      setTimeout(() => setPhase("idle"), 1500);
    }
  };

  const handleDelete = () => setPin((p) => p.slice(0, -1));

  return (
    <div className="min-h-screen bg-stealth-bg">
      {/* App header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <PiggyBank className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-gray-900">Akaunti Yangu</span>
        </div>
        <span className="text-xs text-gray-400">v2.1.4</span>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-5">
        {/* Balance card — tap 5× to unlock */}
        <div
          className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-6 text-white select-none"
          onClick={handleBalanceTap}
          role="button"
          aria-label="Total savings"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-emerald-200 text-sm">Total Savings</p>
              <p className="text-3xl font-bold mt-1">{FAKE_BALANCE}</p>
            </div>
            <div className="bg-white/20 rounded-xl p-2">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          {/* Savings progress */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-emerald-200 mb-1.5">
              <span>Goal: KSh 56,000</span>
              <span>{FAKE_SAVINGS_GOAL}%</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full">
              <div
                className="h-full bg-white rounded-full transition-all"
                style={{ width: `${FAKE_SAVINGS_GOAL}%` }}
              />
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-xs text-gray-500">Income</span>
            </div>
            <p className="text-lg font-semibold text-gray-900">KSh 16,500</p>
            <p className="text-xs text-green-600 mt-0.5">+12% this month</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 bg-red-100 rounded-lg flex items-center justify-center">
                <ArrowDownRight className="w-4 h-4 text-red-500" />
              </div>
              <span className="text-xs text-gray-500">Expenses</span>
            </div>
            <p className="text-lg font-semibold text-gray-900">KSh 3,300</p>
            <p className="text-xs text-red-500 mt-0.5">-5% this month</p>
          </div>
        </div>

        {/* Transaction list */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">Recent Transactions</h2>
          </div>
          <ul>
            {FAKE_TRANSACTIONS.map((tx, i) => (
              <li
                key={i}
                className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">{tx.label}</p>
                  <p className="text-xs text-gray-400">{tx.date}</p>
                </div>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    tx.positive ? "text-green-600" : "text-red-500"
                  )}
                >
                  {tx.amount}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer hint — tiny and ignorable */}
        <p className="text-center text-xs text-gray-300">
          Akaunti Yangu © 2024 · All rights reserved
        </p>
      </main>

      {/* Hidden PIN overlay */}
      {showPinPad && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end">
          <div className="w-full max-w-md mx-auto bg-white rounded-t-3xl px-6 pt-8 pb-10 animate-slide-up">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Lock className="w-4 h-4 text-nia-600" />
              <p className="text-sm font-medium text-earth-700">Enter secure PIN</p>
            </div>

            {/* PIN dots */}
            <div className="flex justify-center gap-3 mb-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-3 h-3 rounded-full transition-all duration-150",
                    i < pin.length
                      ? phase === "error"
                        ? "bg-emergency-500 scale-110"
                        : "bg-nia-600 scale-110"
                      : "bg-earth-200"
                  )}
                />
              ))}
            </div>

            {phase === "error" && (
              <p className="text-center text-xs text-emergency-600 mb-4 animate-fade-in">
                Incorrect PIN. Please try again.
              </p>
            )}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
              {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((key, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (key === "⌫") handleDelete();
                    else if (key !== "") handlePinDigit(key);
                  }}
                  disabled={key === "" || phase === "verifying"}
                  className={cn(
                    "h-14 rounded-2xl text-xl font-medium transition-all",
                    "active:scale-95 disabled:opacity-0",
                    key === "⌫"
                      ? "text-earth-500 hover:bg-earth-100"
                      : "bg-earth-50 hover:bg-earth-100 text-earth-900"
                  )}
                >
                  {phase === "verifying" && key === "0" ? (
                    <span className="inline-block w-4 h-4 border-2 border-nia-400 border-t-transparent rounded-full animate-spin" />
                  ) : key}
                </button>
              ))}
            </div>

            <button
              onClick={() => { setShowPinPad(false); setPin(""); }}
              className="w-full text-center text-sm text-earth-400 mt-6 hover:text-earth-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
