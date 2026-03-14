// src/hooks/useCases.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryClient";
import { getCases, getCaseById, createCase, updateCaseStatus } from "@/lib/supabase/queries";
import { useCurrentUser } from "@/store/hooks";
import type { Case } from "@/types";
import toast from "react-hot-toast";

export function useCases() {
  const user = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.cases.all(user?.id ?? ""),
    queryFn: () => getCases(user!.id),
    enabled: !!user,
  });
}

export function useCase(caseId: string) {
  return useQuery({
    queryKey: queryKeys.cases.detail(caseId),
    queryFn: () => getCaseById(caseId),
    enabled: !!caseId,
  });
}

export function useCreateCase() {
  const queryClient = useQueryClient();
  const user = useCurrentUser();

  return useMutation({
    mutationFn: (payload: Pick<Case, "title" | "description" | "category" | "location">) =>
      createCase({ ...payload, user_id: user!.id }),
    onSuccess: (newCase) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.all(user!.id) });
      toast.success("Case created successfully");
      return newCase;
    },
    onError: () => toast.error("Failed to create case"),
  });
}

export function useUpdateCaseStatus() {
  const queryClient = useQueryClient();
  const user = useCurrentUser();

  return useMutation({
    mutationFn: ({ caseId, status }: { caseId: string; status: Case["status"] }) =>
      updateCaseStatus(caseId, status),
    onSuccess: (_, { caseId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.detail(caseId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.cases.all(user?.id ?? "") });
    },
  });
}
