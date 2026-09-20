-- RemoteEvents.lua (ModuleScript)
-- Central place for every client<->server communication channel used by
-- Tabula Medica Kids, so mini-games and UI never create ad-hoc remotes.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local RemoteEvents = {}

local function getOrCreateEvent(name)
	local existing = ReplicatedStorage:FindFirstChild(name)
	if existing then
		return existing
	end
	local event = Instance.new("RemoteEvent")
	event.Name = name
	event.Parent = ReplicatedStorage
	return event
end

local function getOrCreateFunction(name)
	local existing = ReplicatedStorage:FindFirstChild(name)
	if existing then
		return existing
	end
	local fn = Instance.new("RemoteFunction")
	fn.Name = name
	fn.Parent = ReplicatedStorage
	return fn
end

-- Client -> Server: a mini-game finished and should be synced as a badge.
-- Reserved for future client-only UI mini-games; server-authoritative games
-- (see ServerScriptService/MiniGames/) call MiniGameAPI.Complete directly.
-- Args: (badgeId: string, gameId: string, pointCategory: string?)
RemoteEvents.MiniGameCompleted = getOrCreateEvent("MiniGameCompleted")

-- Client -> Server: one attempt at matching a fictional bottle to a
-- fictional chart in the Medication Match mini-game. Validated server-side.
-- Args: (bottleId: string, chartId: string)
RemoteEvents.MedicationMatchAttempt = getOrCreateEvent("MedicationMatchAttempt")

-- Server -> Client: a reward was confirmed by Tabula Medica, show a toast.
-- Args: { badge = {...}, points = number }
RemoteEvents.RewardEarned = getOrCreateEvent("RewardEarned")

-- Client -> Server (invoke): submit the family's link code typed in the UI.
-- Returns: { ok: boolean, message: string }
RemoteEvents.SubmitLinkCode = getOrCreateFunction("SubmitLinkCode")

return RemoteEvents
