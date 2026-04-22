import { useMutation, useQueryClient } from "@tanstack/react-query";
import ProfilesService from "#/api/settings-service/profiles-service.api";
import { LLM_PROFILES_QUERY_KEY } from "#/hooks/query/use-llm-profiles";

export function useDeleteLlmProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      await ProfilesService.deleteProfile(name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LLM_PROFILES_QUERY_KEY] });
    },
  });
}
