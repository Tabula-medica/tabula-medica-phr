-- ClinicOfTheFuture.server.lua
-- The player runs a pretend clinic. Fictional NPC patients arrive with a
-- "care gap" modeled on a HEDIS measure concept (yearly checkup due, shots
-- due, pressure check...). The player has VISIT_WINDOW seconds to walk up
-- and complete the visit via a ProximityPrompt; otherwise the gap is
-- "missed". The Tabula Medica backend keeps the scorecard, rates the clinic
-- (1-5 stars, rules-based) and returns Dr. Nova's coaching tip, which the
-- client shows in the Nova panel.
--
-- Nothing here rates a real doctor or hospital, and no player health data is
-- involved: every patient is an NPC and every score is the player's own
-- in-game choices. HEDIS(R) is a registered trademark of NCQA; the measures
-- are simplified educational approximations.
--
-- Scene requirements (build in Studio):
--   workspace.MiniGames.ClinicOfTheFuture.Patients.<any name> (Model, one per
--     NPC bed/chair) each containing:
--       - a BasePart named "Anchor" (where the prompt + speech bubble attach)
--       - a ProximityPrompt named "VisitPrompt" (ObjectText/ActionText are set
--         by this script)
--       - a BillboardGui named "Bubble" with a TextLabel named "Text"

local Players = game:GetService("Players")
local ServerScriptService = game:GetService("ServerScriptService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local BadgeSync = require(ServerScriptService.BadgeSync)
local RemoteEvents = require(ReplicatedStorage.RemoteEvents)

local VISIT_WINDOW = 45 -- seconds the player has before an NPC's gap is "missed"
local PAUSE_BETWEEN_PATIENTS = 6
local ROUND_PATIENTS = 6 -- 6 NPC visits per round, then a short breather

local root = workspace:FindFirstChild("MiniGames") and workspace.MiniGames:FindFirstChild("ClinicOfTheFuture")
local patientsFolder = root and root:FindFirstChild("Patients")

if not patientsFolder then
	warn("[ClinicOfTheFuture] Patients folder not found under workspace.MiniGames.ClinicOfTheFuture — build the scene before testing.")
	return
end

local measures = nil

local function loadMeasures()
	local response = BadgeSync.FetchClinicMeasures()
	if response and response.measures and #response.measures > 0 then
		measures = response.measures
	else
		warn("[ClinicOfTheFuture] Could not load measures from backend; check BadgeSync config.")
	end
end

local function pushScorecard(player: Player, scorecard)
	if scorecard then
		RemoteEvents.ClinicScorecardUpdated:FireClient(player, scorecard)
	end
end

local function setBubble(patient: Model, text: string)
	local bubble = patient:FindFirstChild("Bubble", true)
	local label = bubble and bubble:FindFirstChild("Text")
	if label then
		label.Text = text
	end
end

-- Runs one NPC visit for one player. Returns after the gap is closed or missed.
local function runVisit(player: Player, patient: Model, measure)
	local prompt = patient:FindFirstChild("VisitPrompt", true)
	if not prompt then
		warn(("[ClinicOfTheFuture] %s has no VisitPrompt"):format(patient.Name))
		return
	end

	prompt.ObjectText = measure.kidName
	prompt.ActionText = "Do the visit"
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

	setBubble(patient, outcome == "closed" and ("Thanks! " .. measure.whatItTeaches) or "Oops — I had to leave. Maybe next time!")

	local scorecard = BadgeSync.RecordClinicEvent(player, measure.id, outcome)
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
	-- Show whatever scorecard already exists (e.g. from a previous session).
	task.defer(function()
		pushScorecard(player, BadgeSync.FetchClinicScorecard(player))
	end)

	-- Each player gets their own rolling rounds. A single-player scene is the
	-- expected build; for multiplayer, give each player their own Patients
	-- sub-folder and route it here instead of sharing patientsFolder.
	task.spawn(function()
		while player.Parent do
			runRoundFor(player)
			task.wait(15)
		end
	end)
end)
