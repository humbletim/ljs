# ljs - Lua VM implemented in Javascript

* This is the Lua VM / core only.  See [TBD] for example integrations.

* [OLD DEMO](http://humbletim.github.com/ljs/demo/codemirror.html)
 (ljs + precompiled [yeuliang](http://yueliang.luaforge.net/) + [codemirror](http://codemirror.net) editor)

note: ljs itself is bytecode loader / interpreter only
(.lua scripts must be compiled to .luac in advance)

### to run the node-based tests

    make test 
    # -> M/N TESTS PASSED

#### dependencies

node (for running tests)

#### history

originally *ljs-16b833862ae2* from mecurial
  http://code.matthewwild.co.uk/ljs/ :: 
  [16b833862ae2](http://code.matthewwild.co.uk/ljs/rev/16b833862ae2)

------
#### License (MIT/X11)
