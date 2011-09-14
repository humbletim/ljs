# ljs - Lua VM implemented in Javascript

[DEMO #1](http://humbletim.github.com/ljs/demo/demo.html) 
 - ljs w/precompiled sample

[DEMO #2](http://humbletim.github.com/ljs/demo/inbrowser.html)
 - ljs + precompiled [yeuliang](http://yueliang.luaforge.net/)
 
[DEMO #3](http://humbletim.github.com/ljs/demo/codemirror.html)
 - ljs + precompiled [yeuliang](http://yueliang.luaforge.net/) + [codemirror](http://codemirror.net) editor 

note: ljs is bytecode interpreter only
(.lua scripts must be compiled to .luac in advance)
(yeuliang is lua compiler in lua)

originally *ljs-16b833862ae2* from mecurial
  http://code.matthewwild.co.uk/ljs/ :: 
  [16b833862ae2](http://code.matthewwild.co.uk/ljs/rev/16b833862ae2)

### roadmap:

1. put together an example of how to go from lua source code to js-encoded
   bytecode
 * [done -- see Makefile]
2. neutralize node-specific code in lvm.js, so project can run in any web
   browser again
 * [done -- tested in IE6, FF, Chrome, WebKit, Opera]
3. experiment with some [BrowserLua](https://github.com/agladysh/browser-lua) 
   concepts
 * [attempted]
4. make a sandbox'd cgi-bin that takes lua code as input and emits js-encoded
   bytecode (text/javascript)
5. ... that's it for now!

### to run the legacy node-based tests (which should still work)

    bash tests/run.sh
    # -> 32/32 TESTS PASSED

### to build and view the web browser test

    make all 
    firefox demo.html
 
*make all:*

* demo.lua ->
 * demo.lua.output.txt *(build host's lua output, for comparison)* 
 *  .luac *(compiled bytecode)* 
 *  .luac.js *(encoded bytecode as html script include)* 
 *  .lua.src.html *(pretty source for browser)* 

### to build precompiled yeuliang bootstrapping
    # download & extract yeuliang-0.4.1.tar.gz into sibling dir
    make yeualiang.luac.js

#### dependencies

make all: lua / luac (tested with 5.1.4),
  make, bash,
  perl (lua2html.pl for output in browser test),
  node (for running tests)

#### history

On Tue, Jul 20, 2010 at 13:16, Matthew Wild [wrote](http://lua-users.org/lists/lua-l/2010-07/msg00569.html):

>... So I started on my own venture to write a VM in Javascript by hand:
http://code.matthewwild.co.uk/ljs/
 
>Although I haven't had a chance to work on it the past month or so,
it's still under quite heavy development. Much is implemented, except
some of the trivial opcodes, and my current focus is metatables, and
then implementing some of the standard library.

>It's only a VM, which means that scripts either need to be compiled
offline, or someone needs to write a compiler in Lua or Javascript. In
fact (although I haven't looked at it yet) the former has already been
done as far as I know: http://yueliang.luaforge.net/ - so if one
wanted to compile scripts live in the browser, Yueliang could be
compiled offline and run in the VM in the browser to compile them.

>I find all of this much fun :)

>Matthew 

------
#### License (MIT/X11)
see: <http://matthewwild.co.uk/free> ->
  <http://en.wikipedia.org/wiki/MIT_licence>
