// src/app/(nia)/profile/page.tsx
// Updated profile page that reads from the real auth state and uses
// the useSignOut, useUpdateProfile, and useUploadAvatar hooks.
// REPLACE the existing src/app/(nia)/profile/page.tsx with this file.

"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCurrentProfile, useAppDispatch } from "@/store/hooks";
import { lockNia } from "@/store/slices/authSlice";
import { useSignOut, useUpdateProfile, useUploadAvatar } from "@/hooks/useAuth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Card";
import { SetupPinModal } from "@/components/auth/SetupPinModal";
import { cn, maskPhone } from "@/utils";
import toast from "react-hot-toast";
import {
  User, Phone, Shield, Lock, Bell,
  ChevronRight, LogOut, Plus, Trash2,
  Eye, EyeOff, Camera, Loader2,
} from "lucide-react";

const profileSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters").max(80),
  display_name: z.string().max(40).optional(),
  county: z.string().optional(),
  language_preference: z.enum(["en", "sw"]),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const profile = useCurrentProfile();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const signOut = useSignOut();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();

  const [showPhone, setShowPhone] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, reset, formState: { errors, isDirty } } =
    useForm<ProfileFormValues>({
      resolver: zodResolver(profileSchema),
      defaultValues: {
        full_name: profile?.full_name ?? "",
        display_name: profile?.display_name ?? "",
        county: profile?.county ?? "",
        language_preference: profile?.language_preference ?? "en",
      },
    });

  const onSave = async (values: ProfileFormValues) => {
    await updateProfile.mutateAsync({
      full_name: values.full_name,
      display_name: values.display_name || null,
      county: values.county || null,
      language_preference: values.language_preference,
    });
    setIsEditing(false);
    reset(values);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadAvatar.mutate(file);
    e.target.value = "";
  };

  const handleLock = () => {
    dispatch(lockNia());
    router.replace("/");
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const initials = (profile?.full_name ?? "N")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="font-heading text-2xl text-earth-900">My Profile</h1>
        <p className="text-sm text-earth-500 mt-0.5">
          Account settings and security
        </p>
      </div>

      {/* Avatar + name */}
      <Card className="flex items-center gap-4">
        <div className="relative shrink-0">
          <div className="w-16 h-16 rounded-full bg-nia-gradient flex items-center justify-center overflow-hidden">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-white font-heading text-xl font-bold">
                {initials}
              </span>
            )}
          </div>
          <button
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadAvatar.isPending}
            aria-label="Change avatar"
            className="absolute -bottom-1 -right-1 w-6 h-6 bg-nia-600 hover:bg-nia-700 rounded-full flex items-center justify-center shadow-sm transition-colors"
          >
            {uploadAvatar.isPending
              ? <Loader2 className="w-3 h-3 text-white animate-spin" />
              : <Camera className="w-3 h-3 text-white" />
            }
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>

        <div className="flex-1 min-w-0">
          {!isEditing ? (
            <>
              <p className="font-semibold text-earth-900 truncate">
                {profile?.full_name ?? "Nia User"}
              </p>
              {profile?.display_name && (
                <p className="text-xs text-earth-400 truncate">
                  Displayed as: {profile.display_name}
                </p>
              )}
              <p className="text-xs text-earth-400 truncate">{profile?.email}</p>
              <button
                onClick={() => setIsEditing(true)}
                className="text-xs text-nia-600 font-medium mt-1 hover:underline"
              >
                Edit profile
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit(onSave)} className="space-y-2 w-full">
              <input
                {...register("full_name")}
                placeholder="Full name"
                className="w-full h-9 px-3 text-sm border border-earth-200 rounded-xl outline-none focus:border-nia-400"
              />
              {errors.full_name && (
                <p className="text-xs text-emergency-500">{errors.full_name.message}</p>
              )}
              <input
                {...register("display_name")}
                placeholder="Display name (optional)"
                className="w-full h-9 px-3 text-sm border border-earth-200 rounded-xl outline-none focus:border-nia-400"
              />
              <div className="flex gap-2">
                <Button size="sm" loading={updateProfile.isPending} disabled={!isDirty}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => { setIsEditing(false); reset(); }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      </Card>

      {/* Location & language preferences */}
      {!isEditing && (
        <Card className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <User className="w-4 h-4 text-earth-400" />
            <h2 className="text-sm font-semibold text-earth-700">Preferences</h2>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm py-1.5 border-b border-earth-50">
              <span className="text-earth-600">County</span>
              <span className="text-earth-800 font-medium">
                {profile?.county ?? <span className="text-earth-400">Not set</span>}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm py-1.5">
              <span className="text-earth-600">Language</span>
              <span className="text-earth-800 font-medium">
                {profile?.language_preference === "sw" ? "🇰🇪 Kiswahili" : "🇬🇧 English"}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Contact */}
      <Card className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Phone className="w-4 h-4 text-earth-400" />
          <h2 className="text-sm font-semibold text-earth-700">Contact</h2>
        </div>
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-earth-700">
              {profile?.phone
                ? showPhone
                  ? profile.phone
                  : maskPhone(profile.phone)
                : <span className="text-earth-400 text-sm">No phone number</span>}
            </span>
          </div>
          {profile?.phone && (
            <button
              onClick={() => setShowPhone((v) => !v)}
              className="text-earth-400 hover:text-earth-600"
              aria-label={showPhone ? "Hide phone" : "Show phone"}
            >
              {showPhone ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>
      </Card>

      {/* Emergency contacts */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-earth-400" />
            <h2 className="text-sm font-semibold text-earth-700">Emergency Contacts</h2>
          </div>
          <button className="flex items-center gap-1 text-xs text-nia-600 font-medium">
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>

        {Array.isArray(profile?.emergency_contacts) && (profile.emergency_contacts as Array<{ id: string; name: string; phone: string; relationship: string }>).length > 0 ? (
          (profile.emergency_contacts as Array<{ id: string; name: string; phone: string; relationship: string }>).map((c) => (
            <div key={c.id} className="flex items-center justify-between py-2 border-b border-earth-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-earth-800">{c.name}</p>
                <p className="text-xs text-earth-400">{c.relationship} · {c.phone}</p>
              </div>
              <button className="text-earth-300 hover:text-emergency-500 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        ) : (
          <p className="text-sm text-earth-400 text-center py-2">
            No contacts yet. Add trusted people for emergency alerts.
          </p>
        )}
      </Card>

      {/* Security */}
      <Card className="space-y-1">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-earth-400" />
          <h2 className="text-sm font-semibold text-earth-700">Security</h2>
        </div>
        <button
          onClick={() => setShowPinModal(true)}
          className="w-full flex items-center gap-3 py-3 border-b border-earth-50 last:border-0 hover:bg-earth-50 rounded-xl transition-colors px-2"
        >
          <Lock className="w-4 h-4 text-earth-400 shrink-0" />
          <span className="text-sm text-earth-700 flex-1 text-left">
            {profile?.pin_hash ? "Change secret PIN" : "Set up secret PIN"}
          </span>
          <ChevronRight className="w-4 h-4 text-earth-300" />
        </button>
        <button
          className="w-full flex items-center gap-3 py-3 border-b border-earth-50 last:border-0 hover:bg-earth-50 rounded-xl transition-colors px-2"
        >
          <Bell className="w-4 h-4 text-earth-400 shrink-0" />
          <span className="text-sm text-earth-700 flex-1 text-left">Notification preferences</span>
          <ChevronRight className="w-4 h-4 text-earth-300" />
        </button>
      </Card>

      {/* Privacy notice */}
      <div className="bg-nia-50 rounded-2xl p-4 border border-nia-100">
        <p className="text-xs text-nia-700 leading-relaxed">
          <strong>🔒 Your privacy is protected.</strong> All your data is
          end-to-end encrypted. Only you and your chosen contacts can access
          your information.
        </p>
      </div>

      {/* Account actions */}
      <div className="space-y-2 pb-4">
        <Button
          variant="outline"
          size="lg"
          fullWidth
          onClick={handleLock}
          className="gap-2"
        >
          <Lock className="w-4 h-4" />
          Lock Nia Path
        </Button>
        <Button
          variant="ghost"
          size="lg"
          fullWidth
          onClick={handleSignOut}
          className="gap-2 text-emergency-600 hover:bg-emergency-50"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>

      {/* PIN Setup Modal */}
      <SetupPinModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={() => {
          // Refresh profile to reflect the new PIN setup
          window.location.reload();
        }}
      />
    </div>
  );
}
