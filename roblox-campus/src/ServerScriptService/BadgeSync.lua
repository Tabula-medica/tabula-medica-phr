-- BadgeSync.lua (ModuleScript)
-- The ONLY script that talks to the Tabula Medica backend from this place.
-- Account linking (/link/*) and the badge catalog (/catalog) are shared
-- across both World Clinic experiences; Campus Life's own content lives
-- under /api/roblox/campus/*. Every call here is PHI-free by construction —
-- see roblox-campus/README.md for the exact boundary.

local HttpService = game:GetService("HttpService")

local BadgeSync = {}

-- Configuration -------------------------------------------------------------
-- Same backend as the kids' World Clinic (they share the family-linking
-- system), just a different Roblox place. See roblox-campus/README.md.
local API_BASE_URL = "https://YOUR-TABULA-MEDICA-DOMAIN.example.com/api/roblox"
local API_KEY = "" -- injected at publish time; NEVER hardcode the real key here

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

function BadgeSync.RedeemLinkCode(player: Player, code: string): boolean
	local response = request("POST", "/link/redeem", {
		code = code,
		robloxUserId = tostring(player.UserId),
	})
	return response ~= nil and response.linked == true
end

-- Campus Life -----------------------------------------------------------

function BadgeSync.FetchCampusMeasures()
	return request("GET", "/campus/measures", nil)
end

function BadgeSync.RecordCampusEvent(player: Player, measureId: string, outcome: string)
	return request("POST", "/campus/event", {
		robloxUserId = tostring(player.UserId),
		measureId = measureId,
		outcome = outcome,
	})
end

function BadgeSync.FetchCampusScorecard(player: Player)
	return request("GET", "/campus/scorecard?robloxUserId=" .. tostring(player.UserId), nil)
end

-- Generic badge sync, for any future Campus Life mini-games that award a
-- badge directly rather than through the scorecard auto-award.
function BadgeSync.AwardBadge(player: Player, badgeId: string, gameId: string, pointCategory: string?)
	return request("POST", "/rewards/sync", {
		robloxUserId = tostring(player.UserId),
		badgeId = badgeId,
		gameId = gameId,
		pointCategory = pointCategory,
	})
end

return BadgeSync
