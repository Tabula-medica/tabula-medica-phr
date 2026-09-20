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

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerScriptService = game:GetService("ServerScriptService")

local RemoteEvents = require(ReplicatedStorage.RemoteEvents)
local MiniGameAPI = require(ServerScriptService.MiniGameAPI)

local GAME_ID = "medication-match"
local BRONZE_BADGE_ID = "roblox-med-match-bronze"
local GOLD_BADGE_ID = "roblox-med-match-gold"
local BRONZE_THRESHOLD = 10
local GOLD_THRESHOLD = 50

-- Fictional bottle -> chart answer key. Swap or expand freely; nothing here
-- is real medical content.
local ANSWER_KEY = {
	["bottle-a"] = "chart-3",
	["bottle-b"] = "chart-1",
	["bottle-c"] = "chart-2",
	["bottle-d"] = "chart-4",
}

-- playerId -> lifetime correct match count for this server instance.
-- A production build would persist this in a DataStore keyed by UserId so
-- progress survives across sessions/servers.
local correctMatches = {}

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
	elseif total == GOLD_THRESHOLD then
		MiniGameAPI.Complete(player, GOLD_BADGE_ID, GAME_ID, "health_improvement")
	end
end)

game.Players.PlayerRemoving:Connect(function(player)
	correctMatches[player.UserId] = nil
end)
