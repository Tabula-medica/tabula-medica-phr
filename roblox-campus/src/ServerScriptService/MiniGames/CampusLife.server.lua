-- CampusLife.server.lua
-- The flagship mini-game for the teen/college/newlywed tier — same pattern
-- as the kids' Future Health: the player runs a clinic, fictional NPC
-- patients present a care-gap modeled on a preventive-care concept relevant
-- to this life stage, and Nova rates the run and coaches between visits.
--
-- Content note: every measure here is handled per roblox-campus/README.md's
-- content boundary — conceptual framing only, never a depiction of alcohol,
-- drug use, or explicit content. See CAMPUS_MEASURES in
-- server/roblox-campus-routes.ts for the exact copy.
--
-- Scene requirements (build in Studio):
--   workspace.MiniGames.CampusLife.Patients.<any name> (Model, one per NPC)
--     each containing:
--       - a BasePart named "Anchor"
--       - a ProximityPrompt named "VisitPrompt"
--       - a BillboardGui named "Bubble" with a TextLabel named "Text"

local Players = game:GetService("Players")
local ServerScriptService = game:GetService("ServerScriptService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local BadgeSync = require(ServerScriptService.BadgeSync)
local RemoteEvents = require(ReplicatedStorage.RemoteEvents)

local VISIT_WINDOW = 45
local PAUSE_BETWEEN_PATIENTS = 6
local ROUND_PATIENTS = 6

local root = workspace:FindFirstChild("MiniGames") and workspace.MiniGames:FindFirstChild("CampusLife")
local patientsFolder = root and root:FindFirstChild("Patients")

if not patientsFolder then
	warn("[CampusLife] Patients folder not found under workspace.MiniGames.CampusLife — build the scene before testing.")
	return
end

local measures = nil

local function loadMeasures()
	local response = BadgeSync.FetchCampusMeasures()
	if response and response.measures and #response.measures > 0 then
		measures = response.measures
	else
		warn("[CampusLife] Could not load measures from backend; check BadgeSync config.")
	end
end

local function pushScorecard(player: Player, scorecard)
	if scorecard then
		RemoteEvents.CampusScorecardUpdated:FireClient(player, scorecard)
	end
end

local function setBubble(patient: Model, text: string)
	local bubble = patient:FindFirstChild("Bubble", true)
	local label = bubble and bubble:FindFirstChild("Text")
	if label then
		label.Text = text
	end
end

local function runVisit(player: Player, patient: Model, measure)
	local prompt = patient:FindFirstChild("VisitPrompt", true)
	if not prompt then
		warn(("[CampusLife] %s has no VisitPrompt"):format(patient.Name))
		return
	end

	prompt.ObjectText = measure.kidName
	prompt.ActionText = "Talk it through"
	prompt.Enabled = true
	setBubble(patient, measure.npcPrompt)

	local outcome = "missed"
	local done = false

	local connection
	connection = prompt.Triggered:Connect(function(triggeringPlayer)
		if triggeringPlayer ~= player or done then
			return
		end
		done = true
		outcome = "closed"
	end)

	local deadline = os.clock() + VISIT_WINDOW
	while not done and os.clock() < deadline do
		task.wait(0.25)
	end
	done = true
	connection:Disconnect()
	prompt.Enabled = false

	setBubble(patient, outcome == "closed" and ("Good talk. " .. measure.whatItTeaches) or "Ran out of time — catch me next round.")

	local scorecard = BadgeSync.RecordCampusEvent(player, measure.id, outcome)
	pushScorecard(player, scorecard)

	task.wait(PAUSE_BETWEEN_PATIENTS)
	setBubble(patient, "")
end

local function runRoundFor(player: Player)
	if not measures then
		loadMeasures()
		if not measures then
			return
		end
	end

	local patients = patientsFolder:GetChildren()
	if #patients == 0 then
		return
	end

	for i = 1, ROUND_PATIENTS do
		if not player.Parent then
			return
		end
		local patient = patients[((i - 1) % #patients) + 1]
		local measure = measures[math.random(1, #measures)]
		runVisit(player, patient, measure)
	end
end

Players.PlayerAdded:Connect(function(player: Player)
	task.defer(function()
		pushScorecard(player, BadgeSync.FetchCampusScorecard(player))
	end)

	task.spawn(function()
		while player.Parent do
			runRoundFor(player)
			task.wait(15)
		end
	end)
end)
