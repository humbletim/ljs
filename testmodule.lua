-- test case for require/module support
local assert = assert
local type = type
local random = math.random
global = _G
local G = _G
module(...)

assert(not global)
assert(G.type == type)
assert(string == nil)
assert(table == nil)
assert(_G == nil)
assert(type(random) == 'function')
function _M.passmex(x)
   assert(x == "x")
   return _NAME ..":" .. x
end
assert(_M.passmex)
assert(passmex)
return _M