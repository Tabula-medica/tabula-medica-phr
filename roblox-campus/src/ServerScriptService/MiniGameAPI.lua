-- MiniGameAPI.lua (ModuleScript)
-- Same pattern as the kids' World Clinic: a helper for mini-games whose win
-- condition is already observed server-side to report a badge directly.

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
