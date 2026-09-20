-- GameManager.server.lua
-- Boots the account-linking flow and relays mini-game completions to
-- Tabula Medica via BadgeSync. Individual mini-games only ever fire
-- RemoteEvents.MiniGameCompleted; they never call BadgeSync directly.

local Players = game:GetService("Players")
local ServerScriptService = game:GetService("ServerScriptService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local BadgeSync = require(ServerScriptService.BadgeSync)
local RemoteEvents = require(ReplicatedStorage.RemoteEvents)

-- Players who redeemed a link code this session, so we don't spam retries
-- for accounts that declined to link.
local linkedThisSession = {}

RemoteEvents.SubmitLinkCode.OnServerInvoke = function(player: Player, code: string)
	if typeof(code) ~= "string" or #code == 0 then
		return { ok = false, message = "Enter the code shown in your Tabula Medica app." }
	end

	local linked = BadgeSync.RedeemLinkCode(player, code:upper())
	if linked then
		linkedThisSession[player.UserId] = true
		return { ok = true, message = "Linked! Badges you earn here will show up in the Tabula Medica app." }
	end

	return { ok = false, message = "That code is invalid or expired. Get a fresh one from the app and try again." }
end

RemoteEvents.MiniGameCompleted.OnServerEvent:Connect(function(player: Player, badgeId: string, gameId: string, pointCategory: string?)
	if typeof(badgeId) ~= "string" or typeof(gameId) ~= "string" then
		return
	end

	local result = BadgeSync.AwardBadge(player, badgeId, gameId, pointCategory)
	if result and result.awarded then
		RemoteEvents.RewardEarned:FireClient(player, {
			badge = result.badge,
			points = result.points,
		})
	elseif result == nil then
		-- Network/link failure: don't lose the moment, just log it. The
		-- mini-game already gave the player their in-experience reward.
		warn(("[GameManager] Could not sync badge '%s' for %s"):format(badgeId, player.Name))
	end
end)

Players.PlayerAdded:Connect(function(player: Player)
	print(("[GameManager] %s joined World Clinic"):format(player.Name))
end)

Players.PlayerRemoving:Connect(function(player: Player)
	linkedThisSession[player.UserId] = nil
end)
