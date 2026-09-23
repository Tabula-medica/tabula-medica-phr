-- MedicationMatch.server.lua
-- Server-authoritative "match the pretend bottle to the pretend chart"
-- mini-game. Every label here is FICTIONAL ("Bottle A" / "Chart 3") — this
-- teaches the general idea of double-checking before giving medicine, not
-- any real drug or dosage. The client only sends an attempted pairing; the
-- server holds the answer key and decides whether it was correct, so a
-- modified client can't award itself badges.
--
-- Scene requirements (build in Studio): a ScreenGui with draggable "bottle"
-- buttons and drop targets for "charts" (out of scope for this code
-- starter — build with Studio's UI tools) that fire
-- ReplicatedStorage.RemoteEvents.MedicationMatchAttempt:FireServer(bottleId,
-- chartId) on each drop, using the bottle/chart ids in ANSWER_KEY below.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerScriptService = game:GetService("ServerScriptService")

local RemoteEvents = require(ReplicatedStorage.RemoteEvents)
local MiniGameAPI = require(ServerScriptService.MiniGameAPI)
local PlayerDataStore = require(ServerScriptService.PlayerDataStore)

local GAME_ID = "medication-match"
local BRONZE_BADGE_ID = "roblox-med-match-bronze"
local GOLD_BADGE_ID = "roblox-med-match-gold"
local BRONZE_THRESHOLD = 10
local GOLD_THRESHOLD = 50
local AUTOSAVE_EVERY = 5 -- persist every N correct matches, not every single one

-- Fictional bottle -> chart answer key. Swap or expand freely; nothing here
-- is real medical content.
local ANSWER_KEY = {
	["bottle-a"] = "chart-3",
	["bottle-b"] = "chart-1",
	["bottle-c"] = "chart-2",
	["bottle-d"] = "chart-4",
}

-- playerId -> lifetime correct match count, mirrored to a DataStore so a
-- player who's at, say, 37/50 doesn't lose that progress if this Roblox
-- server instance restarts before they hit Gold. Badges/points themselves
-- are already durable on the Tabula Medica backend regardless of this.
local correctMatches = {}

local function loadPlayer(player: Player)
	correctMatches[player.UserId] = PlayerDataStore.Get(player.UserId, 0)
end

local function savePlayer(player: Player)
	local total = correctMatches[player.UserId]
	if total ~= nil then
		PlayerDataStore.Set(player.UserId, total)
	end
end

for _, player in ipairs(Players:GetPlayers()) do
	loadPlayer(player)
end
Players.PlayerAdded:Connect(loadPlayer)

RemoteEvents.MedicationMatchAttempt.OnServerEvent:Connect(function(player: Player, bottleId: string, chartId: string)
	if typeof(bottleId) ~= "string" or typeof(chartId) ~= "string" then
		return
	end

	if ANSWER_KEY[bottleId] ~= chartId then
		return
	end

	correctMatches[player.UserId] = (correctMatches[player.UserId] or 0) + 1
	local total = correctMatches[player.UserId]

	if total == BRONZE_THRESHOLD then
		MiniGameAPI.Complete(player, BRONZE_BADGE_ID, GAME_ID, "engagement")
		savePlayer(player)
	elseif total == GOLD_THRESHOLD then
		MiniGameAPI.Complete(player, GOLD_BADGE_ID, GAME_ID, "health_improvement")
		savePlayer(player)
	elseif total % AUTOSAVE_EVERY == 0 then
		savePlayer(player)
	end
end)

Players.PlayerRemoving:Connect(function(player)
	savePlayer(player)
	correctMatches[player.UserId] = nil
end)

game:BindToClose(function()
	for _, player in ipairs(Players:GetPlayers()) do
		savePlayer(player)
	end
end)
