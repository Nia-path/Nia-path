// src/app/auth/update-password/page.tsx
// Users land here after clicking the reset link in their email.
// Supabase automatically exchanges the URL token for a session cookie
// before this page renders (handled by the auth callback route).

import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";

export default function UpdatePasswordPage() {
  return <UpdatePasswordForm />;
}
