Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$extPath = "C:\Users\vishw\Desktop\Misc\Antigravity Proejcts\Monetisation\copy-freedom"
$outDir = "C:\Users\vishw\.gemini\antigravity\brain\50a8114c-4833-441a-a7c7-81bb612d292e"

$urls = @(
    "https://en.wikipedia.org/wiki/Freedom_of_information",
    "https://news.ycombinator.com/",
    "https://github.com/SupremeDevelopersHQ",
    "https://unsplash.com",
    "https://medium.com"
)

# Close existing chromes to avoid profile lock issues, or use a temp profile
$tempProfile = "$env:TEMP\chrome_screens"
Remove-Item -Path $tempProfile -Recurse -Force -ErrorAction SilentlyContinue

for ($i = 0; $i -lt $urls.Length; $i++) {
    $url = $urls[$i]
    $num = $i + 1
    Write-Host "Capturing shot $num - $url"
    
    # Start Chrome
    $proc = Start-Process -FilePath "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList "--user-data-dir=`"$tempProfile`" --load-extension=`"$extPath`" --start-maximized `"$url`"" -PassThru
    
    Start-Sleep -Seconds 5
    
    # Bring to front
    $wshell = New-Object -ComObject wscript.shell
    $wshell.AppActivate($proc.Id) | Out-Null
    Start-Sleep -Seconds 1
    
    # Send Ctrl+Shift+Y to open popup
    [System.Windows.Forms.SendKeys]::SendWait("^+Y")
    Start-Sleep -Seconds 2
    
    # Capture screen
    $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
    $bmp.Save("$outDir\native_shot_$num.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose(); $bmp.Dispose()
    
    # Kill Chrome
    Stop-Process -Id $proc.Id -Force
    Start-Sleep -Seconds 2
}

Write-Host "Done capturing native screenshots!"
