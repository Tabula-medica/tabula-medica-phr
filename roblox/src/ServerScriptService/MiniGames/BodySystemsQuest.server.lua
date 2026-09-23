-- BodySystemsQuest.server.lua
-- Scene requirements (build in Studio):
--   workspace.MiniGames.BodySystemsQuest.Stations.Heart      (BasePart)
--   workspace.MiniGames.BodySystemsQuest.Stations.Lungs      (BasePart)
--   workspace.MiniGames.BodySystemsQuest.Stations.Digestive  (BasePart)
-- Each station is a glowing checkpoint the player walks into; a matching
-- BillboardGui/floating text can show a kid-friendly fact when touched.
-- Visiting all three awards the Body Systems Explorer badge.

local ServerScriptService = game:GetService("ServerScriptService")
local MiniGameAPI = require(ServerScriptService.MiniGameAPI)

local GAME_ID = "body-systems-quest"
local BADGE_ID = "roblox-body-explorer"
local REQUIRED_STATIONS = { "Heart", "Lungs", "Digestive" }

local root = workspace:FindFirstChild("MiniGames") and workspace.MiniGames:FindFirstChild("BodySystemsQuest")
local stations = root and root:FindFirstChild("Stations")

if not stations then
	warn("[BodySystemsQuest] Stations folder not found under workspace.MiniGames.BodySystemsQuest — build the scene before testing.")
	return
end

-- playerId -> { [stationName] = true }
local visited = {}

local function getPlayerFromPart(part: BasePart): Player?
	local character = part.Parent
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	if not humanoid then
		return nil
	end
	return game.Players:GetPlayerFromCharacter(character)
end

local function hasVisitedAll(playerId: number): boolean
	local record = visited[playerId]
	if not record then
		return false
	end
	for _, station in ipairs(REQUIRED_STATIONS) do
		if not record[station] then
			return false
		end
	end
	return true
end

for _, stationName in ipairs(REQUIRED_STATIONS) do
	local station = stations:FindFirstChild(stationName)
	if station then
		station.Touched:Connect(function(hit)
			local player = getPlayerFromPart(hit)
			if not player then
				return
			end

			visited[player.UserId] = visited[player.UserId] or {}
			if visited[player.UserId][stationName] then
				return
			end
			visited[player.UserId][stationName] = true

			if hasVisitedAll(player.UserId) then
				MiniGameAPI.Complete(player, BADGE_ID, GAME_ID, "engagement")
			end
		end)
	else
		warn(("[BodySystemsQuest] Missing station part: %s"):format(stationName))
	end
end

game.Players.PlayerRemoving:Connect(function(player)
	visited[player.UserId] = nil
end)
