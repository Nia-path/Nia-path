// src/components/auth/SignInForm.tsx
"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  signInWithEmail,
  clearError,
  selectIsLoading,
  selectAuthError,
  selectIsAuthenticated,
} from "@/store/slices/authSlice";
import { AuthInput, AuthButton, AuthAlert } from "./AuthFormField";
import { Mail, Lock } from "lucide-react";

const schema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters"),
});

type FormValues = z.infer<typeof schema>;

export function SignInForm() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();

  const isLoading = useAppSelector(selectIsLoading);
  const error = useAppSelector(selectAuthError);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  // Success: redirect to intended destination
  useEffect(() => {
    if (isAuthenticated) {
      const redirect = searchParams.get("redirect");
      const safe = redirect?.startsWith("/") ? redirect : "/dashboard";
      router.replace(safe);
    }
  }, [isAuthenticated, router, searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    dispatch(clearError());
    dispatch(signInWithEmail({ email: values.email, password: values.password }));
  };

  // URL-passed error (e.g. from expired reset link)
  const urlError = searchParams.get("error");

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="space-y-1 text-center">
        <h2 className="font-heading text-xl text-white font-semibold">
          Welcome back
        </h2>
        <p className="text-xs text-earth-500">
          Sign in to your protected account
        </p>
      </div>

      {(error || urlError) && (
        <AuthAlert type="error" message={error ?? urlError!} />
      )}

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

        <AuthInput
          label="Password"
          type="password"
          autoComplete="current-password"
          icon={<Lock className="w-4 h-4" />}
          error={errors.password?.message}
          {...register("password")}
        />

        <div className="flex justify-end">
          <Link
            href="/auth/reset-password"
            className="text-xs text-nia-400 hover:text-nia-300 transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        <AuthButton type="submit" loading={isLoading}>
          Sign in
        </AuthButton>
      </form>

      <p className="text-center text-xs text-earth-500">
        Don&apos;t have an account?{" "}
        <Link
          href="/auth/sign-up"
          className="text-nia-400 hover:text-nia-300 font-medium transition-colors"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
