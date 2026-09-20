-- ClientUI.client.lua
-- Minimal starter UI: a "Link Family Account" panel and a toast for reward
-- notifications. Replace with real UI/UX art direction before shipping —
-- this exists to prove the client<->server wiring, not as final art.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local RemoteEvents = require(ReplicatedStorage:WaitForChild("RemoteEvents"))

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

-- Link panel ------------------------------------------------------------

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "TabulaMedicaLinkUI"
screenGui.ResetOnSpawn = false
screenGui.Parent = playerGui

local frame = Instance.new("Frame")
frame.Name = "LinkPanel"
frame.Size = UDim2.new(0, 320, 0, 150)
frame.Position = UDim2.new(0, 20, 1, -170)
frame.BackgroundColor3 = Color3.fromRGB(28, 32, 41)
frame.BackgroundTransparency = 0.1
frame.Parent = screenGui

local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(0, 12)
corner.Parent = frame

local title = Instance.new("TextLabel")
title.Size = UDim2.new(1, -20, 0, 24)
title.Position = UDim2.new(0, 10, 0, 8)
title.BackgroundTransparency = 1
title.Text = "Link your Tabula Medica family account"
title.TextColor3 = Color3.fromRGB(240, 240, 240)
title.Font = Enum.Font.GothamBold
title.TextSize = 14
title.TextXAlignment = Enum.TextXAlignment.Left
title.Parent = frame

local codeBox = Instance.new("TextBox")
codeBox.Size = UDim2.new(1, -20, 0, 32)
codeBox.Position = UDim2.new(0, 10, 0, 40)
codeBox.PlaceholderText = "Enter the 8-character code from the app"
codeBox.Text = ""
codeBox.ClearTextOnFocus = false
codeBox.Font = Enum.Font.Gotham
codeBox.TextSize = 14
codeBox.Parent = frame

local linkButton = Instance.new("TextButton")
linkButton.Size = UDim2.new(1, -20, 0, 32)
linkButton.Position = UDim2.new(0, 10, 0, 78)
linkButton.Text = "Link account"
linkButton.Font = Enum.Font.GothamBold
linkButton.TextSize = 14
linkButton.Parent = frame

local statusLabel = Instance.new("TextLabel")
statusLabel.Size = UDim2.new(1, -20, 0, 32)
statusLabel.Position = UDim2.new(0, 10, 0, 114)
statusLabel.BackgroundTransparency = 1
statusLabel.TextWrapped = true
statusLabel.Text = ""
statusLabel.TextColor3 = Color3.fromRGB(200, 200, 200)
statusLabel.Font = Enum.Font.Gotham
statusLabel.TextSize = 12
statusLabel.Parent = frame

linkButton.Activated:Connect(function()
	local code = codeBox.Text
	statusLabel.Text = "Linking..."
	local response = RemoteEvents.SubmitLinkCode:InvokeServer(code)
	if response and response.ok then
		statusLabel.TextColor3 = Color3.fromRGB(120, 220, 150)
	else
		statusLabel.TextColor3 = Color3.fromRGB(230, 120, 120)
	end
	statusLabel.Text = response and response.message or "Something went wrong. Try again."
end)

-- Dr. Nova panel (Future Health scorecard) -------------------------

local novaFrame = Instance.new("Frame")
novaFrame.Name = "NovaPanel"
novaFrame.Size = UDim2.new(0, 320, 0, 120)
novaFrame.Position = UDim2.new(1, -340, 1, -140)
novaFrame.BackgroundColor3 = Color3.fromRGB(20, 40, 60)
novaFrame.BackgroundTransparency = 0.1
novaFrame.Visible = false
novaFrame.Parent = screenGui

local novaCorner = Instance.new("UICorner")
novaCorner.CornerRadius = UDim.new(0, 12)
novaCorner.Parent = novaFrame

local novaTitle = Instance.new("TextLabel")
novaTitle.Size = UDim2.new(1, -20, 0, 22)
novaTitle.Position = UDim2.new(0, 10, 0, 8)
novaTitle.BackgroundTransparency = 1
novaTitle.Text = "Dr. Nova — Future Health"
novaTitle.TextColor3 = Color3.fromRGB(150, 220, 255)
novaTitle.Font = Enum.Font.GothamBold
novaTitle.TextSize = 14
novaTitle.TextXAlignment = Enum.TextXAlignment.Left
novaTitle.Parent = novaFrame

