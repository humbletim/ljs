local ret = 0
for i = 1, 10 do
   print("counting to 10...", i)
   ret = ret + i
end
assert(ret == 55, ret)

ret=0
for i = 1, 10,2 do
   print("counting to 10 by 2...", i)
   ret = ret + i
end

assert(ret == 25, ret)

ret=0
for i = 10, 1, -1 do
   print("counting down from 10...", i)
   ret = ret + i
end
assert(ret == 55, ret)
print(i)