import sys
t = open("Akordyar.html","r",encoding="utf-8").read()
lines = t.split(chr(10))
lines = lines[:1106]
lines[1005] = '            <span class="nav-ic"><span class="ir-icon" data-ir="\U0001F4C2" aria-hidden="true"></span></span>'
open("Akordyar.html","w",encoding="utf-8").write(chr(10).join(lines))
print("OK")
