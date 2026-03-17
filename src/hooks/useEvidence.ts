// src/hooks/useEvidence.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { v4 as uuidv4 } from "uuid";
import { queryKeys } from "@/lib/queryClient";
import {
  getEvidenceByCase,
  createEvidenceRecord,
  uploadEvidenceFile,
} from "@/lib/supabase/queries";
import { savePendingUpload } from "@/lib/db";
import { useAppDispatch, useCurrentUser } from "@/store/hooks";
import { addToQueue, updateQueueItem, setIsUploading } from "@/store/slices/evidenceSlice";
import type { EvidenceType } from "@/types";
import toast from "react-hot-toast";

export function useEvidence(caseId: string) {
  return useQuery({
    queryKey: queryKeys.evidence.byCase(caseId),
    queryFn: () => getEvidenceByCase(caseId),
    enabled: !!caseId,
  });
}

export function useUploadEvidence() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const user = useCurrentUser();

  return useMutation({
    mutationFn: async ({
      file,
      caseId,
      evidenceType,
      description,
      locationLat,
      locationLng,
    }: {
      file: File;
      caseId: string;
      evidenceType: EvidenceType;
      description?: string;
      locationLat?: number;
      locationLng?: number;
    }) => {
      // Check if user is authenticated
      if (!user) {
        throw new Error("User not authenticated. Please log in to upload evidence.");
      }

      const uploadId = uuidv4();

      dispatch(
        addToQueue({
          id: uploadId,
          file,
          case_id: caseId,
          status: "uploading",
          progress: 0,
        })
      );
      dispatch(setIsUploading(true));

      try {
        // Try online upload first
        const fileUrl = await uploadEvidenceFile(user.id, caseId, file);
        const capturedAt = new Date().toISOString();

        const evidence = await createEvidenceRecord({
          case_id: caseId,
          user_id: user.id,
          type: evidenceType,
          file_name: file.name,
          file_url: fileUrl,
          mime_type: file.type,
          file_size: file.size,
          description,
          location_lat: locationLat,
          location_lng: locationLng,
          captured_at: capturedAt,
          is_encrypted: false,
          checksum: uploadId,
        });

        dispatch(updateQueueItem({ id: uploadId, updates: { status: "success", progress: 100 } }));
        return evidence;
      } catch (error: any) {
        // Check if it's a genuine network error or offline
        const isNetworkError =
          error?.message?.includes("fetch") ||
          error?.message?.includes("network") ||
          error?.message?.includes("timeout") ||
          (error && typeof error === "object" && !navigator.onLine);

        if (isNetworkError || !navigator.onLine) {
          // Offline — queue for later sync
          const buffer = await file.arrayBuffer();
          await savePendingUpload({
            id: uploadId,
            case_id: caseId,
            file_name: file.name,
            file_data: buffer,
            mime_type: file.type,
            captured_at: new Date().toISOString(),
            evidence_type: evidenceType,
            location_lat: locationLat,
            location_lng: locationLng,
            synced: false,
          });

          dispatch(updateQueueItem({ id: uploadId, updates: { status: "pending", progress: 0 } }));
          toast("Evidence saved offline. Will sync when connected.", { icon: "📶" });
          return null;
        } else {
          // Actual server error - don't save offline, show real error
          dispatch(updateQueueItem({ id: uploadId, updates: { status: "error", progress: 0 } }));
          throw error;
        }
      } finally {
        dispatch(setIsUploading(false));
      }
    },
    onSuccess: (_, { caseId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.evidence.byCase(caseId) });
    },
    onError: () => toast.error("Failed to save evidence"),
  });
}
