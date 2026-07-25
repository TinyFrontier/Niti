import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  updateApplication,
  type Application,
  type ApplicationStatus,
} from "@/features/applications/api";

interface StatusMutationVariables {
  id: string;
  status: ApplicationStatus;
}

/**
 * Matches both cached shapes that carry application items: table pages
 * (`Page<Application>`) and the board's accumulated `{ items, total }` data.
 */
interface ApplicationItemsCache {
  items: Application[];
}

function hasApplicationItems(data: unknown): data is ApplicationItemsCache {
  return (
    typeof data === "object" &&
    data !== null &&
    Array.isArray((data as ApplicationItemsCache).items)
  );
}

function isApplication(data: unknown): data is Application {
  return typeof data === "object" && data !== null && typeof (data as Application).id === "string";
}

/**
 * Optimistic status change shared by the board, cards, and the detail page.
 * Patches every cached `["applications", ...]` query (list pages and single
 * application detail), rolls back on error, and refreshes applications and
 * analytics when settled.
 */
export function useStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: StatusMutationVariables) => updateApplication(id, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["applications"] });
      const previous = queryClient.getQueriesData({ queryKey: ["applications"] });
      const now = new Date().toISOString();

      queryClient.setQueriesData({ queryKey: ["applications"] }, (data: unknown) => {
        if (hasApplicationItems(data)) {
          return {
            ...data,
            items: data.items.map((item) =>
              item.id === id ? { ...item, status, updated_at: now } : item,
            ),
          };
        }
        if (isApplication(data) && data.id === id) {
          return { ...data, status, updated_at: now };
        }
        return data;
      });

      return { previous };
    },
    onError: (_error, _variables, context) => {
      for (const [queryKey, data] of context?.previous ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}
