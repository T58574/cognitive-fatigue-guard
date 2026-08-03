Set WshShell = CreateObject("WScript.Shell")
strDesktop = WshShell.SpecialFolders("Desktop")
Set oShellLink = WshShell.CreateShortcut(strDesktop & "\Cognitive Fatigue Guard.lnk")
oShellLink.TargetPath = WScript.ScriptFullName
oShellLink.TargetPath = "wscript.exe"
oShellLink.Arguments = """" & WshShell.CurrentDirectory & "\Run-FatigueGuard.vbs"""
oShellLink.WorkingDirectory = WshShell.CurrentDirectory
oShellLink.Description = "Launch Cognitive Fatigue Guard"
oShellLink.Save
WScript.Echo "Shortcut created on Desktop successfully!"
