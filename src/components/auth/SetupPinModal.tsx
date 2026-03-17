"use client";

import { useState, useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setupPin } from "@/store/slices/authSlice";
import { cn } from "@/utils";
import { Lock, ChevronLeft } from "lucide-react";
import toast from "react-hot-toast";

type PinStep = "input" | "confirm" | "success";

interface SetupPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SetupPinModal({ isOpen, onClose, onSuccess }: SetupPinModalProps) {
  const dispatch = useAppDispatch();
  const isLoading = useAppSelector((s) => s.auth.isLoading);

  const [step, setStep] = useState<PinStep>("input");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");

  const handleReset = () => {
    setStep("input");
    setPin("");
    setConfirmPin("");
    setError("");
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handlePinDigit = (digit: string) => {
    if (step === "input") {
      if (pin.length < 6) {
        const next = pin + digit;
        setPin(next);
        setError("");
        if (next.length === 6) {
          setStep("confirm");
        }
      }
    } else if (step === "confirm") {
      if (confirmPin.length < 6) {
        const next = confirmPin + digit;
        setConfirmPin(next);
        setError("");
        if (next.length === 6) {
          handleSubmitPin(next);
        }
      }
    }
  };

  const handleDelete = () => {
    if (step === "input") {
      setPin((p) => p.slice(0, -1));
    } else if (step === "confirm") {
      setConfirmPin((p) => p.slice(0, -1));
    }
  };

  const handleBack = () => {
    if (step === "confirm") {
      setStep("input");
      setConfirmPin("");
      setError("");
    } else {
      handleClose();
    }
  };

  const handleSubmitPin = async (confirmValue: string) => {
    if (pin !== confirmValue) {
      setError("PINs do not match");
      setConfirmPin("");
      setStep("input");
      setPin("");
      return;
    }

    try {
      const result = await dispatch(setupPin(pin));
      if (setupPin.fulfilled.match(result)) {
        setStep("success");
        toast.success("PIN set successfully");
        setTimeout(() => {
          handleClose();
          onSuccess?.();
        }, 1500);
      } else {
        setError("Failed to set PIN. Please try again.");
        handleReset();
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
      handleReset();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center sm:justify-center">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-6 animate-slide-up sm:animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          {step !== "success" ? (
            <>
              <button
                onClick={handleBack}
                className="text-earth-400 hover:text-earth-600 transition-colors"
                aria-label="Go back"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <div className="flex-1 text-center">
                <h2 className="text-lg font-semibold text-earth-900">
                  {step === "input" ? "Create PIN" : "Confirm PIN"}
                </h2>
                <p className="text-xs text-earth-400 mt-1">
                  {step === "input"
                    ? "Enter a 6-digit PIN"
                    : "Re-enter your PIN to confirm"}
                </p>
              </div>
              <div className="w-6" />
            </>
          ) : (
            <div className="w-full text-center">
              <h2 className="text-lg font-semibold text-earth-900">
                PIN Set Successfully
              </h2>
            </div>
          )}
        </div>

        {/* PIN display or success message */}
        {step !== "success" ? (
          <>
            {/* PIN dots */}
            <div className="flex justify-center gap-3 mb-8">
              {Array.from({ length: 6 }).map((_, i) => {
                const currentPin = step === "input" ? pin : confirmPin;
                return (
                  <div
                    key={i}
                    className={cn(
                      "w-3.5 h-3.5 rounded-full transition-all duration-150",
                      i < currentPin.length
                        ? "bg-nia-600 scale-110"
                        : "bg-earth-200"
                    )}
                  />
                );
              })}
            </div>

            {/* Error message */}
            {error && (
              <p className="text-center text-sm text-emergency-600 mb-6 animate-fade-in">
                {error}
              </p>
            )}

            {/* Number keypad */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map(
                (key) => (
                  <button
                    key={key}
                    onClick={() => {
                      if (key === "⌫") handleDelete();
                      else if (key !== "") handlePinDigit(key);
                    }}
                    disabled={isLoading || key === ""}
                    className={cn(
                      "h-12 rounded-xl font-semibold transition-all active:scale-95",
                      "disabled:opacity-0",
                      key === "⌫"
                        ? "text-earth-600 hover:bg-earth-100"
                        : "bg-earth-50 hover:bg-earth-100 active:bg-earth-200 text-earth-900"
                    )}
                  >
                    {key}
                  </button>
                )
              )}
            </div>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
              <p className="text-xs text-blue-700">
                <strong>💡 Tip:</strong> Remember your PIN. You'll need it to unlock Nia Path after signing in.
              </p>
            </div>
          </>
        ) : (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-sm text-earth-600">
              Your PIN is now set. You can use it to unlock Nia Path.
            </p>
          </div>
        )}

        {/* Close button */}
        {step !== "success" && (
          <button
            onClick={handleClose}
            className="w-full text-center text-sm text-earth-400 hover:text-earth-600 transition-colors mt-6"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
