package.preload.themodule = function(name)
							   print("preload called for: ", name)
							   return {
								  afunc = function(x) return x .. x end
							   }
							end

assert(not themodule)
print(require'themodule')
assert(require'themodule'.afunc)
