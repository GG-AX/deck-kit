# Make short clips from still images with the Higgsfield CLI (costs credits - ask the user first).
# Every job id is written to <deck>\ai\higgsfield_jobs.json right after it is submitted, and a case that is
# already in that log is never submitted again (no double spending). Finished clips: <deck>\ai\motion\out\<case>.mp4
#
# Usage: powershell -File motion_run.ps1 -Plan plan.json [-Plan more.json] [-Deck <deck folder>] [-DryRun]
#   -DryRun  only lists what would be submitted and the credits written in the plan - nothing is sent
# plan.json (UTF-8), paths relative to the deck folder:
#   [ { "case": "M01", "image": "source/look1.png", "prompt": "...", "end_image": true,
#       "model": "seedance_2_0", "aspect_ratio": "3:4", "duration": 5, "resolution": "720p", "credits": 22.5 } ]
#   end_image: end on the start image (the clip loops back without a jump). Defaults: the values above.
param([string[]] $Plan, [string] $Deck = '.', [switch] $DryRun)
$ErrorActionPreference = 'Continue'   # 'Stop' would turn the CLI's progress output on stderr into errors (PowerShell 5.1)
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$root = (Resolve-Path -LiteralPath $Deck).Path
$log = Join-Path $root 'ai\higgsfield_jobs.json'
$outDir = Join-Path $root 'ai\motion\out'

function ReadLog {
    # PowerShell 5.1 returns a parsed JSON array as ONE object - assign first, then let it unroll
    if (-not (Test-Path -LiteralPath $log)) { return }
    $x = Get-Content -LiteralPath $log -Raw -Encoding UTF8 | ConvertFrom-Json
    $x
}
function WriteLog($items) {
    New-Item -ItemType Directory -Force (Split-Path $log) | Out-Null
    [IO.File]::WriteAllText($log, (ConvertTo-Json @($items) -Depth 5), (New-Object Text.UTF8Encoding $false))
}
function Opt($p, $name, $default) { if ($null -ne $p.$name -and "$($p.$name)" -ne '') { $p.$name } else { $default } }

$jobs = @(); $stop = $false; $total = 0
foreach ($planPath in $Plan) {
    if ($stop) { break }
    $items = Get-Content -LiteralPath $planPath -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($p in $items) {
        $old = @(ReadLog) | Where-Object { $_.case -eq $p.case } | Select-Object -First 1
        if ($old) { Write-Host "$($p.case) already submitted ($($old.job)) - skipped"; $jobs += [pscustomobject]@{ case = $p.case; job = $old.job }; continue }
        $img = Join-Path $root $p.image
        $model = Opt $p 'model' 'seedance_2_0'; $ar = Opt $p 'aspect_ratio' '3:4'; $dur = Opt $p 'duration' 5
        $res = Opt $p 'resolution' '720p'; $credits = Opt $p 'credits' $null
        if (-not (Test-Path -LiteralPath $img)) { Write-Host "$($p.case) image not found: $img - stopping"; $stop = $true; break }
        if ($DryRun) {
            Write-Host "$($p.case): $model $ar $($dur)s $res, image $($p.image), credits $(if ($credits) { $credits } else { '?' })"
            if ($credits) { $total += [double]$credits }
            continue
        }
        $extra = @(); if ($p.end_image) { $extra = @('--end-image', $img) }
        $raw = & higgsfield.cmd generate create $model --start-image $img @extra --prompt $p.prompt `
            --aspect_ratio $ar --duration $dur --resolution $res --generate_audio false --json | Out-String
        # without --wait the CLI prints just the new job id(s): ["<uuid>"]
        $m = [regex]::Match($raw, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
        if (-not $m.Success) { Write-Host "$($p.case) SUBMIT FAILED - stopping so nothing is charged twice:`n$raw"; $stop = $true; break }
        $entries = @(ReadLog) + [pscustomobject]@{ case = $p.case; job = $m.Value; model = $model; prompt = $p.prompt; credits = $credits
            end_image = [bool]$p.end_image; image = $p.image; out = "ai/motion/out/$($p.case).mp4"; date = (Get-Date -Format 'yyyy-MM-dd') }
        WriteLog $entries
        Write-Host "$($p.case) submitted $($m.Value)"
        $jobs += [pscustomobject]@{ case = $p.case; job = $m.Value }
    }
}
if ($DryRun) { Write-Host "dry run - nothing submitted. Credits written in the plan: $total"; exit }

# wait for all, download as they finish
New-Item -ItemType Directory -Force $outDir | Out-Null
$pending = @($jobs | Where-Object { -not (Test-Path -LiteralPath (Join-Path $outDir "$($_.case).mp4")) })
$deadline = (Get-Date).AddMinutes(60)
while ($pending.Count -gt 0 -and (Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 20
    foreach ($j in @($pending)) {
        try { $r = (& higgsfield.cmd generate get $j.job --json 2>$null | Out-String) | ConvertFrom-Json } catch { continue }
        if ($r.status -eq 'completed') {
            Invoke-WebRequest $r.result_url -OutFile (Join-Path $outDir "$($j.case).mp4") -UseBasicParsing
            Write-Host "$($j.case) done"
            $pending = @($pending | Where-Object { $_.case -ne $j.case })
        } elseif ($r.status -in 'failed', 'nsfw', 'canceled', 'cancelled') {
            Write-Host "$($j.case) $($r.status)"
            $pending = @($pending | Where-Object { $_.case -ne $j.case })
        }
    }
}
Write-Host "finished; still pending: $($pending.Count)"
