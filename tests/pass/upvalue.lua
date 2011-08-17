local u;
local f = {};
for i=1,2 do
	f[i] = function (set)
		if set then
			u = set;
		end
		return u;
	end;
end

assert(f[1]("foo") == "foo");
assert(f[2]() == "foo");

assert(f[2]("bar") == "bar");
assert(f[1]() == "bar");

