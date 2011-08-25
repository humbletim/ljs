// ljs.browserlua.js Released under MIT/X11 license
// Copyright (C) 2011 Tim Dedischew
// see: https://github.com/humbletim/ljs
// see: https://github.com/agladysh/browser-lua

if (typeof times == 'object')
  times.browserluaseen = new Date().getTime();

//== -- BROWSERLUA --
var BrowserLua = {
  _filez: {}, // to be populated by .luac.js script includes

   //== BrowserLua.provideFile(path, file_contents_string)
   provideFile: function(path, file_contents_string) {
	 if (typeof times == 'object')
	   times["provideFile called:"+path] = new Date().getTime();
	 this._filez[path] = file_contents_string;
   }
};
//== -- /BROWSERLUA --

//== -- BROWSERLUA --

// ------- yueliang bootstrapping
BrowserLua._init_evalString = function() {
  if (BrowserLua.evalString)
	throw "BrowserLua._init_evalString: .evalString already exists";

  if (typeof times == 'object')
	times._init_evalString_start = new Date().getTime();

  // FIXME: redo once module system is figured out...
  BrowserLua.VM._setpreload("yueliang", BrowserLua._loadmodule);
  BrowserLua._G.value.require.call([BrowserLua.VM.LValue("yueliang")]);
  // bootstrap frexp
  (function(_G, testvm) {
	_G.value.math.setIndex(testvm.LValue("frexp"),
						   _G._packageloaded.index(
							 testvm.LValue("./misc/frexp")
						   ).index(testvm.LValue("frexp")));
  })(BrowserLua._G, BrowserLua.VM);
  
  // set top-level global compilestring, so can leverage .callLua
  BrowserLua._G.value.compilestring = BrowserLua._G.value.yueliang.value.compilestring;
  BrowserLua._bytecodecache = {};
  BrowserLua.evalString = function(luacode, name) {
	name = name || "=BrowserLua.evalString";
	var jsret = [];
	var old = BrowserLua._setoutput(function(s) {
	  domoutput("> "+s);
	  });
	BrowserLua._pcall(
	  function(){
		var iOPS = BrowserLua.VM.OPS;
		var itime = new Date().getTime();
		BrowserLua._bytecodecache[luacode] = 
		  BrowserLua._bytecodecache[luacode] || 
		  BrowserLua.callLua("compilestring", luacode, name)[0];
		var bytecode = BrowserLua._bytecodecache[luacode];
		BrowserLua._lastcompileOPS = BrowserLua.VM.OPS - iOPS;
		BrowserLua._lastcompilems = (new Date().getTime() - itime);
		iOPS = BrowserLua.VM.OPS;
		itime = new Date().getTime();
		var ret = BrowserLua.doString(bytecode);
		BrowserLua._lastdoOPS = BrowserLua.VM.OPS - iOPS;
		BrowserLua._lastdoms = (new Date().getTime() - itime);
		for (var i=0; i < ret.length; i++)
		  jsret[i] = ret[i].value.toString();
	});
	BrowserLua._setoutput(old); // i do a lot of testing from Firebug, so reset
	return jsret;
  };
  
	if (typeof times != 'object' && typeof times != 'undefined') {
	  times = {
		start: new Date().getTime()
	  };
	}
  if (typeof times == 'object')
	times._init_evalString_end = new Date().getTime();
}
// ------- /yueliang

//== BrowserLua.init([enabled_backends])
BrowserLua.init = function() {

  BrowserLua.VM = new LVM();
  BrowserLua._G = openlibs(BrowserLua.VM);

  BrowserLua._loadmodule = function(NAME, _M) {
	// note: NAME will be require'NAME'
	var bytecode = BrowserLua._filez[NAME+".luac"];

	if (!bytecode)
	  throw "no file '"+NAME+".luac"+"'";

	var m = BrowserLua.VM.loadstring(bytecode, _M );

	var ret = this.vm.call(m, [this.vm.LValue(NAME)]); // calls main chunk

	//	console.warn("ret:",ret);
	return ret[0];
  };

  // hmmm
  BrowserLua._pcall = function(jsfunc) {
	try {
	  return jsfunc.apply(this, Array.prototype.slice.call(arguments,1));
	} catch(e) {
	  try {
		//sys.puts("caught error in ljs.BrowserLua._pcall..."+e);
		var trace = this.VM.traceback();
		var currframe = trace[0];
		if(currframe) {
		  sys.print("ljs.BrowserLua._pcall: "+
					currframe.sourceName+":"+currframe.line+": ");

		} else
		  sys.print("ljs.BrowserLua._pcall: <no frame>:");
		sys.puts(e);

		if(typeof(e) == "object" && "stack" in e)
		  sys.puts(e.stack);
 		else {
 		  sys.puts("stack traceback:");
 		  trace[trace.length-1].todo = "in main chunk";
 		  for (var i=0; i < trace.length; i++) {
 			sys.puts("\t"+trace[i].sourceName+":"+trace[i].line+": "+(trace[i].todo||"[todo]"));
			if (trace[i].sourceName == '?') break;
		  }
 		}
		//process.exit(1);
		this.VM.callstack = [];
	  } catch(e) { alert(e) };
	  //throw e;
	}
  };

  //== BrowserLua.doFile(path)
  BrowserLua.doFile = function(path) {
	if (!this._filez[path]) throw "<err>ljs.BrowserLua.doFile on non-provideFile'd: "+path+"</err>";
	BrowserLua.doString(BrowserLua._filez[path]);
  };


  //== BrowserLua.doString(lua_code, [chunkname])
  BrowserLua.doString = function(lua_code) {
	if (!/^\x1b\x4c\x75\x61\x51\x00/.test(lua_code))
	  throw "ljs.BrowserLua.doString only handles bytecode (no compiler)";
// 	return this._pcall(
// 	  function(){
		var testvm = this.VM;
		var _G = this._G;
		
		var f = testvm.loadstring(lua_code, _G);
		var arg = [];
		"arg1 arg2".replace(/\w+(\d)/g,
							function(x,n) {
							  var jsv = document.getElementById(x).value;
							  arg[n*1-1] = testvm.LValue(jsv);
							});

		var ret = testvm.call(f, arg);
		if(ret.length)
		  sys.puts("ljs Returned: "+sys.inspect(ret));
		return ret;
// 	  }
// 	);
  };

  //== BrowserLua.callLua(functionName, args, ...) --> array of return values
  BrowserLua.callLua = function(functionName) {
	//TODO: error/argument/type checking
	var lfunc = this._G.index(this.VM.LValue(functionName));
	var largs = [];
	for (var i=1; i < arguments.length; i++)
	  largs.push(this.VM.LValue(arguments[i]));
	var ret = this.VM.call(lfunc, largs);
	var jsret = [];
	for (var i=0; i < ret.length; i++)
	  jsret[i] = ret[i].value;
	return jsret;
  };
//== -- /BROWSERLUA --

  // hmmmmmmm
  BrowserLua._getglobal = function(name) {
	return this._G.index(this.VM.LValue(name));
  };
  BrowserLua._setoutput = function(jsfunc) {
	var old = stubs.sys._outputline;
	stubs.sys._outputline = jsfunc;
	return old;
  };
};

