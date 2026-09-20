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
