import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createStudy, fetchStudies, Study } from "@/lib/api";

export function useStudies() {
  return useQuery<Study[], Error>({
    queryKey: ["studies"],
    queryFn: fetchStudies,
  });
}

export function useCreateStudy() {
  const queryClient = useQueryClient();
  return useMutation<Study, Error, string>({
    mutationFn: createStudy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studies"] });
    },
  });
}

