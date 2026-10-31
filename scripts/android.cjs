const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
process.chdir(root);
const firebaseSource=path.resolve(root,'../.private/firebase/google-services.json');
if(fs.existsSync(firebaseSource)){
  const firebase=JSON.parse(fs.readFileSync(firebaseSource,'utf8').replace(/^\uFEFF/,''));
  if(!firebase.client?.some(c=>c.client_info?.android_client_info?.package_name==='com.doceatelie.gourmet'))throw Error('O Firebase precisa usar o pacote com.doceatelie.gourmet.');
  fs.copyFileSync(firebaseSource,'android/app/google-services.json');
}
function run(args) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
run(['scripts/build.cjs']);
const cli = 'node_modules/@capacitor/cli/bin/capacitor';
if (!fs.existsSync(cli)) throw Error('Execute npm install antes de preparar o Android.');
if (!fs.existsSync('android')) run([cli, 'add', 'android']);
run([cli, 'sync', 'android']);
const manifestPath='android/app/src/main/AndroidManifest.xml';
let manifest=fs.readFileSync(manifestPath,'utf8');
if(!manifest.includes('android.permission.CAMERA')){
  manifest=manifest.replace('</manifest>','    <uses-permission android:name="android.permission.CAMERA" />\n    <uses-feature android:name="android.hardware.camera" android:required="false" />\n</manifest>');
  fs.writeFileSync(manifestPath,manifest);
}
const release = JSON.parse(fs.readFileSync('release.json', 'utf8'));
const gradlePath = 'android/app/build.gradle';
const gradle = fs.readFileSync(gradlePath, 'utf8');
if (!/versionCode\s+\d+/.test(gradle) || !/versionName\s+"[^"]+"/.test(gradle)) throw Error('Versão Gradle não encontrada');
fs.writeFileSync(gradlePath, gradle.replace(/versionCode\s+\d+/, 'versionCode ' + release.code).replace(/versionName\s+"[^"]+"/, 'versionName "' + release.version + '"'));

// Keep the ignored/generated Android project reproducible on each machine.
const nativeBuild=JSON.parse(fs.readFileSync('android-build.json','utf8'));
const variablesPath='android/variables.gradle';
let variables=fs.readFileSync(variablesPath,'utf8');
for(const [field,value] of [['compileSdkVersion',nativeBuild.compileSdk],['targetSdkVersion',nativeBuild.targetSdk]]){
 const pattern=new RegExp(field+'\\s*=\\s*\\d+');
 if(!pattern.test(variables))throw Error('Configuração Android ausente: '+field);
 variables=variables.replace(pattern,field+' = '+value);
}
fs.writeFileSync(variablesPath,variables);
const topBuildPath='android/build.gradle';
let topBuild=fs.readFileSync(topBuildPath,'utf8');
const pluginPattern=/com\.android\.tools\.build:gradle:[0-9.]+/;
if(!pluginPattern.test(topBuild))throw Error('Plugin Gradle Android não encontrado');
fs.writeFileSync(topBuildPath,topBuild.replace(pluginPattern,'com.android.tools.build:gradle:'+nativeBuild.androidGradlePlugin));

// Native insets are owned by the versioned activity, not by individual store pages.
fs.copyFileSync('android-src/MainActivity.java','android/app/src/main/java/com/doceatelie/gourmet/MainActivity.java');
