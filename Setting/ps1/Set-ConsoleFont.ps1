param([int]$Height = 20, [string]$FaceName = 'Consolas')
# Phong chu mac dinh cua cmd.exe (Raster Fonts, ~8-12px) rat kho doc khi log dai/nhieu dong.
# Doi sang Consolas co pixel lon hon NGAY TREN CUA SO CONSOLE HIEN TAI (khong can mo cua so moi).
Add-Type -Name Con -Namespace Win32Font -MemberDefinition @'
[DllImport("kernel32.dll", SetLastError = true)]
public static extern IntPtr GetStdHandle(int nStdHandle);
[DllImport("kernel32.dll", SetLastError = true)]
public static extern bool SetCurrentConsoleFontEx(IntPtr hConsoleOutput, bool MaximumWindow, ref CONSOLE_FONT_INFOEX ConsoleCurrentFontEx);
[StructLayout(LayoutKind.Sequential)]
public struct COORD { public short X; public short Y; }
[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
public struct CONSOLE_FONT_INFOEX {
    public uint cbSize;
    public uint nFont;
    public COORD dwFontSize;
    public int FontFamily;
    public int FontWeight;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
    public string FaceName;
}
'@
try {
    $hOut = [Win32Font.Con]::GetStdHandle(-11)
    $font = New-Object Win32Font.Con+CONSOLE_FONT_INFOEX
    $font.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf($font)
    $font.nFont = 0
    $font.dwFontSize = New-Object Win32Font.Con+COORD
    $font.dwFontSize.X = 0
    $font.dwFontSize.Y = $Height
    $font.FontFamily = 54   # FF_MODERN ||  TMPF_TRUETYPE
    $font.FontWeight = 400
    $font.FaceName = $FaceName
    [Win32Font.Con]::SetCurrentConsoleFontEx($hOut, $false, [ref]$font) | Out-Null
} catch { }
