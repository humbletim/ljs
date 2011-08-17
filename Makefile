define LUAC2JS
-- quick bytecode-to-javascript encoder
-- javascript: BrowserLua.provideFile("demo.luac","<bytecode>");
-- TODO: put somewhere else

local bc = io.open("demo.luac","rb"):read("*all")

io.write[[
BrowserLua.provideFile("demo.luac",
"]]

for i in bc:gmatch(".") do
   io.write(string.format("\\x%02x", i:byte(1)))
end

io.write[[");
]]
-- 
endef
export LUAC2JS

all: demo.html

demo.html: demo.luac.js demo.lua.output.txt demo.lua.src.html

demo.luac.js: demo.luac
	lua -e "$$LUAC2JS" > demo.luac.js

demo.luac: demo.lua
	luac -o demo.luac demo.lua

demo.lua.output.txt: demo.lua
	lua demo.lua > demo.lua.output.txt 2>&1 || true

demo.lua.src.html: demo.lua
	perl util/lua2html.pl demo.lua > demo.lua.src.html

test:
	bash tests/run.sh

clean:
	rm -v luac.out demo.luac demo.luac.js demo.lua.output.txt demo.lua.src.html
