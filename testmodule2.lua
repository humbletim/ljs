-- another test case for require/module support
module("test", package.seeall) -- note hard-coded module name for test...

function _M.passmex(x)
   assert(x == "x")
   return _M._NAME ..":" .. x
end

-- return _M -- recommended

-- do ppl still create modules this way? works per PIL...
-- assumes loaded via require'testmodule2'
package.loaded['testmodule2'] = _M 
return 5 