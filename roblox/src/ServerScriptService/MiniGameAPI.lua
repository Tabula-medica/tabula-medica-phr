-- MiniGameAPI.lua (ModuleScript)
-- Helper for mini-games whose win condition is already observed on the
-- server (a ProximityPrompt, a server-side Touched event, an NPC dialogue
-- tree) so they can report completion directly without round-tripping
-- through a RemoteEvent they'd have to fire from a client they don't have.
--
-- Mini-games whose win condition only exists in client-side UI (e.g. a
-- drag-and-drop puzzle rendered in a ScreenGui) should instead fire
-- ReplicatedStorage.RemoteEvents.MiniGameCompleted from a LocalScript;
-- GameManager.server.lua receives that and syncs the same way.

local ServerScriptService = game:GetService("ServerScriptService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local BadgeSync = require(ServerScriptService.BadgeSync)
local RemoteEvents = require(ReplicatedStorage.RemoteEvents)

local MiniGameAPI = {}

function MiniGameAPI.Complete(player: Player, badgeId: string, gameId: string, pointCategory: string?)
	local result = BadgeSync.AwardBadge(player, badgeId, gameId, pointCategory)
	if result and result.awarded then
		RemoteEvents.RewardEarned:FireClient(player, {
			badge = result.badge,
			points = result.points,
		})
	end
	return result
end

return MiniGameAPI
