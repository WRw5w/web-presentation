param(
    [int]$Width = 1600,
    [int]$Height = 900,
    [string]$OutputDirectory = "",
    [switch]$IncludeCameras
)

$ErrorActionPreference = "Stop"
$PresentationDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDirectory = Split-Path -Parent $PresentationDirectory
$Chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$BuildFlows = Join-Path $PresentationDirectory "build-flows.ps1"

if (-not (Test-Path -LiteralPath $Chrome)) {
    throw "Chrome was not found at $Chrome"
}

& $BuildFlows

if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $ProjectDirectory "tmp\screenshots\web_presentation_white_figures_review"
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$ProfileDirectory = Join-Path $OutputDirectory "chrome-profile"
New-Item -ItemType Directory -Force -Path $ProfileDirectory | Out-Null

$IndexUrl = "file:///" + ($PresentationDirectory -replace "\\", "/") + "/index.html"
$Revision = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

function Save-DeckScreenshot {
    param([int]$Slide, [int]$Camera, [string]$Destination)

    $Url = "${IndexUrl}?slide=$Slide&camera=$Camera&reducedMotion=1&export=1&noHistory=1&rev=$Revision"
    $Arguments = @(
        "--headless=new",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--disable-background-networking",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        "--window-size=$Width,$Height",
        "--run-all-compositor-stages-before-draw",
        "--user-data-dir=$ProfileDirectory",
        "--screenshot=$Destination",
        $Url
    )

    Start-Process -FilePath $Chrome -ArgumentList $Arguments -WindowStyle Hidden -Wait | Out-Null
    if (-not (Test-Path -LiteralPath $Destination)) {
        throw "Chrome did not create $Destination"
    }
}

$SlideCount = ([regex]::Matches((Get-Content -Raw (Join-Path $PresentationDirectory "index.html")), '<section class="slide(?:\s|\")').Count) -
    ([regex]::Matches((Get-Content -Raw (Join-Path $PresentationDirectory "index.html")), '<template[\s\S]*?</template>') | ForEach-Object { [regex]::Matches($_.Value, '<section class="slide(?:\s|\")').Count } | Measure-Object -Sum).Sum

foreach ($Slide in 1..$SlideCount) {
    $Destination = Join-Path $OutputDirectory ("slide-{0:D2}.png" -f $Slide)
    Save-DeckScreenshot -Slide $Slide -Camera 1 -Destination $Destination
}

if ($IncludeCameras) {
    $CameraDirectory = Join-Path $OutputDirectory "cameras"
    New-Item -ItemType Directory -Force -Path $CameraDirectory | Out-Null
    $CameraCounts = [ordered]@{ 5 = 4; 6 = 2; 7 = 1; 8 = 2; 9 = 2; 10 = 2; 12 = 2 }
    foreach ($Entry in $CameraCounts.GetEnumerator()) {
        foreach ($Camera in 1..$Entry.Value) {
            $Destination = Join-Path $CameraDirectory ("slide-{0:D2}-camera-{1:D2}.png" -f $Entry.Key, $Camera)
            Save-DeckScreenshot -Slide $Entry.Key -Camera $Camera -Destination $Destination
        }
    }
}

$PrimaryCount = (Get-ChildItem -LiteralPath $OutputDirectory -Filter "slide-??.png").Count
$CameraCount = if ($IncludeCameras) { (Get-ChildItem -LiteralPath (Join-Path $OutputDirectory "cameras") -Filter "*.png").Count } else { 0 }
Write-Output "Rendered $PrimaryCount slides and $CameraCount camera states to $OutputDirectory"
