# resume-all-claude.ps1 — regenerated 2026-09-29
# Opens all active Claude Code sessions in one named Windows Terminal window.
# Each tab is titled "Project - Purpose" and runs `claude --resume <id>`.
# The current session (Desktop - PHR Stripe) is intentionally excluded so you
# don't get a duplicate of this window.

$sessions = @(
    @{ id = "511deb73-116f-4688-b25a-408bb82d8808"; title = "WorldEHR - TCM Discharge" },
    @{ id = "40f38a26-dc15-4e0c-8cf9-0f27f5f86888"; title = "Accountable.law - Site Deploy" },
    @{ id = "9a461b6b-7789-4e29-a2e2-ca6053a98974"; title = "NoorJyoti - Blank Site Fix" },
    @{ id = "81e909bd-4734-4c67-a40b-839f2a9c2f7c"; title = "iOS - App Review Submit" },
    @{ id = "4770a9d2-3224-40a2-bd37-32aca79a60dc"; title = "Sprinto - SOC2 HIPAA" },
    @{ id = "efe45b3c-cec3-4062-af7d-4a5f7e4e54ad"; title = "Parkinson - RPM Project" }
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
