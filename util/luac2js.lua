-- quick bytecode-to-javascript encoder
-- javascript: BrowserLua.provideFile("demo.luac","<bytecode>");
-- TODO: accept wrapper template (BrowserLua, etc.) as arg...

local bc = assert(io.open(arg[1], "rb")):read("*all")
local wrap = math.huge --80-5

io.write('/* luac2js '..arg[1]..' @ '..os.date()..' */\n');

io.write('BrowserLua.provideFile("'..arg[1]..'",\n"')

local n = 0
for i in bc:gmatch(".") do
   local s = string.format("\\x%02x", i:byte(1))
   io.write(s)
   n = n + #s
   if n > wrap-2 then
	  io.write('"+\n"')
	  n = 0 
   end
end

io.write('");\n')
