param([Parameter(Mandatory=$true)][string]$Directory,[string]$BundleTool='..\.tools\bundletool-all-1.18.2.jar')
$ErrorActionPreference='Stop'
$directoryPath=(Resolve-Path -LiteralPath $Directory).Path
$release=Get-Content (Join-Path $directoryPath 'release.json') -Raw | ConvertFrom-Json
$bundle=Join-Path $directoryPath "elume-shop-$($release.version).aab"
$verification=& "$env:JAVA_HOME\bin\jarsigner.exe" '-J-Duser.language=en' -verify -verbose -certs $bundle 2>&1
$verifyExit=$LASTEXITCODE
$verification | Set-Content (Join-Path $directoryPath 'assinatura.txt') -Encoding UTF8
if($verifyExit -ne 0 -or -not(($verification | Out-String) -match 'jar verified') -or (($verification | Out-String) -match 'contains unsigned entries')){throw 'Assinatura do AAB não validada.'}
$certificate=& "$env:JAVA_HOME\bin\keytool.exe" '-J-Duser.language=en' -printcert -jarfile $bundle 2>&1
if($LASTEXITCODE -ne 0){throw 'Certificado do AAB não encontrado.'}
$fingerprint=(($certificate | Out-String) -replace ':','').ToLowerInvariant()
if($fingerprint -notmatch 'c8744eb9a3bba0d4baae0d42471b0630f784df09bb538f7eef21ebc785c1b0ee'){throw 'AAB não usa o certificado permanente esperado.'}
$bundleValidation=& "$env:JAVA_HOME\bin\java.exe" -jar $BundleTool validate --bundle=$bundle 2>&1
$bundleExit=$LASTEXITCODE
$bundleValidation | Set-Content (Join-Path $directoryPath 'bundletool.txt') -Encoding UTF8
if($bundleExit -ne 0){throw 'Bundletool rejeitou o AAB.'}
$manifestPath=Join-Path $directoryPath 'AndroidManifest.xml'
& "$env:JAVA_HOME\bin\java.exe" -jar $BundleTool dump manifest --bundle=$bundle | Set-Content $manifestPath -Encoding UTF8
if($LASTEXITCODE -ne 0){throw 'Falha ao extrair manifesto.'}
[xml]$manifest=Get-Content -LiteralPath $manifestPath -Raw
$ns='http://schemas.android.com/apk/res/android'
if($manifest.manifest.package -ne 'com.doceatelie.gourmet' -or $manifest.manifest.GetAttribute('versionCode',$ns) -ne [string]$release.code -or $manifest.manifest.GetAttribute('versionName',$ns) -ne $release.version -or [int]$manifest.manifest.'uses-sdk'.GetAttribute('targetSdkVersion',$ns) -lt 36){throw 'Pacote, versão ou API alvo diferentes do esperado.'}
$sums=foreach($file in Get-ChildItem -LiteralPath $directoryPath -File | Where-Object Name -ne 'SHA256SUMS.txt'){"$((Get-FileHash -LiteralPath $file.FullName).Hash.ToLowerInvariant())  $($file.Name)"}
$sums | Set-Content (Join-Path $directoryPath 'SHA256SUMS.txt') -Encoding ASCII
Write-Host "OK: AAB $($release.version), pacote e código preservados, API alvo 36+, assinatura permanente e estrutura válidas."
