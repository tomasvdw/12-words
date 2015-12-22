#!/bin/python

import re

with open('web/index.html', 'r') as f:
    content = f.read()

scontent = '';
ccontent = ''

rx= re.finditer(r"script src=\"(.+)\"", content, flags=re.MULTILINE)
for m in rx:
    print("OK")
    print(m.group(1))
    with open('web/'+str(m.group(1)), 'r') as f:
        scontent = scontent + f.read()


with open('web/style.css', 'r') as f:
    ccontent = f.read()


content = re.sub(r"\n[^\n]+script src[^\n]+", "", content, 0, flags=re.MULTILINE)
content = re.sub(r"\n[^\n]+stylesheet\" href[^\n]+", "", content, 0, flags=re.MULTILINE)


with open("web/all.js", "w"):

content = content.replace("<!-- SCRIPTS -->", 
  '<script src="all.js"></script>')

content =content.replace("<!-- STYLE -->", 
   "<style>\n"+ccontent+"</style>")

with open("web/all.html", "w") as f:
    f.write(content)




