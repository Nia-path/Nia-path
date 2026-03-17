// src/components/auth/UpdatePasswordForm.tsx
// Rendered after the user clicks the password reset link in their email.
// The URL contains a one-time token that Supabase exchanges for a session.

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  updatePassword,
  clearError,
  selectIsLoading,
  selectAuthError,
} from "@/store/slices/authSlice";
import { AuthInput, AuthButton, AuthAlert } from "./AuthFormField";
import { Lock } from "lucide-react";

const schema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export function UpdatePasswordForm() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const isLoading = useAppSelector(selectIsLoading);
  const error = useAppSelector(selectAuthError);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    dispatch(clearError());
    const result = await dispatch(updatePassword(values.password));
    if (updatePassword.fulfilled.match(result)) {
      router.replace("/dashboard");
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="space-y-1 text-center">
        <h2 className="font-heading text-xl text-white font-semibold">
          Create new password
        </h2>
        <p className="text-xs text-earth-500">
          Choose a strong password for your account
        </p>
      </div>

      {error && <AuthAlert type="error" message={error} />}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <AuthInput
          label="New password"
          type="password"
          autoComplete="new-password"
          icon={<Lock className="w-4 h-4" />}
          error={errors.password?.message}
          {...register("password")}
        />

        <AuthInput
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          icon={<Lock className="w-4 h-4" />}
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />

        <AuthButton type="submit" loading={isLoading}>
          Update password
        </AuthButton>
      </form>
    </div>
  );
}
