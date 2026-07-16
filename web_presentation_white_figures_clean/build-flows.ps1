$ErrorActionPreference = "Stop"
$PresentationDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$FlowsDirectory = Join-Path $PresentationDirectory "assets\flows"
$SourceDirectory = Join-Path $FlowsDirectory "src"
$MermaidConfig = Join-Path $FlowsDirectory "mermaid-config.json"
$PuppeteerConfig = Join-Path $FlowsDirectory "puppeteer-config.json"
$Node = (Get-Command node -ErrorAction Stop).Source

$CliCandidates = Get-ChildItem "$env:LOCALAPPDATA\npm-cache\_npx" -Recurse -Filter "cli.js" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -like "*\@mermaid-js\mermaid-cli\src\cli.js" } |
    Sort-Object LastWriteTime -Descending
$MermaidCli = $CliCandidates | Select-Object -First 1
if (-not $MermaidCli) {
    throw "Mermaid CLI was not found in the local npm cache. Run npx @mermaid-js/mermaid-cli once to install it."
}

foreach ($Source in Get-ChildItem -LiteralPath $SourceDirectory -Filter "*.mmd") {
    $Output = Join-Path $FlowsDirectory ($Source.BaseName + ".svg")
    if ((Test-Path -LiteralPath $Output) -and ((Get-Item -LiteralPath $Output).LastWriteTime -ge $Source.LastWriteTime)) {
        continue
    }

    & $Node $MermaidCli.FullName -p $PuppeteerConfig -i $Source.FullName -o $Output -c $MermaidConfig -b transparent
    if ($LASTEXITCODE -ne 0) {
        throw "Mermaid compilation failed for $($Source.Name)."
    }
}

Write-Output "Mermaid flow assets are up to date."
