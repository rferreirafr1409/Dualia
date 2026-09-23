# maj-accents-ecrans-vides.ps1
#
# Corrige deux libelles francais ecrits sans accents :
#   "Aucune decision dans cette categorie."  (ecran Decisions)
#   "Aucun souvenir dans cette categorie."   (ecran Journal)
#
# Ce sont les messages des ecrans VIDES : ce sont donc les premiers textes
# que lit un nouvel utilisateur, avant d'avoir cree quoi que ce soit.
#
# Chaines encodees en base64 : l'encodage de ce fichier n'a aucune influence.

$ErrorActionPreference = 'Stop'
$chemin = Join-Path $PSScriptRoot 'constants\i18n.ts'

if (-not (Test-Path $chemin)) {
  Write-Host "Fichier introuvable : $chemin" -ForegroundColor Red
  exit 1
}

function ConvertFrom-Base64Utf8($b64) {
  return [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b64))
}

$encodage = New-Object System.Text.UTF8Encoding($false)
$texte = [System.IO.File]::ReadAllText($chemin, $encodage)

$paires = @(
  @{
    ancien  = ConvertFrom-Base64Utf8 (
      'ICAgICAgdmlkZTogJ0F1Y3VuZSBkZWNpc2lvbiBkYW5zIGNldHRlIGNhdGVnb3JpZS4nLA=='
    )
    nouveau = ConvertFrom-Base64Utf8 (
      'ICAgICAgdmlkZTogJ0F1Y3VuZSBkw6ljaXNpb24gZGFucyBjZXR0ZSBjYXTDqWdvcmllLics'
    )
  }
,
  @{
    ancien  = ConvertFrom-Base64Utf8 (
      'ICAgICAgdmlkZTogJ0F1Y3VuIHNvdXZlbmlyIGRhbnMgY2V0dGUgY2F0ZWdvcmllLics'
    )
    nouveau = ConvertFrom-Base64Utf8 (
      'ICAgICAgdmlkZTogJ0F1Y3VuIHNvdXZlbmlyIGRhbnMgY2V0dGUgY2F0w6lnb3JpZS4nLA=='
    )
  }
)

if ($paires[0].nouveau -notmatch ([char]0x00E9)) {
  Write-Host "Decodage base64 incorrect. Rien n'a ete ecrit." -ForegroundColor Red
  exit 1
}

$probleme = 0
foreach ($p in $paires) {
  $n = ([regex]::Matches($texte, [regex]::Escape($p.ancien))).Count
  if ($n -ne 1) {
    Write-Host "Introuvable ou en double ($n) : $($p.ancien)" -ForegroundColor Red
    $probleme++
  }
}
if ($probleme -gt 0) {
  Write-Host "Aucune modification effectuee." -ForegroundColor Red
  exit 1
}

$sauvegarde = "$chemin.$(Get-Date -Format 'yyyyMMdd-HHmmss').bak"
Copy-Item $chemin $sauvegarde
Write-Host "Sauvegarde : $sauvegarde" -ForegroundColor DarkGray

foreach ($p in $paires) {
  $texte = $texte.Replace($p.ancien, $p.nouveau)
  Write-Host "Corrige : $($p.nouveau.Trim())" -ForegroundColor Green
}

[System.IO.File]::WriteAllText($chemin, $texte, $encodage)
Write-Host ""
Write-Host "=== i18n.ts mis a jour ===" -ForegroundColor Green
