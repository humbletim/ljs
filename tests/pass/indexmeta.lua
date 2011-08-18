local t = setmetatable({ name="test" },
	{ 
	   __index=function(self, k)
				  if k == "metaname" then return "fromindex" end
				  if k == "tabval" then return {1234} end
			   end,
	})

assert(t.metaname == "fromindex")
--assert(#t.tabval == 1, #t.tabval)
assert(t.tabval[1] == 1234)
