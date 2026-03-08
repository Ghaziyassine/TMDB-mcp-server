#!/usr/bin/env node
/**
 * TMDB MCP Server
 * Gives Claude access to The Movie Database (TMDB) API.
 *
 * Setup:
 *   1. Get a free API key at https://www.themoviedb.org/settings/api
 *   2. Set it: export TMDB_API_KEY=your_key_here
 *   3. Run:    node index.js
 *
 * Tools exposed to Claude:
 *   - search_movies       Search by title
 *   - get_movie_details   Full details by movie ID
 *   - get_trending        Trending movies (day or week)
 *   - get_now_playing     Movies currently in theatres
 *   - get_top_rated       All-time top rated movies
 *   - discover_movies     Filter by genre, year, rating, etc.
 *   - search_person       Search for actors/directors
 *   - get_movie_credits   Cast & crew for a movie
 */

const readline = require("readline");
require("dotenv").config();

const TMDB_BASE = "https://api.themoviedb.org/3";
const API_KEY = process.env.TMDB_API_KEY;
// const API_KEY = "3c49560e86e331cecaa85fb1f10031fa";

if (!API_KEY) {
  process.stderr.write(
    "❌  TMDB_API_KEY environment variable is not set.\n" +
    "    Get a free key at https://www.themoviedb.org/settings/api\n" +
    "    Then run: export TMDB_API_KEY=your_key_here\n"
  );
  process.exit(1);
}

// ─── TMDB helpers ─────────────────────────────────────────────────────────────

async function tmdb(path, params = {}) {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", API_KEY);
  url.searchParams.set("language", "en-US");
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`TMDB ${res.status}: ${err.status_message || res.statusText}`);
  }
  return res.json();
}

// Clean up movie objects — only return useful fields to avoid flooding the context
function formatMovie(m) {
  return {
    id: m.id,
    title: m.title,
    release_date: m.release_date,
    rating: m.vote_average,
    votes: m.vote_count,
    overview: m.overview,
    genres: m.genre_ids || m.genres?.map((g) => g.name),
    popularity: m.popularity,
    original_language: m.original_language,
  };
}

function formatPerson(p) {
  return {
    id: p.id,
    name: p.name,
    known_for_department: p.known_for_department,
    popularity: p.popularity,
    known_for: p.known_for?.map((m) => m.title || m.name).slice(0, 5),
  };
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "search_movies",
    description: "Search for movies by title. Returns a list of matching movies with their IDs, ratings, and overviews.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Movie title to search for" },
        year: { type: "number", description: "Optional: filter by release year" },
        page: { type: "number", description: "Page number (default 1)" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_movie_details",
    description: "Get full details about a specific movie by its TMDB ID. Includes runtime, tagline, budget, revenue, genres, and production companies.",
    inputSchema: {
      type: "object",
      properties: {
        movie_id: { type: "number", description: "TMDB movie ID (get this from search_movies)" },
      },
      required: ["movie_id"],
    },
  },
  {
    name: "get_trending",
    description: "Get currently trending movies on TMDB.",
    inputSchema: {
      type: "object",
      properties: {
        time_window: {
          type: "string",
          enum: ["day", "week"],
          description: "Trending over 'day' or 'week' (default: week)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_now_playing",
    description: "Get movies currently playing in theatres.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number", description: "Page number (default 1)" },
      },
      required: [],
    },
  },
  {
    name: "get_top_rated",
    description: "Get the all-time top rated movies on TMDB.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number", description: "Page number (default 1)" },
      },
      required: [],
    },
  },
  {
    name: "discover_movies",
    description: "Find movies using filters: genre, year range, minimum rating, sort order. Great for recommendations.",
    inputSchema: {
      type: "object",
      properties: {
        genre_id: {
          type: "number",
          description: "Genre ID. Common ones: 28=Action, 35=Comedy, 18=Drama, 27=Horror, 10749=Romance, 878=Sci-Fi, 53=Thriller, 16=Animation, 99=Documentary",
        },
        year: { type: "number", description: "Primary release year" },
        min_year: { type: "number", description: "Release year >= this" },
        max_year: { type: "number", description: "Release year <= this" },
        min_rating: { type: "number", description: "Minimum vote average (0-10)" },
        sort_by: {
          type: "string",
          enum: ["popularity.desc", "popularity.asc", "vote_average.desc", "release_date.desc", "revenue.desc"],
          description: "Sort order (default: popularity.desc)",
        },
        page: { type: "number", description: "Page number (default 1)" },
      },
      required: [],
    },
  },
  {
    name: "search_person",
    description: "Search for an actor, director, or other film personality by name.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Person's name to search for" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_movie_credits",
    description: "Get the cast and crew (director, writer, etc.) for a movie by its TMDB ID.",
    inputSchema: {
      type: "object",
      properties: {
        movie_id: { type: "number", description: "TMDB movie ID" },
      },
      required: ["movie_id"],
    },
  },
];

// ─── Tool implementations ─────────────────────────────────────────────────────

async function searchMovies({ query, year, page = 1 }) {
  const data = await tmdb("/search/movie", { query, year, page });
  return {
    total_results: data.total_results,
    total_pages: data.total_pages,
    page: data.page,
    results: data.results.slice(0, 10).map(formatMovie),
  };
}

