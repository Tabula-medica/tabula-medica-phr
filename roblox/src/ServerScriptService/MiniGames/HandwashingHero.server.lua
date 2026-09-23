-- HandwashingHero.server.lua
-- Scene requirements (build in Studio):
--   workspace.MiniGames.HandwashingHero.SinkPrompt  (a ProximityPrompt on the sink)
-- Holding the prompt for the full WASH_DURATION seconds counts as a wash.
-- Reads real CDC guidance ("scrub for 20 seconds") without collecting any
-- player health data.

local ServerScriptService = game:GetService("ServerScriptService")
local MiniGameAPI = require(ServerScriptService.MiniGameAPI)

local WASH_DURATION = 20
local GAME_ID = "handwashing-hero"
local BADGE_ID = "roblox-handwash-hero"

local sink = workspace:FindFirstChild("MiniGames") and workspace.MiniGames:FindFirstChild("HandwashingHero")
local prompt = sink and sink:FindFirstChild("SinkPrompt")

if not prompt then
	warn("[HandwashingHero] SinkPrompt not found under workspace.MiniGames.HandwashingHero — build the scene before testing.")
	return
end

prompt.HoldDuration = WASH_DURATION

local completedThisSession = {}

prompt.Triggered:Connect(function(player: Player)
	if completedThisSession[player.UserId] then
		return
	end
	completedThisSession[player.UserId] = true

	MiniGameAPI.Complete(player, BADGE_ID, GAME_ID, "engagement")
end)

game.Players.PlayerRemoving:Connect(function(player)
	completedThisSession[player.UserId] = nil
end)
