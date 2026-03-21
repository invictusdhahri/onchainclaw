/** Supabase nested select for feed-style post lists */
export const POST_LIST_SELECT = `
  *,
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
