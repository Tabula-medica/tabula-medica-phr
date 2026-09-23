-- BadgeSync.lua (ModuleScript)
-- The ONLY script that talks to the Tabula Medica backend. Every call here
-- is PHI-free by construction: it only ever sends a Roblox UserId, a family
-- link code, and a catalog badge id. It never sends or receives a name,
-- diagnosis, medication, date of birth, or any other health information.

local HttpService = game:GetService("HttpService")

local BadgeSync = {}

-- Configuration -------------------------------------------------------------
-- Set these via Roblox Studio's "Game Settings > Security" HttpService
-- allowlist plus a private config (e.g. Team Create-shared Secrets, or an
-- out-of-source ServerStorage ModuleScript injected at publish time).
-- NEVER hardcode the real API key in a script that ships in a public place
-- file or gets committed to a public repo.
local API_BASE_URL = "https://YOUR-TABULA-MEDICA-DOMAIN.example.com/api/roblox"
local API_KEY = "" -- injected at publish time; see roblox/README.md

local function request(method: string, path: string, body: { [string]: any }?)
	local ok, result = pcall(function()
		return HttpService:RequestAsync({
			Url = API_BASE_URL .. path,
			Method = method,
			Headers = {
				["Content-Type"] = "application/json",
				["X-Roblox-Api-Key"] = API_KEY,
			},
			Body = body ~= nil and HttpService:JSONEncode(body) or nil,
		})
	end)

	if not ok then
		warn(("[BadgeSync] request errored: %s"):format(tostring(result)))
		return nil
	end

	if not result.Success then
		warn(("[BadgeSync] %s %s -> %d %s"):format(method, path, result.StatusCode, result.StatusMessage))
		return nil
	end

	local decodeOk, decoded = pcall(function()
		return HttpService:JSONDecode(result.Body)
	end)

	if not decodeOk then
		warn("[BadgeSync] failed to decode response body")
		return nil
	end

	return decoded
end

-- Redeems a link code the family generated inside the Tabula Medica app.
-- Links this Roblox account to their (server-side only) patient profile.
function BadgeSync.RedeemLinkCode(player: Player, code: string): boolean
	local response = request("POST", "/link/redeem", {
		code = code,
		robloxUserId = tostring(player.UserId),
	})
	return response ~= nil and response.linked == true
end

-- Reports a completed mini-game. The server decides points/duplicate
-- suppression; this call is safe to make more than once per badge.
function BadgeSync.AwardBadge(player: Player, badgeId: string, gameId: string, pointCategory: string?)
	return request("POST", "/rewards/sync", {
		robloxUserId = tostring(player.UserId),
		badgeId = badgeId,
		gameId = gameId,
		pointCategory = pointCategory,
	})
end

-- Fetches the current kid-safe badge catalog (names/descriptions/icons only).
function BadgeSync.FetchCatalog()
	return request("GET", "/catalog", nil)
end

-- Future Health ------------------------------------------------------

-- Kid-safe measure catalog (id, kidName, npcPrompt, whatItTeaches).
function BadgeSync.FetchClinicMeasures()
	return request("GET", "/clinic/measures", nil)
end

-- Records one fictional-patient care-gap outcome ("closed" | "missed") and
-- returns the updated scorecard (stars, per-measure tallies, coaching tip).
function BadgeSync.RecordClinicEvent(player: Player, measureId: string, outcome: string)
	return request("POST", "/clinic/event", {
		robloxUserId = tostring(player.UserId),
		measureId = measureId,
		outcome = outcome,
	})
end

function BadgeSync.FetchClinicScorecard(player: Player)
	return request("GET", "/clinic/scorecard?robloxUserId=" .. tostring(player.UserId), nil)
end

return BadgeSync
