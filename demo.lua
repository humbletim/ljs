print("_VERSION", _VERSION)

-- NOTE: this is here temporarily to test require/module support...
print('----------- module test -------- ')
print('all args', ...)
print(require'testmodule'.passmex("x"))
require'testmodule2' -- note: does module("test") returning 5
print("package.loaded.testmodule2 = ", package.loaded.testmodule2)
print("test.passme('x') = ",test.passmex("x"))
print('testmodule._NAME:',require'testmodule'._NAME)
print('test._NAME:',test._NAME)
local tmp = ...
print('first arg', tmp)
print('----------- /module test -------- \n')
-- /////////////

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
a:deposit(1000.00)
a:show("after deposit")
a:withdraw(100.00)
a:show("after withdraw")

-- this would raise an error
--[[
b = Account:new(nil,"DEMO")
b:withdraw(100.00)
--]]