async function getMovieDetails({ movie_id }) {
  const m = await tmdb(`/movie/${movie_id}`);
  return {
    id: m.id,
    title: m.title,
    tagline: m.tagline,
    overview: m.overview,
    release_date: m.release_date,
    runtime: `${m.runtime} min`,
    rating: m.vote_average,
    votes: m.vote_count,
    genres: m.genres.map((g) => g.name),
    budget: m.budget ? `$${m.budget.toLocaleString()}` : "N/A",
    revenue: m.revenue ? `$${m.revenue.toLocaleString()}` : "N/A",
    original_language: m.original_language,
    production_companies: m.production_companies.map((c) => c.name),
    homepage: m.homepage,
    status: m.status,
    imdb_id: m.imdb_id,
  };
}

async function getTrending({ time_window = "week" }) {
  const data = await tmdb(`/trending/movie/${time_window}`);
  return {
    time_window,
    results: data.results.slice(0, 10).map(formatMovie),
  };
}

async function getNowPlaying({ page = 1 }) {
  const data = await tmdb("/movie/now_playing", { page });
  return {
    total_results: data.total_results,
    results: data.results.slice(0, 10).map(formatMovie),
  };
}

async function getTopRated({ page = 1 }) {
  const data = await tmdb("/movie/top_rated", { page });
  return {
    total_results: data.total_results,
    results: data.results.slice(0, 10).map(formatMovie),
  };
}

async function discoverMovies({ genre_id, year, min_year, max_year, min_rating, sort_by = "popularity.desc", page = 1 }) {
  const data = await tmdb("/discover/movie", {
    with_genres: genre_id,
    primary_release_year: year,
    "primary_release_date.gte": min_year ? `${min_year}-01-01` : undefined,
    "primary_release_date.lte": max_year ? `${max_year}-12-31` : undefined,
    "vote_average.gte": min_rating,
    "vote_count.gte": 100, // avoid low-vote noise
    sort_by,
    page,
  });
  return {
    total_results: data.total_results,
    results: data.results.slice(0, 10).map(formatMovie),
  };
}

async function searchPerson({ query }) {
  const data = await tmdb("/search/person", { query });
  return {
    total_results: data.total_results,
    results: data.results.slice(0, 5).map(formatPerson),
  };
}

async function getMovieCredits({ movie_id }) {
  const data = await tmdb(`/movie/${movie_id}/credits`);
  const director = data.crew.find((c) => c.job === "Director");
  const writers = data.crew.filter((c) => ["Writer", "Screenplay", "Story"].includes(c.job)).slice(0, 3);
  return {
    director: director ? { name: director.name, id: director.id } : null,
    writers: writers.map((w) => ({ name: w.name, job: w.job })),
    cast: data.cast.slice(0, 15).map((a) => ({
      name: a.name,
      character: a.character,
      id: a.id,
    })),
  };
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

async function handleToolCall(name, args) {
  switch (name) {
    case "search_movies":      return searchMovies(args);
    case "get_movie_details":  return getMovieDetails(args);
    case "get_trending":       return getTrending(args);
    case "get_now_playing":    return getNowPlaying(args);
    case "get_top_rated":      return getTopRated(args);
    case "discover_movies":    return discoverMovies(args);
    case "search_person":      return searchPerson(args);
    case "get_movie_credits":  return getMovieCredits(args);
    default:                   return { error: `Unknown tool: ${name}` };
  }
}

// ─── JSON-RPC 2.0 handler ─────────────────────────────────────────────────────

async function handleRequest(raw) {
  let req;
  try {
    req = JSON.parse(raw);
  } catch {
    return { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } };
  }

  const { jsonrpc, id, method, params } = req;
  if (jsonrpc !== "2.0") {
    return { jsonrpc: "2.0", id, error: { code: -32600, message: "Invalid Request" } };
  }

  if (method === "initialize") {
    return {
      jsonrpc: "2.0", id,
      result: {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "tmdb-mcp", version: "1.0.0" },
        capabilities: { tools: {} },
      },
    };
  }

  if (method === "notifications/initialized") return null;
  if (method === "ping") return { jsonrpc: "2.0", id, result: {} };

  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  }

  if (method === "tools/call") {
    const { name, arguments: args = {} } = params || {};
    if (!name) {
      return { jsonrpc: "2.0", id, error: { code: -32602, message: "Missing tool name" } };
    }
    try {
      const output = await handleToolCall(name, args);
      return {
        jsonrpc: "2.0", id,
        result: { content: [{ type: "text", text: JSON.stringify(output, null, 2) }] },
      };
    } catch (err) {
      return {
        jsonrpc: "2.0", id,
        result: { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] },
      };
    }
  }

  return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
}

// ─── stdio transport ──────────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, terminal: false });

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  const response = await handleRequest(trimmed);
  if (response !== null) {
    process.stdout.write(JSON.stringify(response) + "\n");
  }
});

rl.on("close", () => process.exit(0));

process.stderr.write("🎬  TMDB MCP server started (stdio)\n");