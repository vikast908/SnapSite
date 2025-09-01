Param(
  [string]$Remote = "https://github.com/vikast908/GetInspire.git",
  [string]$Branch = "main"
)

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Error "git is not installed or not in PATH. Install Git for Windows and rerun."
  exit 1
}

Set-Location -Path (Split-Path -Parent $MyInvocation.MyCommand.Path) | Out-Null
Set-Location -Path ..

if (-not (Test-Path .git)) {
  git init -b $Branch | Out-Null
}

git add -A
if (-not (git diff --cached --quiet)) {
  git commit -m "feat: initial MVP of GetInspire Chrome extension" | Out-Null
}

if (-not (git remote | Select-String -SimpleMatch origin)) {
  git remote add origin $Remote
} else {
  git remote set-url origin $Remote
}

git push -u origin $Branch
