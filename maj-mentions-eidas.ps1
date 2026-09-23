# maj-mentions-eidas.ps1
#
# Retire les mentions eIDAS de l'interface, dans les quatre langues.
#
# MOTIF
# L'application affiche aujourd'hui "Horodatage eIDAS - Reglement (UE)
# n 910/2014" et "Communications certifiees eIDAS" alors qu'aucun contrat
# avec un prestataire de services de confiance qualifie (QTSP) n'est signe.
# Les jetons "EIDAS-..." affiches sur les decisions sont generes localement
# par l'application : ce n'est pas un horodatage qualifie.
#
# Affirmer une garantie juridique inexistante expose la societe editrice, et
# expose surtout le parent qui s'en prevaudrait devant un juge aux affaires
# familiales : la partie adverse n'aurait aucun mal a demontrer que le jeton
# ne vaut rien.
#
# Les libelles de remplacement disent ce qui est vrai et reste utile : les
# decisions sont datees et conservees, les donnees sont hebergees en France.
# Ils sont a retablir le jour ou le contrat QTSP est signe.
#
# Au passage, les versions espagnole et anglaise annoncaient "UE" / "EU"
# pour l'hebergement : c'est desormais "France", ce qui est exact.
#
# UTILISATION
#   .\maj-mentions-eidas.ps1
# depuis la racine du projet (dualia-mvp).
#
# Ce script ne contient aucun caractere accentue : les chaines sont encodees
# en base64 et decodees en UTF-8 a l'execution. L'encodage du present fichier
# n'a donc aucune influence sur le resultat.

$ErrorActionPreference = 'Stop'
$chemin = Join-Path $PSScriptRoot 'constants\i18n.ts'

if (-not (Test-Path $chemin)) {
  Write-Host "Fichier introuvable : $chemin" -ForegroundColor Red
  Write-Host "Lance ce script depuis la racine du projet (dualia-mvp)." -ForegroundColor Yellow
  exit 1
}

function ConvertFrom-Base64Utf8($b64) {
  return [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b64))
}

$encodage = New-Object System.Text.UTF8Encoding($false)
$texte = [System.IO.File]::ReadAllText($chemin, $encodage)

$paires = @(
  @{
    langue  = 'fr'
    ancien  = ConvertFrom-Base64Utf8 (
      'ICAgICAgdHJ1c3RTdHJpcDogJ0NvbW11bmljYXRpb25zIGNlcnRpZmnDqWVzIGVJREFTIMK3IGRvbm7DqWVzIGjDqW' +
      'JlcmfDqWVzIGVuIEZyYW5jZScs'
    )
    nouveau = ConvertFrom-Base64Utf8 (
      'ICAgICAgdHJ1c3RTdHJpcDogJ0Rvbm7DqWVzIGjDqWJlcmfDqWVzIGVuIEZyYW5jZSDCtyBhY2PDqHMgcsOpc2Vyds' +
      'OpIGF1eCBwYXJlbnRzIGRlIHZvdHJlIGVzcGFjZScs'
    )
  },
  @{
    langue  = 'fr'
    ancien  = ConvertFrom-Base64Utf8 (
      'ICAgICAgc291c1RpdHJlOiAiSG9yb2RhdGFnZSBlSURBUyDCtyBSw6hnbGVtZW50IChVRSkgbsKwOTEwLzIwMTQiLA' +
      '=='
    )
    nouveau = ConvertFrom-Base64Utf8 (
      'ICAgICAgc291c1RpdHJlOiAnRMOpY2lzaW9ucyBkYXTDqWVzIGV0IGNvbnNlcnbDqWVzIGRhbnMgdm90cmUgZXNwYW' +
      'NlJyw='
    )
  },
  @{
    langue  = 'es'
    ancien  = ConvertFrom-Base64Utf8 (
      'ICAgICAgdHJ1c3RTdHJpcDogJ0NvbXVuaWNhY2lvbmVzIGNlcnRpZmljYWRhcyBlSURBUyDCtyBkYXRvcyBhbG9qYW' +
      'RvcyBlbiBsYSBVRScs'
    )
    nouveau = ConvertFrom-Base64Utf8 (
      'ICAgICAgdHJ1c3RTdHJpcDogJ0RhdG9zIGFsb2phZG9zIGVuIEZyYW5jaWEgwrcgYWNjZXNvIHJlc2VydmFkbyBhIG' +
      'xvcyBwcm9nZW5pdG9yZXMgZGUgdnVlc3RybyBlc3BhY2lvJyw='
    )
  },
  @{
    langue  = 'es'
    ancien  = ConvertFrom-Base64Utf8 (
      'ICAgICAgc291c1RpdHJlOiAnU2VsbGFkbyB0ZW1wb3JhbCBlSURBUyDCtyBSZWdsYW1lbnRvIChVRSkgbi7CuiA5MT' +
      'AvMjAxNCcs'
    )
    nouveau = ConvertFrom-Base64Utf8 (
      'ICAgICAgc291c1RpdHJlOiAnRGVjaXNpb25lcyBmZWNoYWRhcyB5IGNvbnNlcnZhZGFzIGVuIHZ1ZXN0cm8gZXNwYW' +
      'Npbycs'
    )
  },
  @{
    langue  = 'pt'
    ancien  = ConvertFrom-Base64Utf8 (
      'ICAgICAgdHJ1c3RTdHJpcDogJ0NvbXVuaWNhw6fDtWVzIGNlcnRpZmljYWRhcyBlSURBUyDCtyBkYWRvcyBhbG9qYW' +
      'RvcyBlbSBGcmFuw6dhJyw='
    )
    nouveau = ConvertFrom-Base64Utf8 (
      'ICAgICAgdHJ1c3RTdHJpcDogJ0RhZG9zIGFsb2phZG9zIGVtIEZyYW7Dp2EgwrcgYWNlc3NvIHJlc2VydmFkbyBhb3' +
      'MgcGFpcyBkbyB2b3NzbyBlc3Bhw6dvJyw='
    )
  },
  @{
    langue  = 'pt'
    ancien  = ConvertFrom-Base64Utf8 (
      'ICAgICAgc291c1RpdHJlOiAnUmVnaXN0byB0ZW1wb3JhbCBlSURBUyDCtyBSZWd1bGFtZW50byAoVUUpIG4uwrogOT' +
      'EwLzIwMTQnLA=='
    )
    nouveau = ConvertFrom-Base64Utf8 (
      'ICAgICAgc291c1RpdHJlOiAnRGVjaXPDtWVzIGRhdGFkYXMgZSBjb25zZXJ2YWRhcyBubyB2b3NzbyBlc3Bhw6dvJy' +
      'w='
    )
  },
  @{
    langue  = 'en'
    ancien  = ConvertFrom-Base64Utf8 (
      'ICAgICAgdHJ1c3RTdHJpcDogJ2VJREFTLWNlcnRpZmllZCBjb21tdW5pY2F0aW9ucyDCtyBkYXRhIGhvc3RlZCBpbi' +
      'B0aGUgRVUnLA=='
    )
    nouveau = ConvertFrom-Base64Utf8 (
      'ICAgICAgdHJ1c3RTdHJpcDogJ0RhdGEgaG9zdGVkIGluIEZyYW5jZSDCtyBhY2Nlc3MgcmVzdHJpY3RlZCB0byB5b3' +
      'VyIHNwYWNlJyw='
    )
  },
  @{
    langue  = 'en'
    ancien  = ConvertFrom-Base64Utf8 (
      'ICAgICAgc291c1RpdHJlOiAnZUlEQVMgdGltZXN0YW1wIMK3IFJlZ3VsYXRpb24gKEVVKSBObyA5MTAvMjAxNCcs'
    )
    nouveau = ConvertFrom-Base64Utf8 (
      'ICAgICAgc291c1RpdHJlOiAnRGVjaXNpb25zIGRhdGVkIGFuZCBrZXB0IGluIHlvdXIgc3BhY2UnLA=='
    )
  }
)

