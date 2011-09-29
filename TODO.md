### FUTURE ROADMAP -- a possibility
TODO: Create support for and tutorials showing:

#### 1. How to bootstrap LJS into an existing JavaScript environment

```javascript
    // packaging LJS w/compiler as a CommonJS module
    var ret = require('ljs.lua').eval('return [[demo]]');
    
    // packaging Lua modules as a self-contained CommonJS modules
    var myapi = require('myluamodule');
    alert(myapi.method('arg'));
```
#### 2. How to map JavaScript APIs into LJS Lua

```lua
    -- DOM - document, window, etc.
    local div = require'domglue'.document.getElemenById('output')
    div.innerHTML = [[<i> hi from lua </i>]]
    
     -- HTML5 Canvas
    local canvas = require'domglue.canvas'.byId('mycanvas')
    local ctx = canvas.getContext('2d')
    function circle(x,y,r)
      ctx.beginPath()
      ctx.arc(x,y,r,0,math.pi*2,true)
      ctx.stroke()
    end
    circle(50,50,10)
```    

* show how to use Firebug and profiling to identify performance issues
* integrate http://www.timdown.co.uk/jshashtable/ to support full objects as table keys
