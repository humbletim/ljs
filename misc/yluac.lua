-- this is baked into modluac.lua for yueliang testing
--DEBUG=true
if DEBUG then
   local _luaK = luaK
   
   luaK = setmetatable({},
					   {
						  __index=function(self, k)
									 print("luaK", k)
									 return _luaK[k]
								  end
					   })

end
   

lua_assert = function(x) assert(x) end
luaX:init()
failing = [[
local ret = ""
for k,v in pairs({1,'a',3}) do
   ret = ret .. k .. ":" .. v .. "|"
end
assert(ret == "1:1|2:a|3:3|", ret)
print(ret)
]] 

-- make modluac && luac modluac.lua && node lvm.js | lua
working = [[
   local t = {name="test"}
   
   print("hi:"..t.name)
]]

assert(arg and arg[1], "usage: node lvm.js <luafile>...")
lua = io.open and io.open(arg[1],"rb"):read("*all") 
local zio = luaZ:init(luaZ:make_getS(lua), nil)
local func = luaY:parser({}, zio, nil, arg and "@"..arg[1] or "@yluacx")
local writer, buff = luaU:make_setS()
luaU:dump({}, func, writer, buff)
io.write(buff.data)
