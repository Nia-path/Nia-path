// src/components/auth/AuthLoadingScreen.tsx
// Shown during the brief window when the app is checking for an existing
// Supabase session on first load. Prevents a flash of unauthenticated UI.

export function AuthLoadingScreen() {
  return (
    <div className="min-h-screen bg-earth-900 flex flex-col items-center justify-center gap-6">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3 animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-nia-gradient flex items-center justify-center shadow-glow">
          <span className="text-white font-heading text-2xl font-bold select-none">N</span>
        </div>
        <div className="text-center">
          <p className="font-heading text-xl text-white font-semibold tracking-wide">
            Nia Path
          </p>
          <p className="text-earth-500 text-xs mt-0.5 tracking-widest uppercase">
            Loading…
          </p>
        </div>
      </div>

      {/* Spinner */}
      <div
        className="w-6 h-6 border-2 border-nia-400/30 border-t-nia-400 rounded-full animate-spin"
        aria-label="Loading"
        role="status"
      />
    </div>
  );
}
