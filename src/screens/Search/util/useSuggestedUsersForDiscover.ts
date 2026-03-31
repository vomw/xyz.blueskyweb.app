import {useGetSuggestedUsersForDiscoverQuery} from '#/state/queries/trending/useGetSuggestedUsersForDiscoverQuery'

export function useSuggestedUsersForDiscover() {
  const curated = useGetSuggestedUsersForDiscoverQuery({
    enabled: true,
  })

  return {
    data: curated.data,
    isLoading: curated.isLoading,
    error: curated.error,
    isRefetching: curated.isRefetching,
    refetch: curated.refetch,
  }
}
