-- RemoteEvents.lua (ModuleScript)
-- Client<->server channels for World Clinic: Campus Life. This is a
-- separate Roblox place from the kids' World Clinic, so it keeps its own
-- copy of this module rather than sharing one across places.

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

-- Server -> Client: a badge was confirmed by Tabula Medica, show a toast.
RemoteEvents.RewardEarned = getOrCreateEvent("RewardEarned")

-- Server -> Client: the Campus Life scorecard changed (stars, per-measure
-- tallies, Nova's coaching tip).
RemoteEvents.CampusScorecardUpdated = getOrCreateEvent("CampusScorecardUpdated")

-- Client -> Server (invoke): submit the family/self link code typed in the UI.
-- Returns: { ok: boolean, message: string }
RemoteEvents.SubmitLinkCode = getOrCreateFunction("SubmitLinkCode")

return RemoteEvents
