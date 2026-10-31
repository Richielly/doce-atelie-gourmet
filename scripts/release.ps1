param([ValidateSet('Debug','Release')][string]$Mode='Debug',[string]$KeyStore,[string]$PasswordFile,[switch]$NextVersion)
$ErrorActionPreference='Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
if (-not $env:JAVA_HOME) {
  $portable=Get-ChildItem '..\.tools\java21' -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
  $jdk = Get-ChildItem 'C:\Program Files\Eclipse Adoptium' -Directory -ErrorAction SilentlyContinue | Where-Object Name -Like 'jdk-21*' | Select-Object -First 1
  if ($portable) { $env:JAVA_HOME=$portable.FullName } elseif ($jdk) { $env:JAVA_HOME=$jdk.FullName }
}
if (-not $env:ANDROID_HOME) {
  if (Test-Path '..\.tools\android-sdk') { $env:ANDROID_HOME=(Resolve-Path '..\.tools\android-sdk').Path }
  else { $env:ANDROID_HOME=Join-Path $env:USERPROFILE 'AppData\Local\Android\Sdk' }
}
if (-not (Test-Path "$env:JAVA_HOME\bin\java.exe")) { throw 'Instale o JDK 21 e configure JAVA_HOME.' }
if (-not (Test-Path "$env:ANDROID_HOME\platforms")) { throw 'Instale o Android SDK e configure ANDROID_HOME.' }
$release=Get-Content release.json -Raw | ConvertFrom-Json
if ($release.version -notmatch '^(\d+)\.(\d+)\.(\d+)$' -or $release.code -lt 1) { throw 'release.json invalido.' }
if ($NextVersion) {
  $parts=$release.version.Split('.')
  $patch=[int]$parts[2]
  $maxCode=[long]$release.code
  foreach ($metadata in Get-ChildItem releases -Filter release.json -Recurse -File -ErrorAction SilentlyContinue) {
    $previous=Get-Content -LiteralPath $metadata.FullName -Raw | ConvertFrom-Json
    $maxCode=[Math]::Max($maxCode,[long]$previous.code)
  }
  do { $patch++; $release.version="$($parts[0]).$($parts[1]).$patch" }
  while (Test-Path (Join-Path 'releases' $release.version))
  $release.code=$maxCode+1
  if ($release.code -gt 2100000000) { throw 'Limite de versionCode Android atingido.' }
  [IO.File]::WriteAllText((Join-Path $PWD 'release.json'), ($release | ConvertTo-Json)+[Environment]::NewLine, (New-Object Text.UTF8Encoding($false)))
  Write-Host "Nova versao do app: $($release.version) (codigo $($release.code))."
}
$destination=Join-Path (Get-Location) "releases\$($release.version)\$Mode"
if (Test-Path $destination) { throw 'Esta versao ja existe. Use -NextVersion para gerar outra sem sobrescrever a anterior.' }
if ($Mode -eq 'Release' -and $KeyStore) {
  if (-not (Test-Path -LiteralPath $KeyStore -PathType Leaf)) { throw 'Chave de assinatura nao encontrada.' }
  if (-not $PasswordFile -or -not (Test-Path -LiteralPath $PasswordFile -PathType Leaf)) { throw 'Arquivo de senha nao encontrado.' }
}
node scripts/android.cjs
if ($LASTEXITCODE -ne 0) { throw 'Falha ao preparar Android.' }
Push-Location android
try {
  & .\gradlew.bat "assemble$Mode" --no-daemon
  if ($LASTEXITCODE -ne 0) { throw 'Falha na compilação Android.' }
} finally { Pop-Location }
New-Item -ItemType Directory -Path $destination | Out-Null
$variant=$Mode.ToLowerInvariant()
Copy-Item "android/app/build/outputs/apk/$variant/*.apk" $destination
Copy-Item release.json $destination
Compress-Archive -Path dist/* -DestinationPath "$destination\painel-web.zip"
if ($Mode -eq 'Release' -and $KeyStore) {
  if (-not $PasswordFile) { throw 'Informe PasswordFile para assinar com a chave permanente.' }
  $signer=Get-ChildItem "$env:ANDROID_HOME\build-tools\*\apksigner.bat" | Sort-Object FullName -Descending | Select-Object -First 1
  if (-not $signer) { throw 'apksigner não encontrado no SDK.' }
  $env:DOCE_SIGN_PASSWORD=[IO.File]::ReadAllText((Resolve-Path $PasswordFile)).Trim()
  try {
    & $signer.FullName sign --ks $KeyStore --ks-type PKCS12 --ks-key-alias doce-atelie --ks-pass env:DOCE_SIGN_PASSWORD --key-pass env:DOCE_SIGN_PASSWORD --out "$destination\doce-atelie.apk" "$destination\app-release-unsigned.apk"
    if ($LASTEXITCODE -ne 0) { throw 'Falha na assinatura.' }
    & $signer.FullName verify --verbose --print-certs "$destination\doce-atelie.apk"
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao verificar assinatura.' }
  } finally { Remove-Item Env:DOCE_SIGN_PASSWORD -ErrorAction SilentlyContinue }
}
$checksums=foreach ($file in Get-ChildItem $destination -File) {
  $stream=[IO.File]::OpenRead($file.FullName)
  $sha=[Security.Cryptography.SHA256]::Create()
  try { $hash=[BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','').ToLowerInvariant() }
  finally { $stream.Dispose(); $sha.Dispose() }
  "$hash  $($file.Name)"
}
$checksums | Set-Content -LiteralPath (Join-Path $destination 'SHA256SUMS.txt') -Encoding ASCII
$checksums | ForEach-Object { Write-Host $_ }
Write-Host "Versão criada em $destination. Distribua somente APK Release assinado com a chave permanente."
