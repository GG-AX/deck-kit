# Local helper so the presenter window can save notes straight into assets/notes.js (no file dialog).
# Started hidden by "Start Presentation.bat". Listens on 127.0.0.1 only (not reachable from other PCs).
# Accepts only note text: the request is parsed as data and notes.js is written by this script,
# so nothing sent to it can become code. Stops by itself 3 minutes after the deck is closed.
$ErrorActionPreference = 'Stop'
$port = 47615
$root = Split-Path -Parent $PSScriptRoot
$target = Join-Path $root 'assets\notes.js'
$prev = Join-Path $root 'assets\notes.prev.js'
Add-Type -AssemblyName System.Web.Extensions
$json = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$json.MaxJsonLength = 20MB

function SameDir($a, $b) { return ($a.TrimEnd('\') -replace '/', '\').ToLowerInvariant() -eq ($b.TrimEnd('\') -replace '/', '\').ToLowerInvariant() }

# Only one helper can run. If another copy of the presentation (other folder) still has one,
# ask it to quit so saves always go to the copy opened last.
$listener = $null
for ($i = 0; $i -lt 6 -and -not $listener; $i++) {
    try {
        $l = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $port)
        $l.Start()
        $listener = $l
    } catch {
        try {
            $other = (Invoke-WebRequest "http://127.0.0.1:$port/ping" -UseBasicParsing -TimeoutSec 2).Content
            if (SameDir $other $root) { exit }   # this copy is already served
            Invoke-WebRequest "http://127.0.0.1:$port/quit" -UseBasicParsing -TimeoutSec 2 | Out-Null
        } catch {}
        Start-Sleep -Milliseconds 700
    }
}
if (-not $listener) { exit }

function Send($stream, $status, $body) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    $head = "HTTP/1.1 $status`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($bytes.Length)`r`n" +
            "Access-Control-Allow-Origin: *`r`nAccess-Control-Allow-Methods: GET, POST, OPTIONS`r`n" +
            "Access-Control-Allow-Headers: Content-Type`r`nAccess-Control-Allow-Private-Network: true`r`nConnection: close`r`n`r`n"
    $h = [System.Text.Encoding]::ASCII.GetBytes($head)
    $stream.Write($h, 0, $h.Length)
    $stream.Write($bytes, 0, $bytes.Length)
}

function SaveNotes($text) {
    $data = $json.DeserializeObject($text)
    if (-not ($data -is [System.Collections.IDictionary]) -or -not $data.ContainsKey('notes')) { throw 'no notes' }
    # never write into a different copy of the presentation than the one that is open
    if (-not $data.ContainsKey('root') -or -not (SameDir ([string]$data['root']) $root)) { throw 'other copy' }
    # plain .NET types only (PowerShell [ordered]/ArrayList wrappers cannot be serialized).
    # Slide ids are names or numbers (data-src); they must start with a letter or digit, so nothing
    # like __proto__ can reach notes.js. Notes are kept in the order the deck sent them (slide order).
    $notes = New-Object 'System.Collections.Generic.Dictionary[string,object]'
    foreach ($k in $data['notes'].Keys) {
        if ($k -cnotmatch '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$') { throw "bad slide key $k" }
        $notes[$k] = [string[]]@(@($data['notes'][$k]) | ForEach-Object { [string]$_ })
    }
    $out = New-Object 'System.Collections.Generic.Dictionary[string,object]'
    $out.Add('saved', [string]$data['saved'])
    $out.Add('notes', $notes)
    $js = "window.DECK_NOTES = " + $json.Serialize($out) + ";`n"
    # -LiteralPath: folder names such as "Deck [final]" are not wildcards
    if (Test-Path -LiteralPath $target) { Copy-Item -LiteralPath $target -Destination $prev -Force }
    $tmp = "$target.tmp"
    [System.IO.File]::WriteAllText($tmp, $js, (New-Object System.Text.UTF8Encoding $false))
    Move-Item -LiteralPath $tmp -Destination $target -Force
}

$last = Get-Date
while ($true) {
    if (-not $listener.Pending()) {
        Start-Sleep -Milliseconds 150
        if (((Get-Date) - $last).TotalMinutes -gt 3) { break }
        continue
    }
    $client = $listener.AcceptTcpClient()
    $last = Get-Date
    try {
        $s = $client.GetStream()
        $s.ReadTimeout = 5000
        $buf = New-Object System.Collections.Generic.List[byte]
        while ($true) {
            $b = $s.ReadByte()
            if ($b -lt 0) { break }
            $buf.Add([byte]$b)
            $n = $buf.Count
            if ($n -ge 4 -and $buf[$n - 4] -eq 13 -and $buf[$n - 3] -eq 10 -and $buf[$n - 2] -eq 13 -and $buf[$n - 1] -eq 10) { break }
            if ($n -gt 65536) { break }
        }
        $head = [System.Text.Encoding]::ASCII.GetString($buf.ToArray())
        $line = ($head -split "`r`n")[0]
        $method, $path = $line.Split(' ')[0, 1]
        $origin = if ($head -match "(?im)^Origin:\s*(.+?)\s*$") { $Matches[1] } else { '' }
        $len = if ($head -match "(?im)^Content-Length:\s*(\d+)") { [int]$Matches[1] } else { 0 }
        if ($origin -and $origin -ne 'null') { Send $s '403 Forbidden' 'only the local deck may save' }      # file:// pages send Origin: null
        elseif ($method -eq 'OPTIONS') { Send $s '204 No Content' '' }
        elseif ($path -eq '/ping') { Send $s '200 OK' $root }
        elseif ($path -eq '/quit' -and -not $origin) { Send $s '200 OK' 'bye'; $client.Close(); break }   # newer copy took over (not callable from web pages)
        elseif ($method -eq 'POST' -and $path -eq '/save') {
            $body = New-Object byte[] $len
            $got = 0
            while ($got -lt $len) { $r = $s.Read($body, $got, $len - $got); if ($r -le 0) { break }; $got += $r }
            try { SaveNotes ([System.Text.Encoding]::UTF8.GetString($body, 0, $got)); Send $s '200 OK' 'saved' }
            catch { Send $s '400 Bad Request' "$($_.Exception.Message)" }
        }
        else { Send $s '404 Not Found' 'not found' }
    } catch {
    } finally {
        $client.Close()
    }
}
$listener.Stop()
