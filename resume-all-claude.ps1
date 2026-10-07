# resume-all-claude.ps1 — regenerated 2026-10-07
# Opens all active Claude Code sessions in one named Windows Terminal window.
# Each tab is titled "Project - Purpose" and runs `claude --resume <id>`.
# Current session (Accountable.law - Audit) excluded to avoid duplicate.

$sessions = @(
    @{ id = "511deb73-116f-4688-b25a-408bb82d8808"; title = "WorldEHR - TCM Discharge" },
    @{ id = "4770a9d2-3224-40a2-bd37-32aca79a60dc"; title = "Sprinto - SOC2 HIPAA" },
    @{ id = "81e909bd-4734-4c67-a40b-839f2a9c2f7c"; title = "iOS - App Review Submit" },
    @{ id = "f6eaa261-f307-42cc-b4e7-5f1e5123981b"; title = "Underinsured - Code Review" },
    @{ id = "efe45b3c-cec3-4062-af7d-4a5f7e4e54ad"; title = "Parkinson - Project" },
    @{ id = "000a9114-8606-41df-827a-69a9815a7270"; title = "PHR - Revamp" },
    @{ id = "7a23926b-9805-40b6-ad56-d80b58c2bfee"; title = "PHR - Base44 Integration" },
    @{ id = "cdc4d69b-bae3-475f-879a-e85cdb9bd267"; title = "PHR - Audit" },
    @{ id = "febd7c2c-6f95-4260-8d5d-d61ec7568c05"; title = "PHR - Strix Safe" },
    @{ id = "919dcb06-81ed-4925-b2ac-48c4072e6154"; title = "Uninsurance - Twilio" },
    @{ id = "f42b20b9-4cc2-46ae-b145-92a126a5ab6e"; title = "Uninsurance - Code" },
    @{ id = "56539779-3e4a-476c-9664-c24ac4ad04e6"; title = "Uninsurance - App Review" },
    @{ id = "387c3ff7-0ec8-4aa2-8dc3-d4db09d71141"; title = "Play Store - Fleet" },
    @{ id = "c41cd6c7-4aa6-4152-804b-0133105cf571"; title = "Google Calendar - OAuth" },
    @{ id = "c1d4cb31-12d2-4059-80ef-d4aed201f2d5"; title = "WorldEHR - General" },
    @{ id = "ceb7da1a-76e5-4bc7-a079-11ff3da427c8"; title = "AI - App Assessment" }
)

$baseDir = "C:\Users\Aggarwal"

# Build the wt command: first tab, then subsequent tabs appended
$first = $sessions[0]
$wtArgs = "-w claude-resume new-tab --suppressApplicationTitle --title `"$($first.title)`" --startingDirectory `"$baseDir`" cmd /k `"claude --resume $($first.id)`""

for ($i = 1; $i -lt $sessions.Count; $i++) {
    $s = $sessions[$i]
    $wtArgs += " ; new-tab --suppressApplicationTitle --title `"$($s.title)`" --startingDirectory `"$baseDir`" cmd /k `"claude --resume $($s.id)`""
}

Start-Process wt -ArgumentList $wtArgs