local starsLabel = Instance.new("TextLabel")
starsLabel.Size = UDim2.new(1, -20, 0, 22)
starsLabel.Position = UDim2.new(0, 10, 0, 32)
starsLabel.BackgroundTransparency = 1
starsLabel.Text = ""
starsLabel.TextColor3 = Color3.fromRGB(255, 215, 120)
starsLabel.Font = Enum.Font.GothamBold
starsLabel.TextSize = 18
starsLabel.TextXAlignment = Enum.TextXAlignment.Left
starsLabel.Parent = novaFrame

local tipLabel = Instance.new("TextLabel")
tipLabel.Size = UDim2.new(1, -20, 0, 56)
tipLabel.Position = UDim2.new(0, 10, 0, 58)
tipLabel.BackgroundTransparency = 1
tipLabel.TextWrapped = true
tipLabel.Text = ""
tipLabel.TextColor3 = Color3.fromRGB(230, 230, 230)
tipLabel.Font = Enum.Font.Gotham
tipLabel.TextSize = 12
tipLabel.TextXAlignment = Enum.TextXAlignment.Left
tipLabel.TextYAlignment = Enum.TextYAlignment.Top
tipLabel.Parent = novaFrame

RemoteEvents.ClinicScorecardUpdated.OnClientEvent:Connect(function(scorecard)
	if not scorecard then
		return
	end
	local stars = scorecard.stars or 0
	starsLabel.Text = string.rep("★", stars) .. string.rep("☆", 5 - stars)
		.. ("   %d visits"):format(scorecard.totalEvents or 0)
	tipLabel.Text = scorecard.coachingTip or ""
	novaFrame.Visible = true
end)

-- Reward toast ------------------------------------------------------------

RemoteEvents.RewardEarned.OnClientEvent:Connect(function(payload)
	local badge = payload and payload.badge
	if not badge then
		return
	end

	local toast = Instance.new("Frame")
	toast.Size = UDim2.new(0, 280, 0, 64)
	toast.Position = UDim2.new(1, -300, 0, 20)
	toast.BackgroundColor3 = Color3.fromRGB(28, 32, 41)
	toast.BackgroundTransparency = 0.1
	toast.Parent = screenGui

	local toastCorner = Instance.new("UICorner")
	toastCorner.CornerRadius = UDim.new(0, 10)
	toastCorner.Parent = toast

	local nameLabel = Instance.new("TextLabel")
	nameLabel.Size = UDim2.new(1, -16, 0, 22)
	nameLabel.Position = UDim2.new(0, 8, 0, 6)
	nameLabel.BackgroundTransparency = 1
	nameLabel.Text = ("Badge earned: %s"):format(badge.name or "Unknown badge")
	nameLabel.TextColor3 = Color3.fromRGB(255, 215, 120)
	nameLabel.Font = Enum.Font.GothamBold
	nameLabel.TextSize = 14
	nameLabel.TextXAlignment = Enum.TextXAlignment.Left
	nameLabel.Parent = toast

	local pointsLabel = Instance.new("TextLabel")
	pointsLabel.Size = UDim2.new(1, -16, 0, 18)
	pointsLabel.Position = UDim2.new(0, 8, 0, 30)
	pointsLabel.BackgroundTransparency = 1
	pointsLabel.Text = ("+%d points synced to Tabula Medica"):format(payload.points or 0)
	pointsLabel.TextColor3 = Color3.fromRGB(210, 210, 210)
	pointsLabel.Font = Enum.Font.Gotham
	pointsLabel.TextSize = 12
	pointsLabel.TextXAlignment = Enum.TextXAlignment.Left
	pointsLabel.Parent = toast

	local tween = TweenService:Create(toast, TweenInfo.new(0.5, Enum.EasingStyle.Quad), {
		Position = UDim2.new(1, -300, 0, 20),
	})
	toast.Position = UDim2.new(1, 20, 0, 20)
	tween:Play()

	task.delay(4, function()
		local fadeOut = TweenService:Create(toast, TweenInfo.new(0.4), { Position = UDim2.new(1, 20, 0, 20) })
		fadeOut:Play()
		fadeOut.Completed:Wait()
		toast:Destroy()
	end)
end)
