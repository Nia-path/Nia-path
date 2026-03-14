// src/app/(nia)/profile/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser, useAppDispatch } from "@/store/hooks";
import { lockNia, setUser } from "@/store/slices/authSlice";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Card";
import { isValidPhone, maskPhone, cn } from "@/utils";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import {
  User,
  Phone,
  Shield,
  Lock,
  Bell,
  ChevronRight,
  LogOut,
  Plus,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";

export default function ProfilePage() {
  const user = useCurrentUser();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const supabase = createClient();

  const [showPhone, setShowPhone] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.full_name ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: name, updated_at: new Date().toISOString() })
        .eq("id", user.id);
      if (error) throw error;
      dispatch(setUser({ ...user, full_name: name }));
      setIsEditing(false);
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLock = () => {
    dispatch(lockNia());
    router.replace("/");
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    dispatch(setUser(null));
    dispatch(lockNia());
    router.replace("/");
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="font-heading text-2xl text-earth-900">My Profile</h1>
        <p className="text-sm text-earth-500 mt-0.5">Manage your account and security settings</p>
      </div>

      {/* Avatar & name */}
      <Card className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-nia-gradient flex items-center justify-center shrink-0">
          <span className="text-white font-heading text-xl font-bold">
            {user?.full_name?.charAt(0).toUpperCase() ?? "N"}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 h-9 px-3 text-sm border border-earth-200 rounded-xl outline-none focus:border-nia-400"
              />
              <Button size="sm" loading={isSaving} onClick={handleSave}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <>
              <p className="font-semibold text-earth-900">{user?.full_name ?? "Nia User"}</p>
              <p className="text-xs text-earth-400 truncate">{user?.email}</p>
              <button
                onClick={() => setIsEditing(true)}
                className="text-xs text-nia-600 font-medium mt-1 hover:underline"
              >
                Edit name
              </button>
            </>
          )}
        </div>
      </Card>

      {/* Contact info */}
      <Card className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <User className="w-4 h-4 text-earth-400" />
          <h2 className="text-sm font-semibold text-earth-700">Contact Info</h2>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-earth-50">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-earth-400" />
            <span className="text-sm text-earth-700">
              {user?.phone
                ? showPhone
                  ? user.phone
                  : maskPhone(user.phone)
                : "No phone number"}
            </span>
          </div>
          {user?.phone && (
            <button onClick={() => setShowPhone((v) => !v)}>
              {showPhone
                ? <EyeOff className="w-4 h-4 text-earth-400" />
                : <Eye className="w-4 h-4 text-earth-400" />
              }
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
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
        {user?.emergency_contacts?.length ? (
          user.emergency_contacts.map((c) => (
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
          <p className="text-sm text-earth-400 text-center py-3">
            No emergency contacts added. Add trusted people who will be alerted in emergencies.
          </p>
        )}
      </Card>

      {/* Security settings */}
      <Card className="space-y-1">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-earth-400" />
          <h2 className="text-sm font-semibold text-earth-700">Security</h2>
        </div>
        {[
          { label: "Change secret PIN",        icon: Lock,  action: () => router.push("/profile/change-pin") },
          { label: "Notification preferences", icon: Bell,  action: () => {} },
        ].map(({ label, icon: Icon, action }) => (
          <button
            key={label}
            onClick={action}
            className="w-full flex items-center gap-3 py-3 border-b border-earth-50 last:border-0 hover:bg-earth-50 rounded-xl transition-colors px-2"
          >
            <Icon className="w-4 h-4 text-earth-400 shrink-0" />
            <span className="text-sm text-earth-700 flex-1 text-left">{label}</span>
            <ChevronRight className="w-4 h-4 text-earth-300" />
          </button>
        ))}
      </Card>

      {/* Privacy note */}
      <div className="bg-nia-50 rounded-2xl p-4 border border-nia-100 text-xs text-nia-700 leading-relaxed">
        <p className="font-semibold mb-1">🔒 Your privacy is protected</p>
        <p>
          All your data is end-to-end encrypted. Nia Path staff cannot view your personal information,
          evidence files, or conversations. Only you and your chosen contacts can access your data.
        </p>
      </div>

      {/* Actions */}
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
    </div>
  );
}
