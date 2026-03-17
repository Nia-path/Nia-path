// src/components/auth/SignUpForm.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  signUpWithEmail,
  clearError,
  selectIsLoading,
  selectAuthError,
} from "@/store/slices/authSlice";
import { AuthInput, AuthButton, AuthAlert, AuthDivider } from "./AuthFormField";
import { User, Mail, Lock, Phone, CheckCircle } from "lucide-react";

const schema = z
  .object({
    fullName: z
      .string()
      .min(2, "Full name must be at least 2 characters")
      .max(80, "Name is too long")
      .regex(/^[a-zA-Z\s'-]+$/, "Name can only contain letters, spaces, hyphens, and apostrophes"),
    email: z
      .string()
      .min(1, "Email is required")
      .email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    language: z.enum(["en", "sw"]),
    consentTerms: z.boolean().refine((v) => v === true, {
      message: "You must accept the terms to continue",
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export function SignUpForm() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const isLoading = useAppSelector(selectIsLoading);
  const error = useAppSelector(selectAuthError);
  const [emailSent, setEmailSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { language: "en", consentTerms: false },
  });

  const password = watch("password", "");

  const passwordStrength = getPasswordStrength(password);

  const onSubmit = async (values: FormValues) => {
    dispatch(clearError());
    const result = await dispatch(
      signUpWithEmail({
        email: values.email,
        password: values.password,
        fullName: values.fullName.trim(),
        language: values.language,
      })
    );

    if (signUpWithEmail.fulfilled.match(result)) {
      if ((result.payload as { emailConfirmationRequired?: boolean }).emailConfirmationRequired) {
        // Email confirmation required — show success message
        setSubmittedEmail(values.email);
        setEmailSent(true);
      } else {
        // Auto-confirmed — go straight to dashboard
        router.replace("/dashboard");
      }
    }
  };

  if (emailSent) {
    return (
      <div className="space-y-5 text-center animate-scale-in">
        <div className="w-16 h-16 bg-green-900/40 border border-green-500/40 rounded-2xl flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-green-400" />
        </div>
        <div className="space-y-2">
          <h2 className="font-heading text-xl text-white font-semibold">
            Check your email
          </h2>
          <p className="text-sm text-earth-400 leading-relaxed">
            We sent a confirmation link to{" "}
            <span className="text-white font-medium">{submittedEmail}</span>.
            Open it to activate your account.
          </p>
        </div>
        <p className="text-xs text-earth-600">
          Didn&apos;t receive it? Check your spam folder.
        </p>
        <Link
          href="/auth/sign-in"
          className="block text-sm text-nia-400 hover:text-nia-300 transition-colors"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="space-y-1 text-center">
        <h2 className="font-heading text-xl text-white font-semibold">
          Create your account
        </h2>
        <p className="text-xs text-earth-500">
          Your information is private and encrypted
        </p>
      </div>

      {error && <AuthAlert type="error" message={error} />}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <AuthInput
          label="Full name"
          type="text"
          autoComplete="name"
          autoCapitalize="words"
          icon={<User className="w-4 h-4" />}
          error={errors.fullName?.message}
          {...register("fullName")}
        />

        <AuthInput
          label="Email address"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          icon={<Mail className="w-4 h-4" />}
          error={errors.email?.message}
          {...register("email")}
        />

        <AuthInput
          label="Password"
          type="password"
          autoComplete="new-password"
          icon={<Lock className="w-4 h-4" />}
          error={errors.password?.message}
          {...register("password")}
        />

        {/* Password strength bar */}
        {password.length > 0 && (
          <div className="space-y-1 -mt-2">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                    i <= passwordStrength.score
                      ? passwordStrength.score <= 1
                        ? "bg-emergency-500"
                        : passwordStrength.score === 2
                        ? "bg-yellow-500"
                        : passwordStrength.score === 3
                        ? "bg-nia-400"
                        : "bg-green-500"
                      : "bg-white/10"
                  }`}
                />
              ))}
            </div>
            <p className={`text-[11px] ${passwordStrength.color}`}>
              {passwordStrength.label}
            </p>
          </div>
        )}

        <AuthInput
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          icon={<Lock className="w-4 h-4" />}
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />

        {/* Language preference */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-earth-300 tracking-wide">
            Preferred language
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(["en", "sw"] as const).map((lang) => (
              <label
                key={lang}
                className={`flex items-center justify-center gap-2 h-10 rounded-xl border text-sm cursor-pointer transition-all ${
                  watch("language") === lang
                    ? "border-nia-400/60 bg-nia-900/40 text-nia-300"
                    : "border-white/10 bg-white/[0.04] text-earth-400 hover:border-white/20"
                }`}
              >
                <input
                  type="radio"
                  value={lang}
                  className="sr-only"
                  {...register("language")}
                />
                {lang === "en" ? "🇬🇧 English" : "🇰🇪 Kiswahili"}
              </label>
            ))}
          </div>
        </div>

        {/* Consent */}
        <label className="flex items-start gap-3 cursor-pointer">
          <div className="relative mt-0.5">
            <input
              type="checkbox"
              className="sr-only peer"
              {...register("consentTerms")}
            />
            <div className="w-4 h-4 rounded border border-white/20 bg-white/5 peer-checked:bg-nia-500 peer-checked:border-nia-500 transition-all flex items-center justify-center">
              <svg
                className="w-2.5 h-2.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                viewBox="0 0 10 8"
                fill="none"
              >
                <path
                  d="M1 4L3.5 6.5L9 1"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
          <span className="text-xs text-earth-400 leading-relaxed">
            I accept the{" "}
            <a
              href="/terms"
              target="_blank"
              className="text-nia-400 hover:text-nia-300 underline"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="/privacy"
              target="_blank"
              className="text-nia-400 hover:text-nia-300 underline"
            >
              Privacy Policy
            </a>
            . I understand my data is encrypted and only accessible by me.
          </span>
        </label>
        {errors.consentTerms && (
          <p className="text-xs text-emergency-400 -mt-3">
            {errors.consentTerms.message}
          </p>
        )}

        <AuthButton type="submit" loading={isLoading}>
          Create account
        </AuthButton>
      </form>

      <p className="text-center text-xs text-earth-500">
        Already have an account?{" "}
        <Link
          href="/auth/sign-in"
          className="text-nia-400 hover:text-nia-300 font-medium transition-colors"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

// ─── Password strength helper ─────────────────────────────────────────────────

function getPasswordStrength(password: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
} {
  if (!password) return { score: 0, label: "", color: "" };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password)) score++;

  const levels = [
    { label: "", color: "" },
    { label: "Too short — keep going", color: "text-emergency-400" },
    { label: "Getting better", color: "text-yellow-400" },
    { label: "Strong password", color: "text-nia-400" },
    { label: "Excellent password", color: "text-green-400" },
  ];

  return { score: score as 0 | 1 | 2 | 3 | 4, ...levels[score] };
}
