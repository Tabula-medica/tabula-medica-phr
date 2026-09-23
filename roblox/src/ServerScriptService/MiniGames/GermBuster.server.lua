-- GermBuster.server.lua
-- Timed round: a set of "germ zone" parts light up around the clinic; the
-- player clears a zone by touching it (representing wiping it down / washing
-- hands after contact). Clearing every zone before the round timer runs out
-- awards the Germ Buster badge. Missing the timer just resets the round —
-- there's no penalty, so a kid can keep trying.
--
-- Scene requirements (build in Studio):
--   workspace.MiniGames.GermBuster.Zones.<any name> (BasePart, one per germ
--     spot — sink counters, door handles, toy bins, etc.) Tint/texture these
--     however fits the futuristic-clinic look; this script only reads
--     Touched events and toggles a "Cleared" BoolValue + transparency.
--   Zones should start with Transparency ~0.3 and a BoolValue child named
--   "Cleared" (defaults to false) so the script can reset them between
--   rounds without extra scene setup.

local Players = game:GetService("Players")
local ServerScriptService = game:GetService("ServerScriptService")
local MiniGameAPI = require(ServerScriptService.MiniGameAPI)

local GAME_ID = "germ-buster"
local BADGE_ID = "roblox-germ-buster"
local ROUND_SECONDS = 30
local CLEARED_TRANSPARENCY = 0.85
local UNCLEARED_TRANSPARENCY = 0.3

local root = workspace:FindFirstChild("MiniGames") and workspace.MiniGames:FindFirstChild("GermBuster")
local zonesFolder = root and root:FindFirstChild("Zones")

if not zonesFolder then
	warn("[GermBuster] Zones folder not found under workspace.MiniGames.GermBuster — build the scene before testing.")
	return
end

local zones = zonesFolder:GetChildren()
if #zones == 0 then
	warn("[GermBuster] Zones folder is empty — add at least one germ-zone part.")
	return
end

local function getPlayerFromPart(part: BasePart): Player?
	local character = part.Parent
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	if not humanoid then
		return nil
	end
	return Players:GetPlayerFromCharacter(character)
end

local function setCleared(zone: BasePart, cleared: boolean)
	local flag = zone:FindFirstChild("Cleared")
	if flag and flag:IsA("BoolValue") then
		flag.Value = cleared
	end
	zone.Transparency = cleared and CLEARED_TRANSPARENCY or UNCLEARED_TRANSPARENCY
end

local function allCleared(): boolean
	for _, zone in ipairs(zones) do
		local flag = zone:FindFirstChild("Cleared")
		if not (flag and flag:IsA("BoolValue") and flag.Value) then
			return false
		end
	end
	return true
end

-- One round is shared per player; connections are scoped to that round so a
-- touch after the round ends (or by a different player) doesn't count.
local function runRound(player: Player)
	for _, zone in ipairs(zones) do
		setCleared(zone, false)
	end

	local connections = {}
	local finished = false

	local function cleanup()
		for _, conn in ipairs(connections) do
			conn:Disconnect()
		end
	end

	for _, zone in ipairs(zones) do
		table.insert(
			connections,
			zone.Touched:Connect(function(hit)
				if finished then
					return
				end
				local touchingPlayer = getPlayerFromPart(hit)
				if touchingPlayer ~= player then
					return
				end
				setCleared(zone, true)
				if allCleared() then
					finished = true
					cleanup()
					MiniGameAPI.Complete(player, BADGE_ID, GAME_ID, "engagement")
				end
			end)
		)
	end

	task.delay(ROUND_SECONDS, function()
		if not finished then
			finished = true
			cleanup()
		end
	end)
end

-- One germ-zone Model in the workspace acts as the round trigger: touching
-- it starts a fresh round for that player (cooldown prevents instant restarts).
local starter = root:FindFirstChild("StartPrompt")
local cooldown = {}

if starter and starter:IsA("BasePart") then
	starter.Touched:Connect(function(hit)
		local player = getPlayerFromPart(hit)
		if not player or cooldown[player.UserId] then
			return
		end
		cooldown[player.UserId] = true
		runRound(player)
		task.delay(ROUND_SECONDS + 2, function()
			cooldown[player.UserId] = nil
		end)
	end)
else
	warn("[GermBuster] No StartPrompt part found under workspace.MiniGames.GermBuster — rounds must be triggered manually or add a start part.")
end

Players.PlayerRemoving:Connect(function(player)
	cooldown[player.UserId] = nil
end)
