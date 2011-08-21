local t = {}

t[1] = 1
assert(#t == 1)

t[0] = 0
assert(t[0] and #t == 1)

t[5.5] = t
assert(t[5.5] == t)

--assert(t["5.5"] == nil) -- not yet, still figuring out js-side of tables 
