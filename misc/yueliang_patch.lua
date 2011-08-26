
-- patch to allow nil as table index
function luaK:nilK(fs)
  local k, v = {}, {}  -- TValue
  self:setnilvalue(v)
  -- xxxxxx cannot use nil as key; instead use table itself to represent nil
  -- easier to, since javascript hash only strings by default...
  -- will end up as old["nil:nil"] below in open_func -t
  self:sethvalue(k, nil)
  return self:addk(fs, k, v)
end

-- patch to avoid javascript limitation on indexes...
local old_luaY_open_func = luaY.open_func
function luaY:open_func(ls, fs)
   old_luaY_open_func(luaY, ls, fs)
   local oldh = fs.h
   fs.h = setmetatable({}, {
				   __index=function(self, key)
							  return oldh[type(key)..":"..tostring(key)]
						   end,
				   __newindex=function(self, key, val)
								 oldh[type(key)..":"..tostring(key)] = val
							  end
				})
end


