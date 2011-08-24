lua_assert = function(x) assert(x) end
luaX:init()

module(..., package.seeall)

function _M.compilestring(lua, name)
   local zio = luaZ:init(luaZ:make_getS(lua), nil)
   local func = luaY:parser({}, zio, nil, name or "=mluac.compilestring")
   local writer, buff = luaU:make_setS()
   luaU:dump({}, func, writer, buff)
   return buff.data
end

return _M