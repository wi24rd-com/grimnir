#!/bin/sh
# signer.sh – Grimnir signeret med Developer ID, notariseret og hæftet, med fast signeringstid (V-SIGN.1).
#
#   sh tools/signer.sh proeve [--toer]               # debug-bundle, Developer ID, hardened runtime, UDEN tidsstempel
#   sh tools/signer.sh udgiv [--toer] [--uden-vagt]  # release: bygning uden navne, signering, notarisering, hæftning
#   sh tools/signer.sh tjek <sti til .app> [--toer]  # kun kontrollerne, ingen signering
#   sh tools/signer.sh planlaeg|afplanlaeg|status [--toer]   # launchd kører udgiv kl. 23:30, til det er lykkedes
#   --toer: tørkørsel. Skriver kommandoerne (linjer med "+ "), kører dem ikke, skriver intet til disken.
#
# Identitet: $APPLE_SIGNING_IDENTITY, ellers identitet=… i tools/signer.lokal (git-ignoreret), ellers Developer ID nedenfor.
# Notarisering: Nøglering-profilen grimnir-notary (profil=… i signer.lokal). Ingen adgangskode i filer, miljø eller log.
# Udgivelser og notariseringslog: udgivelser=… i signer.lokal, ellers ~/Grimnir-udgivelser (aldrig i repoet).
# Klokkeslæt: git config fasttid.klokken (som tools/fast-tid.sh, standard 23:30:00) · vindue: git config signer.vindue
# (minutter, standard 30). udgiv nægter at signere og indsende uden for vinduet; Apples tidsstempel kan ikke vælges.
# Er Mac'en i dvale kl. 23:30, kører launchd jobbet ved næste opvågning; så er vinduet lukket, og der prøves igen
# næste aften. Kun macOS.
set -eu

ROD=$(cd "$(dirname "$0")/.." && pwd -P)
ENT="$ROD/src-tauri/Grimnir.entitlements"
STANDARD_IDENTITET="Developer ID Application: Jan Tingsvad (5DAVNFA355)"
STANDARD_PROFIL="grimnir-notary"

fejl() { echo "signer: $*" >&2; exit 1; }
trin() { echo "== $*"; }
lokal() { # $1 = nøgle → sidste værdi i tools/signer.lokal (læses som tekst, køres aldrig)
  f="$ROD/tools/signer.lokal"
  [ -f "$f" ] || return 0
  sed -n "s/^$1=//p" "$f" | tail -n 1
}

TOER=0; UDEN_VAGT=0; MAAL=""
TILSTAND=${1:-}
[ $# -gt 0 ] && shift
for a in "$@"; do
  case $a in
    --toer) TOER=1 ;;
    --uden-vagt) UDEN_VAGT=1 ;;
    -*) fejl "ukendt flag: $a" ;;
    *) [ -z "$MAAL" ] || fejl "for mange argumenter: $a"; MAAL=$a ;;
  esac
done

