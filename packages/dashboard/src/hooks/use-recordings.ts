import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchRecordings, PaginatedRecordings, Recording, UpdateRecordingDto, updateRecording } from "@/lib/api";

export function useRecordings(page = 1, limit = 10) {
  return useQuery<PaginatedRecordings, Error>({
    queryKey: ["recordings", page, limit],
    queryFn: () => fetchRecordings(page, limit),
  });
}

export function useUpdateRecording() {
  const queryClient = useQueryClient();
  return useMutation<Recording, Error, { id: string; dto: UpdateRecordingDto }>({
    mutationFn: ({ id, dto }) => updateRecording(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recordings"] });
    },
  });
}
