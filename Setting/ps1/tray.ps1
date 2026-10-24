param([int]$ParentPid, [string]$StateFile, [string]$IconFile, [string]$CommandDir)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$ni = New-Object System.Windows.Forms.NotifyIcon
$ni.Icon = New-Object System.Drawing.Icon($IconFile)
$ni.Text = 'Media Server'
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$items = @{}

function Update-ServerButtons([string]$status) {
  $running = ($status -eq 'Running')
  # Web dang chay: chi hien Stop.
  # Web dang tat: chi hien Start.
  $items['start'].Visible = -not $running
  $items['stop'].Visible = $running
}

function Send-Click([string]$id) {
  try {
    if (!(Test-Path -LiteralPath $CommandDir)) { New-Item -ItemType Directory -Force -Path $CommandDir | Out-Null }
    $name = 'click-' + [Guid]::NewGuid().ToString('N') + '.cmd'
    $tmp = Join-Path $CommandDir ($name + '.tmp')
    $dst = Join-Path $CommandDir $name
    [System.IO.File]::WriteAllText($tmp, $id, (New-Object System.Text.UTF8Encoding($false)))
    [System.IO.File]::Move($tmp, $dst)
  } catch {
    [System.Windows.Forms.MessageBox]::Show(('MediaPlayer command error: ' + $_.Exception.Message), 'Media Player') | Out-Null
  }
}

function Add-Entry([string]$id, [string]$text, [bool]$enabled = $true) {
  $mi = New-Object System.Windows.Forms.ToolStripMenuItem($text)
  $mi.Tag = $id
  $mi.Enabled = $enabled
  $mi.Add_Click({ param($s, $e) Send-Click ([string]$s.Tag) })
  [void]$menu.Items.Add($mi)
  $items[$id] = $mi
}
function Add-Sep { [void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) }

# GIU NGUYEN THANH KHAY HE THONG
Add-Entry 'open' 'Open Website'
Add-Entry 'admin' 'Open Admin'
Add-Sep
Add-Entry 'start' 'Start Server'
Add-Entry 'stop' 'Stop Server'
Add-Entry 'restart' 'Restart Server'
Add-Entry 'status' 'Server Status: ...' $false
Add-Sep
Add-Entry 'auto' 'Start with Windows'
Add-Sep
Add-Entry 'cf_toggle' 'Cloudflare Tunnel - Bat/Tat'
Add-Entry 'cf_setup' 'Cloudflare Tunnel - Cai / Cau hinh lai'
Add-Entry 'cf_status' 'Cloudflare Tunnel: ...' $false
Add-Sep
Add-Entry 'video' 'Open Video Folder'
Add-Entry 'img' 'Open Image Folder'
Add-Entry 'logs' 'Open Logs'
Add-Sep
Add-Entry 'exit' 'Exit'

$ni.ContextMenuStrip = $menu
$ni.Add_DoubleClick({ Send-Click 'open' })
$ni.Visible = $true

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 1000
$script:lastWrite = [datetime]::MinValue
$script:lastNotice = 0
$timer.Add_Tick({
  try { $null = [System.Diagnostics.Process]::GetProcessById($ParentPid) } catch {
    $ni.Visible = $false
    [System.Windows.Forms.Application]::Exit()
    return
  }
  try {
    if (Test-Path -LiteralPath $StateFile) {
      $w = [System.IO.File]::GetLastWriteTimeUtc($StateFile)
      if ($w -ne $script:lastWrite) {
        $script:lastWrite = $w
        $st = Get-Content -Raw -LiteralPath $StateFile | ConvertFrom-Json
        $status = [string]$st.status
        $items['status'].Text = 'Server Status: ' + $status
        $items['auto'].Checked = [bool]$st.auto
        if ($st.cf) { $items['cf_status'].Text = 'Cloudflare Tunnel: ' + [string]$st.cf }
        Update-ServerButtons $status
        if ($st.noticeId -and ([int]$st.noticeId -ne $script:lastNotice)) {
          $script:lastNotice = [int]$st.noticeId
          if ($st.notice) { $ni.ShowBalloonTip(3000, 'Media Server', [string]$st.notice, [System.Windows.Forms.ToolTipIcon]::Info) }
        }
      }
    }
  } catch { }
})

# Dong bo ngay khi khoi dong, tranh hien ca Start + Stop trong khoanh khac.
try {
  if (Test-Path -LiteralPath $StateFile) {
    $st0 = Get-Content -Raw -LiteralPath $StateFile | ConvertFrom-Json
    $items['status'].Text = 'Server Status: ' + [string]$st0.status
    $items['auto'].Checked = [bool]$st0.auto
    if ($st0.cf) { $items['cf_status'].Text = 'Cloudflare Tunnel: ' + [string]$st0.cf }
    $script:lastNotice = [int]$st0.noticeId
    Update-ServerButtons ([string]$st0.status)
  } else {
    # Chua co state: mac dinh theo huong an toan la hien Start, an Stop.
    Update-ServerButtons 'Stopped'
  }
} catch { Update-ServerButtons 'Stopped' }

$timer.Start()
[System.Windows.Forms.Application]::Run()
$ni.Dispose()
