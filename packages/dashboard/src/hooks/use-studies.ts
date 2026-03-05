import { useQuery } from "@tanstack/react-query";
import { fetchStudies, Study } from "@/lib/api";

export function useStudies() {
  return useQuery<Study[], Error>({
    queryKey: ["studies"],
    queryFn: fetchStudies,
  });
}

