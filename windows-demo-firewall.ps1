#Requires -RunAsAdministrator
param(
  [switch]$Remove
)

$ruleName = "CareCopilot Android Demo (Local Subnet)"

if ($Remove) {
  Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue |
    Remove-NetFirewallRule
  Write-Host "Removed the CareCopilot Android demo firewall rule."
  exit 0
}

Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue |
  Remove-NetFirewallRule

New-NetFirewallRule `
  -DisplayName $ruleName `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort 3000,8000 `
  -RemoteAddress LocalSubnet `
  -Profile Public `
  -Description "Temporary same-Wi-Fi access to the CareCopilot hackathon demo." |
  Select-Object DisplayName, Enabled, Direction, Action, Profile, LocalPort, RemoteAddress
