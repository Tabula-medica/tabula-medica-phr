# Resume all frozen Claude Code sessions as titled tabs in one Windows Terminal window.
# Each tab runs `claude --resume <id>` in C:\Users\Aggarwal.
# Generated 2026-07-01.

$dir = 'C:\Users\Aggarwal'

# session-id  =>  tab title
$sessions = @(
    @{ id = '131f9169-d485-4a8a-b14a-d2b86175028c'; title = 'SAWD-Bank' }
    @{ id = '4f746615-6ace-41b7-bcf6-7f6ad9a5be22'; title = 'Tabula-Cognita' }
    @{ id = '97f86b5f-6753-4b26-93ba-f103947fd1d5'; title = 'Tabula-Attentiva' }
    @{ id = '03fefc69-3088-490d-b5e8-b1bbcd31f86f'; title = 'PHR-GCP' }
    @{ id = 'baa3368b-f979-4ee2-94ec-1a6a179af564'; title = 'Healonda-Radio' }
    @{ id = 'daa18315-a962-450d-865a-c93cb914fcab'; title = 'Health-Radio' }
    @{ id = '167bef02-f38f-4dfe-bd28-c6ff868876fb'; title = 'Repo-Work' }
    @{ id = 'e9d35469-de32-4012-a9d0-779112838305'; title = 'Resume-Last' }
    @{ id = '5dbf902b-fb1c-46e8-a1be-e2b09ca3176f'; title = 'Frozen-Meta' }
)

# Build the wt argument list: tabs separated by a literal ';' argument.
$wtArgs = @()
for ($i = 0; $i -lt $sessions.Count; $i++) {
    $s = $sessions[$i]
    if ($i -gt 0) { $wtArgs += ';' }
    $wtArgs += @(
        'new-tab', '-d', $dir, '--title', $s.title,
        'cmd', '/k', 'claude', '--resume', $s.id
    )
}

Write-Host "Opening $($sessions.Count) Claude Code sessions in Windows Terminal..." -ForegroundColor Cyan
& wt.exe @wtArgs
