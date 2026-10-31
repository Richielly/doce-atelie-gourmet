param(
 [string]$KeyStore='..\.private\doce-atelie.p12',
 [string]$PasswordFile='..\.private\KEYSTORE_PASSWORD.txt',
 [string]$BundleTool='..\.tools\bundletool-all-1.18.2.jar'
)
$ErrorActionPreference='Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
if(-not $env:JAVA_HOME){$env:JAVA_HOME=(Get-ChildItem '..\.tools\java21' -Directory | Select-Object -First 1).FullName}
if(-not $env:ANDROID_HOME){$env:ANDROID_HOME=(Resolve-Path '..\.tools\android-sdk').Path}
foreach($file in @("$env:JAVA_HOME\bin\jarsigner.exe",$KeyStore,$PasswordFile,$BundleTool)){
 if(-not(Test-Path -LiteralPath $file -PathType Leaf)){throw "Arquivo necessário não encontrado: $file"}
}
$release=Get-Content release.json -Raw | ConvertFrom-Json
$destination=Join-Path $PWD "releases\$($release.version)\PlayStore"
if(Test-Path -LiteralPath $destination){throw 'Pacote PlayStore já existe; use uma nova versão, sem sobrescrever artefatos.'}
node scripts/android.cjs
if($LASTEXITCODE -ne 0){throw 'Falha na preparação Android.'}
Push-Location android
try{
 & .\gradlew.bat bundleRelease lintRelease --no-daemon
 if($LASTEXITCODE -ne 0){throw 'Falha na compilação/validação Android.'}
}finally{Pop-Location}
New-Item -ItemType Directory -Path $destination | Out-Null
$bundle=Join-Path $destination "elume-shop-$($release.version).aab"
Copy-Item android/app/build/outputs/bundle/release/app-release.aab $bundle
Copy-Item release.json $destination
$env:ELUME_UPLOAD_PASSWORD=[IO.File]::ReadAllText((Resolve-Path $PasswordFile)).Trim()
try{
 & "$env:JAVA_HOME\bin\jarsigner.exe" -keystore $KeyStore -storetype PKCS12 -storepass:env ELUME_UPLOAD_PASSWORD -keypass:env ELUME_UPLOAD_PASSWORD -sigalg SHA256withRSA -digestalg SHA-256 $bundle doce-atelie
 if($LASTEXITCODE -ne 0){throw 'Falha ao assinar o AAB com a chave permanente.'}
}finally{Remove-Item Env:ELUME_UPLOAD_PASSWORD -ErrorAction SilentlyContinue}
Copy-Item android/app/build/reports/lint-results-release.html (Join-Path $destination 'lint.html')
& (Join-Path $PSScriptRoot 'verify-play.ps1') -Directory $destination -BundleTool $BundleTool
Write-Host "AAB candidato gerado: $bundle"
Write-Host 'Concluir privacidade, dados, acesso de revisão, testes físicos e cadastro da Play antes do envio.'
