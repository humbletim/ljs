/** @license
ljs - Lua VM in JavaScript
ljs.module51.js - package/require/module - Lua 5.1 style
Copyright (c) 2011 Tim Dedischew 
portions Copyright (c) 2006-2008 Lua.org, PUC-Rio
MIT license
*/

(function(exports) {
  var sys = require('sys');

  function luaopen_module51(testvm, _G) {
	_G = _G || testvm.LValue([]);
	_G.setIndex(testvm.LValue("_MODULE_VERSION"), testvm.LValue("5.1 experimental"));
  // -----------------------------------------
  /* experimental module/require support */

  var modlog = sys.debug || function(){};//sys.puts
  var modlogV = sys.debug || function(){};//sys.puts
	var _G_package = testvm.registerLib(_G, "package", { 
	seeall: "seeall",
	loaded: [],
	preload: []
  });
 

	function _getPackageObs() {
	  return _G_package.value; /*{ 
		loaded: _G_package.index(testvm.LValue("loaded")),
		preload: _G_package.index(testvm.LValue("preload")),
		loaders: _G_package.index(testvm.LValue("loaders")),
	};*/
	}

	/*= http://www.lua.org/manual/5.1/manual.html#pdf-package.loaders
	  Copyright (c) 2006-2008 Lua.org, PUC-Rio [Lua license]
	  
	  package.loaders
	  
	  A table used by require to control how to load modules.
	
	  Each entry in this table is a searcher function. When looking for a module, require calls each of these searchers in ascending order, with the module name (the argument given to require) as its sole parameter. The function can return another function (the module loader) or a string explaining why it did not find that module (or nil if it has nothing to say). */
	var loaders = {
	  1: function(name) {
		  var loader = _G_package.index(testvm.LValue("preload")).index(name);
		  if (loader.type == 'function')
			return [loader];
		  return [testvm.LValue("no field package.preload['"+name+"']")];
		}
	};

	testvm.registerLib(_G_package, "loaders", loaders);
  //= module() -- faithfully implemented against lua.org manual -t
	function lua_module(name, opt) {
	if (!name || name.type != 'string') 
	  throw "bad argument #1 to 'module' (string expected, got "+
		(name?name.type:"no")+" value)"; 

	modlog("module('"+name+"', "+opt+")");
	  var _package = _getPackageObs();//{ loaded: _G._package_loaded };
	var G = this.callstack[this.callstack.length-1].f.environment;
	if (G != _G)
	  throw "ljs.module only supports top-level modules (_G == VM._G!)"

	/*= http://www.lua.org/manual/5.1/manual.html#5.3
	   Copyright (c) 2006-2008 Lua.org, PUC-Rio [Lua license]
	   module (name [, ...])
	   Creates a module. */

	/*= If there is a table in package.loaded[name],
	        this table is the module. */
		  var t = _package.loaded.index(name);

	if (t.type == 'nil') {
	  /*= Otherwise, if there is a global table t with the given name,
          this table is the module.  */
	  t = _G.index(name);
	}
	
	if (t.type == 'nil') {
	  /*= Otherwise creates a new table t
		 and sets it as the value of the global name
		 and the value of package.loaded[name]. */
	  t = this.LValue([]);
	  _G.setIndex(name, t);
		_package.loaded.setIndex(name, t);
	}

	/*= This function also initializes t._NAME with the given name, 
	   t._M with the module (t itself),
	   and t._PACKAGE with the package name 
	   (the full module name minus last component; see below).  */

	t.setIndex(this.LValue("_NAME"), name);
	t.setIndex(this.LValue("_M"), t);
	//= TODO: t.setIndex(this.LValue("_PACKAGE", ...

	/*= Finally, module sets t as the new environment of the current function
      and the new value of package.loaded[name], so that require returns t.*/
	
	this.callstack[this.callstack.length-1].f.environment = t;

	  _package.loaded.setIndex(name, t);

	/*= TODO: If name is a compound name (that is, one with components separated by dots), module creates (or reuses, if they already exist) tables for each component. For instance, if name is a.b.c, then module stores the module table in field c of field b of global a. */

	/*= TODO: This function can receive optional options after the module
	  name, where each option is a function to be applied over the module. */

	if (opt && opt.type != 'nil' && opt.value != 'seeall')
	  throw "ljs.module: package.seeall only supported"+
		" (optional) second parameter to module() ["+opt+"]";

	//= /lua.org

	// VERIFY: does lua copy values over as well?
 	if (opt && opt.value == "seeall") {
	  for (var p in _G.value) {
		//sys.puts("_G."+p+" -> _M."+p);
		p = this.LValue(p);
		t.setIndex(p, _G.index(p));
	  }
	}

	return [];
	}

  // require() -- faithfully implemented against lua.org manual -t
	function lua_require(modname) {
	  var _package = _getPackageObs();
	
	/*= http://www.lua.org/manual/5.1/manual.html#pdf-require
	   Copyright (c) 2006-2008 Lua.org, PUC-Rio [Lua license]
	   require (modname)

	   Loads the given module. */

	/*= The function starts by looking into the package.loaded table to
	   determine whether modname is already loaded. */
	
	  var value = _package.loaded.index(modname);

	/*= If it is, then require returns the value stored at
	    package.loaded[modname]. */

	if (value.type != 'nil')
	  return [value];

	  /*=  Otherwise, it tries to find a loader for the module.
           To find a loader, require is guided by the package.loaders array.
           By changing this array, we can change how require looks for a module. */
	  var errors = [];
	  var loader = testvm.LValue(null);
	  for(var i=1; i <= _package.loaders.len(); i++) {
		var _search = _package.loaders.index(testvm.LValue(i));
// 		sys.puts("trying package.loaders["+i+"]: " + _search);
		if (!_search || _search.type != 'function')
		  throw "package.loaders["+i+"] invalid type: "+(_search?_search.type:'null');

		var _ret = (_search.call([modname])||[])[0];
// 		sys.puts("package.loaders["+i+"] returned " + _ret);
		if (!_ret || _ret.type == 'nil')
		  continue;
		if (_ret.type == 'string') {
		  errors.push("\t"+_ret.toString());
		  continue;
		}
		if (_ret.type == 'function') {
		  loader = _ret;
		  break;
		}
		throw "invalid searcher (package.loaders["+i+"]) retval:"+typeof _ret+"/"+_ret.type;
	  }



	if (loader.type == 'nil') {

	  throw "module '"+modname+"' not found:\n"+
		  errors.join("\n")
	}

	/*= Once a loader is found,
    	   require calls the loader with a single argument, modname. */

	var retval = loader.call([modname])[0];

	/*= If the loader returns any value,
    	   require assigns the returned value to package.loaded[modname]. */
	if (retval)
		_package.loaded.setIndex(modname, retval);
	else {
	  /*= If the loader returns no value 
		   and has not assigned any value to package.loaded[modname],
     		 then require assigns true to this entry. */
		if (_package.loaded.index(modname).type == 'nil') {
		  _package.loaded.setIndex(modname, this.LValue(true));
	  }
	}

	/*= In any case,
    	   require returns the final value of package.loaded[modname]. */
	  return [_package.loaded.index(modname)];

	/*= If there is any error loading or running the module,
         or if it cannot find any loader for the module,
	      then require signals an error. */
	//= /lua.org
	}
	_G.setIndex(testvm.LValue("module"), testvm.LValue(lua_module));
	_G.setIndex(testvm.LValue("require"), testvm.LValue(lua_require));
	return _G;
  }
  exports.luaopen_module51 = luaopen_module51;
  return exports;
})(typeof exports == 'object' ? exports : typeof window == 'object' ? window : {} );
	
