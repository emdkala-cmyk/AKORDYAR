import sys
sys.stdout.reconfigure(encoding="utf-8")
t = open("Akordyar.html","r",encoding="utf-8").read()
lines = t.split(chr(10))
# L369: mixer-close
lines[368] = '        <button class="mixer-close" onclick="toggleMixer()" title="\u0628\u0633\u062A\u0646"><span class="ir-icon" data-ir="\u2715" aria-hidden="true"></span></button>'
# L589: artistSearchClear
lines[588] = '            <button class="asc-clear" id="artistSearchClear" onclick=".value=\'\';archFilterArtists();" aria-label="\u067E\u0627\u06A9 \u06A9\u0631\u062F\u0646"><span class="ir-icon" data-ir="\u2715" aria-hidden="true"></span></button>'
open("Akordyar.html","w",encoding="utf-8").write(chr(10).join(lines))
print("OK")
