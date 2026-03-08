# 🎬 TMDB MCP Server

Gives Claude (or any MCP client) full access to The Movie Database API.
No npm dependencies — uses Node.js 18+ native `fetch`.

---

## Quick Start

### 1. Get a free TMDB API key
👉 https://www.themoviedb.org/settings/api  
(Create a free account → Settings → API → Request API Key)

### 2. Set your key
```bash
export TMDB_API_KEY=your_key_here
```

### 3. Run the server
```bash
node index.js
```

---

## Connect to Claude Desktop

Edit your Claude Desktop config:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "tmdb": {
      "command": "node",
      "args": ["/absolute/path/to/tmdb-mcp-server/index.js"],
      "env": {
        "TMDB_API_KEY": "your_key_here"
      }
    }
  }
}
```

Restart Claude Desktop. You'll see a 🔌 icon — Claude can now query movies!

---

## Connect to Claude Code

```bash
TMDB_API_KEY=your_key claude mcp add tmdb node /absolute/path/to/index.js
```

---

## Connect to Gemini CLI

Edit your Gemini CLI config:

**Windows:** `%USERPROFILE%\.gemini\settings.json`  
**macOS/Linux:** `~/.gemini/settings.json`

Add the `mcpServers` section:

```json
{
  "mcpServers": {
    "tmdb": {
      "command": "node",
      "args": ["/absolute/path/to/index.js"],
      "env": {
        "TMDB_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

Replace `YOUR_USERNAME` with your actual Windows username and `your_api_key_here` with your TMDB API key. Restart Gemini CLI after saving.

---

## Tools available

| Tool | What Claude can ask |
|------|-------------------|
| `search_movies` | "Find movies called Inception" |
| `get_movie_details` | "Get details for movie ID 27205" |
| `get_trending` | "What movies are trending this week?" |
| `get_now_playing` | "What's in theatres right now?" |
| `get_top_rated` | "What are the highest rated movies ever?" |
| `discover_movies` | "Find action movies from the 90s rated above 7" |
| `search_person` | "Find info about Christopher Nolan" |
| `get_movie_credits` | "Who's in the cast of Interstellar?" |

---

## Example Claude conversations

Once connected, you can ask Claude things like:

- *"What are the trending movies this week?"*
- *"Find me sci-fi movies from 2010–2020 with a rating above 7.5"*
- *"Who directed The Dark Knight and who was in the cast?"*
- *"What's currently playing in theatres?"*
- *"Find horror movies sorted by rating"*

---

## Genre IDs (for discover_movies)

| ID | Genre |
|----|-------|
| 28 | Action |
| 12 | Adventure |
| 16 | Animation |
| 35 | Comedy |
| 80 | Crime |
| 99 | Documentary |
| 18 | Drama |
| 27 | Horror |
| 10749 | Romance |
| 878 | Science Fiction |
| 53 | Thriller |
| 37 | Western |

---

## How it works

```
You → Claude → MCP tool call → TMDB REST API → data back to Claude → answer
```

The server translates Claude's tool calls into TMDB API requests,
cleans up the response (removing noise), and hands the data back to Claude.