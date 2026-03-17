// src/components/auth/ResetPasswordForm.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  sendPasswordReset,
  clearError,
  selectIsLoading,
  selectAuthError,
} from "@/store/slices/authSlice";
import { AuthInput, AuthButton, AuthAlert } from "./AuthFormField";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";

const schema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
});

type FormValues = z.infer<typeof schema>;

export function ResetPasswordForm() {
  const dispatch = useAppDispatch();
  const isLoading = useAppSelector(selectIsLoading);
  const error = useAppSelector(selectAuthError);
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    dispatch(clearError());
    const result = await dispatch(sendPasswordReset(values.email));
    if (sendPasswordReset.fulfilled.match(result)) {
      setSubmittedEmail(values.email);
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="space-y-5 text-center animate-scale-in">
        <div className="w-16 h-16 bg-nia-900/40 border border-nia-500/40 rounded-2xl flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-nia-400" />
        </div>
        <div className="space-y-2">
          <h2 className="font-heading text-xl text-white font-semibold">
            Reset link sent
          </h2>
          <p className="text-sm text-earth-400 leading-relaxed">
            We sent a reset link to{" "}
            <span className="text-white font-medium">{submittedEmail}</span>.
            Follow the link to create a new password.
          </p>
        </div>
        <p className="text-xs text-earth-600">
          The link expires in 1 hour. Check your spam folder if you
          don&apos;t see it.
        </p>
        <Link
          href="/auth/sign-in"
          className="flex items-center justify-center gap-1.5 text-sm text-nia-400 hover:text-nia-300 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="space-y-1">
        <Link
          href="/auth/sign-in"
          className="inline-flex items-center gap-1.5 text-xs text-earth-500 hover:text-earth-300 transition-colors mb-2"
        >
          <ArrowLeft className="w-3 h-3" />
          Back to sign in
        </Link>
        <h2 className="font-heading text-xl text-white font-semibold">
          Reset your password
        </h2>
        <p className="text-xs text-earth-500">
          Enter your email and we&apos;ll send a reset link
        </p>
      </div>

      {error && <AuthAlert type="error" message={error} />}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <AuthInput
          label="Email address"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          icon={<Mail className="w-4 h-4" />}
          error={errors.email?.message}
          {...register("email")}
        />

        <AuthButton type="submit" loading={isLoading}>
          Send reset link
        </AuthButton>
      </form>
    </div>
  );
}
