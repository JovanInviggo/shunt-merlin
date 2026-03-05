import { useQuery } from "@tanstack/react-query";
import { fetchRecordings, Recording } from "@/lib/api";

export function useRecordings() {
  return useQuery<Recording[], Error>({
    queryKey: ["recordings"],
    queryFn: fetchRecordings,
  });
}

