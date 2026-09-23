-- GameManager.server.lua
-- Boots the account-linking flow for Campus Life. Uses the same
-- /api/roblox/link/* endpoints as the kids' World Clinic — a linked Roblox
-- account can play either experience.

local Players = game:GetService("Players")
local ServerScriptService = game:GetService("ServerScriptService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local BadgeSync = require(ServerScriptService.BadgeSync)
local RemoteEvents = require(ReplicatedStorage.RemoteEvents)

RemoteEvents.SubmitLinkCode.OnServerInvoke = function(player: Player, code: string)
	if typeof(code) ~= "string" or #code == 0 then
		return { ok = false, message = "Enter the code shown in your Tabula Medica app." }
	end

	local linked = BadgeSync.RedeemLinkCode(player, code:upper())
	if linked then
		return { ok = true, message = "Linked! Progress here syncs to your Tabula Medica account." }
	end

	return { ok = false, message = "That code is invalid or expired. Get a fresh one from the app and try again." }
end

Players.PlayerAdded:Connect(function(player: Player)
	print(("[GameManager] %s joined Campus Life"):format(player.Name))
end)
