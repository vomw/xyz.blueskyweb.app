import {useGetSuggestedUsersForExploreQuery} from '#/state/queries/trending/useGetSuggestedUsersForExploreQuery'

export function useSuggestedUsersForExplore({
  category = null,
}: {
  category?: string | null
}) {
  const curated = useGetSuggestedUsersForExploreQuery({
    enabled: true,
    category,
  })

  return {
    data: curated.data,
    isLoading: curated.isLoading,
    error: curated.error,
    isRefetching: curated.isRefetching,
    refetch: curated.refetch,
  }
}
