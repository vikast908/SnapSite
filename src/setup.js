async function main(){
  const btn = document.getElementById('downloadBtn');
  const s = document.getElementById('status');
  const extId = chrome.runtime.id;
  const hostJsUrl = chrome.runtime.getURL('native/ytdlp_host.js');
  const runnerUrl = chrome.runtime.getURL('native/run_ytdlp_host.cmd');
  const [hostJs, runnerCmd] = await Promise.all([
    fetch(hostJsUrl).then(r=>r.text()),
    fetch(runnerUrl).then(r=>r.text()),
  ]);

  function toB64(str){
    // Encode text to base64 safely
    return btoa(unescape(encodeURIComponent(str)));
  }

  function buildInstaller(){
    const hostB64 = toB64(hostJs);
    const runnerB64 = toB64(runnerCmd);
    const ps = `# GetInspire yt-dlp helper installer (auto-generated)\n`+
`$ErrorActionPreference = 'Stop'\n`+
`$ExtId = '${extId}'\n`+
`$root = Join-Path $env:LOCALAPPDATA 'GetInspire/yt-dlp-host'\n`+
`New-Item -ItemType Directory -Force -Path $root | Out-Null\n`+
`$hostB64 = '${hostB64}'\n`+
`$runnerB64 = '${runnerB64}'\n`+
`[IO.File]::WriteAllBytes((Join-Path $root 'ytdlp_host.js'), [Convert]::FromBase64String($hostB64))\n`+
`[IO.File]::WriteAllBytes((Join-Path $root 'run_ytdlp_host.cmd'), [Convert]::FromBase64String($runnerB64))\n`+
`# Download yt-dlp.exe if missing\n`+
`$ytdlpExe = Join-Path $root 'yt-dlp.exe'\n`+
`if (-not (Test-Path $ytdlpExe)) {\n`+
`  try {\n`+
`    $url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'\n`+
`    Invoke-WebRequest -Uri $url -OutFile $ytdlpExe -UseBasicParsing\n`+
`  } catch { Write-Host 'Warning: could not download yt-dlp.exe; ensure it is in PATH' -ForegroundColor Yellow }\n`+
`}\n`+
`# Manifest\n`+
`$manifestPath = Join-Path $root 'com.getinspire.ytdlp.json'\n`+
`$manifest = @{\n`+
`  name = 'com.getinspire.ytdlp'\n`+
`  description = 'GetInspire yt-dlp Native Messaging Host'\n`+
`  path = (Join-Path $root 'run_ytdlp_host.cmd')\n`+
`  type = 'stdio'\n`+
`  allowed_origins = @("chrome-extension://$ExtId/")\n`+
`} | ConvertTo-Json -Depth 5\n`+
`Set-Content -Path $manifestPath -Value $manifest -Encoding UTF8\n`+
`# Register manifest\n`+
`$regKey = 'HKCU:\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.getinspire.ytdlp'\n`+
`if (-not (Test-Path $regKey)) { New-Item -Path $regKey -Force | Out-Null }\n`+
`Set-ItemProperty -Path $regKey -Name '(Default)' -Value $manifestPath -Force\n`+
`Write-Host 'Installed helper to:' $root -ForegroundColor Green\n`+
`Write-Host 'Registered native host for extension:' $ExtId -ForegroundColor Green\n`;
    return ps;
  }

  btn.addEventListener('click', async () => {
    try {
      const content = buildInstaller();
      const blob = new Blob([content], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'GetInspire-YTDLP-Install.ps1';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=> URL.revokeObjectURL(url), 5000);
      s.textContent = 'Downloaded installer. Open Downloads and run it (Run with PowerShell).';
      s.className = 'ok';
    } catch (e) {
      s.textContent = 'Error: ' + String(e); s.className='warn';
    }
  });
}

main().catch(e=>{ console.error(e); });
