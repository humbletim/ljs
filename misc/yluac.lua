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

assert(arg and arg[1], "usage: node lvm.js <luafile>...")
local lua = io.open and io.open(arg[1],"rb"):read("*all") 
local zio = luaZ:init(luaZ:make_getS(lua), nil)
local func = luaY:parser({}, zio, nil, "@"..arg[1])
local writer, buff = luaU:make_setS()
luaU:dump({}, func, writer, buff)
io.write(buff.data)
