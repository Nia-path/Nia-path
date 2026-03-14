// src/app/(nia)/evidence/page.tsx
"use client";

import { useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { useEvidence, useUploadEvidence } from "@/hooks/useEvidence";
import { useUploadQueue } from "@/store/hooks";
import { Card, Skeleton, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  formatFileSize,
  formatRelativeTime,
  EVIDENCE_TYPE_ICONS,
  cn,
} from "@/utils";
import type { EvidenceType } from "@/types";
import {
  Upload,
  Camera,
  Mic,
  FileText,
  Image as ImageIcon,
  MapPin,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
} from "lucide-react";

const EVIDENCE_TYPES: { type: EvidenceType; label: string; icon: React.ElementType; accept: string }[] = [
  { type: "photo",     label: "Photo",     icon: Camera,    accept: "image/*" },
  { type: "video",     label: "Video",     icon: ImageIcon, accept: "video/*" },
  { type: "audio",     label: "Audio",     icon: Mic,       accept: "audio/*" },
  { type: "document",  label: "Document",  icon: FileText,  accept: ".pdf,.doc,.docx,.txt" },
];

export default function EvidencePage() {
  const searchParams = useSearchParams();
  const caseId = searchParams.get("case") ?? "";

  const { data: evidenceItems, isLoading } = useEvidence(caseId);
  const uploadEvidence = useUploadEvidence();
  const uploadQueue = useUploadQueue();

  const [selectedType, setSelectedType] = useState<EvidenceType>("photo");
  const [description, setDescription] = useState("");
  const [captureLocation, setCaptureLocation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      for (const file of acceptedFiles) {
        await uploadEvidence.mutateAsync({
          file,
          caseId: caseId || "general",
          evidenceType: selectedType,
          description: description || undefined,
        });
      }
      setDescription("");
    },
    [caseId, selectedType, description, uploadEvidence]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": selectedType === "photo" ? [".jpg", ".jpeg", ".png", ".webp"] : [],
      "video/*": selectedType === "video" ? [".mp4", ".webm", ".mov"] : [],
      "audio/*": selectedType === "audio" ? [".mp3", ".wav", ".webm", ".m4a"] : [],
      "application/pdf": selectedType === "document" ? [".pdf"] : [],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const pendingUploads = uploadQueue.filter((i) => i.status !== "success");

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="font-heading text-2xl text-earth-900">Evidence Vault</h1>
        <p className="text-sm text-earth-500 mt-0.5">
          All evidence is encrypted and timestamped automatically
        </p>
      </div>

      {/* Type selector */}
      <div>
        <p className="text-xs font-semibold text-earth-500 uppercase tracking-wide mb-2">
          Evidence Type
        </p>
        <div className="grid grid-cols-4 gap-2">
          {EVIDENCE_TYPES.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={cn(
                "flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all text-xs font-medium",
                selectedType === type
                  ? "bg-nia-600 border-nia-600 text-white"
                  : "bg-white border-earth-200 text-earth-600 hover:border-nia-300"
              )}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="text-xs font-semibold text-earth-500 uppercase tracking-wide mb-2 block">
          Description (optional)
        </label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Briefly describe this evidence…"
          className="w-full h-10 px-3 text-sm bg-white border border-earth-200 rounded-xl outline-none focus:border-nia-400 focus:ring-1 focus:ring-nia-300"
        />
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all",
          isDragActive
            ? "border-nia-400 bg-nia-50"
            : "border-earth-200 bg-earth-50 hover:border-nia-300 hover:bg-nia-50/50"
        )}
      >
        <input {...getInputProps()} />
        <Upload className={cn("w-8 h-8 mx-auto mb-3", isDragActive ? "text-nia-600" : "text-earth-300")} />
        <p className="text-sm font-medium text-earth-700">
          {isDragActive ? "Drop files here" : "Tap to upload or drag & drop"}
        </p>
        <p className="text-xs text-earth-400 mt-1">Max 50MB per file</p>
      </div>

      {/* Camera / Mic quick capture */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="secondary"
          onClick={() => {
            if (fileInputRef.current) {
              fileInputRef.current.accept = "image/*";
              fileInputRef.current.capture = "environment";
              fileInputRef.current.click();
            }
          }}
          className="flex items-center gap-2"
        >
          <Camera className="w-4 h-4" /> Take Photo
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            if (fileInputRef.current) {
              fileInputRef.current.accept = "audio/*";
              fileInputRef.current.capture = "microphone";
              fileInputRef.current.click();
            }
          }}
          className="flex items-center gap-2"
        >
          <Mic className="w-4 h-4" /> Record Audio
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onDrop([file]);
            e.target.value = "";
          }}
        />
      </div>

      {/* Upload queue */}
      {pendingUploads.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-earth-500 uppercase tracking-wide mb-2">
            Upload Queue
          </p>
          <div className="space-y-2">
            {pendingUploads.map((item) => (
              <Card key={item.id} padding="sm" className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-earth-800 truncate">{item.file.name}</p>
                  <div className="mt-1.5 h-1.5 bg-earth-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-nia-500 rounded-full transition-all"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                </div>
                {item.status === "success" && <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />}
                {item.status === "pending" && <Clock className="w-4 h-4 text-yellow-500 shrink-0" />}
                {item.status === "error" && <AlertCircle className="w-4 h-4 text-emergency-500 shrink-0" />}
                {item.status === "uploading" && (
                  <span className="w-4 h-4 border-2 border-nia-400 border-t-transparent rounded-full animate-spin shrink-0" />
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Evidence gallery */}
      <div>
        <p className="text-xs font-semibold text-earth-500 uppercase tracking-wide mb-3">
          Stored Evidence {evidenceItems ? `(${evidenceItems.length})` : ""}
        </p>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : !evidenceItems || evidenceItems.length === 0 ? (
          <Card className="text-center py-8">
            <FolderLockEmpty />
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {evidenceItems.map((item) => (
              <Card key={item.id} hover padding="sm" className="flex flex-col gap-2">
                <div className="h-24 bg-earth-50 rounded-xl flex items-center justify-center">
                  <span className="text-3xl">{EVIDENCE_TYPE_ICONS[item.type]}</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-earth-800 truncate">{item.file_name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-earth-400">{formatFileSize(item.file_size)}</span>
                    <Badge variant="default">{item.type}</Badge>
                  </div>
                  <p className="text-xs text-earth-400 mt-0.5">{formatRelativeTime(item.captured_at)}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FolderLockEmpty() {
  return (
    <div className="flex flex-col items-center gap-2">
      <FileText className="w-10 h-10 text-earth-200" />
      <p className="text-sm text-earth-400">No evidence stored yet</p>
      <p className="text-xs text-earth-300">Upload files above to build your evidence vault</p>
    </div>
  );
}
