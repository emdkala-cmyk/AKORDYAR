import sys
sys.stdout.reconfigure(encoding="utf-8")
t=open("Akordiar.html","r",encoding="utf-8").read()
lines=t.split(chr(10))
lines[368]="        <button class=\"mixer-close\" onclick=\"toggleMixer()\" title=\"\u0628\u0633\u062A\u0646\"><span class=\"ir-icon\" data-ir=\"\u2715\" aria-hidden=\"true\"></span></button>"
lines[588]="            <button class=\"asc-clear\" id=\"artistSearchClear\" onclick=\"\$(\'artistSearchInput\').value=\'\';archFilterArtists();\" aria-label=\"\u067E\u0627\u06A9 \u06A9\u0627\u0646\u0628\"><span class=\"ir-icon\" data-ir=\"\u2715\" aria-hidden=\"true\"></span></button>"
open("Akordiar.html","w",encoding="utf-8").write(chr(10).join(lines))
print("OK")