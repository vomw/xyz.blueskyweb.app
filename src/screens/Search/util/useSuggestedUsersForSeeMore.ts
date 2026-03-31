import {useGetSuggestedUsersForSeeMoreQuery} from '#/state/queries/trending/useGetSuggestedUsersForSeeMoreQuery'

export function useSuggestedUsersForSeeMore({
  category = null,
}: {
  category?: string | null
}) {
  const curated = useGetSuggestedUsersForSeeMoreQuery({
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
