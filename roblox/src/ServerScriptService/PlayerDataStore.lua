-- PlayerDataStore.lua (ModuleScript)
-- Thin, safe wrapper around DataStoreService for per-player mini-game
-- progress (e.g. Medication Match's lifetime correct-match count). This is
-- NOT where badges/points live — those are the source of truth on the
-- Tabula Medica backend (server/roblox-clinic-routes.ts,
-- roblox-education-link-routes.ts) and already survive across Roblox
-- server restarts. This store only protects *in-progress* counters that
-- would otherwise reset if a Roblox server instance restarts mid-session.
--
-- Every value stored here is a plain number/table keyed by Roblox UserId —
-- no names, no health data, nothing that touches the PHI boundary described
-- in roblox/README.md.

local DataStoreService = game:GetService("DataStoreService")

local PlayerDataStore = {}

local store = DataStoreService:GetDataStore("WorldClinic_MiniGameProgress_v1")

local function keyFor(userId: number): string
	return "player_" .. tostring(userId)
end

-- Returns the stored value for this player, or `defaultValue` if there is
-- none yet or the read failed (DataStore outages should never block play).
function PlayerDataStore.Get(userId: number, defaultValue: any): any
	local ok, result = pcall(function()
		return store:GetAsync(keyFor(userId))
	end)
	if ok and result ~= nil then
		return result
	end
	if not ok then
		warn(("[PlayerDataStore] GetAsync failed for %d: %s"):format(userId, tostring(result)))
	end
	return defaultValue
end

-- Best-effort save; returns true on success. Callers should treat a false
-- return as "try again later," never as fatal — DataStore write limits and
-- transient outages are normal.
function PlayerDataStore.Set(userId: number, value: any): boolean
	local ok, err = pcall(function()
		store:SetAsync(keyFor(userId), value)
	end)
	if not ok then
		warn(("[PlayerDataStore] SetAsync failed for %d: %s"):format(userId, tostring(err)))
	end
	return ok
end

return PlayerDataStore
