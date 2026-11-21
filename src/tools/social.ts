import { z } from "zod";
import type { Tool } from "../agents/call.js";
import { getJson } from "./dexscreener.js";

export function socialActions(tokens: string[], windowMinutes: number, request = fetch, credentials: { x?:string; reddit?:string; subreddit?:string }={x:process.env.X_BEARER_TOKEN, reddit:process.env.REDDIT_ACCESS_TOKEN,
  subreddit:process.env.REDDIT_SUBREDDIT}): Tool[] {
  if (!tokens.length) return [];
  const query = z.enum(tokens as [string, ...string[]]);
  const actions: Tool[] = [];
  const bearer = credentials.x;
  if (bearer) {
    const parameters = z.strictObject({ query, limit: z.number().int().min(10).max(100) });
    actions.push({
      name: "x_search",
      description: "Search recent mentions for a requested token.",
      parameters,
      maxCalls: tokens.length,
      run: async (args) => {
        const { query, limit } = parameters.parse(args);
        const url = new URL("https://api.x.com/2/tweets/search/recent");
        url.search = new URLSearchParams({
          query,
          max_results: String(limit),
          start_time: new Date(Date.now() - windowMinutes * 60000).toISOString(),
          expansions: "author_id",
          "tweet.fields": "author_id,created_at",
          "user.fields": "created_at,verified,public_metrics",
        }).toString();
        return getJson(url, request, { Authorization: "Bearer " + bearer });
      },
    });
  }
  const reddit = credentials.reddit,
    subreddit = credentials.subreddit;
  if (reddit && subreddit && /^[A-Za-z0-9_]+$/.test(subreddit)) {
    const parameters = z.strictObject({ subreddit: z.literal(subreddit), query });
    actions.push({
      name: "reddit_search",
      description: "Search the configured subreddit for a requested token.",
      parameters,
      maxCalls: tokens.length,
      run: async (args) => {
        const { query } = parameters.parse(args);
        const url = new URL("https://oauth.reddit.com/r/" + subreddit + "/search");
        url.search = new URLSearchParams({ q: query, restrict_sr: "1", sort: "new", limit: "100" }).toString();
        return getJson(url, request, { Authorization: "Bearer " + reddit, "User-Agent": "dex-orchestrator/0.1" });
      },
    });
  }
  return actions;
}