# --- Controles prealables : rien n'est ecrit tant que tout n'est pas verifie.

# 1. Les chaines decodees doivent avoir des accents intacts.
if ($paires[0].nouveau -notmatch ([char]0x00E9)) {
  Write-Host "Decodage base64 incorrect (accents absents). Rien n'a ete ecrit." -ForegroundColor Red
  exit 1
}

# 2. Chaque chaine a remplacer doit etre presente exactement une fois.
$probleme = 0
foreach ($p in $paires) {
  $n = ([regex]::Matches($texte, [regex]::Escape($p.ancien))).Count
  if ($n -ne 1) {
    Write-Host "[$($p.langue)] introuvable ou en double ($n fois) :" -ForegroundColor Red
    Write-Host "         $($p.ancien)" -ForegroundColor DarkGray
    $probleme++
  }
}
if ($probleme -gt 0) {
  Write-Host ""
  Write-Host "$probleme chaine(s) non conforme(s). AUCUNE modification effectuee." -ForegroundColor Red
  Write-Host "Le fichier a peut-etre deja ete modifie." -ForegroundColor Yellow
  exit 1
}

Write-Host "8 chaines a remplacer, toutes trouvees." -ForegroundColor Cyan

# --- Sauvegarde puis remplacement.

$sauvegarde = "$chemin.$(Get-Date -Format 'yyyyMMdd-HHmmss').bak"
Copy-Item $chemin $sauvegarde
Write-Host "Sauvegarde : $sauvegarde" -ForegroundColor DarkGray

foreach ($p in $paires) {
  $texte = $texte.Replace($p.ancien, $p.nouveau)
  Write-Host "[$($p.langue)] remplace" -ForegroundColor Green
}

# --- Controle final : plus aucune mention eIDAS dans les libelles.

$restantes = ([regex]::Matches($texte, 'eIDAS', 'IgnoreCase')).Count
[System.IO.File]::WriteAllText($chemin, $texte, $encodage)

Write-Host ""
if ($restantes -eq 0) {
  Write-Host "=== i18n.ts mis a jour - plus aucune mention eIDAS ===" -ForegroundColor Green
} else {
  Write-Host "=== i18n.ts mis a jour ===" -ForegroundColor Green
  Write-Host "ATTENTION : $restantes mention(s) eIDAS subsistent dans i18n.ts." -ForegroundColor Yellow
}
Write-Host "Verifie que VS Code affiche 0 probleme, puis lance .\deploy-dualia.ps1" -ForegroundColor Cyan