IDENTITET=${APPLE_SIGNING_IDENTITY:-$(lokal identitet)}
IDENTITET=${IDENTITET:-$STANDARD_IDENTITET}
PROFIL=$(lokal profil); PROFIL=${PROFIL:-$STANDARD_PROFIL}
UD=$(lokal udgivelser); UD=${UD:-$HOME/Grimnir-udgivelser}
case "$UD/" in "$ROD"/*) fejl "udgivelser=$UD ligger i repoet; vælg en mappe uden for $ROD" ;; esac

# ---- tørkørsel: én funktion kører eller skriver hver kommando ----
vis() { # skriver argumenterne som en kommandolinje, med anførselstegn hvor det trænger
  printf '+'
  for x in "$@"; do
    case $x in
      ''|*[!A-Za-z0-9_./:=,+@%-]*) printf " '%s'" "$x" ;;
      *) printf ' %s' "$x" ;;
    esac
  done
  printf '\n'
}
koer() { if [ "$TOER" = 1 ]; then vis "$@"; else "$@"; fi; }
saet() { # $1 = navn, $2 = værdi, $3 = visning (valgfri) → export
  export "$1=$2"
  echo "+ export $1=${3:-$2}"
}

# ---- klokkeslæt og vindue ----
heltal() { t=$1; while [ "${t#0}" != "$t" ]; do t=${t#0}; done; echo "${t:-0}"; }
KLOKKEN=$(git -C "$ROD" config --get fasttid.klokken 2>/dev/null || echo "23:30:00")
case $KLOKKEN in
  [0-2][0-9]:[0-5][0-9]) KLOKKEN="$KLOKKEN:00" ;;
  [0-2][0-9]:[0-5][0-9]:[0-5][0-9]) ;;
  *) fejl "fasttid.klokken skal være TT:MM eller TT:MM:SS (fik $KLOKKEN)" ;;
esac
K_T=$(heltal "$(echo "$KLOKKEN" | cut -d: -f1)")
K_M=$(heltal "$(echo "$KLOKKEN" | cut -d: -f2)")
K_S=$(echo "$KLOKKEN" | cut -d: -f3)
[ "$K_T" -le 23 ] || fejl "fasttid.klokken: timen skal være 00-23 (fik $KLOKKEN)"
VINDUE=$(git -C "$ROD" config --get signer.vindue 2>/dev/null || echo 30)
case $VINDUE in ''|*[!0-9]*) fejl "signer.vindue skal være et antal minutter (fik $VINDUE)" ;; esac
FRA=$(( K_T * 60 + K_M )); TIL=$(( FRA + VINDUE ))

nu_min() { echo $(( $(heltal "$(date +%H)") * 60 + $(heltal "$(date +%M)") )); }
i_vinduet() { # 0 hvis nu ligger i [klokken, klokken + vindue), også hen over midnat
  n=$(nu_min)
  { [ "$n" -ge "$FRA" ] && [ "$n" -lt "$TIL" ]; } || { [ "$TIL" -gt 1440 ] && [ "$n" -lt $(( TIL - 1440 )) ]; }
}
hhmm() { printf '%02d:%02d' $(( ($1 / 60) % 24 )) $(( $1 % 60 )); }
# Den faste tid til filtider: dagens dato + klokkeslættet (gårsdagens, hvis vinduet er gået hen over midnat).
if [ "$(nu_min)" -lt "$FRA" ] && [ "$TIL" -gt 1440 ] && [ "$(nu_min)" -lt $(( TIL - 1440 )) ]; then
  DAG=$(date -v-1d +%Y%m%d)
else
  DAG=$(date +%Y%m%d)
fi
TS=$(printf '%s%02d%02d.%s' "$DAG" "$K_T" "$K_M" "$K_S")   # touch -t CCYYMMDDhhmm.SS

vagt() { # $1 = hvad der skal ske nu
  if i_vinduet; then return 0; fi
  if [ "$UDEN_VAGT" = 1 ]; then
    echo "signer: ADVARSEL: $1 uden for vinduet $(hhmm "$FRA")-$(hhmm "$TIL") (--uden-vagt). Apples tidsstempel og notariseringen viser det rigtige klokkeslæt." >&2
    return 0
  fi
  fejl "$1 stoppet: udgiv kører kun i vinduet $(hhmm "$FRA")-$(hhmm "$TIL"), og klokken er $(date +%H:%M). Planlæg: sh tools/signer.sh planlaeg · bevidst nu: --uden-vagt (røber tidspunktet)"
}

# ---- byggeklodser ----
version() { plutil -extract version raw -o - "$ROD/src-tauri/tauri.conf.json"; }

filtider() { # $1 = sti → alle filtider (også mapper og links) sættes til den faste tid
  koer find "$1" -exec touch -h -t "$TS" '{}' +
}

tjek_filtider() { # $1 = sti → fejler, hvis en filtid ikke har det faste klokkeslæt
  if [ "$TOER" = 1 ]; then echo "+ (kontrol) alle filtider i $1 har klokkeslættet $KLOKKEN"; return 0; fi
  forkerte=$(find "$1" -exec stat -f '%Sm' -t '%H:%M:%S' '{}' + | grep -v -c -x -F "$KLOKKEN" || true)
  [ "$forkerte" = 0 ] || fejl "$forkerte filtid(er) i $1 har ikke klokkeslættet $KLOKKEN"
  echo "filtider: alle har klokkeslættet $KLOKKEN"
}

tjek_navne() { # $1 = sti → fejler, hvis brugernavn, hjemmemappe eller maskinnavn står i en fil (værdierne skrives ikke)
  if [ "$TOER" = 1 ]; then echo "+ (kontrol) intet brugernavn, ingen hjemmemappe og intet maskinnavn i $1"; return 0; fi
  fundet=0
  for par in "brugernavnet=$(id -un)" "hjemmemappen=$HOME" "maskinnavnet=$(hostname -s 2>/dev/null || true)" \
             "computernavnet=$(scutil --get ComputerName 2>/dev/null || true)" \
             "værtsnavnet=$(scutil --get LocalHostName 2>/dev/null || true)"; do
    navn=${par%%=*}; vaerdi=${par#*=}
    [ -n "$vaerdi" ] || continue
    # Under 4 tegn (fx et generisk "Mac") rammer det dele af andre ord ("macOS") og siger intet om maskinen.
    if [ "${#vaerdi}" -lt 4 ]; then echo "navne: $navn har under 4 tegn og måles ikke"; continue; fi
    filer=$(LC_ALL=C grep -r -a -l -F -- "$vaerdi" "$1" || true)
    if [ -n "$filer" ]; then
      fundet=1
      echo "$filer" | while read -r f; do echo "signer: $navn står i ${f#"$1"/}" >&2; done
    fi
  done
  [ "$fundet" = 0 ] || fejl "navne i bygningen (se ovenfor); intet er signeret"
  echo "navne: intet brugernavn, ingen hjemmemappe og intet maskinnavn i bundlen"
}

kontrol() { # $1 = sti til .app
  koer codesign --verify --deep --strict --verbose=2 "$1"
  koer spctl -a -vv "$1"
  koer xcrun stapler validate "$1"
}

zip_af() { # $1 = .app, $2 = zip-fil → ditto uden udvidede attributter, og zip-filens egen tid sættes
  filtider "$1"
  koer ditto -c -k --norsrc --noextattr --noqtn --noacl --keepParent "$1" "$2"
  filtider "$2"
}

notariser() { # $1 = zip-fil
  if [ "$TOER" = 1 ]; then
    vis xcrun notarytool submit "$1" --keychain-profile "$PROFIL" --wait --output-format json
    echo "+ (status læses fra svaret; ved andet end Accepted hentes loggen, og scriptet stopper med exit 1)"
    vis xcrun notarytool log '<id>' --keychain-profile "$PROFIL" "$UD/notarisering-<id>.json"
    return 0
  fi
  svar="$UD/notarisering-svar.json"
  rc=0
  xcrun notarytool submit "$1" --keychain-profile "$PROFIL" --wait --output-format json > "$svar" || rc=$?
  status=$(plutil -extract status raw -o - "$svar" 2>/dev/null || echo ukendt)
  id=$(plutil -extract id raw -o - "$svar" 2>/dev/null || true)
  echo "notarisering: status=$status id=${id:-ingen} (notarytool exit $rc)"
  if [ -n "$id" ]; then
    log="$UD/notarisering-$id.json"
    if xcrun notarytool log "$id" --keychain-profile "$PROFIL" "$log"; then echo "notariseringslog: $log"; fi
  fi
  [ "$status" = Accepted ] || fejl "notariseringen er ikke godkendt (status $status). Loggen ligger i $UD. Intet er hæftet."
}

byg_release() {
  us=$(printf '\037')
  cargo_hjem=${CARGO_HOME:-$HOME/.cargo}; rustup_hjem=${RUSTUP_HOME:-$HOME/.rustup}
  # Sidste matchende omskrivning vinder (rustc-bogen, "Remap source paths"), så den mest specifikke står sidst.
  rf="--remap-path-prefix=$HOME=/home${us}--remap-path-prefix=$cargo_hjem=/cargo${us}--remap-path-prefix=$rustup_hjem=/rustup${us}--remap-path-prefix=$ROD=/grimnir"
  saet APPLE_SIGNING_IDENTITY "$IDENTITET"
  saet SOURCE_DATE_EPOCH "$(date -j -f %Y%m%d%H%M.%S "$TS" +%s)"
  saet CARGO_ENCODED_RUSTFLAGS "$rf" "$(printf '%s' "$rf" | tr "$us" ' ')"
  koer npm run tauri build -- --no-sign
}

# ---- tilstande ----
proeve() {
  cd "$ROD"
  app="$ROD/target/debug/bundle/macos/Grimnir.app"
  trin "prøvebygning: $IDENTITET, hardened runtime, uden tidsstempel, uden notarisering"
  saet APPLE_SIGNING_IDENTITY "$IDENTITET"
  koer npm run tauri build -- --debug --no-sign
  [ "$TOER" = 1 ] || [ -d "$app" ] || fejl "bundlen findes ikke: $app"
  koer xattr -cr "$app"
  koer codesign --force --sign "$IDENTITET" --options runtime --entitlements "$ENT" --timestamp=none "$app"
  koer codesign --verify --strict --verbose=2 "$app"
  koer codesign -dv "$app"
  koer codesign -d -r- "$app"
}

udgiv() {
  vagt "udgiv"
  [ "$TOER" = 1 ] || mkdir -p "$UD"
  cd "$ROD"
  v=$(version)
  app="$ROD/target/release/bundle/macos/Grimnir.app"
  trin "udgivelse $v: fast tid $TS, identitet $IDENTITET, profil $PROFIL, ud: $UD"
  byg_release
  [ "$TOER" = 1 ] || [ -d "$app" ] || fejl "bundlen findes ikke: $app"
  tjek_navne "$app"
  koer xattr -cr "$app"
  filtider "$app"
  vagt "signering"
  koer codesign --force --sign "$IDENTITET" --options runtime --entitlements "$ENT" --timestamp "$app"
  koer codesign --verify --strict --verbose=2 "$app"
  indsend="$UD/Grimnir-$v-til-notarisering.zip"
  zip_af "$app" "$indsend"
  vagt "notarisering"
  notariser "$indsend"
  koer xcrun stapler staple "$app"
  filtider "$app"
  trin "kontrol"
  tjek_filtider "$app"
  kontrol "$app"
  slut="$UD/Grimnir-$v.zip"
  zip_af "$app" "$slut"
  koer rm -f "$indsend"
  trin "færdig: $slut"
}

tjek() {
  [ -n "$MAAL" ] || fejl "brug: sh tools/signer.sh tjek <sti til .app> [--toer]"
  [ "$TOER" = 1 ] || [ -d "$MAAL" ] || fejl "findes ikke: $MAAL"
  koer codesign -dvv "$MAAL"
  tjek_navne "$MAAL"
  tjek_filtider "$MAAL"
  kontrol "$MAAL"
}

etiket() { echo "com.wi24rd.signer.$(basename "$ROD" | tr 'A-Z' 'a-z' | tr -c 'a-z0-9\n' '-')"; }
plist() { echo "$HOME/Library/LaunchAgents/$(etiket).plist"; }
logfil() { echo "$HOME/Library/Logs/$(etiket).log"; }
plist_indhold() {
  cat <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$(etiket)</string>
  <key>ProgramArguments</key>
  <array><string>/bin/sh</string><string>$ROD/tools/signer.sh</string><string>koer</string></array>
  <key>WorkingDirectory</key><string>$ROD</string>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$PATH</string></dict>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>$K_T</integer><key>Minute</key><integer>$K_M</integer></dict>
  <key>RunAtLoad</key><false/>
  <key>StandardOutPath</key><string>$(logfil)</string>
  <key>StandardErrorPath</key><string>$(logfil)</string>
</dict>
</plist>
PLIST
}

planlaeg() {
  [ "$(uname)" = "Darwin" ] || fejl "kun macOS (launchd)"
  p=$(plist)
  if [ "$TOER" = 1 ]; then
    echo "+ cat > '$p' <<PLIST"; plist_indhold; echo "PLIST"
  else
    mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
    plist_indhold > "$p"
  fi
  if [ "$TOER" = 1 ]; then vis launchctl bootout "gui/$(id -u)/$(etiket)"; else launchctl bootout "gui/$(id -u)/$(etiket)" 2>/dev/null || true; fi
  koer launchctl bootstrap "gui/$(id -u)" "$p"
  echo "planlagt: udgiv kl. $(hhmm "$FRA") (vindue $VINDUE min), indtil det lykkes. Log: $(logfil)"
}

afplanlaeg() {
  if [ "$TOER" = 1 ]; then vis launchctl bootout "gui/$(id -u)/$(etiket)"; else launchctl bootout "gui/$(id -u)/$(etiket)" 2>/dev/null || true; fi
  koer rm -f "$(plist)"
  echo "afplanlagt: $(etiket)"
}

status() {
  if [ -f "$(plist)" ]; then p=planlagt; else p="ikke planlagt"; fi
  if launchctl print "gui/$(id -u)/$(etiket)" >/dev/null 2>&1; then l=indlæst; else l="ikke indlæst"; fi
  echo "job:       $(etiket) ($p, $l)"
  echo "vindue:    $(hhmm "$FRA")-$(hhmm "$TIL") ($( i_vinduet && echo åbent nu || echo lukket nu ))"
  echo "identitet: $IDENTITET"
  echo "profil:    $PROFIL"
  echo "ud:        $UD"
  if [ -f "$(logfil)" ]; then echo "log:       $(logfil), sidste linjer:"; tail -n 5 "$(logfil)"; fi
}

koer_job() { # kaldes af launchd: udgiv i en ny proces (så set -e gælder fuldt), og afplanlæg efter succes
  echo "== launchd $(date '+%Y-%m-%d %H:%M')"
  if sh "$ROD/tools/signer.sh" udgiv; then
    echo "udgiv lykkedes; jobbet fjernes"
    rm -f "$(plist)"
    launchctl bootout "gui/$(id -u)/$(etiket)" 2>/dev/null || true
  else
    echo "udgiv lykkedes ikke; jobbet prøver igen kl. $(hhmm "$FRA")"
    exit 1
  fi
}

case $TILSTAND in
  proeve) proeve ;;
  udgiv) udgiv ;;
  tjek) tjek ;;
  planlaeg) planlaeg ;;
  afplanlaeg) afplanlaeg ;;
  status) status ;;
  koer) koer_job ;;
  *) sed -n '2,16p' "$0"; exit 1 ;;
esac
