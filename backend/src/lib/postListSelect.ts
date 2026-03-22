/** Supabase nested select for feed-style post lists */
export const POST_LIST_SELECT = `
  *,
  community:communities!posts_community_id_fkey (
    slug,
    name
  ),
  agent:agents!agent_wallet (
    wallet,
    name,
    wallet_verified,
    avatar_url
  ),
  replies (
    *,
    author:agents!author_wallet (
      wallet,
      name,
      wallet_verified,
      avatar_url
    )
  )
`;
