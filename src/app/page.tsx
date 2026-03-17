// src/app/page.tsx
// Stealth landing page — public face of the app.
// This is the ONLY page accessible without authentication.
// Authenticated users who haven't entered their PIN see this page.
// Tapping the balance 5x reveals the hidden PIN pad.
// REPLACE the existing src/app/page.tsx with this file.

"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch } from "@/store/hooks";
import { useIsAuthenticated, useIsNiaUnlocked } from "@/store/hooks";
import { verifyPin, clearError } from "@/store/slices/authSlice";
import { useAppSelector } from "@/store/hooks";
import { selectAuthError, selectIsLoading } from "@/store/slices/authSlice";
import { cn } from "@/utils";
import { TrendingUp, PiggyBank, ArrowUpRight, ArrowDownRight, Lock } from "lucide-react";
import Link from "next/link";
import { SetupPinModal } from "@/components/auth/SetupPinModal";

const FAKE_BALANCE = "KSh 47,350";
const FAKE_SAVINGS_GOAL = 85;
const FAKE_TRANSACTIONS = [
  { label: "MPESA Deposit",    amount: "+5,000", date: "Today",     positive: true },
  { label: "Grocery Shopping", amount: "-1,200", date: "Yesterday", positive: false },
  { label: "MPESA Deposit",    amount: "+3,500", date: "Mon 9th",   positive: true },
  { label: "Electricity Bill", amount: "-2,100", date: "Sun 8th",   positive: false },
  { label: "Side Business",    amount: "+8,000", date: "Fri 6th",   positive: true },
];

type PinPhase = "idle" | "verifying" | "error";

export default function StealthPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const isAuthenticated = useIsAuthenticated();
  const isNiaUnlocked = useIsNiaUnlocked();
  const error = useAppSelector(selectAuthError);
  const isLoading = useAppSelector(selectIsLoading);

  const [pin, setPin] = useState("");
  const [phase, setPhase] = useState<PinPhase>("idle");
  const [showPinPad, setShowPinPad] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [showSetupModal, setShowSetupModal] = useState(false);

  // If already unlocked, go straight to dashboard
  useEffect(() => {
    if (isNiaUnlocked) {
      router.replace("/dashboard");
    }
  }, [isNiaUnlocked, router]);

  // If not authenticated at all, show a link to sign in
  // (the stealth app still needs an account)

  const handleBalanceTap = useCallback(() => {
    const next = tapCount + 1;
    setTapCount(next);
    if (next >= 5) {
      setShowPinPad(true);
      setTapCount(0);
    }
  }, [tapCount]);

  const handlePinDigit = useCallback(
    (digit: string) => {
      if (pin.length >= 6) return;
      const next = pin + digit;
      setPin(next);
      if (next.length === 6) {
        submitPin(next);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pin]
  );

  const submitPin = useCallback(
    async (p: string) => {
      setPhase("verifying");
      dispatch(clearError());
      const result = await dispatch(verifyPin(p));

      if (verifyPin.fulfilled.match(result)) {
        setPhase("idle");
        setShowPinPad(false);
        setPin("");
        router.push("/dashboard");
      } else {
        setPhase("error");
        setPin("");
        setTimeout(() => {
          setPhase("idle");
          dispatch(clearError());
        }, 1800);
      }
    },
    [dispatch, router]
  );

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
        {!isAuthenticated && (
          <div className="flex gap-2">
            <Link 
              href="/auth/sign-in" 
              className="px-4 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
            >
              Sign in
            </Link>
            <Link 
              href="/auth/sign-up" 
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
            >
              Sign up
            </Link>
          </div>
        )}
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-5">

        {/* Authenticated but locked — quick access to set up PIN */}
        {isAuthenticated && !isNiaUnlocked && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-2 flex items-start gap-3">
            <div className="flex-shrink-0 pt-0.5">
              <Lock className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-900">Secure your account</h3>
              <p className="text-xs text-amber-700 mt-1">You&apos;re signed in but haven&apos;t set a 6-digit PIN yet. Create one now to unlock Nia Path.</p>
              <div className="mt-3">
                <button
                  onClick={() => setShowSetupModal(true)}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-amber-600 text-white text-sm rounded-lg"
                >
                  Set up PIN
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Balance — tap 5× to unlock PIN pad */}
        <div
          className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-6 text-white select-none cursor-pointer"
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
          <div className="mt-4">
            <div className="flex justify-between text-xs text-emerald-200 mb-1.5">
              <span>Goal: KSh 56,000</span>
              <span>{FAKE_SAVINGS_GOAL}%</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full">
              <div
                className="h-full bg-white rounded-full"
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

        {/* Transactions */}
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
                <span className={cn("text-sm font-semibold", tx.positive ? "text-green-600" : "text-red-500")}>
                  {tx.amount}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-center text-xs text-gray-300">
          Akaunti Yangu © {new Date().getFullYear()}
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

            {/* Error message */}
            {(phase === "error" || error) && (
              <p className="text-center text-xs text-emergency-600 mb-4 animate-fade-in">
                {error ?? "Incorrect PIN. Please try again."}
              </p>
            )}

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

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
              {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((key, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (key === "⌫") handleDelete();
                    else if (key !== "") handlePinDigit(key);
                  }}
                  disabled={key === "" || phase === "verifying" || isLoading}
                  className={cn(
                    "h-14 rounded-2xl text-xl font-medium transition-all active:scale-95",
                    "disabled:opacity-0",
                    key === "⌫"
                      ? "text-earth-500 hover:bg-earth-100"
                      : "bg-earth-50 hover:bg-earth-100 active:bg-earth-200 text-earth-900"
                  )}
                >
                  {(phase === "verifying" || isLoading) && key === "0" ? (
                    <span className="inline-block w-4 h-4 border-2 border-nia-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    key
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setShowPinPad(false);
                setPin("");
                dispatch(clearError());
              }}
              className="w-full text-center text-sm text-earth-400 mt-6 hover:text-earth-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {/* Setup PIN modal (for authenticated users who haven't set a PIN) */}
      <SetupPinModal
        isOpen={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        onSuccess={() => {
          // reload so Nia unlock state and UI refresh
          window.location.reload();
        }}
      />
    </div>
  );
}
