print("_VERSION", _VERSION)
print("#arg", #arg)
print("arg[1]", arg[1])
print("...", ...)
print(string.rep("-", 30))
require'testmodule'
print("x:", testmodule.passmex("x"))


local deposit = tonumber(arg[1]) or 1000.00
local withdraw = tonumber(arg[2]) or 100.00

-- account.lua
-- from PiL 1, Chapter 16

Account = {balance = 0, name = "base"}
Account.__index = Account;

function Account:new (o, name)
  o = o or {name=name}
  setmetatable(o, self)
  return o
end

function Account:deposit (v)
  self.balance = self.balance + v
end

function Account:withdraw (v)
  if v > self.balance then error("insufficient funds on account "..self.name) end
  self.balance = self.balance - v
end

function Account:show (title)
  print(title or "", self.name, self.balance)
end

a = Account:new(nil,"demo")
a:show("after creation")
a:deposit(deposit)--1000.00)
a:show("after deposit")
a:withdraw(withdraw)--100.00)
a:show("after withdraw")

-- this would raise an error
--[[
b = Account:new(nil,"DEMO")
b:withdraw(100.00)
--]]

